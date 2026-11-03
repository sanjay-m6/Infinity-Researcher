Execute Phase 1 of the Infinity Researcher Research Tools module enhancement by performing a comprehensive audit across the existing frontend, Rust backend, Python backend, and SQLite database, delivering the audit report, and repairing existing broken functionality. Preserve all working functionality and user data without introducing mock implementations or replacing architecture prematurely.

Integrity mode: development

## Requirements

### R1. Full-Stack Codebase Audit
Inspect all existing Research Tools components in the repository across:
- Frontend: Research Tools navigation, Tools Hub, the nine existing tool pages (AI Writing Detector, Plagiarism Checker, AI Humanizer, Academic Writing Assistant, Paraphrasing Tool, Citation Checker, Readability Analyzer, Research Integrity), shared components, document upload, PDF reader integration, global loading, theme engine, and report views.
- Rust Backend: Tauri commands, document handling, database access, file processing, background workers, AI orchestration, event communication, cancellation, and error handling.
- Python Backend: PDF extraction, OCR, NLP, text similarity, document processing, AI model integrations, and reference extraction.
- Database: Document tables, research papers, projects, citations, AI requests, analysis history, settings, and file references.
Document all findings in `docs/research-tools/CURRENT_IMPLEMENTATION_AUDIT.md` including existing features, functional features, broken features, incomplete features, mock implementations, reusable components, missing backend services, dependency problems, database gaps, technical risks, and the recommended implementation sequence.

### R2. Existing Tool Repair and Stabilization
Fix broken or nonfunctional features identified in the nine existing Research Tools without breaking existing working functionality or modifying user data schemas without backward compatibility. Eliminate placeholder or mock logic where functional backend implementations can be stabilized or wired to actual handlers.

### R3. Test Fixture Generation and Offline Execution Support
Establish synthetic test documents (PDF, DOCX, TXT) and test fixtures to validate document processing and repair verification. Ensure all tools, tests, and repairs operate with local/offline fallback handling so workflows and test suites execute cleanly without requiring external cloud API keys or missing local system binaries.

## Verification Resources
- Generate synthetic test documents (PDF, DOCX, TXT) and test papers covering standard research paper structures (title, abstract, sections, citations, references, tables, figures).
- Use local test runners for frontend (`npm test` / Vitest), Rust backend (`cargo test`), and Python backend (`pytest`).

## Acceptance Criteria

### Audit Deliverable
- [ ] `docs/research-tools/CURRENT_IMPLEMENTATION_AUDIT.md` exists and contains dedicated sections for Existing Features, Functional Features, Broken Features, Incomplete Features, Mock Implementations, Reusable Components, Missing Backend Services, Dependency Problems, Database Gaps, Technical Risks, and Recommended Implementation Sequence.
- [ ] Every audited tool among the nine existing tools is explicitly inventoried with current status and file paths.

### Codebase Integrity & Tool Repair
- [ ] All broken functionality identified during the audit for the nine existing tools is repaired and verified functional.
- [ ] Existing working features, routes, and user data remain intact with zero regressions.
- [ ] No repaired tool relies on fabricated analysis percentages or mock UI data.
- [ ] Offline fallback mechanisms allow tools and tests to execute without failure when external API keys or external services are unavailable.

### Automated Verification
- [ ] Synthetic test fixtures (PDF, DOCX, TXT) are present in the repository test directory.
- [ ] Frontend tests pass without errors.
- [ ] Rust backend tests (`cargo test`) pass without errors.
- [ ] Python backend tests pass without errors.
