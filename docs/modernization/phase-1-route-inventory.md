# Phase 1: Complete Page and Route Inventory

This inventory documents every page, view, drawer, and modal in **Infinity Researcher** based on inspection of `src/app/App.tsx`, `src/components/layout/AppShell.tsx`, and `src/components/layout/Sidebar.tsx`.

---

## 1. Primary Navigation Routes & Views

| Navigation Identifier | Component Entry Point | Primary Purpose | Status | Backend / IPC Dependencies | Database Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard` | `src/features/dashboard/DashboardView.tsx` | Overview KPI metrics, quick actions, recent papers, and system status | **Implemented and verified** | `list_papers`, `list_collections`, `list_pdf_download_jobs` | `papers`, `collections`, `pdf_download_jobs` |
| `discover` | `src/features/discover/DiscoverView.tsx` | Academic paper discovery, multi-source query streaming, 3-pane layout, grounded assistant | **Implemented and verified** | `start_website_search_stream`, `start_python_search_stream`, `cancel_website_search`, `read_paper_pdf` | `sources`, `crawled_papers`, `papers` |
| `literature_workspace` | `src/features/literature-workspace/LiteratureWorkspaceView.tsx` | 3-panel Literature Survey workspace: paper collection, comparative matrix, and evidence synthesis | **Implemented and verified** | `list_matrix_workspaces`, `upsert_matrix_extraction`, `extract_matrix_fields` | `matrix_workspaces`, `matrix_columns`, `matrix_extractions` |
| `library` | `src/features/library/LibraryView.tsx` | Personal research library, document integrity, deduplication queue, and metadata normalization | **Implemented and verified** | `list_papers`, `start_duplicate_scan`, `list_duplicate_candidates`, `merge_papers` | `papers`, `paper_files`, `duplicate_candidates` |
| `paper_comparison` / `review_matrix` | `src/features/review-matrix/ReviewMatrixView.tsx` | Matrix spreadsheet grid comparing methodology, datasets, findings, and evidence quotes | **Implemented and verified** | `list_matrix_workspaces`, `create_matrix_workspace`, `export_matrix_csv` | `matrix_workspaces`, `matrix_columns`, `matrix_extractions` |
| `ieee` | `src/features/ieee/IeeeOpenAccessView.tsx` | IEEE Open Access paper explorer, provenance verification, and direct PDF resolution | **Implemented and verified** | `get_open_access_stats`, `list_open_access_papers`, `import_ieee_paper` | `ieee_open_access_records`, `papers` |
| `research_assistant` / `ai_hub` / `ai_models` | `src/features/ai-hub/AiHubView.tsx` | AI provider registry, model routing, hardware telemetry (GPU/VRAM), and RAG chat session | **Implemented and verified** | `list_ai_providers`, `get_ai_hardware_info`, `generate_ai_response`, `index_paper_for_rag` | `ai_providers`, `ai_task_routes`, `ai_paper_chunks`, `ai_chat_messages` |
| `ai_tools` | `src/features/ai-tools/AiToolsHubView.tsx` | Launchpad catalog for 8 specialized scholarly AI intelligence tools | **Implemented and verified** | `list_ai_task_routes`, `get_app_setting` | `app_settings`, `ai_tool_executions` |
| `ai_writing_detector` | `src/features/ai-tools/AiToolWorkspaceView.tsx` | Analyzes text for synthetic LLM patterns, burstiness, perplexity, and AI signals | **Implemented and verified** | `detect_ai_signals`, `save_integrity_report` | `integrity_reports`, `document_content_cache` |
| `plagiarism_checker` | `src/features/ai-tools/AiToolWorkspaceView.tsx` | Text similarity analysis, n-gram matching, and academic cross-source comparison | **Implemented and verified** | `start_analysis_job`, `get_analysis_job_status` | `similarity_analyses`, `integrity_findings` |
| `ai_humanizer` | `src/features/writing-workspace/AcademicWritingWorkspaceView.tsx` | Humanizes text flow while preserving citations, equations, technical terms, and evidence | **Implemented and verified** | `generate_ai_response`, `save_writing_revision` | `writing_sessions`, `writing_revisions` |
| `academic_writing_assistant` | `src/features/writing-workspace/AcademicWritingWorkspaceView.tsx` | Academic paper drafting, section-by-section structuring, and tone refinement | **Implemented and verified** | `generate_ai_response`, `save_writing_revision` | `writing_sessions`, `writing_revisions` |
| `paraphrasing_tool` | `src/features/writing-workspace/AcademicWritingWorkspaceView.tsx` | Rephrases scholarly passages with variable tone (Formal, Concise, Academic, Literature Review) | **Implemented and verified** | `generate_ai_response`, `save_writing_revision` | `writing_sessions`, `writing_revisions` |
| `citation_checker` | `src/features/citation-checker/CitationCheckerWorkspaceView.tsx` | Crossref validation, orphan citation detection, hallucination audit, and bibliography formatting | **Implemented and verified** | `save_citation_audit`, `list_citation_audits` | `citation_audits` |
| `readability_analyzer` | `src/features/readability/ReadabilityAnalyzerView.tsx` | Multi-metric readability engine (Flesch-Kincaid, Gunning Fog, Coleman-Liau, SMOG, Dale-Chall) | **Implemented and verified** | `save_readability_report`, `get_readability_report_by_hash` | `readability_reports` |
| `research_integrity` | `src/features/integrity/ResearchIntegrityView.tsx` | Multi-dimensional manuscript audit combining plagiarism, AI signals, and citation validity | **Implemented and verified** | `start_analysis_job`, `save_integrity_report`, `list_saved_integrity_reports` | `integrity_reports`, `integrity_findings` |
| `projects` / `collections` | `src/features/collections/CollectionsView.tsx` | Research projects, folders, tagged collections, and paper grouping | **Implemented and verified** | `list_collections`, `create_collection`, `delete_collection` | `collections`, `paper_collections` |
| `saved_reports` | `src/features/reports/SavedReportsView.tsx` | Central archive of generated integrity audits, citation checks, and literature reviews | **Implemented and verified** | `list_saved_integrity_reports`, `list_citation_audits` | `integrity_reports`, `citation_audits`, `readability_reports` |
| `history` / `downloads` | `src/features/downloads/DownloadsView.tsx` | Active PDF downloads queue, crawl jobs monitor, and audit activity stream | **Implemented and verified** | `list_pdf_download_jobs`, `list_crawl_jobs`, `cancel_pdf_download` | `crawl_jobs`, `pdf_metadata_cache` |
| `sources` | `src/features/sources/SourcesView.tsx` | Academic web crawling connectors, source policies, sandbox URL tester, and rate limits | **Implemented and verified** | `list_sources`, `check_website_policy`, `preview_url_extraction` | `sources`, `crawl_profiles` |
| `activity` | `src/features/activity/ActivityView.tsx` | Chronological research activity logs, filter by action type, and export | **Implemented and verified** | `get_database_info` | `schema_migrations`, `auth_audit_log` |
| `settings` | `src/features/settings/SettingsView.tsx` | System configurations: storage location, default scraping engine, auto-lock timeout, theme | **Implemented and verified** | `list_app_settings`, `set_app_setting`, `auth_get_preferences` | `app_settings`, `user_preferences` |
| `privacy_security` | `src/features/privacy/PrivacySecurityView.tsx` | Local-only data guarantees, local storage path inspector, zero-telemetry assurance | **Implemented and verified** | `get_database_info`, `get_app_setting` | `app_settings` |

---

## 2. Global Modals, Drawers & Overlay Screens

| Identifier / Modal | Component Entry Point | Trigger Mechanism | Purpose |
| :--- | :--- | :--- | :--- |
| `AuthView` (Login/Signup) | `src/features/auth/AuthView.tsx` | When `user == null` in root `MainAppContent` | Local account registration and authentication with Argon2id and login throttling |
| `LockScreenView` | `src/features/auth/LockScreenView.tsx` | When `isLocked === true` in `useApp()` | Inactivity or manual application lock screen requiring password verification |
| `EmbeddedPdfViewer` | `src/components/pdf-viewer/EmbeddedPdfViewer.tsx` | `readingPaper != null` portal in `AppShell` | High-fidelity canvas PDF viewer with search, page jump, and text selection |
| `PaperDetailDrawer` | `src/features/paper-details/PaperDetailDrawer.tsx` | `selectedPaperId != null` in `useApp()` | Slide-over drawer with full paper metadata, bibtex export, notes, and PDF actions |
| `CommandPalette` | `src/components/ui/CommandPalette.tsx` | `Ctrl+K` or `Cmd+K` keyboard shortcut | Quick command launcher and fast section navigation across the entire application |
| `OnboardingWizard` | `src/features/onboarding/OnboardingWizard.tsx` | First launch or `Help > Onboarding` | Multi-step interactive walkthrough explaining the workspace |
| `FeedbackCenterModal` | `src/features/feedback/FeedbackCenterModal.tsx` | Help menu or toolbar feedback icon | GitHub issue generator for bug reports and feature requests |
| `AboutModal` | `src/components/ui/AboutModal.tsx` | Help menu or sidebar footer link | Version details, credits, system architecture, and license information |
| `EvidenceCopilotModal` | `src/features/review-matrix/EvidenceCopilotModal.tsx` | Review Matrix toolbar button | Grounded Q&A assistant analyzing claims extracted across the review matrix |
| `EvidenceDrawer` | `src/features/review-matrix/EvidenceDrawer.tsx` | Matrix cell click | Inspects underlying sentence quote, page number, and source PDF reference |
| `ColumnConfigModal` | `src/features/review-matrix/ColumnConfigModal.tsx` | Review Matrix settings | Add, edit, reorder custom literature survey extraction columns |
| `AddPapersModal` | `src/features/review-matrix/AddPapersModal.tsx` | Review Matrix `Add Papers` | Selects papers from personal library to insert into the comparison matrix |
| `PaperImportModal` | `src/features/discover/PaperImportModal.tsx` | Discover toolbar `Import Paper` | Manual DOI, URL, or local PDF file import with automated metadata extraction |
| `CitationAuditReportModal` | `src/features/citation-checker/components/CitationAuditReportModal.tsx` | Citation Checker `Export Audit` | Formats and exports citation integrity audit report |
| `ReferenceInspectorDrawer` | `src/features/citation-checker/components/ReferenceInspectorDrawer.tsx` | Citation Checker finding row | Deep-dive into reference string, Crossref match, and DOI resolution |

---

## 3. UI/UX Condition and Modernization Opportunities

1. **Routing Architecture**:
   - Navigation is currently governed by `activeSection: NavSection` in `AppContext.tsx`.
   - **Advantage**: Instant section switching without page reload, keeping state persistent.
   - **Discover View State Persistence**: Explicitly uses `hasVisitedDiscover` and `display: hidden` so switching to Library or Settings never resets queries or streaming searches.
   - **Modernization Opportunity**: Add smooth slide/fade exit and enter transitions via `<AnimatePresence mode="wait">` using Motion for React.
2. **Layout Consistency**:
   - Some pages use full-bleed (`overflow-hidden p-0 flex flex-col h-full w-full`) while standard views use `max-w-7xl mx-auto px-6 py-6`.
   - Workspaces requiring multi-panel splitters (`DiscoverView`, `ReviewMatrixView`, `LiteratureWorkspaceView`) have slightly different divider dragging handles. These should be unified into a standardized `<ResizablePanelGroup>` component.
3. **Modal & Drawer Overlays**:
   - Multiple modal components currently implement their own `createPortal` and backdrop blur. These should be consolidated into standard Radix-powered `<Dialog>` and `<Sheet>` primitives.

