# Comprehensive Python Backend, Document Processing & Offline Fallback Audit

**Audit Date**: 2026-11-03  
**Auditor**: `explorer_survey_3` (teamwork_explorer subagent)  
**Target Repository**: `d:\Paper`  
**Working Directory**: `d:\Paper\python-engine` / `d:\Paper\src-tauri` / `d:\Paper\src`

---

## 1. Executive Summary

A comprehensive architectural, code-level, and empirical audit was conducted on the Python backend services, document processing pipelines, inter-process communication (IPC) contracts, offline fallbacks, and test suites across the Infinity Researcher repository.

### Key Audit Findings

1. **Python Engine Execution Model & Architecture**:
   - The Python backend lives in `python-engine/src/paper_scraper/` and functions as a dual-mode service: either as a standalone compiled PyInstaller binary (`src-tauri/binaries/paper-scraper-x86_64-pc-windows-msvc.exe`, 227.6 MB) with zero external Python runtime dependencies, or via a development fallback executing `python -m paper_scraper` via the host Python 3.10+ interpreter.
   - Communication between the Rust backend (`src-tauri/src/services/python_engine.rs`) and Python is mediated via **versioned JSON Lines (NDJSON) over standard I/O pipes (stdin/stdout)**, with diagnostics isolated strictly to `stderr`.

2. **Verified Critical Runtime Bug in Document Extraction**:
   - In `python-engine/src/paper_scraper/ai/signals.py` at line 59, `extract_document_file` crashes with:
     ```
     NameError: name 'replacement_count' is not defined. Did you mean: 'replacement_chars'?
     ```
     Variable `replacement_chars` is defined at line 58, but line 59 references undefined `replacement_count`. Any call to `extract_document_text` via the Python sidecar currently terminates with an unhandled exception.

3. **Document Extraction Gaps (PDF, DOCX, Scanned OCR)**:
   - **PDF**: Digital text layers are parsed using `PyMuPDF` (`fitz`) with fallbacks to `pypdf` or raw stream regex. Scanned/image-only PDFs have **no OCR fallback** (Tesseract and PaddleOCR are absent).
   - **DOCX**: The file extractor in `signals.py` treats non-PDF files as plain text. Reading binary `.docx` files via `open(..., encoding="latin1")` produces binary zip garbage. Standard library `zipfile` extraction of `word/document.xml` is missing.
   - **Frontend Disconnect**: In `CitationCheckerWorkspaceView.tsx`, `ReadabilityAnalyzerView.tsx`, and `ResearchIntegrityView.tsx`, file uploads use browser `FileReader.readAsText(file)` directly on `.pdf` and `.docx` files, resulting in corrupt text and bypassing the backend document extraction engine completely.

4. **Zero Cloud AI Calls in Python (100% Local / Scrapy / Statistical)**:
   - Python code makes **zero calls** to OpenAI, Anthropic, Gemini, or Hugging Face APIs. All cloud provider routing is handled exclusively in the Rust backend (`src-tauri/src/services/ai_provider_service.rs`).
   - Python AI functionality is strictly local, statistical, and analytical (`rapidfuzz`, standard library `math`, `re`, `psutil`, and optional local PyTorch for CUDA device inspection).

5. **Offline Fallback Resilience**:
   - When external cloud APIs are unavailable or offline, tools fall back to deterministic local rule engines (`applyLocalHeuristicRewriting` in `writingEngine.ts`, `applyDeterministicPolish`, and Rust local statistical heuristics in `python_engine.rs:954`).
   - Search scrapers handle network timeouts and blocked sources via structured `source.failed` / `job.completed_with_warnings` NDJSON events without freezing the desktop UI.

6. **Test Suite & Synthetic Test Fixture Audit**:
   - `pytest` executes via `python -m pytest python-engine/tests`. **All 109 existing unit tests pass cleanly in 28.81s**.
   - **Zero synthetic test documents (`.pdf`, `.docx`, `.txt`) exist** in repository test directories. Only 7 `.html` mock search fixtures exist in `python-engine/tests/fixtures/`.
   - `test_ai_module.py` only tests chunker and fine-tuning dataset leakage; it **does not test** `extract_document_file` or `compute_statistical_ai_signals`, which is why the `replacement_count` bug previously escaped detection.

---

## 2. Complete Inventory of Python Backend Services & Scripts

### 2.1 File Inventory

| Path | Primary Module / Class | Role & Description | Status |
|---|---|---|---|
| `python-engine/src/paper_scraper/__main__.py` | CLI Entry Point | Routes to `run_sidecar()` (stdin loop) or `run_worker_cli()` | **Functional** |
| `python-engine/src/paper_scraper/__init__.py` | Package Root | Version declaration and top-level package imports | **Functional** |
| `python-engine/src/paper_scraper/protocol.py` | `ProtocolEvent`, `emit_event` | NDJSON serialization, version header (`1.0.0`), UTF-8 stream reconfig | **Functional** |
| `python-engine/src/paper_scraper/models.py` | Pydantic Models | `PaperResult`, `QueryFilter`, `SourceDescriptor`, `RelevanceScoreBreakdown` | **Functional** |
| `python-engine/src/paper_scraper/security.py` | Security Engine | Anti-SSRF URL validator, private IP / loopback blocking, path sanitizer | **Functional** |
| `python-engine/src/paper_scraper/pdf.py` | `PdfManager`, `verify_pdf_signature` | `%PDF-` magic byte verification, HTML masquerade check, preview cache | **Functional** |
| `python-engine/src/paper_scraper/dedup.py` | Backwards Shim | Re-exports deduplication routines from `deduplication.dedup` | **Functional** |
| `python-engine/src/paper_scraper/deduplication/dedup.py` | `Deduplicator` | RapidFuzz token sort ratio (>=92% / >=96%), DOI normalization | **Functional** |
| `python-engine/src/paper_scraper/relevance.py` | Backwards Shim | Re-exports relevance scorer from `ranking.relevance` | **Functional** |
| `python-engine/src/paper_scraper/ranking/relevance.py` | `RelevanceScorer` | Term overlap, fuzzy title similarity, phrase boost, penalty weights | **Functional** |
| `python-engine/src/paper_scraper/ranking/source_ranker.py` | `SourceCandidateRanker` | Multi-source ranking, DOI matching, metadata quality filtering | **Functional** |
| `python-engine/src/paper_scraper/ranking/__init__.py` | Ranking Module Init | Re-exports ranker and relevance scorer | **Functional** |
| `python-engine/src/paper_scraper/engine.py` | Backwards Shim | Re-exports crawler engine components | **Functional** |
| `python-engine/src/paper_scraper/engine/crawler.py` | `ScrapySearchEngine` | Subprocess crawler lifecycle management, job cancellation | **Functional** |
| `python-engine/src/paper_scraper/engine/worker.py` | `CrawlerProcess` Worker | Isolated Scrapy process runner preventing Twisted reactor restart errors | **Functional** |
| `python-engine/src/paper_scraper/engine/settings.py` | `get_scrapy_settings` | Scrapy settings config, pipeline order, concurrency, timeouts | **Functional** |
| `python-engine/src/paper_scraper/engine/adapter_engine.py` | `AdapterSearchEngine` | Async HTTP search runner alternative using HTTPX adapters | **Functional** |
| `python-engine/src/paper_scraper/extractors/metadata.py` | `LayeredMetadataExtractor` | Highwire Press citation tags, Dublin Core, JSON-LD, OpenGraph | **Functional** |
| `python-engine/src/paper_scraper/extractors/pdf.py` | `PdfDiscoveryExtractor` | Discovers direct PDF URLs from HTML meta tags, links, and DOI patterns | **Functional** |
| `python-engine/src/paper_scraper/ai/__init__.py` | AI Subsystem Init | Exports chunkers, dataset splitters, signals, and file extractors | **Functional** |
| `python-engine/src/paper_scraper/ai/chunker.py` | `chunk_pdf_document`, `chunk_text_content` | Section-aware chunking with overlap (1200 chars / 150 overlap) via PyMuPDF/pypdf | **Functional** |
| `python-engine/src/paper_scraper/ai/finetuning.py` | `evaluate_hardware_capability`, `prepare_finetuning_dataset` | Hardware RAM/VRAM inspection, paper-level leakage-free split | **Functional** |
| `python-engine/src/paper_scraper/ai/signals.py` | `extract_document_file`, `compute_statistical_ai_signals` | Text extraction from documents & statistical cadence calculation | **BROKEN** (`NameError` at line 59; missing DOCX support) |
| `python-engine/src/paper_scraper/integration/runner.py` | `stdin_reader_loop`, `run_sidecar` | Stdin JSON Lines event reader, RPC dispatcher, async task coordinator | **Functional** |
| `python-engine/src/paper_scraper/integration/protocol.py` | `emit_response`, `emit_log` | Protocol versioning and response emitters | **Functional** |
| `python-engine/src/paper_scraper/adapters/` | `SourceRegistry`, 11 source adapters | Adapters for arXiv, bioRxiv, medRxiv, PubMed, PMC, PLOS, Nature, IEEE, Semantic Scholar, CORE, OpenAlex | **Functional** |
| `python-engine/src/paper_scraper/spiders/` | Scrapy Spiders | Production Scrapy spiders matching adapters | **Functional** |
| `python-engine/src/paper_scraper/browser/playwright_client.py` | `PlaywrightClient` | Headless browser client for JS-rendered scholarly pages | **Incomplete / Optional** |
| `python-engine/src/paper_scraper/jobs/state.py` | `JobStorage` | SQLite state store for search jobs | **Functional** |
| `python-engine/src/paper_scraper/middleware/` | Scrapy Middlewares | Anti-SSRF middleware, structured logging middleware, retry middleware | **Functional** |
| `python-engine/src/paper_scraper/pipelines/` | Scrapy Pipelines | Deduplication, validation, normalization, relevance scoring, storage | **Functional** |
| `scripts/build-python-sidecar.py` | Build Script | PyInstaller one-file packaging script for Windows MSVC target | **Functional** |
| `python-engine/paper-scraper-x86_64-pc-windows-msvc.spec` | PyInstaller Spec | PyInstaller build definition including datas and hidden imports | **Functional** |
| `scratch/update_lib.py` | Developer Scratch | One-off helper script modifying `src-tauri/src/lib.rs` | **Scratch / Deprecated** |

---

## 3. Rust <-> Python Interaction Mechanism & IPC Architecture

### 3.1 Dual-Mode Execution Strategy

The Rust backend coordinates the Python engine via `PythonEngineService` located in `src-tauri/src/services/python_engine.rs`:

```rust
// src-tauri/src/services/python_engine.rs:26-35
pub enum EngineExecutionPlan {
    /// Standalone packaged executable (PyInstaller sidecar with zero python dependencies)
    StandaloneBinary(PathBuf),
    /// Development fallback: system Python interpreter with python-engine module
    PythonModule {
        python_cmd: String,
        engine_dir: PathBuf,
    },
}
```

1. **Standalone Production Binary**:
   - Searches `src-tauri/binaries/paper-scraper-x86_64-pc-windows-msvc.exe`.
   - Built via PyInstaller; contains embedded Python 3.10+ runtime, Scrapy, lxml, RapidFuzz, PyMuPDF, and all dependencies.
   - Requires zero Python installation on end-user machines.
2. **Development Python Module Mode**:
   - In debug builds (`cfg!(debug_assertions)`), if a system Python command (`python` / `python3`) and `python-engine/src/paper_scraper/__init__.py` exist, it spawns `python -m paper_scraper` with working directory set to `python-engine/src`. This allows code edits to take effect without rebuilding the 227 MB binary.

### 3.2 IPC Communication Protocols

Communication operates over **standard I/O pipes (stdin/stdout)** using newline-delimited JSON (NDJSON):

#### 1. Asynchronous Streaming Search (`start_streaming_search`)
- **Request (stdin)**:
  ```json
  {
    "type": "start_search",
    "request_id": "req_session123",
    "job_id": "session123",
    "query": "quantum computing",
    "sources": ["arxiv", "pubmed"],
    "filters": { "year_start": 2022, "limit_per_source": 50 }
  }
  ```
- **Events (stdout)**:
  - `job.started`: Search session initialized.
  - `source.started`: Individual source query initiated.
  - `paper.discovered`: Emitted per paper discovered, translated directly to `SearchStreamEvent::PaperFound` and forwarded via Tauri event `search_stream_{session_id}`.
  - `source.completed` / `source.failed`: Individual source resolution.
  - `job.completed` / `job.no_results` / `job.completed_with_warnings`: Terminal events.
- **Cancellation**:
  - Writes `{"type": "cancel_search", "job_id": "..."}\n` to child stdin.
  - Gives 500ms grace window, then terminates child process if unclosed.

#### 2. Request-Response RPC Protocol (`execute_rpc`)
- Used for synchronous inspection, document text extraction, and stylometric AI signal detection:
  - Sends command message with unique `request_id` over stdin.
  - Sends immediate `{"type": "shutdown"}\n` signal to close stdin loop cleanly.
  - Reads stdout lines until message matching `reply_to == request_id` arrives (30-second timeout).
- Supported RPC message types in `runner.py`:
  - `extract_document_text` -> returns `extract_document_text_result`
  - `detect_ai_signals` -> returns `detect_ai_signals_result`
  - `chunk_pdf` -> returns `chunk_pdf_result`
  - `eval_hardware` -> returns `eval_hardware_result`
  - `prepare_finetuning_dataset` -> returns `prepare_finetuning_dataset_result`
  - `preview_pdf` -> returns `preview_pdf_result`
  - `handshake` / `list_sources` / `shutdown`

---

## 4. Functional, Broken, Incomplete, and Mock Analysis

### 4.1 Detailed Component Status Table

| Component | Location | Category | Detailed Finding | Impact |
|---|---|---|---|---|
| Document Text Extraction | `python-engine/src/paper_scraper/ai/signals.py:59` | **Broken** | `is_clean = replacement_count < 5` references undefined variable. Line 58 defines `replacement_chars`. | Calling `extract_document_text` crashes immediately with `NameError`. |
| DOCX Extraction | `python-engine/src/paper_scraper/ai/signals.py:45-54` | **Incomplete** | `.docx` files fall into plain-text reader (`open(..., encoding="latin1")`). No zip/XML parser. | Uploading `.docx` files returns raw binary zip bytes instead of text. |
| Scanned PDF OCR | `python-engine/src/paper_scraper/ai/signals.py:27-32` & `ai/chunker.py:79-82` | **Incomplete** | Text extraction only reads digital font streams via `fitz.get_text("text")`. No Tesseract/PaddleOCR integration. | Scanned PDFs yield empty text (`""`). User sees "no extractable text". |
| Analysis Job Runner | `src-tauri/src/commands/ai_tools.rs:126-157` | **Mock** | Background worker uses `tokio::time::sleep` (100ms, 150ms, 100ms) and completes with a static dummy JSON string. | Analysis jobs do not execute actual multi-stage analysis; they simulate progress with timers. |
| Corpus Fingerprinting | SQLite schema `0008` & `src-tauri` | **Incomplete / Disconnected** | `corpus_fingerprints` and `similarity_runs` tables exist in SQLite, but Rust has zero repository or service code querying them. | Plagiarism checking against full library text corpus cannot utilize DB schema. |
| Plagiarism Checker | `src/features/ai-tools/AiToolWorkspaceView.tsx:375-408` | **Incomplete** | Computes 4-gram overlap solely in memory against loaded `papers.map(p => p.title + p.abstract)`. | Ignores paper full-text content and backend SQLite corpus tables. |
| Research Tools File Upload | `src/features/citation-checker/`, `readability/`, `integrity/` | **Broken / Architecture Flaw** | File upload handlers use `FileReader.readAsText(file)` on `.pdf` and `.docx` files instead of sending files to `extract_document_text`. | PDFs and DOCXs uploaded in these 3 views get mangled into binary UTF-8 replacement chars. |
| AI Signal Detection | `python-engine/src/paper_scraper/ai/signals.py:72-153` | **Functional** | Sentence segmentation, mean sentence length, variance, burstiness ($std\_dev / mean$), and lexical diversity ($TTR$). | Fully functional statistical calculations with truthful uncertainty caveats. |
| Section-Aware Chunker | `python-engine/src/paper_scraper/ai/chunker.py:61-139` | **Functional** | Regex heading detection, page attribution, sliding window chunking with token estimation. | Functional; relies on PyMuPDF when installed. |
| Hardware & Fine-Tuning | `python-engine/src/paper_scraper/ai/finetuning.py` | **Functional** | GPU/CUDA VRAM check, RAM/disk check, Alpaca document-level split preventing leakage. | Functional evaluation routines. |
| Search Scraping Engine | `python-engine/src/paper_scraper/engine/` | **Functional** | Scrapy spiders and HTTPX adapters with deduplication, ranking, and anti-SSRF. | 109/109 pytest tests passing. |

### 4.2 Verified Runtime Bug: `signals.py:59` NameError

Empirical reproduction of the bug via Python interpreter:
```powershell
$env:PYTHONPATH="d:\Paper\python-engine\src"
python -c "from paper_scraper.ai.signals import extract_document_file; extract_document_file('d:/Paper/README.md')"
```
**Output**:
```
Traceback (most recent call last):
  File "<string>", line 1, in <module>
  File "d:\Paper\python-engine\src\paper_scraper\ai\signals.py", line 59, in extract_document_file
    is_clean = replacement_count < 5
               ^^^^^^^^^^^^^^^^^
NameError: name 'replacement_count' is not defined. Did you mean: 'replacement_chars'?
```
**Fix Required**:
In `python-engine/src/paper_scraper/ai/signals.py`:
```python
# Before (line 58-59):
replacement_chars = raw_text.count("\ufffd")
is_clean = replacement_count < 5

# After:
replacement_chars = raw_text.count("\ufffd")
is_clean = replacement_chars < 5
```

---

## 5. Offline Fallback & Dependency Analysis

### 5.1 External Cloud AI APIs Audit

| Provider | Endpoint URL | Called in Python? | Called in Rust? | Called in Frontend? |
|---|---|---|---|---|
| OpenAI | `https://api.openai.com/v1` | **No** | Yes (`ai_provider_service.rs`) | Via desktop-api |
| Anthropic | `https://api.anthropic.com/v1` | **No** | Yes (`ai_provider_service.rs`) | Via desktop-api |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | **No** | Yes (`ai_provider_service.rs`) | Via desktop-api |
| GroqCloud | `https://api.groq.com/openai/v1` | **No** | Yes (`ai_provider_service.rs`) | Via desktop-api |
| Hugging Face | `https://api-inference.huggingface.co` | **No** | Yes (`ai_provider_service.rs`) | Via desktop-api |
| Cerebras / NVIDIA NIM | Various Cloud Endpoints | **No** | Yes (`ai_provider_service.rs`) | Via desktop-api |

### 5.2 Offline Behavior When Internet or API Keys Are Missing

1. **Python Scraper & Document Processor**:
   - Document extraction (`extract_document_file`) and AI stylometric signal detection (`compute_statistical_ai_signals`) require **zero internet connectivity and zero API keys**.
   - If an online search is executed while offline, network requests timeout or fail in HTTPX/Scrapy, emitting `source.failed` events with clean categorization (`network_error`). The search completes gracefully with `job.completed_with_warnings` or `job.failed`.
2. **Writing Workspace (AI Humanizer, Academic Assistant, Paraphraser)**:
   - In `src/features/writing-workspace/writingEngine.ts:491`, if the remote or local LLM call fails or times out, it automatically catches the error and falls back to `applyLocalHeuristicRewriting(text, toolType, modeId)`.
   - This fallback is 100% on-device, rule-based, deterministic, zero-RAM, and guarantees preservation of all invariant tokens, citations, and formulas.
3. **Rust AI Signal Detection Fallback**:
   - In `src-tauri/src/services/python_engine.rs:954-1006`, if the Python sidecar process fails to respond or crashes, Rust catches the error and executes an internal native Rust statistical cadence heuristic:
     ```rust
     let burstiness = if mean_len + std_dev > 0.0 {
         (std_dev - mean_len) / (std_dev + mean_len)
     } else {
         0.0
     };
     ```
     This ensures the frontend receives valid results even if Python is completely absent.
4. **Readability & Citation Checker**:
   - Readability analysis (`readabilityEngine.ts`) is 100% offline, executing classical algorithmic equations in TypeScript.
   - Citation checking (`citationParser.ts`, `consistencyEngine.ts`, `doiValidator.ts`) parses in-text citation markers and checks bibliography consistency entirely offline using regex and string metrics.

### 5.3 Local System Binary Dependencies Audit

| Binary Dependency | Required for Core Operation? | Present on Host System? | Fallback Behavior When Missing |
|---|---|---|---|
| **Tesseract OCR** | No (optional for scanned PDFs) | **No** | Files without digital text return empty text; flagged as `no_text` or `is_scanned: true`. |
| **Poppler** (`pdftotext`, `pdftoppm`) | No | **No** | Pure Rust (`lopdf`) and pure Python (`PyMuPDF`) are used instead. |
| **Pandoc** | No | **No** | Markdown, LaTeX, and text parsed natively. |
| **Python Sidecar Executable** (`paper-scraper-x86_64-pc-windows-msvc.exe`) | Yes (production bundle) | **Yes** (`src-tauri/binaries/`, 227 MB) | Falls back to system Python interpreter (`python -m paper_scraper`). If both missing, Rust heuristic fallback activates. |
| **Python Interpreter** (`python.exe`) | Yes (development mode) | **Yes** (Python 3.14.3 in PATH) | Standalone binary used if system Python not found. |

### 5.4 Python Package Dependencies & Environment Audit

Inspection of `python-engine/pyproject.toml` revealed several discrepancy gaps:

```toml
# python-engine/pyproject.toml
dependencies = [
    "scrapy>=2.11.0",
    "lxml>=5.0.0",
    "httpx>=0.27.0",
    "beautifulsoup4>=4.12.0",
    "soupsieve>=2.5",
    "pydantic>=2.7.0",
    "rapidfuzz>=3.9.0",
]
```

**Discrepancies & Gaps**:
1. **Missing from `pyproject.toml` dependencies**:
   - `pymupdf` (imported in `ai/signals.py:27` and `ai/chunker.py:79`)
   - `psutil` (imported in `ai/finetuning.py:25`)
   - `torch` (imported dynamically in `ai/finetuning.py:44`)
2. **Missing DOCX support library**:
   - `python-docx` is not listed in `pyproject.toml` and is not installed in the Python environment.
3. **Environment Command Path**:
   - While `pytest 9.1.1` is installed in the Python 3.14 site-packages, the standalone `pytest.exe` wrapper is not in system PATH. Invoking `pytest` directly fails; invoking `python -m pytest` succeeds.

---

## 6. Test Setup & Synthetic Test Fixture Audit

### 6.1 Pytest Test Suite Execution

Pytest execution was validated using `python -m pytest d:\Paper\python-engine\tests`:

```
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.1.1, pluggy-1.7.0
rootdir: d:\Paper\python-engine
configfile: pyproject.toml
plugins: anyio-4.13.0, platformdirs-4.13.5, asyncio-1.4.0, respx-0.23.1
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_test_loop_scope=function
collected 109 items

python-engine\tests\test_adapters.py ......                              [  5%]
python-engine\tests\test_ai_module.py ....                               [  9%]
python-engine\tests\test_candidate_expansion.py .....                    [ 13%]
python-engine\tests\test_dedup.py ....                                   [ 17%]
python-engine\tests\test_engine.py .....                                 [ 22%]
python-engine\tests\test_engine_regression.py ..........                 [ 31%]
python-engine\tests\test_extractors.py ....                              [ 34%]
python-engine\tests\test_ieee_adapter.py ....                            [ 38%]
python-engine\tests\test_jobs.py .                                       [ 39%]
python-engine\tests\test_middleware.py .....                             [ 44%]
python-engine\tests\test_pdf.py ....                                     [ 47%]
python-engine\tests\test_pipelines.py .....                              [ 52%]
python-engine\tests\test_protocol.py .                                   [ 53%]
python-engine\tests\test_query_intelligence.py ......................... [ 76%]
python-engine\tests\test_relevance.py ....                               [ 79%]
python-engine\tests\test_scrapy_engine.py .....                          [ 84%]
python-engine\tests\test_security.py ....                                [ 88%]
python-engine\tests\test_source_ranker.py .........                      [ 96%]
python-engine\tests\test_spiders.py ....                                 [100%]

============================ 109 passed in 28.81s =============================
```

### 6.2 Test Coverage Analysis & Critical Gaps

While 109 tests pass, significant test coverage blind spots exist in `test_ai_module.py` and `test_pdf.py`:

1. **`test_ai_module.py`**:
   - Tests: `test_chunk_text_preserves_page_numbers_and_headings`, `test_hardware_evaluation`, `test_finetuning_dataset_leakage_prevention`, `test_finetuning_dataset_empty`.
   - **Missing Tests**: Does **not test** `extract_document_file` or `compute_statistical_ai_signals` from `paper_scraper.ai.signals`.
2. **`test_pdf.py`**:
   - Tests: `test_verify_pdf_signature_valid`, `test_verify_pdf_signature_html_masquerade`, `test_verify_pdf_signature_too_short_or_corrupt`, `test_pdf_manager_ssrf_blocked`.
   - **Missing Tests**: Does **not test** actual document extraction from real PDF files on disk; tests only in-memory byte buffers.

### 6.3 Synthetic Test Fixtures Audit

An exhaustive search across the entire repository confirmed:
- **Existing Fixtures**: 7 mock `.html` files in `python-engine/tests/fixtures/`:
  - `arxiv_search.html`, `biorxiv_search.html`, `fake_pdf_login_wall.html`, `malformed_results.html`, `plos_search.html`, `pubmed_search.html`, `zero_results.html`.
- **Missing Fixtures**:
  - **Zero `.pdf` files** exist anywhere in the repository.
  - **Zero `.docx` files** exist anywhere in the repository.
  - **Zero `.txt` document test papers** exist in any test directory.

Requirement **R3** of `ORIGINAL_REQUEST.md` specifically mandates:
> "Establish synthetic test documents (PDF, DOCX, TXT) and test fixtures to validate document processing and repair verification."

---

## 7. Actionable Recommendations for Phase 1 Repair & Stabilization

To prepare for Phase 1 implementation without breaking working features or modifying schemas without backward compatibility, the following sequence of repairs is recommended:

### Recommendation 1: Fix `signals.py:59` Runtime Crash
Replace `is_clean = replacement_count < 5` with `is_clean = replacement_chars < 5` in `python-engine/src/paper_scraper/ai/signals.py`.

### Recommendation 2: Implement Native Standard Library DOCX Extraction
In `python-engine/src/paper_scraper/ai/signals.py`, implement `.docx` handling using Python's built-in `zipfile` and `xml.etree.ElementTree` to parse `word/document.xml`. This eliminates the need for external C-extensions or extra pip packages:
```python
elif ext == ".docx":
    try:
        import zipfile
        import xml.etree.ElementTree as ET
        with zipfile.ZipFile(file_path) as z:
            xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            # w:t namespace tag contains textual runs
            texts = [node.text for node in tree.iter() if node.tag.endswith("}t") and node.text]
            raw_text = " ".join(texts)
    except Exception as e:
        raise ValueError(f"Could not extract DOCX text: {e}")
```

### Recommendation 3: Generate Synthetic Test Fixtures
Create a dedicated `tests/fixtures/synthetic/` directory (or co-located in `python-engine/tests/fixtures/documents/`) containing:
1. `synthetic_paper.txt`: Clean academic paper with standard sections (Title, Abstract, Introduction, Methods, Results, Discussion, References).
2. `synthetic_paper.pdf`: Valid minimal 1-page/2-page PDF generated via `lopdf` or pure Python script with extractable text layer and citations.
3. `synthetic_paper.docx`: Valid synthetic `.docx` zip archive containing `word/document.xml`.

### Recommendation 4: Wire Frontend Uploads to Backend `extract_document_text`
In `CitationCheckerWorkspaceView.tsx`, `ReadabilityAnalyzerView.tsx`, and `ResearchIntegrityView.tsx`, update `handleFileUpload`:
- For plain text files (`.txt`, `.md`, `.tex`, `.bib`): continue using `FileReader.readAsText(file)` for instant zero-latency processing.
- For binary documents (`.pdf`, `.docx`): write file path / buffer to backend via Tauri `extract_document_text` so `lopdf` or `PyMuPDF` extracts clean text instead of reading raw binary data as UTF-8 string.

### Recommendation 5: Add Pytest Unit Tests for Signal & File Extraction
Add tests to `python-engine/tests/test_ai_module.py`:
- `test_extract_document_file_txt`: Validates clean text extraction, word count, char count, and encoding cleanliness.
- `test_extract_document_file_pdf`: Validates PDF text layer extraction.
- `test_extract_document_file_docx`: Validates DOCX extraction.
- `test_compute_statistical_ai_signals`: Validates burstiness, cadence, and caveat generation on academic prose.

### Recommendation 6: Update `pyproject.toml`
Add `pymupdf>=1.24.0` and `psutil>=5.9.0` to `dependencies` in `python-engine/pyproject.toml` to accurately reflect imports.

---

*End of Python Backend & Document Processing Audit Report.*
