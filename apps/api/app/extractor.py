"""Small, in-memory document extraction helpers."""

from __future__ import annotations

import warnings
from io import BytesIO
from pathlib import Path

import pytesseract
from PIL import Image, ImageOps, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.errors import PdfReadError

MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024

PDF_CONTENT_TYPES = {"application/pdf"}
IMAGE_CONTENT_TYPES = {
    "image/bmp",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
}


class UnsupportedDocumentError(ValueError):
    """Raised when an upload is not one of the supported document types."""


class DocumentExtractionError(ValueError):
    """Raised when a supported document cannot be read."""


def extract_document_text(
    contents: bytes, *, content_type: str, filename: str
) -> str:
    """Extract text from a supported PDF or image byte string."""

    normalized_type = content_type.partition(";")[0].strip().lower()
    suffix = Path(filename).suffix.lower()

    if normalized_type in PDF_CONTENT_TYPES or (
        normalized_type in {"", "application/octet-stream"} and suffix == ".pdf"
    ):
        return _extract_pdf_text(contents)

    if normalized_type in IMAGE_CONTENT_TYPES or (
        normalized_type in {"", "application/octet-stream"}
        and suffix in {".bmp", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}
    ):
        return _extract_image_text(contents)

    raise UnsupportedDocumentError(
        "Unsupported file type. Upload a PDF, PNG, JPEG, WebP, TIFF, or BMP image."
    )


def _extract_pdf_text(contents: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(contents))
        page_text = [page.extract_text().strip() for page in reader.pages]
    except (PdfReadError, OSError, ValueError) as exc:
        raise DocumentExtractionError(
            "The PDF could not be read. It may be damaged or password-protected."
        ) from exc

    return "\n\n".join(text for text in page_text if text)


def _extract_image_text(contents: bytes) -> str:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(contents)) as source:
                source.load()
                image = ImageOps.exif_transpose(source).convert("RGB")
                return pytesseract.image_to_string(image).strip()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise DocumentExtractionError(
            "The image dimensions are too large to process safely."
        ) from exc
    except UnidentifiedImageError as exc:
        raise DocumentExtractionError(
            "The image could not be read. It may be damaged or use an unsupported format."
        ) from exc
    except (OSError, RuntimeError, pytesseract.TesseractError) as exc:
        raise DocumentExtractionError("OCR could not process this image.") from exc
