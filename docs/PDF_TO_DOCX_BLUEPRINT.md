# PDF to DOCX Conversion System — Technical Blueprint

Production-grade specification for a multi-page PDF → structured DOCX conversion system. Target accuracy: 95–99%. Preserve layout, reading order, paragraph formatting, tables, and images. No installation on user machines; everything runs via web frontend and optionally backend.

---

## 1. Architecture Overview

### 1.1 High-Level Stack

| Layer | Technology | Notes |
|-------|------------|--------|
| **Frontend** | Vite + React + TypeScript | SPA, drag & drop, progress, download |
| **Backend** | Python (FastAPI) | Optional; GPU support for OCR/layout models |
| **Pipeline** | Hybrid: page + region-level analysis | Text, image, table, header/footer, captions, formulas |

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Vite + React)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Drag & Drop │  │ File Validate │  │ Progress Bar │  │ Download DOCX Button │  │
│  │   Upload     │  │ (type, size)   │  │ (stages)     │  │                      │  │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                                    │                     │              │
│         └────────────────────────────────────┼─────────────────────┘              │
│                                              │ REST / WebSocket                    │
└──────────────────────────────────────────────┼────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (FastAPI, optional)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Receive PDF  │  │ Temp Storage  │  │ Worker Queue  │  │ DOCX Generation      │  │
│  │ (multipart)  │  │ (auto-delete) │  │ (Celery/Redis)│  │ (python-docx)        │  │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼────────────────────────────────────┼─────────────────────┼─────────────┘
          │                                    │                     │
          ▼                                    ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PDF → DOCX PIPELINE (ASCII FLOW)                         │
│                                                                                  │
│  PDF Upload → Page Split → Layout Detection → Region Classification              │
│       → Per-region Extraction (text / OCR / table) → Post-processing             │
│       → Layout Reconstruction → DOCX Generation → Download                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Pipeline Flow (ASCII)

```
PDF upload
    │
    ▼
Page Split (pdf2image / PyMuPDF / pdfjs)
    │
    ▼
Layout Detection (per-page: regions = text | image | table | header | footer | caption | formula)
    │
    ▼
Region Classification (ML or rule-based: coordinates, type)
    │
    ▼
Per-region Extraction
    ├── Text blocks   → PDF parser (PDFium, pdfplumber)
    ├── Image blocks  → OCR (Tesseract, PaddleOCR, ABBYY)
    ├── Table blocks  → Table lib (Camelot, Tabula, Paddle Table)
    └── Mixed         → combined parsing + OCR
    │
    ▼
Post-processing (reading order, merge adjacent text, clean whitespace)
    │
    ▼
Layout Reconstruction (paragraphs, tables, images in order)
    │
    ▼
DOCX Generation (python-docx / docx npm)
    │
    ▼
Download (blob / signed URL)
```

---

## 2. Component Details

### 2.1 Frontend

- **Drag & drop** PDF upload; single file (or chunked for large files).
- **Validation**: file type `application/pdf`, max size (e.g. 50 MB); show clear errors.
- **Progress**: stages (upload → split → layout → extract → docx) with percentage or step labels.
- **Download**: trigger download of resulting DOCX (same base name, `.docx`).
- **Communication**: REST `POST /convert` with `multipart/form-data`, or WebSocket for long-running jobs and progress.
- **Responsive**: mobile and desktop; touch-friendly buttons, readable text, no horizontal scroll.

### 2.2 Backend (Optional)

- **Receive PDF**: FastAPI endpoint, `File(...)`, size limit, optional virus scan.
- **Page rendering**: Render each page to image (e.g. 150 DPI) for layout/OCR.
- **Layout detection**: Model or heuristics to output regions with type and bbox.
- **Per-region extraction**: Dispatch to text extractor, OCR, or table engine.
- **DOCX generation**: Build document from unified content blocks (paragraphs, tables, images).
- **Temp storage**: Write to temp dir; delete after response or TTL (e.g. 1 hour).
- **Async**: Use Celery + Redis (or RQ) for large PDFs; return job ID, poll status, then download.
- **GPU**: Use GPU for OCR/layout models if available (CUDA).

### 2.3 Client-Only Fallback (Current Implementation)

- **PDF.js** (pdfjs-dist): load PDF, get text per page via `getTextContent()`.
- **docx** (npm): build Document with sections, Paragraphs, TextRuns, PageBreaks.
- **Limitation**: No layout/tables/images/OCR; text-only, best-effort reading order. Suitable when no backend is deployed.

---

## 3. Library and Model Choices

| Concern | Option | Justification |
|--------|--------|----------------|
| **PDF text** | pdfplumber, PDFium, pdfjs | pdfplumber/PDFium for Python; pdfjs in browser. |
| **Page → image** | pdf2image (poppler), PyMuPDF | Reliable rendering for layout/OCR. |
| **Layout detection** | LayoutLM, DocTR, custom YOLO, or rule-based | Balance accuracy vs. latency and GPU. |
| **OCR** | Tesseract, PaddleOCR, ABBYY | PaddleOCR good accuracy/speed; Tesseract widely used. |
| **Tables** | Camelot, Tabula, Paddle Table | Camelot/Tabula for grids; Paddle for complex tables. |
| **DOCX (backend)** | python-docx | Standard for programmatic DOCX in Python. |
| **DOCX (frontend)** | docx (npm) | Used in browser for client-side DOCX. |

---

## 4. Data Structures (JSON Schemas)

Defined in `src/types/pdfToWord.ts` and aligned with backend:

```ts
// Region type
type RegionType = 'text' | 'image' | 'table' | 'header' | 'footer' | 'caption' | 'formula';

// Bounding box (normalized or pixel)
interface BoundingBox { x: number; y: number; width: number; height: number; }

// Layout block from detection
interface LayoutBlock {
  type: RegionType;
  coordinates: BoundingBox;
  pageNumber: number;
}

// OCR result per region
interface OCRResult {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

// Table extraction result
interface TableResult {
  data: string[][];
  coordinates: BoundingBox;
}

// Unified block for DOCX assembly
interface UnifiedContentBlock {
  type: RegionType;
  content: string | string[][] | { base64?: string; alt?: string };
  formatting?: Record<string, unknown>;
  position: { page: number; bbox: BoundingBox };
}

// Progress for UI
interface ConversionProgress {
  stage: 'upload' | 'split' | 'layout' | 'extract' | 'merge' | 'docx';
  progress: number;
  message?: string;
}
```

---

## 5. Code Examples

### 5.1 FastAPI File Upload Endpoint

```python
from fastapi import APIRouter, File, UploadFile, HTTPException

router = APIRouter()
MAX_SIZE = 50 * 1024 * 1024  # 50 MB

@router.post("/convert")
async def convert_pdf_to_docx(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF allowed")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "File too large")
    # ... run pipeline, write temp DOCX, return FileResponse or stream
    return FileResponse(path, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        filename="output.docx")
```

### 5.2 Frontend Request to Backend

```ts
const formData = new FormData();
formData.append('file', pdfFile);
const res = await fetch(`${API_URL}/convert`, { method: 'POST', body: formData });
if (!res.ok) throw new Error(await res.text());
const blob = await res.blob();
downloadBlob(blob, `${baseName}.docx`);
```

### 5.3 Client-Side Text Extraction + DOCX (Current)

- See `src/hooks/usePDFToWord.ts`: uses `pdfjs-dist` `getDocument` + `getTextContent()` per page, then `docx` `Document`, `Paragraph`, `TextRun`, `PageBreak`, `Packer.toBlob()`.

---

## 6. Scalability & Performance

- **Large PDFs**: Chunked upload, async job queue (Celery/Redis), poll status endpoint, then download when ready.
- **Worker queues**: Celery + Redis (or RQ); one worker per job; optional GPU worker pool for OCR.
- **GPU**: Use CUDA for PaddleOCR/layout models; single GPU can serve multiple small PDFs via batching.
- **Caching**: Hash first N bytes (or full file) of PDF; if same file converted recently, return cached DOCX URL (with TTL).

---

## 7. Security

- **HTTPS**: All traffic over TLS.
- **File size limits**: Enforce server-side (e.g. 50 MB).
- **Virus scanning**: Optional ClamAV or cloud scan before processing.
- **Temp storage**: Write to temp dir; delete after send or after TTL (e.g. 1 hour); no permanent storage of user files.
- **Input validation**: Reject non-PDF MIME and extensions.

---

## 8. Accuracy Considerations and Trade-offs

| Approach | Accuracy | Layout/Tables/Images | Speed | Dependency |
|----------|----------|----------------------|-------|-------------|
| Client-only (PDF.js + docx) | ~70–85% text | No | Fast | None |
| Backend (full pipeline) | 95–99% | Yes | Slower | Server, GPU optional |
| OCR on scanned PDFs | Depends on OCR model | Yes (as text/image) | Slower | Backend + OCR |

- **Text PDFs**: Prefer native text extraction over OCR.
- **Scanned PDFs**: Require OCR; quality depends on resolution and language.
- **Tables**: Dedicated table detection + extraction improves fidelity.
- **Reading order**: Layout model or geometric sort (e.g. top-to-bottom, left-to-right) to order blocks.

---

## 9. Deliverable Checklist

- [x] Architecture diagram
- [x] Component description (frontend, backend, pipeline)
- [x] Library and model choices
- [x] Data structures (TypeScript/JSON)
- [x] Pipeline flow (ASCII)
- [x] Minimal code snippets (backend + frontend)
- [x] Scalability (queues, GPU, caching)
- [x] Security (HTTPS, limits, temp, no permanent storage)
- [x] Accuracy and trade-offs

This blueprint is ready to use as the project specification for implementing or extending the PDF-to-DOCX system (frontend already implemented; backend and full pipeline can be added following this document).
