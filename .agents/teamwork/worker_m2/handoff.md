# Handoff Report: Milestone M2 — Synthetic Test Fixtures & Python Engine Repair

## 1. Observation

1. **Initial Codebase Audit**:
   - In `python-engine/src/paper_scraper/ai/signals.py:58-59`:
     ```python
     replacement_chars = raw_text.count("\ufffd")
     is_clean = replacement_count < 5
     ```
     Variable `replacement_count` was undefined, causing immediate crash `NameError: name 'replacement_count' is not defined`.
   - In `python-engine/src/paper_scraper/ai/signals.py:25-54`:
     Function `extract_document_file` handled `.pdf` and fell back to `open(file_path, "r", encoding=enc)` for all non-PDF files. `.docx` files (which are zipped OpenXML packages) were treated as plain text, leading to decode failures or binary corruption.
   - In `python-engine/tests/test_ai_module.py`:
     Only 4 tests existed covering `chunk_text_content`, `evaluate_hardware_capability`, and `prepare_finetuning_dataset`. `extract_document_file` and `compute_statistical_ai_signals` had zero unit test coverage.
   - In `fixtures/documents/`:
     No synthetic document fixtures existed in the repository prior to execution.

2. **Executed Commands & Output**:
   - `python scripts/generate_synthetic_fixtures.py`:
     ```
     Generating synthetic academic paper fixtures in: D:\Paper\fixtures\documents
     Generated TXT fixture: D:\Paper\fixtures\documents\synthetic_paper.txt (9334 chars)
     Generated DOCX fixture: D:\Paper\fixtures\documents\synthetic_paper.docx (size: 6305 bytes)
     Generated PDF fixture: D:\Paper\fixtures\documents\synthetic_paper.pdf (3 pages, 33218 bytes)
     All fixtures generated successfully!
     ```
   - `python -m pytest python-engine/tests`:
     ```
     ============================ 118 passed in 16.92s =============================
     ```
   - Git Commit:
     `5fb8cc82a51b8b67ca96267c596fa1b76e40e5b4`
     `feat(m2): synthetic test fixtures, docx/pdf extraction, and signals repair`
     6 files changed, 891 insertions(+).

## 2. Logic Chain

1. **Observation 1 → Fixture Requirements (R3)**:
   The system required authentic synthetic academic paper fixtures in `.txt`, `.docx`, and `.pdf` formats containing title, authors, abstract, six standard numbered sections, bracket citations `[1]`, authentic DOIs (`10.1145/...`, `10.1109/...`), and a structured benchmark table (Table 1: Performance Benchmarks).
2. **Offline Generation Tooling**:
   Built `scripts/generate_synthetic_fixtures.py` using standard library `zipfile` and `xml.etree.ElementTree` for valid OpenXML `.docx` generation, and PyMuPDF (`fitz` / `pymupdf`) for 3-page vector text `.pdf` generation. This script executes completely offline with zero network or cloud API dependencies.
3. **Observation 1 → Bug Fix & Document Extraction (R2)**:
   - Line 59 in `signals.py` was corrected from `replacement_count < 5` to `replacement_chars < 5`, resolving the `NameError`.
   - Native standard library `.docx` extraction was implemented using `zipfile.ZipFile` to extract and parse `word/document.xml`, iterating across paragraph `<w:p>` and run `<w:t>` elements, and extracting page count metadata from `docProps/app.xml` when present.
   - In `.pdf` extraction, PyMuPDF import was updated to support both `pymupdf` and `fitz` without deprecation warnings, and added explicit `doc.close()` to ensure file handles are cleanly closed on Windows.
   - Enhanced `compute_statistical_ai_signals` to calculate token frequency variance (`vocabulary_variance`), sentence length variance (`variance`), burstiness (`burstiness`), and Type-Token Ratio (`lexical_diversity_ttr`).
4. **Observation 1 & 2 → Test Suite Enhancement**:
   Added 9 unit tests to `python-engine/tests/test_ai_module.py`:
   - `test_extract_document_file_txt`
   - `test_extract_document_file_docx`
   - `test_extract_document_file_pdf`
   - `test_extract_document_file_nonexistent` (FileNotFoundError validation)
   - `test_extract_document_file_invalid_docx` (Bad zip validation)
   - `test_compute_statistical_ai_signals_empty`
   - `test_compute_statistical_ai_signals_short_text`
   - `test_compute_statistical_ai_signals_academic_prose`
   - `test_compute_statistical_ai_signals_uniform_cadence`
5. **Verification**:
   Running the full test suite demonstrated that all 118 tests in `python-engine/tests` passed with 0 failures and 0 warnings.

## 3. Caveats

- In `.docx` document formats, page breaks are dynamic rendering constructs determined by the word processor renderer; page count is extracted from `docProps/app.xml` if populated by the authoring application, falling back to 1.
- No other files outside the designated ownership list (`fixtures/documents/`, `scripts/generate_synthetic_fixtures.py`, `python-engine/src/paper_scraper/ai/signals.py`, `python-engine/tests/test_ai_module.py`) were altered.

## 4. Conclusion

Milestone M2 is fully accomplished:
1. Synthetic academic paper fixtures (`synthetic_paper.pdf`, `synthetic_paper.docx`, `synthetic_paper.txt`) are generated and committed in `fixtures/documents/`.
2. Standalone offline generation script `scripts/generate_synthetic_fixtures.py` is established and verified.
3. Python engine `signals.py` Line 59 `NameError` is repaired; native `.docx` and PyMuPDF `.pdf` text extraction are operational.
4. Test suite `python-engine/tests` has 100% pass rate (118/118 tests passing).

## 5. Verification Method

To independently verify the implementation:
1. **Run full Python test suite**:
   ```bash
   python -m pytest python-engine/tests
   ```
   *Expected Result*: 118 passed in ~16s.
2. **Run individual AI module test suite**:
   ```bash
   python -m pytest python-engine/tests/test_ai_module.py -v
   ```
   *Expected Result*: 13 passed in ~7s.
3. **Verify offline fixture re-generation**:
   ```bash
   python scripts/generate_synthetic_fixtures.py
   ```
   *Expected Result*: Exits 0 and regenerates `.txt`, `.docx`, and `.pdf` in `fixtures/documents/`.
4. **Inspect Git commit**:
   ```bash
   git show 5fb8cc82a51b8b67ca96267c596fa1b76e40e5b4 --stat
   ```
