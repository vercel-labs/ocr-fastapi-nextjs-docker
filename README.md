# OCR with FastAPI, Next.js, and Docker

A minimal document extraction application built as two services in one Vercel
project:

- A Next.js frontend for selecting a document and displaying its metadata and
  extracted text.
- A containerized FastAPI backend that parses PDFs with `pypdf` and performs
  image OCR with Tesseract.

Uploads are processed for the current request and are not persisted to a Blob
store or database. The API accepts PDF, PNG, JPEG, WebP, TIFF, and BMP files up
to 4 MB.

## Project structure

```text
.
├── apps
│   ├── api
│   │   ├── app
│   │   │   ├── __init__.py
│   │   │   ├── extractor.py       # PDF and image extraction
│   │   │   └── main.py            # FastAPI routes and validation
│   │   ├── tests
│   │   │   └── test_extractor.py
│   │   ├── Dockerfile.vercel      # Python and Tesseract image
│   │   └── requirements.txt
│   └── web
│       ├── app
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── components
│       │   └── upload-workbench.tsx
│       ├── next.config.ts
│       └── package.json
├── vercel.json                    # Services and public routing
└── README.md
```

## Prerequisites

- Docker Desktop or another Docker-compatible runtime
- Node.js 20 or newer and npm
- Vercel CLI for the combined local workflow
- Python 3.12 or newer only if you want to run backend tests outside Docker

## Run both services with Vercel CLI

Start Docker, then run this command from the repository root:

```bash
vercel dev -L
```

The `-L` flag runs the Services project locally without requiring a linked
Vercel project.

## Run the services separately

Build and start the FastAPI container from the repository root:

```bash
docker build -f apps/api/Dockerfile.vercel -t ocr-fastapi-api apps/api
docker run --rm -p 8000:8000 -e PORT=8000 ocr-fastapi-api
```

In another terminal, install and start the frontend:

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). During local Next.js
development, `/api/*` is proxied to `http://127.0.0.1:8000`. Set `API_ORIGIN`
before starting Next.js if your backend uses a different origin.

## API reference

```text
GET  /api/health
POST /api/extract
```

`POST /api/extract` expects multipart form data with one field named `file`.
A successful response has this shape:

```json
{
  "filename": "sample.pdf",
  "content_type": "application/pdf",
  "size_bytes": 123456,
  "text": "Extracted document text..."
}
```

The PDF path extracts embedded text. Scanned PDFs are not OCRed in this version;
export scanned pages as images to use Tesseract OCR.

## Run checks

Frontend checks:

```bash
cd apps/web
npm install
npm run typecheck
npm run build
```

Backend tests:

```bash
python3 -m venv .venv
.venv/bin/pip install -r apps/api/requirements.txt
PYTHONPATH=apps/api .venv/bin/python -m unittest discover -s apps/api/tests -v
```

## Deploy to Vercel

1. Import the repository as one Vercel project.
2. Set the project framework to **Services** under **Build and Deployment**.
3. Deploy from the repository root.
4. Verify `/api/health`, then upload a PDF and an image from the UI.

The top-level `vercel.json` sends `/api/*` to the FastAPI container and all
other paths to Next.js. Vercel preserves the original request path, so the
backend routes include the `/api` prefix.

Vercel Services is a Beta feature. This template intentionally omits persistent
file storage.

## Current upload limit and next steps

Vercel Functions limit request and response bodies to 4.5 MB. Since a multipart
request adds a small amount of overhead around the file, this template caps
direct uploads at 4 MB.

For larger documents, upload from the browser directly to
[Vercel Blob](https://vercel.com/docs/vercel-blob/client-upload), then send the
Blob URL to the extraction API. The backend can download, process, and delete
the object after extraction if persistent storage is not required. This keeps
the large file body out of the function request.
