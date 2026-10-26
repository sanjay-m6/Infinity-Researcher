# Research Integrity & Academic Writing Engine Design

## 1. Overview and Core Philosophy

The Research Integrity & Academic Writing Engine is a local-first subsystem designed to augment the Research Paper Scraper desktop application. It delivers three distinct, clearly segregated functional pillars:

1. **Plagiarism / Text-Similarity Checker**: A deterministic literal and near-exact matching engine operating over an auditable local corpus, combining token shingling, Rabin-Karp polynomial hashing with Winnowing fingerprint selection, candidate retrieval, and seed-and-extend character alignment.
2. **AI-Writing Signal Analyzer (Experimental)**: An explicit uncertainty-governed classifier calculating stylometric burstiness, variance, and lexical entropy. It is strictly constrained by a minimum length threshold (80 words) and prominently displays disclaimers explaining that statistical scores do not constitute proof of authorship or academic misconduct.
3. **Academic Writing Assistant**: A transparent, meaning-preserving transformation tool supporting 11 academic enhancement modes (academic tone, conciseness, clarity, abstract review, etc.) with strict automated preservation validators for protected tokens (numbers, units, citations, DOI strings, equations, and epistemic hedging).

---

## 2. Document Ingestion & Normalization Architecture

The document ingestion pipeline processes diverse scholarly formats into a canonical, immutable schema:

```
+-----------------------------------------------------------------------------------+
|                            Document Ingestion Pipeline                            |
+-----------------------------------------------------------------------------------+
|  [PDF Files]    [DOCX Files]    [LaTeX Sources]    [Plain Text / MD]    [Library] |
|   (PyMuPDF /     (Native XML        (Macro /           (UTF-8 Normal-     (SQLite  |
|    Poppler)      Decompress)       Stripper)            ization)         Papers)  |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                         Canonical Document Representation                         |
+-----------------------------------------------------------------------------------+
|  - document_id: UUIDv4                                                            |
|  - file_hash: SHA-256                                                             |
|  - raw_content: Immutable original string                                         |
|  - normalized_content: Case-folded, whitespace-compacted search text              |
|  - word_count / page_count: Integer measurements                                  |
|  - segments: List[DocumentSegment] with offsets [start_offset, end_offset]        |
|      * Classifications: "body", "abstract", "section_heading", "references", etc. |
+-----------------------------------------------------------------------------------+
```

### 2.1 Multi-Format Extractors
- **PDF Extraction**: Extracts page-by-page character streams preserving bounding coordinates and page numbers. Unextractable scanned pages are recorded with `extraction_metadata: { "needs_ocr": true }` rather than silently omitted.
- **DOCX Extraction**: High-performance XML parser reads `word/document.xml` using streaming XML parsers (`defusedxml` / native Python ElementTree) extracting clean paragraph text without requiring Microsoft Word or external office runtimes.
- **LaTeX Extraction**: Eliminates preambles, command definitions (`\newcommand`), and comments (`%`), while cleanly unwrapping text blocks (`\section{...}`, `\textit{...}`) and preserving mathematical identifiers and equation environments.
- **Segment Identification**: Automatically partitions text into discrete structural units and tags references/bibliographies (e.g., `References`, `Bibliography`, `[1] ...`) and boilerplate to allow user-directed exclusion from literal similarity scoring.

---

## 3. Plagiarism & Literal Similarity Engine

The similarity engine employs a first-party, zero-external-dependency implementation inspired by the Rabin-Karp and Winnowing algorithms (Schleimer et al., 2003):

### 3.1 Token Shingling & Winnowing Fingerprints
1. **Token Stream Generation**:
   The normalized document is tokenized into word tokens while preserving exact character slice offsets `(token, start_char, end_char)`.
2. **K-Gram Shingling**:
   A sliding window of length $k = 16$ tokens forms consecutive shingles.
3. **Hash Calculation**:
   Each shingle is hashed into an unsigned 64-bit integer using 64-bit FNV-1a polynomial hashing:
   $$\text{hash}(S) = \left( \sum_{i=0}^{k-1} c_i \cdot p^{k-1-i} \right) \pmod{2^{64}}$$
4. **Winnowing Window Filter**:
   Across a sliding window of size $w = 4$ hashes, the minimum hash value is selected as the fingerprint for that window. In the event of ties, the rightmost minimum hash is retained. This guarantees that any shared verbatim substring of length $\ge (w + k - 1) = 19$ tokens will produce at least one identical fingerprint.

### 3.2 Candidate Retrieval & Inverted Index
Corpus fingerprints are stored in SQLite table `corpus_fingerprints (source_id, fingerprint_hash, position_offset, segment_id)`.
During query document analysis:
- Query fingerprints are grouped and matched against `corpus_fingerprints` via indexed lookups.
- Candidate source documents with fingerprint matches exceeding threshold $\tau \ge 2$ are selected for passage alignment.

### 3.3 Seed-and-Extend Character Alignment
For each candidate source document:
1. Matching fingerprint positions act as seeds.
2. The engine extends the match forward and backward character-by-character while matching tokens or normalized characters.
3. Candidate matches are bounded into intervals: $[S_{\text{start}}, S_{\text{end}}]$ in query and $[C_{\text{start}}, C_{\text{end}}]$ in corpus source.
4. Overlapping query matches across all sources are merged via a 1D interval union algorithm:
   $$\text{MergedIntervals} = \bigcup_{i} [S_{\text{start}}^{(i)}, S_{\text{end}}^{(i)}]$$
5. Similarity score is computed strictly against the query document body text denominator:
   $$\text{Similarity Score} = \frac{\sum_{I \in \text{MergedIntervals}} \text{len}(I)}{\text{Total Query Document Length}} \times 100\%$$

---

## 4. AI-Writing Signal Engine (Experimental)

### 4.1 Ethical & Product Boundaries
- **No Authorship Allegations**: The engine does not and cannot identify who authored a text. It evaluates whether text exhibits statistical characteristics (uniformity, low variance, high predictability) commonly observed in language model outputs.
- **Minimum Input Threshold**: Requires at least 80 words. Any input under 80 words returns `status: "insufficient_text"` rather than manufacturing an uncalibrated prediction.

### 4.2 Statistical Stylometric Baseline
In local-only mode without heavy GPU weights, the engine runs a stylometric baseline measuring:
1. **Perplexity / Shannon Token Entropy**:
   $$H(X) = -\sum_{w \in V} P(w) \log_2 P(w)$$
2. **Sentence Length Burstiness & Variance**:
   $$\sigma^2 = \frac{1}{N} \sum_{i=1}^{N} (L_i - \mu)^2$$
   Human writing displays high variance in sentence length and rhythmic burstiness, whereas raw LLM outputs often cluster around moderate, uniform sentence lengths.
3. **Lexical Richness (Type-Token Ratio & Hapax Legomena)**:
   Calculates vocabulary diversity across sliding 100-word windows.

---

## 5. Academic Writing Assistant

### 5.1 Preservation Invariant Architecture
Scholarly text revisions must never corrupt empirical claims, experimental quantities, or formal citations. The engine validates every revision through a strict preservation pipeline:

| Protected Category | Regular Expression / AST Rule | Action on Violation |
| :--- | :--- | :--- |
| **Numeric Quantities** | `\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b` | Triggers `meaning_risk_flag` if modified |
| **Physical Units** | `(?:mK\|nm\|$\mu$m\|$\mu$s\|GHz\|dB\|mol\|mg\|kg)` | Flags unit mutations |
| **Citations** | `\[\d+(?:,\s*\d+)*\]` or `\([A-Z][a-z]+(?:\s+et\s+al\.)?,\s*\d{4}\)` | Reversion warning if marker dropped |
| **DOIs / URLs** | `10\.\d{4,9}/[-._;()/:A-Za-z0-9]+` | Blocks alterations |
| **Hedging Verbs** | `suggests\|indicates\|correlates\|may\|might` | Warns if transformed into definitive causation |

### 5.2 Word-Level Diff Generator
Generates token-by-token diff operations (`equal`, `insert`, `delete`, `replace`) using Python's `difflib.SequenceMatcher` and Rust's `similar` crate, displaying side-by-side visual diffs with accept/reject controls for individual change chunks.

---

## 6. Process Lifecycle & IPC Protocol

The Tauri Rust desktop application spawns the Python engine as a supervised subprocess communicating over JSON-RPC via standard input/output:
- **Ping / Health Check**: Ensures worker readiness within 5 seconds of launch.
- **Graceful Shutdown**: On application exit or cancellation, Rust issues an exit command followed by SIGTERM / `TerminateProcess`.
- **Zero Detached Tasks**: All worker tasks are tied to parent process handles. If the frontend window is closed or Tauri terminates, the worker exits immediately.
