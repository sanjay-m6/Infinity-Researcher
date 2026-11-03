# Challenge Report: Adversarial Stress Testing of Python Signals & Document Extraction

**Challenger**: `challenger_m2_2` (empirical_challenger)  
**Target Milestone**: M2 — Synthetic Test Fixtures & Python Engine Repair  
**Target Modules**: `python-engine/src/paper_scraper/ai/signals.py`, `python-engine/src/paper_scraper/integration/runner.py`, `python-engine/tests/`  
**Overall Risk Assessment**: **LOW** (Implementation is robust, mathematically stable, and resilient against adversarial inputs)

---

## 1. Challenge Summary

An exhaustive empirical stress-testing campaign was executed against `extract_document_file` and `compute_statistical_ai_signals`. The harness subjected both functions to 36 distinct adversarial test cases encompassing malformed, corrupted, zero-byte, extreme-length, non-UTF8, multilingual, and mathematically pathological inputs.

Key Findings:
1. **Zero Uncaught Crashes**: Neither function produced unhandled exceptions that could bring down the sidecar daemon or host process.
2. **Sidecar Safety**: The JSON protocol integration runner (`runner.py`) encapsulates both routines in comprehensive `try...except Exception` handlers, ensuring IPC stability.
3. **Graceful Degradation**: Zero-byte files, non-existent files, and truncated DOCX archives raise expected, structured errors (`FileNotFoundError`, `ValueError`).
4. **Algorithmic Stability**: In `compute_statistical_ai_signals`, all potential division-by-zero vectors (empty inputs, 0 tokens, 0 variance, single words, sentence counts < 4) are explicitly guarded with fallback defaults and calibrated uncertainty caveats.
5. **Minor Behavioral Nuance (PDF Exceptions)**: When PyMuPDF (`fitz`) is present, corrupted/empty PDFs raise PyMuPDF library exceptions (`pymupdf.EmptyFileError`, `pymupdf.FileDataError`) rather than standard `ValueError` (which is raised for DOCX). While safely caught by `runner.py`, consumers expecting unified `ValueError` should catch `Exception`.

---

## 2. Adversarial Challenges & Findings

### [Low Risk] Challenge 1: Exception Type Discrepancy Between DOCX and PDF Extraction
- **Assumption Challenged**: Callers might assume document extraction raises uniform standard library exception types (`ValueError`) for all corrupted file formats.
- **Attack Scenario**: Passing an empty (`0 bytes`) or corrupted `.pdf` file to `extract_document_file` when PyMuPDF is installed.
- **Empirical Observation**:
  - In `extract_document_file`:
    - Corrupted `.docx` raises `ValueError: File is not a valid zip archive / docx: ...`
    - Corrupted `.pdf` raises `pymupdf.FileDataError: Failed to open file ... as type pdf`
    - Empty `.pdf` raises `pymupdf.EmptyFileError: Cannot open empty file: ...`
  - In `python-engine/src/paper_scraper/ai/signals.py:30-40`, `doc = fitz.open(file_path)` is inside a `try` block catching only `except ImportError:`. PyMuPDF errors bubble up directly.
- **Blast Radius**: None in the desktop sidecar application because `runner.py:165` catches generic `Exception`. Direct Python library consumers catching only `(ValueError, FileNotFoundError)` would encounter uncaught PyMuPDF exceptions unless importing `fitz` or catching `Exception`.
- **Mitigation / Recommendation**: In future refactoring, wrap `fitz.open()` with `try ... except Exception as e: raise ValueError(f"Could not extract PDF text: {e}")` to mirror the `.docx` behavior.

### [Low Risk / By-Design] Challenge 2: Multilingual Tokenization and Sentence Boundary Sensitivity
- **Assumption Challenged**: `compute_statistical_ai_signals` assumes universal whitespace tokenization and punctuation-based (`[.!?]`) sentence segmentation across all languages.
- **Attack Scenario**: Submitting academic manuscripts written in unspaced languages (e.g., Chinese, Japanese) or non-Latin punctuation (e.g., Hindi danda `।`).
- **Empirical Observation**:
  - Chinese text ("这是第一句话关于学术研究。这是第二句话关于文献检索系统..."): Sentence splitting succeeds on `。`, but word tokenization `s.split()` produces single unsegmented strings where `len(words) < 3`. Returns `status: "insufficient_text"` with 0 sentences counted.
  - Hindi text: Does not split on `।` (danda), treating the paragraph as a single sentence. Returns `status: "insufficient_text"` (< 4 sentences).
  - Russian (Cyrillic) and Arabic: Splitting on `[.!?]` and whitespace works cleanly, returning `status: "completed"` with valid burstiness metrics.
- **Blast Radius**: Graceful degradation to `insufficient_text`; zero crashes or division errors.
- **Mitigation**: Appropriate for the current English/Latin research paper focus; future multi-language expansions can incorporate language-aware sentence tokenizers (e.g., `nltk` or `spaCy`).

### [Informational] Challenge 3: Non-UTF8 Text Encoding Fallback with Null Bytes
- **Assumption Challenged**: Plain text fallback handles non-UTF8 text cleanly.
- **Attack Scenario**: Passing a UTF-16 LE file without BOM, or raw binary files masquerading as `.txt`.
- **Empirical Observation**:
  - Encoded files in `utf-8`, `utf-8-sig`, `latin1`, and `cp1252` are decoded cleanly.
  - Arbitrary binary or UTF-16 files decode under `latin1` (which maps all byte values 0x00-0xFF). NUL bytes (`\x00`) are preserved.
  - When text containing null bytes is analyzed by `compute_statistical_ai_signals`, regex word extraction `\b[A-Za-z0-9'-]+\b` ignores null bytes and operates normally without exception.

---

## 3. Empirical Stress Test Results

Harness script: `scripts/adversarial_m2_test.py`  
Total Test Cases: **36** | **PASS: 34** | **OBSERVE: 2** | **FAIL: 0**

| Test Case | Category | Input Condition | Expected Behavior | Actual Empirical Result | Status |
|---|---|---|---|---|---|
| 1.1 | Document Extraction | Missing file path | Raise `FileNotFoundError` | Raised `FileNotFoundError: File does not exist` | PASS |
| 1.2 | Document Extraction | Empty `.txt` file (0 bytes) | Return empty string & 0 word count | `raw_text=""`, `word_count=0`, `char_count=0` | PASS |
| 1.3 | Document Extraction | Empty `.docx` file (0 bytes) | Raise `ValueError` (Bad Zip) | Raised `ValueError: File is not a valid zip archive / docx` | PASS |
| 1.4a | Document Extraction | Truncated `.docx` file | Raise `ValueError` (Bad Zip) | Raised `ValueError: File is not a valid zip archive / docx` | PASS |
| 1.4b | Document Extraction | `.docx` missing `word/document.xml` | Raise `ValueError` (Missing XML) | Raised `ValueError: Could not extract DOCX text: Invalid DOCX format...` | PASS |
| 1.4c | Document Extraction | `.docx` with malformed XML | Raise `ValueError` (XML ParseError) | Raised `ValueError: Could not extract DOCX text: unbound prefix...` | PASS |
| 1.5 | Document Extraction | Empty `.pdf` file (0 bytes) | Clean error handling | Raised `pymupdf.EmptyFileError` (caught by caller) | OBSERVE |
| 1.6 | Document Extraction | Corrupted `.pdf` file | Clean error handling | Raised `pymupdf.FileDataError` (caught by caller) | OBSERVE |
| 1.7a | Document Extraction | Latin-1 encoded text file | Decode accents without corrupting | Decoded cleanly: "Hélène wrote a naïve résumé with £500 cost." | PASS |
| 1.7b | Document Extraction | CP1252 encoded file (smart quotes, em-dash) | Decode curly punctuation | Decoded cleanly: "“Smart quotes” and an em—dash" | PASS |
| 1.7c | Document Extraction | Raw binary byte stream | Graceful decode, flag clean status | Decoded via Latin-1 fallback, `warning=None` | PASS |
| 1.8a | Document Extraction | Markdown file (`.md`) | Plain text extraction | Formatted text preserved, `word_count=7` | PASS |
| 1.8b | Document Extraction | LaTeX file (`.tex`) | Plain text extraction | Syntax preserved, `word_count=2` | PASS |
| 1.9 | Document Extraction | Password-protected encrypted PDF | Handle encrypted stream | Raised `ValueError: document closed or encrypted` | PASS |
| 2.1a | Statistical Signals | Empty string `""` | Insufficient text status | `status="insufficient_text"`, all metrics 0.0 | PASS |
| 2.1b | Statistical Signals | Whitespace only `"   \t\n  "` | Insufficient text status | `status="insufficient_text"`, all metrics 0.0 | PASS |
| 2.1c | Statistical Signals | Newline chars only `"\n\n\r\n"` | Insufficient text status | `status="insufficient_text"`, all metrics 0.0 | PASS |
| 2.2a | Statistical Signals | Single word ("Hello") | Insufficient text status | `status="insufficient_text"`, `sentence_count=0` | PASS |
| 2.2b | Statistical Signals | Single word ("Unprecedented") | Insufficient text status | `status="insufficient_text"`, `sentence_count=0` | PASS |
| 2.2c | Statistical Signals | Long single word (45 chars) | Insufficient text status | `status="insufficient_text"`, `sentence_count=0` | PASS |
| 2.3a | Statistical Signals | 2 words ("One two") | Insufficient text status | `status="insufficient_text"`, `sentence_count=0` | PASS |
| 2.3b | Statistical Signals | Single short sentence | Insufficient text status | `status="insufficient_text"`, `sentence_count=1` | PASS |
| 2.3c | Statistical Signals | 3 short sentences | Insufficient text status (< 4 sent) | `status="insufficient_text"`, `sentence_count=3` | PASS |
| 2.4 | Statistical Signals | Extreme length (5,000 sentences / 55,000 words) | Linear runtime, no memory explosion | Completed in 0.089s, `sentence_count=5000` | PASS |
| 2.5 | Statistical Signals | Zero punctuation text (continuous stream) | Insufficient text status | Treated as single sentence, `status="insufficient_text"` | PASS |
| 2.6a | Statistical Signals | 10,000 repeated letters ("aaaa...") | Insufficient text status | No regex catastrophic backtracking, `status="insufficient_text"` | PASS |
| 2.6b | Statistical Signals | Repeated punctuation (`.!? ` * 500) | Insufficient text status | `sentence_count=0`, `status="insufficient_text"` | PASS |
| 2.6c | Statistical Signals | Repeated symbols (`---___===`) | Insufficient text status | `status="insufficient_text"` | PASS |
| 2.6d | Statistical Signals | Repeated emojis (`🤖🧠🚀` * 500) | Insufficient text status | `status="insufficient_text"` | PASS |
| 2.7 | Statistical Signals | LaTeX math equations | Segment sentences without crash | `status="completed"`, `sentence_count=4` | PASS |
| 2.8a | Statistical Signals | Zero burstiness (strictly identical lengths) | Burstiness = 0.0, Variance = 0.0 | `burstiness=0.0`, `variance=0.0` | PASS |
| 2.8b | Statistical Signals | Extreme burstiness (3 to 100 word variance) | High burstiness, high variance | `burstiness=1.141`, `variance=1898.56` | PASS |
| 2.9a | Statistical Signals | Chinese academic text | Graceful handling | `status="insufficient_text"`, 0 sentences | PASS |
| 2.9b | Statistical Signals | Russian academic text | Segment & compute | `status="completed"`, `burstiness=0.257` | PASS |
| 2.9c | Statistical Signals | Arabic academic text | Segment & compute | `status="completed"`, `burstiness=0.06` | PASS |
| 2.9d | Statistical Signals | Hindi academic text | Graceful handling | `status="insufficient_text"`, 1 sentence | PASS |
| 2.10 | Statistical Signals | NUL bytes & terminal escape codes | Clean string handling | `status="insufficient_text"`, no decode failure | PASS |

---

## 4. Unchallenged Areas

- **OCR on Scanned Images**: Out of scope for Milestone M2 (covered in later phases; current PyMuPDF and fallback focus on digital text extraction).
- **Frontend IPC Stress**: Rust-to-Python IPC transport layer was inspected statically in `runner.py`; integration tests for full Tauri IPC messaging are tested in system integration tests.

---

## 5. Verdict

**APPROVE**

The implementation in `python-engine/src/paper_scraper/ai/signals.py` and the accompanying synthetic test fixtures in `fixtures/documents/` meet all requirements of Milestone M2 with high reliability, excellent execution performance (<100ms for large manuscripts), zero crashes, and robust error guards.
