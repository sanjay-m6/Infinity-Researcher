# Research Integrity & Academic Writing Assistant User Guide

Welcome to the **Research Integrity & Academic Writing Suite**, a local-first workspace integrated into the Research Paper Scraper desktop application. This guide explains how to use each tool effectively while adhering to best practices in academic publishing and research ethics.

---

## 1. Navigating to the Suite

In the application's left sidebar, click the **Integrity & Writing** navigation item (shield icon). The dashboard presents three primary workspaces alongside a local privacy indicator:

```
+-----------------------------------------------------------------------------------+
|  [Shield] Research Integrity & Academic Writing Suite    [Badge: Local Only]      |
+-----------------------------------------------------------------------------------+
|  +--------------------+  +--------------------+  +--------------------+           |
|  | Check Similarity   |  | AI-Writing Signals |  | Improve Writing    |           |
|  | Find literal and   |  | Inspect statistical|  | Polish academic    |           |
|  | near-exact matches |  | uniformity with    |  | style, tone, and   |           |
|  | in local corpus.   |  | uncertainty caveat.|  | preserve citations.|           |
|  +--------------------+  +--------------------+  +--------------------+           |
+-----------------------------------------------------------------------------------+
|  [Drag & Drop Document Area (PDF, DOCX, LaTeX, TXT)]   [Pick from Library]        |
+-----------------------------------------------------------------------------------+
```

---

## 2. Ingesting Documents

You can analyze a manuscript using three methods:
1. **File Upload / Dropzone**: Drag and drop a `.pdf`, `.docx`, `.tex`, or `.txt` file onto the dropzone.
2. **Paste Text**: Click **Paste Text** in the ingestion dialog to test an excerpt or draft paragraph.
3. **Select from Research Library**: Click **Choose from Research Library** to pick any academic paper already saved or crawled into your local SQLite library.

---

## 3. Tool 1: Plagiarism & Similarity Checker

The Similarity Checker finds exact and near-exact matching passages between your manuscript and the indexed local corpus.

### 3.1 Understanding the Three-Pane Workspace
- **Left Pane (Outline & Findings)**:
  - **Summary Metrics**: Displays the net de-duplicated similarity ratio, matched character count, and total analyzed sources.
  - **Match List**: Lists all identified matches with source titles, page numbers, match types (`exact`, `fingerprint`, `fuzzy`, or `semantic_candidate`), and current review statuses.
  - **Source Filter**: Filter findings by specific source papers.
- **Center Pane (Document Viewer)**:
  - Renders your manuscript text with color-coded highlights for matched spans.
  - Clicking any match in the left list scrolls the center viewer directly to the corresponding passage.
- **Right Pane (Evidence & Review Controls)**:
  - Displays the query passage side-by-side with the matched source passage.
  - Provides source metadata and clickable DOI / web links.
  - **Review Controls**: Classify each match as:
    - `Mark as Quote`: Flags properly cited verbatim quotes.
    - `Citation Present`: Marks paraphrased text with valid bibliographic citations.
    - `Boilerplate`: Excludes standard institutional phrasing or publisher notices.
    - `Not a Match`: Disregards false-positive overlaps.

### 3.2 Managing the Local Corpus
Click **Manage Corpus** to view indexed documents:
- **Corpus Scope Notice**: The checker can only match against documents that have been indexed into your local database. It does not perform an unconstrained crawl of the entire web.
- **Index Library**: Click **Index All Papers** to convert all PDFs in your research library into Winnowing fingerprints.
- **Add Files / Folders**: Index specific external reference documents or conference proceedings.
- **Safe Deletion**: Removing an entry from the corpus removes its search fingerprints without deleting the underlying PDF file.

---

## 4. Tool 2: AI-Writing Signal Analyzer (Experimental)

The AI-Writing Signal Analyzer estimates statistical regularity, lexical entropy, and sentence burstiness.

### 4.1 Important Ethical Guidelines
- **Not Proof of Misconduct**: Language model classifiers detect statistical uniformity, not author identity. Never use these signals to accuse students, researchers, or colleagues of misconduct.
- **Minimum Text Requirement**: Text must contain at least **80 words**. Short snippets display `Insufficient text for statistical analysis`.

### 4.2 Interpreting the Dashboard
- **Stylometric Metrics**:
  - **Lexical Entropy**: High entropy indicates rich vocabulary variation typical of human expression; low entropy indicates repetitive phrasing.
  - **Sentence Burstiness**: Human writing mixes short and long sentences; machine drafts tend toward uniform sentence lengths.
- **Paragraph Heatmap**:
  - Highlights individual paragraphs based on statistical regularity.
  - Click on any paragraph to view detailed sentence length distributions.

---

## 5. Tool 3: Academic Writing Assistant

The Writing Assistant improves manuscript clarity, tone, and conciseness while strictly preserving scientific meaning and citations.

### 5.1 Selectable Academic Modes
Select a mode from the top toolbar:
- **Academic Tone**: Transforms informal phrasing into formal scholarly register.
- **Improve Clarity**: Simplifies convoluted syntax and untangles nested clauses.
- **Make More Concise**: Eliminates unnecessary qualifiers and wordiness.
- **Abstract Review**: Enhances structure (background, methodology, results, implications).
- **Methodology Clarity**: Ensures experimental procedures are sequential and precise.
- **Results & Discussion**: Refines the presentation of empirical findings.
- **Hedging & Epistemic Caution**: Softens overstatements (e.g., replaces "proves" with "indicates").

### 5.2 Protected Token Preservation
The assistant automatically validates every revision. If an edit inadvertently alters:
- **Numbers & Quantities** (e.g., `49 qubits`, `10 mK`)
- **Citation Markers** (e.g., `[1]`, `(Smith et al., 2024)`)
- **DOI Identifiers or Equations**

A warning badge appears: `⚠️ Protected Token Modified`. You can review the inline word diff and reject individual changes using the `Accept` and `Reject` buttons.

### 5.3 Saving Revisions
- The original document remains immutable.
- Each revision session is saved separately under `Revisions`.
- Click **Save Revision** or **Export** to save the polished manuscript to disk.
