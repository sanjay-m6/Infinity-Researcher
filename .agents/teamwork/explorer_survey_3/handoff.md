# Handoff Report: Python Backend, Document Processing & Offline Fallback Audit

**Subagent**: `explorer_survey_3`  
**Parent Conversation ID**: `b0eaf2ef-a808-46f4-a060-5d8f0f6729a2`  
**Mission**: Python Backend, Document Processing & Offline Fallback Audit  
**Artifacts Produced**:
- `d:\Paper\.agents\teamwork\explorer_survey_3\survey_python.md` (Comprehensive audit findings)
- `d:\Paper\.agents\teamwork\explorer_survey_3\handoff.md` (Structured handoff report)
- `d:\Paper\.agents\teamwork\explorer_survey_3\progress.md` (Heartbeat log)
- `d:\Paper\.agents\teamwork\explorer_survey_3\BRIEFING.md` (Persistent context memory)

---

## 1. Observation

1. **Python Engine Codebase & Sidecar Architecture**:
   - `python-engine/src/paper_scraper/`: Contains 33 Python modules covering spiders, adapters, middleware, deduplication (`RapidFuzz`), ranking, extractors, and AI subsystems.
   - `src-tauri/src/services/python_engine.rs:26-35`: Implements `EngineExecutionPlan` supporting either `StandaloneBinary` (`src-tauri/binaries/paper-scraper-x86_64-pc-windows-msvc.exe`, size 227,631,330 bytes, built with PyInstaller) or `PythonModule` fallback executing `python -m paper_scraper` with cwd `python-engine/src`.
   - `src-tauri/src/services/python_engine.rs:788-904`: Implements Request-Response RPC (`execute_rpc`) over standard I/O pipes using newline-delimited JSON with a 30-second timeout.
   - `python-engine/src/paper_scraper/integration/runner.py:160-175`: Handles RPC commands `extract_document_text` and `detect_ai_signals`.

2. **Verbatim Runtime Crash in Document Text Extraction**:
   - In `python-engine/src/paper_scraper/ai/signals.py`:
     ```python
     58:     replacement_chars = raw_text.count("\ufffd")
     59:     is_clean = replacement_count < 5
     ```
   - Running `python -c "from paper_scraper.ai.signals import extract_document_file; extract_document_file('d:/Paper/README.md')"` with `PYTHONPATH=python-engine/src` produces:
     ```
     NameError: name 'replacement_count' is not defined. Did you mean: 'replacement_chars'?
     ```

3. **Document Extraction Gaps (DOCX, Scanned OCR, Frontend Uploads)**:
   - In `python-engine/src/paper_scraper/ai/signals.py:45-54`, `.docx` files are not specially handled and fall through to plain text `open(..., encoding="latin1")`, producing binary zip garbage rather than document text.
   - No optical character recognition (OCR) library (Tesseract or PaddleOCR) is present in `python-engine` or `src-tauri`. Scanned/image-only PDFs return empty text.
   - In `src/features/citation-checker/CitationCheckerWorkspaceView.tsx:111`, `src/features/readability/ReadabilityAnalyzerView.tsx:132`, and `src/features/integrity/ResearchIntegrityView.tsx:185`, file uploads use browser `FileReader.readAsText(file)` on all accepted formats (`.txt,.md,.tex,.bib,.docx,.pdf`), corrupting binary PDFs and DOCXs and bypassing backend extraction.

4. **Offline Fallbacks & Cloud AI API Audit**:
   - Grep searches for `openai`, `anthropic`, `gemini`, `huggingface`, and `api_key` in `python-engine` returned zero API call sites. Python backend makes **zero external cloud AI calls**.
   - Cloud AI provider connections are located in `src-tauri/src/services/ai_provider_service.rs`.
   - Offline fallback in `src/features/writing-workspace/writingEngine.ts:491` catches AI provider failures and falls back to `applyLocalHeuristicRewriting(text, toolType, modeId)` (deterministic rule-based transformation).
   - In `src-tauri/src/services/python_engine.rs:954`, if Python AI signal detection RPC fails, Rust executes an internal fallback calculating burstiness and cadence heuristics.

5. **Pytest Test Suite Execution & Synthetic Fixtures Audit**:
   - Running `python -m pytest d:\Paper\python-engine\tests`: 109 tests collected, **109 passed in 28.81s** (0 failed).
   - Repository search across `d:\Paper`: **0 `.pdf` files**, **0 `.docx` files**, and **0 `.txt` synthetic document test fixtures** exist in test directories.
   - Existing fixtures are strictly 7 `.html` files in `python-engine/tests/fixtures/`.
   - `python-engine/tests/test_ai_module.py` contains 4 tests (chunker and fine-tuning dataset split) but zero tests for `extract_document_file` or `compute_statistical_ai_signals`.

---

## 2. Logic Chain

1. **From Observation 1 and 2**:
   - Because `python_engine.rs:933` issues RPC `"extract_document_text"`, which `runner.py:163` routes to `extract_document_file(file_path)`, and because line 59 in `signals.py` references undefined `replacement_count`, any invocation of `extract_document_text` on non-txt/md files via the Python engine fails with a `PYTHON_RPC_ERROR` wrapping the `NameError`.
   - In dev mode, this causes immediate failure; in production, the PyInstaller sidecar binary exhibits the identical failure because it was packaged from this source.

2. **From Observation 3**:
   - The frontend accepts `.docx` and `.pdf` files in Citation Checker, Readability Analyzer, and Research Integrity views, but uses browser `FileReader.readAsText(file)` rather than passing file paths or buffers to Tauri's `extract_document_text` or `PdfProcessor`.
   - Consequently, users uploading research papers in PDF or DOCX format receive unreadable replacement character gibberish in their editor, breaking analysis.

3. **From Observation 4**:
   - The Python backend was confirmed to be completely local, offline-capable, and decoupled from cloud LLM API keys.
   - All cloud AI dependencies exist in the Rust backend and frontend, and both have active fallback mechanisms (local heuristic rewriting, deterministic polish, and native Rust stylometric heuristics) when offline or when keys are absent.

4. **From Observation 5**:
   - The 109 existing pytest tests pass because they cover Scrapy adapters, spiders, URL security, relevance scoring, and chunking.
   - The absence of any tests for `extract_document_file` in `test_ai_module.py` allowed the `NameError` crash to remain undetected.
   - Synthetic test documents (PDF, DOCX, TXT) required by R3 do not currently exist and must be generated to validate end-to-end document processing.

---

## 3. Caveats

- **Host Python Environment**: Python 3.14.3 is installed on the host. `pytest` is not accessible as a direct PATH binary `pytest.exe`, but runs properly via `python -m pytest`.
- **PyInstaller Binary Rebuild**: `src-tauri/binaries/paper-scraper-x86_64-pc-windows-msvc.exe` was built prior to the latest code edits. In debug builds, Rust automatically runs `python -m paper_scraper` from source, so source repairs take effect immediately in development without needing a full PyInstaller rebuild.
- **Cargo Test Abort**: `cargo test --manifest-path src-tauri/Cargo.toml --lib` aborted with `0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND)`. This is a dynamic linker/DLL resolution issue in the Windows terminal environment and does not indicate an issue within the Python backend.

---

## 4. Conclusion

1. **Python Service Health**: The Python discovery and search scraping engine is highly functional with 109 passing unit tests and robust anti-SSRF protections. However, the document processing service in `ai/signals.py` is **broken** due to a one-line `NameError` (`replacement_count`), and **incomplete** due to lack of DOCX parsing and OCR for scanned documents.
2. **Offline Resilience**: The system exhibits excellent offline design: Python engine makes zero cloud calls, and frontend/Rust components have functional deterministic offline fallbacks.
3. **Fixture Gap**: Synthetic document fixtures (PDF, DOCX, TXT) are 100% missing from repository test directories and must be created.
4. **Actionable Repairs Identified**:
   - Change `replacement_count` to `replacement_chars` in `signals.py:59`.
   - Add native standard library `zipfile` XML parsing for `.docx` in `signals.py`.
   - Generate synthetic test fixtures (`.pdf`, `.docx`, `.txt`) covering standard research paper sections.
   - Add pytest coverage in `test_ai_module.py` for file extraction and stylometric signals.
   - Wire frontend binary file uploads (`CitationCheckerWorkspaceView`, `ReadabilityAnalyzerView`, `ResearchIntegrityView`) to backend `extract_document_text`.

---

## 5. Verification Method

To independently verify all findings in this report:

1. **Verify Python Pytest Suite**:
   ```powershell
   python -m pytest d:\Paper\python-engine\tests
   ```
   *Expected result*: 109 tests passed.

2. **Verify `signals.py:59` Runtime Crash**:
   ```powershell
   $env:PYTHONPATH="d:\Paper\python-engine\src"
   python -c "from paper_scraper.ai.signals import extract_document_file; extract_document_file('d:/Paper/README.md')"
   ```
   *Expected result*: `NameError: name 'replacement_count' is not defined. Did you mean: 'replacement_chars'?`.

3. **Verify Absence of Synthetic Document Fixtures**:
   ```powershell
   Get-ChildItem -Path "d:\Paper" -Recurse -Include "*.pdf","*.docx" | Where-Object { $_.FullName -notmatch "node_modules|\.git" }
   ```
   *Expected result*: Zero files returned.

4. **Verify Offline AI Signal Detection**:
   ```powershell
   $env:PYTHONPATH="d:\Paper\python-engine\src"
   python -c "from paper_scraper.ai.signals import compute_statistical_ai_signals; print(compute_statistical_ai_signals('Sentence one is here. Sentence two is short. Sentence three is longer than usual. Sentence four concludes.'))"
   ```
   *Expected result*: Returns dictionary with `status: completed`, `burstiness`, `mean_sentence_length`, and `uncertainty_caveat`.
