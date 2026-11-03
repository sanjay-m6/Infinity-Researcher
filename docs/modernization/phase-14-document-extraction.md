# Phase 14 Document Extraction & Text Processing

## 1. Overview

Accurate paper understanding relies directly on high-fidelity document text extraction. Academic manuscripts feature complex formatting—two-column layouts, mathematical equations, nested tables, captions, footnotes, and citation brackets—that challenge naive text extraction.

Phase 14 refines the text ingestion pipeline across the Rust backend and Python engine to ensure clean section demarcation, heading identification, and noise removal.

---

## 2. Ingestion Pipeline

### 2.1 Extraction Flow

```mermaid
flowchart LR
    PDF["Academic PDF"] --> Extractor["PDF Extraction Engine<br/>(lopdf / pdf-rs / PyMuPDF)"]
    Extractor --> Normalizer["Layout & Whitespace Normalizer"]
    Normalizer --> HeaderDetector["Section Heading Detector"]
    HeaderDetector --> BoundaryChunker["Boundary-Aware Chunker"]
    BoundaryChunker --> FTSIndex[("FTS5 Indexed Storage")]
```

### 2.2 Text Normalization Techniques
1. **Hyphenation De-Wrapping**: Recombines line-broken compound words (e.g., `trans-\nformer` -> `transformer`).
2. **Whitespace Normalization**: Collapses multi-space formatting artifact runs while preserving paragraph breaks (`\n\n`).
3. **Control Character Stripping**: Removes non-printable ASCII and invalid UTF-8 codepoints that corrupt SQLite FTS indexing.
4. **Scanned PDF Detection**: If extracted text yields fewer than 50 characters per page across more than 3 pages, the system flags the document as a scanned image requiring OCR, preventing false empty-context answers.

---

## 3. Section Heading Heuristics

The extraction system recognizes standard academic section patterns:
- Numbered headers: `1. Introduction`, `3.2 Methodology`, `IV. Results`
- Canonical titles: `Abstract`, `Related Work`, `Experiments`, `Ablation Studies`, `Limitations`, `Conclusion`
- Font weight / size triggers: In structured PDF extractions, lines with distinct heading weights are tagged as `section_heading` on the resulting chunk.

---

## 4. Preservation of Mathematical and Tabular Data

Mathematical notation and tabular empirical results are critical for technical question answering:
- Inline LaTeX formulas (`$E = mc^2$`) and display formulas (`$$...$$`) are preserved verbatim.
- Tabular text is retained with column delimitation, enabling the Results Analysis module to accurately extract metrics, baselines, and condition splits.

