# Milestone M2 Challenge & Stress Test Report

## Challenge Summary

**Overall risk assessment**: LOW

The synthetic fixture generation script (`scripts/generate_synthetic_fixtures.py`) and multi-format document extraction module (`python-engine/src/paper_scraper/ai/signals.py`) are robust, fully offline, and comply with all acceptance criteria from `ORIGINAL_REQUEST.md`. All 118 unit and integration tests in `python-engine/tests` pass without error. Empirical verification confirmed that Title, Abstract, Section Headings, Benchmark Table content, Citations [1]-[5], and DOIs are present and cleanly extracted across all three formats (`.pdf`, `.docx`, `.txt`).

Two minor edge-case failure modes were discovered during adversarial stress testing and are documented below with mitigations. Neither issue blocks approval.

---

## Challenges

### [Low] Challenge 1: Purely Symbolic / Punctuation-Only Text Bypasses Insufficient Text Guard in `compute_statistical_ai_signals`

- **Assumption challenged**: The function assumes that any text segment yielding `>= 4` sentences (split on punctuation) contains valid academic or natural language prose.
- **Attack scenario**: Supplying a string composed exclusively of symbolic characters separated by spaces and periods:
  ```python
  compute_statistical_ai_signals("--- --- ---. +++ +++ +++. *** *** ***. /// /// ///.")
  ```
  In this scenario:
  - `sentences` splits into 4 items, each containing 3 non-empty tokens.
  - `len(words) >= 3` evaluates to True because `s.split()` splits purely on whitespace without validating character types.
  - `all_words` regex `\b[A-Za-z0-9'-]+\b` matches 0 words (`total_tokens = 0`).
  - The function passes the `len(sentence_lengths) < 4` check and returns `status: "completed"`, `sentence_count: 4`, `burstiness: 0.0`, `classification: "mixed_signals"`, even though the document contains zero words.
- **Blast radius**: Low. Non-textual documents (e.g., ascii art, pure punctuation separators) may receive a `completed` classification rather than `insufficient_text`.
- **Mitigation**: Add a guard checking minimum actual word tokens prior to sentence metrics evaluation:
  ```python
  if total_tokens < 15:
      return {
          "status": "insufficient_text",
          "overall_signal_score": 0.0,
          "classification": "insufficient_text",
          "sentence_count": len(sentence_lengths),
          ...
      }
  ```

---

### [Low] Challenge 2: Inconsistent Exception Typing Between Corrupted DOCX and Corrupted PDF in `extract_document_file`

- **Assumption challenged**: The function caller expects unified error handling across document types (`ValueError` for malformed/corrupted files, `FileNotFoundError` for missing files).
- **Attack scenario**:
  - When a corrupted or 0-byte `.docx` is processed, `extract_document_file` catches `zipfile.BadZipFile` and re-raises `ValueError("File is not a valid zip archive / docx: ...")`.
  - When a corrupted or 0-byte `.pdf` is processed while PyMuPDF is installed, `doc = fitz.open(file_path)` raises `fitz.FileDataError` or `pymupdf.EmptyFileError`. Because the `try` block only catches `ImportError` (for the fallback), these PyMuPDF-specific exceptions escape unhandled to the caller instead of being converted into `ValueError`.
- **Blast radius**: Low. Callers expecting standard `ValueError` exceptions on corrupted documents may fail to handle `fitz.FileDataError`.
- **Mitigation**: Wrap the `fitz` opening and page extraction block in a general exception handler:
  ```python
  except ImportError:
      ...
  except Exception as e:
      raise ValueError(f"Could not extract PDF text: {e}")
  ```

---

## Stress Test Results

| # | Stress Scenario | Expected Behavior | Actual Behavior | Result |
|---|-----------------|-------------------|-----------------|--------|
| 1 | Offline fixture generation via `scripts/generate_synthetic_fixtures.py` | Generates TXT, DOCX, and PDF fixtures in `fixtures/documents/` with 0 network calls | Generated 3 files (TXT: 9334 chars, DOCX: 6305 bytes, PDF: 33218 bytes) | **PASS** |
| 2 | Empirical element verification (Title, Abstract, 6 Headings, Table, Citations [1]-[5], DOIs) on TXT | All elements present in `raw_text` | All 6 element categories verified present | **PASS** |
| 3 | Empirical element verification (Title, Abstract, 6 Headings, Table, Citations [1]-[5], DOIs) on DOCX | All elements present in `raw_text` | All 6 element categories verified present | **PASS** |
| 4 | Empirical element verification (Title, Abstract, 6 Headings, Table, Citations [1]-[5], DOIs) on PDF | All elements present in `raw_text` | All 6 element categories verified present | **PASS** |
| 5 | Full test suite execution: `python -m pytest python-engine/tests` | 100% tests pass | 118 passed in 26.90s | **PASS** |
| 6 | AI Module test execution: `python -m pytest python-engine/tests/test_ai_module.py` | All 13 tests pass | 13 passed in 7.02s | **PASS** |
| 7 | Empty & whitespace strings to `compute_statistical_ai_signals` | Returns `status: "insufficient_text"` | Returned `status: "insufficient_text"`, `overall_signal_score: 0.0` | **PASS** |
| 8 | Monotonous prose (identical sentence length) | Detects zero variance / low burstiness (`burstiness: 0.0`) | Detected `burstiness: 0.0`, `variance: 0.0`, `classification: "mixed_signals"` | **PASS** |
| 9 | High-volume stress test: 100,000 words prose | Sub-second analysis without memory exhaustion | Analyzed in 0.080s with 0 memory issues | **PASS** |
| 10 | Multilingual Unicode text handling (German, umlauts) | Clean tokenization and metric computation | Tokenized 4 sentences, `ttr > 0.0`, clean signals | **PASS** |
| 11 | File encoding resilience: UTF-8 with BOM and CP1252 with smart punctuation | Clean decode, `is_clean_encoding: True` | Both UTF-8 BOM and CP1252 extracted cleanly with `is_clean_encoding: True` | **PASS** |
| 12 | Alternative plain formats: `.md` and `.tex` | Clean text extraction with appropriate format tags | Handled cleanly, tags `file_format: "md"` and `"tex"` | **PASS** |
| 13 | Case-insensitive extensions: `.PDF`, `.DOCX` | Same extraction fidelity as lowercase | Successfully extracted 3 pages for both uppercase extensions | **PASS** |
| 14 | Malformed DOCX (missing `word/document.xml` or 0-byte zip) | Raises `ValueError` | Raised `ValueError` with clear message | **PASS** |
| 15 | Adversarial symbol-only sentences (`"--- --- ---. +++ +++ +++."`) | Expected `insufficient_text` | Returned `status: "completed"` due to non-empty tokens | **FINDING** (Challenge 1) |
| 16 | 0-byte or corrupted PDF file | Expected unified `ValueError` | Raised raw `pymupdf.EmptyFileError` / `fitz.FileDataError` | **FINDING** (Challenge 2) |

---

## Unchallenged Areas

- **OCR fallback for scanned PDFs**: In `signals.py`, image OCR (e.g. via Tesseract or PaddleOCR) is out of scope for Milestone M2 text-based synthetic fixtures and was not tested.
- **Complex multi-column PDF table layout**: The synthetic PDF layout was single-column Letter format; multi-column overlapping text bounding boxes were not evaluated.
