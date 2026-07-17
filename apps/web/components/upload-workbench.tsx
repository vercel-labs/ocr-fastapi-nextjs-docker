"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useId,
  useRef,
  useState,
} from "react";

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_FILE_TYPES =
  "application/pdf,image/png,image/jpeg,image/webp,image/tiff,image/bmp";

type ExtractionResult = {
  filename: string;
  content_type: string;
  size_bytes: number;
  text: string;
};

type Theme = "light" | "dark";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isExtractionResult(value: unknown): value is ExtractionResult {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ExtractionResult>;
  return (
    typeof candidate.filename === "string" &&
    typeof candidate.content_type === "string" &&
    typeof candidate.size_bytes === "number" &&
    typeof candidate.text === "string"
  );
}

export function UploadWorkbench() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  function selectFile(nextFile: File | null) {
    setResult(null);
    setError(null);
    setHasCopied(false);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setError(
        "This file is too large for direct processing on Vercel. Choose a file under 4 MB.",
      );
      return;
    }

    setFile(nextFile);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          payload &&
          typeof payload === "object" &&
          "detail" in payload &&
          typeof payload.detail === "string"
            ? payload.detail
            : "The document could not be processed. Please try another file.";
        throw new Error(detail);
      }

      if (!isExtractionResult(payload)) {
        throw new Error("The server returned an unexpected response.");
      }

      setResult(payload);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The document could not be processed.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyText() {
    if (!result?.text) return;

    try {
      await navigator.clipboard.writeText(result.text);
      setHasCopied(true);
    } catch {
      setError("Your browser could not copy the text automatically.");
    }
  }

  function clearFile() {
    setFile(null);
    setResult(null);
    setError(null);
    setHasCopied(false);
    setIsDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="topbar" aria-label="Folio document extractor">
        <div className="brand-lockup">
          <a className="brand" href="#top" aria-label="Folio home">
            Folio
          </a>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-detail">document extraction</span>
        </div>

        <div className="topbar-actions">
          <span className="persistence-badge">
            <span aria-hidden="true" />
            No persistence
          </span>
          <button
            className="theme-toggle"
            type="button"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            aria-pressed={theme === "dark"}
            onClick={() =>
              setTheme((currentTheme) =>
                currentTheme === "light" ? "dark" : "light",
              )
            }
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </header>

      <main className="content-shell" id="top">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-heading">
            <p className="eyebrow">Document utility · 01</p>
            <h1 id="page-title">
              Open the document.
              <br />
              <span>Keep the words.</span>
            </h1>
          </div>
          <p className="hero-copy">
            Drop in a PDF or image. Folio reads it once, returns the text, and
            forgets the file.
          </p>
        </section>

        <section className="workbench" aria-labelledby="workbench-title">
          <div className="workbench-bar">
            <h2 id="workbench-title">Extraction desk</h2>
            <span>PDF + image OCR</span>
          </div>

          <div className="workbench-grid">
            <form className="selection-panel" onSubmit={handleSubmit}>
              <PanelHeader number="01" label="Select" />

              <div className="selection-body">
                <label
                  className={`drop-zone${file ? " has-file" : ""}${
                    isDragging ? " is-dragging" : ""
                  }`}
                  htmlFor={inputId}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setIsDragging(false);
                    }
                  }}
                  onDrop={handleDrop}
                >
                  <input
                    ref={inputRef}
                    id={inputId}
                    className="visually-hidden"
                    type="file"
                    name="file"
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleFileChange}
                  />

                  {file ? (
                    <span className="picked-file">
                      <span className="picked-mark" aria-hidden="true">
                        <CheckIcon />
                      </span>
                      <strong>{file.name}</strong>
                      <small>
                        {file.type || "application/octet-stream"} ·{" "}
                        {formatBytes(file.size)}
                      </small>
                      <span className="change-file">Choose a different file</span>
                    </span>
                  ) : (
                    <span className="empty-picker">
                      <span className="upload-mark" aria-hidden="true">
                        <UploadIcon />
                      </span>
                      <strong>Drop a file or click to browse</strong>
                      <small>PDF · PNG · JPEG · WEBP · TIFF · BMP</small>
                    </span>
                  )}
                </label>

                <div className="action-row">
                  <button
                    className="extract-button"
                    type="submit"
                    disabled={!file || isLoading}
                  >
                    <span>{isLoading ? "Extracting…" : "Extract text"}</span>
                    {isLoading ? <SpinnerIcon /> : <ArrowIcon />}
                  </button>
                  <button
                    className="clear-button"
                    type="button"
                    onClick={clearFile}
                    disabled={isLoading}
                  >
                    Clear
                  </button>
                </div>

                <p className="privacy-note">
                  <span aria-hidden="true">✳</span>
                  Uploaded files are read in memory and discarded after the
                  response.
                </p>
              </div>
            </form>

            <section className="output-panel" aria-labelledby="result-heading">
              <PanelHeader number="02" label="Output" />
              <div className="output-body" aria-live="polite" aria-busy={isLoading}>
                {isLoading ? <LoadingState /> : null}
                {!isLoading && error ? <ErrorState message={error} /> : null}
                {!isLoading && !error && result ? (
                  <ResultState
                    result={result}
                    hasCopied={hasCopied}
                    onCopy={copyText}
                  />
                ) : null}
                {!isLoading && !error && !result ? <EmptyState /> : null}
              </div>
            </section>
          </div>
        </section>

        <footer className="site-footer">
          <span>No accounts · No archive · Files are processed in memory</span>
          <span>PDF · PNG · JPEG · WEBP · TIFF · BMP</span>
        </footer>
      </main>
    </div>
  );
}

function PanelHeader({ number, label }: { number: string; label: string }) {
  return (
    <div className="panel-header" aria-hidden="true">
      <span>{number}</span>
      <span>{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="state-message empty-state">
      <DocumentIcon />
      <h3 id="result-heading">No output yet</h3>
      <p>Select a file and run extraction to see the plain text here.</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="state-message loading-state" role="status">
      <span className="loading-mark" aria-hidden="true">
        <SpinnerIcon />
      </span>
      <h3 id="result-heading">Extracting text</h3>
      <p>Reading the document and preparing the plain-text output.</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="state-message error-state" role="alert">
      <span className="error-mark" aria-hidden="true">
        !
      </span>
      <h3 id="result-heading">Extraction failed</h3>
      <p>{message}</p>
    </div>
  );
}

function ResultState({
  result,
  hasCopied,
  onCopy,
}: {
  result: ExtractionResult;
  hasCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="result-state">
      <div className="result-heading-row">
        <div className="result-title">
          <span className="complete-label">
            <span aria-hidden="true" />
            Extraction complete
          </span>
          <h3 id="result-heading">{result.filename}</h3>
        </div>
        <span className="ready-badge">
          <span aria-hidden="true" />
          Ready
        </span>
      </div>

      <dl className="metadata-grid">
        <div>
          <dt>File</dt>
          <dd>{result.filename}</dd>
        </div>
        <div>
          <dt>MIME</dt>
          <dd>{result.content_type}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{formatBytes(result.size_bytes)}</dd>
        </div>
        <div>
          <dt>Characters</dt>
          <dd>{result.text.length.toLocaleString()}</dd>
        </div>
      </dl>

      <div className="text-output">
        <div className="text-output-bar">
          <span>Plain text</span>
          <button type="button" onClick={onCopy} disabled={!result.text}>
            <CopyIcon />
            {hasCopied ? "Copied" : "Copy text"}
          </button>
        </div>
        {result.text ? (
          <pre>{result.text}</pre>
        ) : (
          <p className="no-text">
            No selectable text was found. Export scanned PDF pages as images to
            run them through OCR.
          </p>
        )}
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 16V4m0 0L7 9m5-5 5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 17 17 7M17 7H9M17 7v8" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M20 12a8 8 0 0 0-8-8" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="document-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 2h6l6 6v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 15.2A7.7 7.7 0 0 1 8.8 5a7.8 7.8 0 1 0 10.2 10.2Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
