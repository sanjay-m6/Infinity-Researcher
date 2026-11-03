# Progress: Python Backend & Document Processing Audit

**Last visited**: 2026-11-03T06:33:45Z
**Current Status**: Comprehensive investigation completed. Drafting `survey_python.md` and `handoff.md`.

## Steps
- [x] Initialized DISPATCH.md, BRIEFING.md, progress.md
- [x] Read ORIGINAL_REQUEST.md
- [x] Inventory Python backend scripts and services (`python-engine`, `scripts/build-python-sidecar.py`, `scratch/update_lib.py`)
- [x] Investigate interaction mechanism between Rust/Frontend and Python (Subprocess JSON-Lines IPC / RPC over stdin/stdout)
- [x] Analyze functional vs broken vs mock vs incomplete implementations:
  - Identified critical runtime `NameError` crash in `signals.py:59` (`replacement_count` vs `replacement_chars`)
  - Identified lack of OCR for scanned/rasterized documents (pure text stream only)
  - Identified lack of DOCX parsing (binary stream fallback)
  - Identified mock implementations in `ai_tools.rs` (`start_analysis_job` dummy timer)
  - Identified missing frontend routing (frontend `FileReader.readAsText` reads PDF/DOCX as raw text instead of calling backend extraction)
  - Identified unused SQLite schema tables (`corpus_fingerprints`, `similarity_runs`)
- [x] Analyze offline fallbacks, cloud AI calls, and binary dependencies:
  - Python engine makes NO cloud AI calls (purely local/Scrapy/statistical)
  - Rust backend manages cloud providers (OpenAI, Anthropic, Gemini, Groq, Cerebras, etc.) and local runtimes (Ollama, LM Studio, in-app Qwen)
  - Deterministic offline fallbacks exist in frontend (`applyLocalHeuristicRewriting`, `applyDeterministicPolish`) and Rust (`PythonEngineService::detect_ai_signals` fallback)
  - Binary dependencies: PyInstaller sidecar binary present (227 MB). Tesseract, Poppler, Pandoc are NOT installed/used
  - Dependency gap: `pymupdf`, `torch`, `psutil` missing from `pyproject.toml`; `python-docx` missing completely
- [x] Analyze test suites, pytest execution, and synthetic test fixtures:
  - `pytest 9.1.1` via `python -m pytest` executes 109 tests, all 109 pass in 28.81s
  - Confirmed: Zero synthetic document fixtures (.pdf, .docx, .txt) exist in repo test directory
- [ ] Compile survey_python.md
- [ ] Write handoff.md and send message to parent
