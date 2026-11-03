## 2026-11-03T07:12:41Z
You are worker_m2, a teamwork_worker subagent.
Working Directory: d:\Paper\.agents\teamwork\worker_m2\
Parent Conversation ID: b0eaf2ef-a808-46f4-a060-5d8f0f6729a2
Authoritative Request: d:\Paper\.agents\teamwork\ORIGINAL_REQUEST.md

MANDATORY FIRST STEP: Read d:\Paper\.agents\teamwork\ORIGINAL_REQUEST.md in full.
Read docs/research-tools/CURRENT_IMPLEMENTATION_AUDIT.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You own:
- `fixtures/documents/` (or repository test fixtures directory)
- `scripts/generate_synthetic_fixtures.py`
- `python-engine/src/paper_scraper/ai/signals.py`
- `python-engine/tests/test_ai_module.py`
- Files in your working directory `d:\Paper\.agents\teamwork\worker_m2\`

Mission: Milestone M2 — Synthetic Test Fixtures & Python Engine Repair
1. Synthetic Test Fixtures (R3):
   - Generate high-quality synthetic research papers in `fixtures/documents/`:
     - `synthetic_paper.pdf`
     - `synthetic_paper.docx`
     - `synthetic_paper.txt`
   - Each fixture MUST include standard academic sections:
     - Title & Authors
     - Abstract
     - 1. Introduction
     - 2. Related Work & Literature Review
     - 3. Methodology & System Architecture
     - 4. Experimental Results & Performance Evaluation
     - 5. Discussion & Research Integrity Analysis
     - 6. Conclusion
     - References / Bibliography (including authentic DOI formats e.g. 10.1145/..., 10.1109/..., and bracket citations [1], [2], [3])
     - A structured table (e.g. Table 1: Performance Benchmarks)
   - Write a standalone generation script `scripts/generate_synthetic_fixtures.py` that can re-generate all three fixtures completely offline using Python (PyMuPDF `fitz` is available in python-engine, standard library `zipfile` for docx, etc.).
2. Python Document Extraction & Signals Repair (R2):
   - In `python-engine/src/paper_scraper/ai/signals.py`:
     - Fix Line 59: `replacement_chars = raw_text.count("\ufffd")` -> `is_clean = replacement_chars < 5` (fixing `NameError: replacement_count`).
     - In `extract_document_file(file_path)`: implement native standard library `.docx` text extraction using `zipfile.ZipFile` and `xml.etree.ElementTree` to parse `word/document.xml`, extracting all paragraph text cleanly.
     - Ensure `.pdf` extraction uses PyMuPDF (`fitz`) when available, returning clean page text.
3. Test Coverage & Verification:
   - In `python-engine/tests/test_ai_module.py`:
     - Add tests verifying `extract_document_file` correctly extracts text from `.txt`, `.docx`, and `.pdf` files.
     - Add tests verifying `compute_statistical_ai_signals` returns complete metrics (burstiness, sentence length, vocabulary variance) without crashing.
   - Run `python -m pytest python-engine/tests` and confirm 100% of tests pass cleanly.
4. Deliverables:
   - Commit all fixture files, scripts, and code repairs.
   - Write handoff report in `d:\Paper\.agents\teamwork\worker_m2\handoff.md`.
   - Send completion message to Parent `b0eaf2ef-a808-46f4-a060-5d8f0f6729a2`.
