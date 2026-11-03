# Architecture: Unified Three-Panel Literature Workspace

**Document Version:** 1.0.0  
**Status:** Approved Specification  
**Application:** Infinity Researcher  

---

## 1. System Architecture Overview

The **Infinity Researcher Three-Panel Literature Workspace** unifies research discovery, document ingestion, literature analysis, academic drafting, and source evidence verification into a single desktop interface.

```mermaid
flowchart LR
    subgraph Desktop Shell (Tauri v2 + Rust)
        API[Tauri IPC Command Handlers]
        DB[(SQLite 3 Database\nMigrations 0001-0011)]
        PROC[PDF Processor & Lopdf]
        PY_SRV[Python Engine Service\nJSON Lines IPC]
    end

    subgraph Python Processing Engine
        SCRAPY[Scrapy Academic Spiders]
        SIGNALS[Statistical AI & Cadence Signals]
        EXTRACT[Multi-Format Extractor\nPDF, DOCX, TXT, MD]
        SIM[Winnowing Similarity Engine]
    end

    subgraph Frontend (React 19 + TypeScript)
        CTX[ProjectWorkspaceContext\nShared Evidence & Selection Bus]
        P1[Panel 1: Literature Collection\nDiscovery, Upload, Collections]
        P2[Panel 2: Research Workspace\nMatrix, Comparison, Gaps, Writer]
        P3[Panel 3: Details & Evidence\nSource Excerpts, Citations, Similarity]
    end

    P1 <--> CTX
    P2 <--> CTX
    P3 <--> CTX
    CTX <--> API
    API <--> DB
    API <--> PROC
    API <--> PY_SRV
    PY_SRV <--> SCRAPY
    PY_SRV <--> SIGNALS
    PY_SRV <--> EXTRACT
    PY_SRV <--> SIM
```

---

## 2. The Three-Panel Layout Architecture

The workspace utilizes an independently resizable, collapsible 3-column grid container. Panel widths are persisted to `localStorage` and gracefully adapt to constrained viewports.

```
+-----------------------------------------------------------------------------------------------------------+
|                                    TITLE BAR & PROJECT SELECTOR TOOLBAR                                   |
+--------------------------+---------------------------------------------------+----------------------------+
| PANEL 1: COLLECTION      | PANEL 2: RESEARCH WORKSPACE                       | PANEL 3: DETAILS & EVIDENCE|
| (Width: 260px - 450px)   | (Width: Flexible 40% - 60%)                       | (Width: 320px - 550px)     |
|                          |                                                   |                            |
| [Upload / Discovery Tab] | [Tabs: Survey | Compare | Gaps | Writer | Notes] | [Context-Sensitive View]   |
|                          |                                                   |                            |
| * Project Papers List    | TAB 1: Literature Survey Matrix                   | * Paper Metadata           |
| * Search & Keyword Filter|   (Papers x Objectives, Methods, Results, Gaps)   | * Verbatim Source Passage  |
| * Tag / Collection Filter| TAB 2: Multi-Paper Comparison Matrix              | * PDF Page Link & Jump     |
| * Extraction Status:     | TAB 3: Potential Research Gap Synthesizer         | * Claim Support Rating:    |
|   - Extracted (Ready)    | TAB 4: Structured Academic Paper Writer           |   Direct / Related / Weak  |
|   - OCR Required         |   (Title, Abstract, Methods, Results...)          | * Similarity & Plagiarism: |
|   - Failed / Queued      | TAB 5: Research Notes & Observations              |   Intervals & Matched Text |
| * Quick Actions          | TAB 6: Extracted Figures & Tables                 | * Citation Validator       |
+--------------------------+---------------------------------------------------+----------------------------+
|                                       STATUS & LOCAL-FIRST FOOTER                                         |
+-----------------------------------------------------------------------------------------------------------+
```

---

## 3. Panel Functional Specifications

### 3.1 Panel 1 — Literature Collection & Discovery
- **Input Channels:**
  - Multi-file drag-and-drop / upload (PDF, DOCX, LaTeX, TXT, Markdown).
  - Online query search across 8 academic providers (arXiv, bioRxiv, medRxiv, PubMed, PMC, PLOS, Nature, IEEE).
- **Processing States:**
  - `Queued`: Ingestion registered, awaiting extraction worker.
  - `Extracting`: Structural parsing of title, authors, abstract, sections, citations, equations, figures.
  - `Extracted`: Text and metadata indexed in SQLite; ready for matrix analysis.
  - `OCR Required`: Document is scanned/rasterized; optical recognition queued.
  - `Failed`: Corrupted file or syntax error with actionable retry trigger.
- **Collection Controls:**
  - Filter by publication year, methodology, author, tags.
  - Duplicate detection: Identifies existing papers via SHA-256 hash or canonical DOI match.
  - Project assignment: Organizes papers into dedicated research investigations.

### 3.2 Panel 2 — Research Workspace (Center Area)
Panel 2 provides 6 specialized analytical and drafting tabs:

#### Tab 1: Literature Survey
- Structured spreadsheet table where **rows = papers** and **columns = research dimensions**:
  - Research Objective
  - Proposed Methodology & Algorithms
  - Datasets & Sample Sizes
  - Empirical Results & Metrics
  - Explicit Limitations
  - Future Work Directions
- Each cell contains:
  - Extracted value summary
  - Verbatim source snippet
  - Exact source page number
  - Verification badge: `Extracted by AI`, `Verified by Researcher`, `Manual Edit`

#### Tab 2: Literature Comparison
- Side-by-side dimensional contrast across 2 to 6 selected papers.
- Highlights experimental divergence (e.g., distinct test sets, differing evaluation protocols).
- Explicitly flags when numerical scores cannot be compared directly due to non-identical baselines.

#### Tab 3: Research Gap Analysis
- Synthesizes findings across the collection to identify candidate research opportunities:
  - Frequently repeated limitations across independent studies.
  - Missing real-world deployments or benchmark evaluations.
  - Conflicting empirical findings between competing architectures.
  - Underexplored datasets or domain adaptations.
- **Epistemic Safeguard:** Every suggested gap is explicitly labeled as a **Potential Research Gap** based strictly on the current project collection, never as an unconditioned claim of universal novelty.

#### Tab 4: Research Paper Writer
- Configurable academic manuscript editor with standard scholarly sections:
  `Title`, `Abstract`, `Keywords`, `Introduction`, `Related Work`, `Problem Statement`, `Methodology`, `Experimental Setup`, `Results`, `Discussion`, `Limitations`, `Conclusion`, `References`.
- Interactive sentence/claim selection: clicking any claim instantly updates Panel 3 with source evidence.
- Full revision history and token preservation guards (protecting citations, equations, and numbers).

#### Tab 5: Research Notes & Evidence Quotes
- Searchable repository of researcher annotations, highlighted quotations, and methodology notes linked to their originating paper and page.

#### Tab 6: Figures & Tables Gallery
- Extracted visual diagrams, architecture schematics, and structured tables with original page references, captions, and attribution notices.

### 3.3 Panel 3 — Details, Evidence & Similarity Review
Panel 3 acts as the contextual ground truth inspector:
- **When a Paper is selected:** Displays full bibliographic metadata, canonical DOI, abstract, extraction health, and PDF reading launcher.
- **When a Matrix Cell or Claim is selected:** Renders the **Evidence Inspector**:
  - Originating Paper Title and Authors.
  - Verbatim source sentence/paragraph.
  - Page number with a 1-click `Open PDF at Page` trigger.
  - Evidence support assessment: `Directly Supports`, `Contextual / Related`, `Contradicts`, or `Insufficient Evidence`.
- **When Similarity Review is active:**
  - Renders Winnowing 4-gram overlap matches against project papers.
  - Merges overlapping match intervals to guarantee that words are never double-counted.
  - Categorizes findings: `Exact Match`, `Near Match`, `Paraphrase Candidate`, `Common Technical Phrase`, `Quoted with Citation`.
  - Side-by-side passage comparison with review action buttons (`Acknowledge`, `Properly Quoted`, `False Positive`).
- **When Citation Check is active:**
  - Displays unmatched citations, uncited references, and canonical DOI syntax/metadata verification.

---

## 4. Shared State Architecture (`ProjectWorkspaceContext`)

To prevent panel disconnect, state is managed through a central `ProjectWorkspaceContext`:

```typescript
export interface ProjectWorkspaceState {
  // Project Scope
  activeProjectId: string;
  activeProjectTitle: string;
  
  // Panel 1: Document Collection
  papers: LiteraturePaperItem[];
  selectedPaperId: string | null;
  searchFilter: string;
  activeTag: string | null;
  
  // Panel 2: Workspace Tab & Section
  activeTab: "survey" | "compare" | "gaps" | "writer" | "notes" | "figures";
  selectedMatrixCell: {
    paperId: string;
    columnKey: string;
    extractionId?: string;
  } | null;
  selectedWritingClaim: {
    sectionId: string;
    claimText: string;
    linkedPaperIds: string[];
    linkedPage?: number;
    evidenceSnippet?: string;
  } | null;
  
  // Panel 3: Contextual Inspector State
  inspectorMode: "paper_details" | "source_evidence" | "similarity_review" | "citation_audit" | "figure_preview";
  activeEvidenceSnippet: {
    paperId: string;
    paperTitle: string;
    pageNumber: number;
    verbatimText: string;
    confidence: number;
    supportRating: "direct" | "related" | "contradictory" | "unverified";
  } | null;
  activeSimilarityMatch: SimilarityFindingItem | null;
  
  // Layout Management
  isPanel1Collapsed: boolean;
  isPanel3Collapsed: boolean;
  panel1Width: number;
  panel3Width: number;
}
```

---

## 5. Database Schema & Persistence Alignment

The workspace leverages existing SQLite tables from migrations 0001 through 0011:

| Workspace Entity | Primary Table(s) | Key Columns & Indexes |
|---|---|---|
| **Project & Collection** | `collections`, `paper_collections` | `id`, `name`, `description`, `color` |
| **Paper Document** | `papers`, `paper_files`, `integrity_documents` | `id`, `title`, `authors`, `doi`, `document_hash`, `pdf_path`, `extraction_status` |
| **Literature Matrix** | `review_matrix_workspaces`, `review_matrix_columns` | `workspace_id`, `key`, `name`, `data_type`, `sort_order` |
| **Cell Extractions** | `review_matrix_extractions` | `workspace_id`, `paper_id`, `column_id`, `extracted_value`, `source_snippet`, `source_page`, `verification_status` |
| **Paper Writing Drafts** | `writing_sessions`, `writing_revisions` | `session_id`, `original_text`, `revised_text`, `preserved_citations_ok`, `is_accepted` |
| **Citation Audits** | `citation_audits`, `doi_cache` | `document_hash`, `health_score`, `summary_json`, `issues_json`, `references_json` |
| **Similarity Corpus** | `corpus_fingerprints`, `similarity_matches` | `corpus_id`, `paper_id`, `fingerprint_hash`, `matched_span_start`, `matched_span_end` |
| **Background Jobs** | `analysis_jobs` | `id`, `document_hash`, `job_type`, `status`, `progress_pct`, `created_at` |

---

## 6. Privacy & Execution Boundaries

1. **Local-First Default:** All text extraction, Winnowing similarity checking, citation verification, matrix editing, and gap analysis run strictly on-device using Rust, SQLite, and Python.
2. **Explicit Remote Consent:** If a user selects an optional remote LLM provider (e.g. Gemini, OpenAI, Claude) for manuscript drafting assistance, a mandatory confirmation modal appears before any draft text leaves the desktop.
3. **Immutable Originals:** Uploaded PDFs and manuscripts are never overwritten or altered. All extraction data is stored as non-destructive metadata.

