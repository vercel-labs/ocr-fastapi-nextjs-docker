from __future__ import annotations

import asyncio
import sys
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, UploadFile
from PIL import Image
from pypdf import PdfWriter
from starlette.datastructures import Headers

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.extractor import (  # noqa: E402
    MAX_FILE_SIZE_BYTES,
    UnsupportedDocumentError,
    extract_document_text,
)
from app.main import extract, health  # noqa: E402


def make_pdf() -> bytes:
    stream = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.write(stream)
    return stream.getvalue()


def make_png() -> bytes:
    stream = BytesIO()
    Image.new("RGB", (160, 60), "white").save(stream, format="PNG")
    return stream.getvalue()


def make_upload(filename: str, content_type: str, contents: bytes) -> UploadFile:
    return UploadFile(
        file=BytesIO(contents),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


class ExtractorTests(unittest.TestCase):
    def test_extracts_a_valid_pdf(self) -> None:
        text = extract_document_text(
            make_pdf(), content_type="application/pdf", filename="blank.pdf"
        )
        self.assertEqual(text, "")

    @patch("app.extractor.pytesseract.image_to_string", return_value="Hello OCR")
    def test_hands_a_decoded_image_to_tesseract(self, image_to_string) -> None:
        text = extract_document_text(
            make_png(), content_type="image/png", filename="scan.png"
        )
        self.assertEqual(text, "Hello OCR")
        self.assertEqual(image_to_string.call_args.args[0].mode, "RGB")

    def test_rejects_an_unsupported_type(self) -> None:
        with self.assertRaises(UnsupportedDocumentError):
            extract_document_text(
                b"plain text", content_type="text/plain", filename="notes.txt"
            )

    def test_health_response(self) -> None:
        response = asyncio.run(health())
        self.assertEqual(response.status, "ok")

    def test_extract_endpoint_returns_metadata(self) -> None:
        contents = make_pdf()
        response = asyncio.run(
            extract(make_upload("blank.pdf", "application/pdf", contents))
        )
        self.assertEqual(response.filename, "blank.pdf")
        self.assertEqual(response.content_type, "application/pdf")
        self.assertEqual(response.size_bytes, len(contents))
        self.assertEqual(response.text, "")

    def test_extract_endpoint_enforces_upload_limit(self) -> None:
        upload = make_upload(
            "large.pdf",
            "application/pdf",
            b"x" * (MAX_FILE_SIZE_BYTES + 1),
        )

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(extract(upload))

        self.assertEqual(raised.exception.status_code, 413)


if __name__ == "__main__":
    unittest.main()
