"""FastAPI application for document text extraction."""

from __future__ import annotations

from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.extractor import (
    MAX_FILE_SIZE_BYTES,
    DocumentExtractionError,
    UnsupportedDocumentError,
    extract_document_text,
)

app = FastAPI(
    title="Minimal Document Extractor",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)


class HealthResponse(BaseModel):
    status: str


class ExtractionResponse(BaseModel):
    filename: str
    content_type: str
    size_bytes: int
    text: str


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/api/extract", response_model=ExtractionResponse)
async def extract(
    file: Annotated[
        UploadFile,
        File(description="A PDF or image document, up to 4 MB"),
    ],
) -> ExtractionResponse:
    filename = file.filename or "untitled-upload"
    content_type = file.content_type or "application/octet-stream"

    try:
        contents = await file.read(MAX_FILE_SIZE_BYTES + 1)
    finally:
        await file.close()

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="The uploaded file exceeds the 4 MB direct-upload limit.",
        )

    try:
        text = await run_in_threadpool(
            extract_document_text,
            contents,
            content_type=content_type,
            filename=filename,
        )
    except UnsupportedDocumentError as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        ) from exc
    except DocumentExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    return ExtractionResponse(
        filename=filename,
        content_type=content_type,
        size_bytes=len(contents),
        text=text,
    )
