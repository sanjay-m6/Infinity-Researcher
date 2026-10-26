# Literature Review Matrix & Evidence-Linked Copilot

## 1. Overview & Vision
The **Literature Review Matrix** and **Evidence-Linked AI Copilot** transform the Research Paper Scraper from an isolated discovery tool and PDF viewer into a comprehensive **AI Research Workbench**.

Researchers frequently face friction when transitioning between discovering literature, extracting findings, performing comparative analysis, and writing scholarly reviews:
- Studies are manually copied into spreadsheets with claims detached from their sources.
- AI summaries hallucinate or fail to provide exact page numbers.
- Adding papers to a comparative synthesis requires tedious copy-pasting or file re-importing.

This system resolves these bottlenecks through a **local-first, evidence-traceable, and continuous desktop workflow**:
1. **Literature Review Matrix**: Organizes papers into a comparative spreadsheet across 9 standard PRISMA/empirical dimensions (Research Question, Methodology, Dataset, Sample Size, Model/Architecture, Evaluation Metrics, Main Results, Limitations, and Future Work).
2. **Claim-to-Page Traceability**: Every extracted claim maintains a verifiable link to its supporting verbatim passage and exact PDF page number.
3. **Evidence-Linked Copilot**: A grounded conversational assistant that searches library chunks and returns synthesized answers with clickable page citation chips.
4. **Seamless Cross-Tool Continuity**: Seamlessly transition from the Discover view to the Review Matrix with a single click, open the exact PDF page in the Reader, or inspect extractions in the slide-over Evidence Drawer.

---

## 2. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          React / TypeScript UI                         │
│                                                                        │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │   ReviewMatrixView      │  │        EvidenceCopilotModal          │ │
│  │ - Spreadsheet Data Grid │  │ - Multi-turn conversational Q&A      │ │
│  │ - Dimension Config      │  │ - Clickable citation chips           │ │
│  │ - Search & Filter       │  │ - "Show Supporting Evidence" drawer  │ │
│  │ - RFC 4180 CSV Export   │  │ - Jump to PDF page                   │ │
│  └───────────┬─────────────┘  └──────────────────┬───────────────────┘ │
│              │                                   │                     │
│  ┌───────────▼───────────────────────────────────▼───────────────────┐ │
│  │                      EvidenceDrawer.tsx                           │ │
│  │ - Supporting passage quote & page badge                           │ │
│  │ - Human verification toggle & claim editor                        │ │
│  │ - "Jump to Page in PDF Reader" action                             │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Tauri IPC (14 Commands)
┌────────────────────────────────────▼───────────────────────────────────┐
│                           Rust Desktop Core                            │
│                                                                        │
│  ┌───────────────────────────────┐   ┌───────────────────────────────┐ │
│  │     commands::matrix          │   │      MatrixService            │ │
│  │ - list_matrix_workspaces      │   │ - extract_paper_dimensions()  │ │
│  │ - get_matrix_workspace        │   │ - synthesize_copilot_answer() │ │
│  │ - add_paper_to_workspace      │   │ - export_workspace_csv()      │ │
│  │ - update_matrix_extraction    │   │                               │ │
│  │ - ask_evidence_copilot        │   │                               │ │
│  └───────────────┬───────────────┘   └───────────────┬───────────────┘ │
│                  │                                   │                 │
│  ┌───────────────▼───────────────────────────────────▼───────────────┐ │
│  │                      MatrixRepository                             │ │
│  │ - SQLite schema migration 0009                                    │ │
│  │ - matrix_workspaces & matrix_workspace_papers                     │ │
│  │ - matrix_extractions (with evidence JSON & verification status)   │ │
│  │ - evidence_copilot_sessions & messages                            │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ SQLite
┌────────────────────────────────────▼───────────────────────────────────┐
│               Local SQLite Database (schema version 9)                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema (Migration 0009)

The matrix and copilot subsystem is persisted locally via SQLite tables:

### `matrix_workspaces`
Stores project review workspaces, custom column schemas, and metadata.
- `id` (TEXT PRIMARY KEY): Unique identifier (e.g. `default_matrix`).
- `name` (TEXT NOT NULL): Workspace name.
- `description` (TEXT): Workspace research objective.
- `columns_json` (TEXT NOT NULL): JSON-serialized array of column definitions (key, label, description, visible, width).
- `created_at` / `updated_at`: ISO-8601 timestamps.

### `matrix_workspace_papers`
Join table linking papers into workspaces with customizable sorting orders.
- `workspace_id` (TEXT NOT NULL REFERENCES `matrix_workspaces(id)` ON DELETE CASCADE)
- `paper_id` (TEXT NOT NULL REFERENCES `papers(id)` ON DELETE CASCADE)
- `display_order` (INTEGER NOT NULL DEFAULT 0)
- `added_at` (TEXT NOT NULL)
- PRIMARY KEY (`workspace_id`, `paper_id`)

### `matrix_extractions`
Stores individual dimension extractions for each paper in a workspace.
- `id` (TEXT PRIMARY KEY)
- `workspace_id` (TEXT NOT NULL REFERENCES `matrix_workspaces(id)` ON DELETE CASCADE)
- `paper_id` (TEXT NOT NULL REFERENCES `papers(id)` ON DELETE CASCADE)
- `column_key` (TEXT NOT NULL): Column dimension key (e.g. `methodology`, `limitations`).
- `extracted_claim` (TEXT NOT NULL): Extracted factual summary.
- `confidence` (TEXT NOT NULL): `high`, `medium`, or `low`.
- `evidence_json` (TEXT NOT NULL): JSON array of `EvidenceSource` objects containing `{ page_number, verbatim_quote, section_title, char_start, char_end }`.
- `user_verified` (BOOLEAN NOT NULL DEFAULT 0): Human verification flag.
- `user_notes` (TEXT): Optional researcher annotations.

### `evidence_copilot_sessions` & `evidence_copilot_messages`
Stores multi-turn conversational chat sessions grounded in paper library context, including citation chips and references.

---

## 4. Academic Extraction Dimensions

The extraction engine analyzes paper abstracts, indexed text chunks, and PDF pages across 9 core dimensions:

| Column Key | Label | Description | Extraction Pattern / Heuristic |
| :--- | :--- | :--- | :--- |
| `research_question` | Research Question | Problem statement or hypothesis | Matches "we investigate", "this paper addresses", "the aim of", questions |
| `methodology` | Methodology | Study design, algorithm, or experimental setup | Matches "we propose", "methodology", "framework", "architecture" |
| `dataset` | Dataset | Benchmarks, corpora, or data sources | Matches "dataset", "benchmark", "trained on", "corpus", "ImageNet" |
| `sample_size` | Sample Size | Population, subjects, epochs, or parameters | Matches "sample size", "participants", "parameters", "N =", "patients" |
| `model` | Model / Architecture | Neural network or theoretical formulation | Matches "transformer", "resnet", "quantum circuit", "deep learning" |
| `evaluation_metrics` | Evaluation Metrics | Quantitative metrics used for validation | Matches "accuracy", "F1", "BLEU", "perplexity", "latency", "MSE" |
| `main_results` | Main Results | Primary findings, improvements, or baselines | Matches "achieves", "outperforms", "improves by", "state-of-the-art" |
| `limitations` | Limitations | Shortcomings, bounds, or potential biases | Matches "limitation", "drawback", "computational overhead", "assumption" |
| `future_work` | Future Work | Open avenues for further research | Matches "future work", "further investigation", "remains open", "next step" |

Researchers can also define custom column dimensions (e.g. `hardware_platform`, `clinical_endpoint`) via the **Configure Columns** modal.

---

## 5. Evidence-Linked AI Copilot

The Evidence-Linked Copilot provides grounded Q&A over the entire research library:
1. **Library Retrieval**: Queries the local SQLite Full-Text Search (FTS5) table over chunked paper sections (`paper_chunks_fts`).
2. **Grounded Synthesis**: Produces structured answers referencing specific papers and section headers.
3. **Citations & Quotes**: Each answer includes clickable source chips indicating the paper title, section name, and exact PDF page number.
4. **Direct PDF Navigation**: Clicking any citation opens the exact PDF page in the viewer without manual scrolling.

---

## 6. RFC 4180 CSV Export

The matrix view provides one-click export of comparison tables to standard CSV format:
- Properly escapes quotes, commas, and multiline text per RFC 4180.
- Includes paper titles, publication years, venues, and all visible dimensions.
- Ready for immediate import into Microsoft Excel, Google Sheets, or R/Python dataframes.

---

## 7. Testing & Verification

The suite is verified across all layers:
- **Rust Integration Tests** (`src-tauri/tests/matrix_tests.rs`): Tests workspace creation, paper addition, heuristic extractions, manual claim verification, CSV generation, and copilot synthesis.
- **Frontend Vitest Suite** (`src/test/review-matrix-suite.test.tsx`): Tests data grid rendering, evidence drawer opening, column configuration, search filtering, and AddPapersModal interaction.
- **Continuous Continuity**: Navigation links from Discover, Library, and PDF reader maintain session context.
