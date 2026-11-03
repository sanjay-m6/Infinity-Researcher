# Phase 7 — Navigation Architecture

## 1. Overview

The navigation architecture of Infinity Researcher provides a high-density, ergonomic workstation interface for academic literature discovery, AI analysis, workspace organization, and system telemetry.

```
+---------------------------------------------------------------------------------------------------+
|  [IR] Infinity Researcher                   • TitleBar (z-40) •                  [_] [O] [X]     |
+--------+--------------------------+---------------------------------------------------------------+
| Rail   | Subnav Panel (224px)     | Application Toolbar (Header, z-20)                            |
| (56px) |                          | Breadcrumbs: Research > Discover Papers   [Search Ctrl+K] [T] |
|        | [RESEARCH]       [<]     +---------------------------------------------------------------+
| (o)    | • Discover Papers        |                                                               |
|        | • Literature Workspace   |                                                               |
| (AI)   | • My Library (14)        |                     Active Content Canvas                     |
|        | • Research Assistant     |              (Multi-Panel or Document View)                   |
| (W)    | • Paper Comparison       |                                                               |
|        | • IEEE Open Access       |                                                               |
| (S)    |                          |                                                               |
|        +--------------------------+                                                               |
| [<]    | Local Engine: Ready SQLite |                                                               |
+--------+--------------------------+---------------------------------------------------------------+
| Bottom Status Bar (z-30) : 14 Papers | 3 Collections | 0 Running Jobs | SQLite Database: 2.1 MB     |
+---------------------------------------------------------------------------------------------------+
```

## 2. Navigation Categorization & Workspace Taxonomy

The application groups all 24 scholarly workspaces into 4 primary functional categories:

### 2.1 Research Category (`research`)
- **Discover Papers (`discover`)**: Academic paper search across arXiv, PubMed, bioRxiv, medRxiv, and IEEE with live streaming ingestion and candidate verification.
- **Literature Workspace (`literature_workspace`)**: 3-pane literature exploration canvas combining collections, active paper feed, and interactive PDF/metadata inspection.
- **My Library (`library`)**: Offline index of curated and saved literature records with local full-text search.
- **Research Assistant (`research_assistant`)**: Local LLM and generative copilot for scholarly synthesis and query expansion.
- **Paper Comparison (`paper_comparison` / `review_matrix`)**: Multi-paper comparison matrix and synthesis workspace.
- **IEEE Open Access (`ieee`)**: Mode A unauthenticated IEEE Xplore harvester and open-access retrieval pipeline.

### 2.2 AI Tools Category (`ai_tools`)
- **AI Tools Hub (`ai_tools`)**: Centralized dashboard of specialized academic integrity and writing tools.
- **AI Writing Detector (`ai_writing_detector`)**: Perplexity and burstiness analysis engine.
- **Plagiarism Checker (`plagiarism_checker`)**: Local n-gram and fuzzy fingerprint matching engine.
- **AI Humanizer (`ai_humanizer`)**: Tone and voice restructuring assistant.
- **Academic Writing Assistant (`academic_writing_assistant`)**: Scholarly grammar, prose, and structure improver.
- **Paraphrasing Tool (`paraphrasing_tool`)**: Academic expression and reformulation engine.
- **Citation Checker (`citation_checker`)**: Reference verification and bibliography validation tool.
- **Readability Analyzer (`readability_analyzer`)**: Flesch-Kincaid, Gunning Fog, and SMOG reading metrics.
- **Research Integrity (`research_integrity`)**: Multi-signal composite scholarly ethics and integrity auditor.

### 2.3 Workspace Category (`workspace`)
- **Projects & Collections (`projects` / `collections`)**: Curated bibliographies and topic collections.
- **Saved Reports (`saved_reports`)**: Historical integrity and readability analysis audit reports.
- **History & Activity (`history` / `downloads` / `activity`)**: Retrieval task history, background scrapers, and audit log.
- **Workspace Overview (`dashboard`)**: Scholarly overview metrics, recent papers, and quick launch pads.

### 2.4 System Category (`system`)
- **AI Models & GPU (`ai_models` / `ai_hub`)**: Local ONNX / PyTorch models and GPU acceleration settings.
- **Academic Sources (`sources`)**: Source scraper configuration, API keys, and rate limits.
- **Settings (`settings`)**: Database diagnostics, storage cleanup, and system telemetry.
- **Privacy & Security (`privacy_security`)**: Local-first storage guarantees, cryptographic verification, and credential lockers.

## 3. State Management & Navigation Contracts

- **Active Section (`activeSection`)**: Single source of truth in `AppContext`.
- **Category Synchronization**: When `activeSection` changes, the primary rail automatically synchronizes its active category indicator via `findCategoryForSection()`.
- **Secondary Column Collapse**: Toggle state is held in React state, synchronized with `AppContext.setIsSidebarCollapsed`, and persisted in `localStorage` under key `infinity_sidebar_v3_secondary_collapsed`.
- **Keyboard Navigation**: Sub-navigation elements participate in roving tab focus and arrow-key cycling (`ArrowDown`/`ArrowUp`) with boundary wrapping.

