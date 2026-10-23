# Phase 1 Documentation Index: Requirements, Source Research, and System Logic

**Project:** Research Paper Scraper  
**Product Type:** Standalone, Local-First Desktop Research Application  
**Target Architecture:** Tauri 2 (Rust Backend + React/TypeScript/Vite Frontend) with SQLite 3 (FTS5)  
**Status:** Approved Specification (Stop/Go Gate: **PASSED**)  
**Last Updated:** 2026-10-24  

---

## 1. Directory Structure & Deliverable Map

The Phase 1 deliverables provide an evidence-based, traceable blueprint for building the Research Paper Scraper. All files are located in `docs/phase-1/`:

```
docs/
└── phase-1/
    ├── README.md                              <- Master Phase 1 index and executive overview
    ├── workspace-assessment.md                <- Toolchain, environment, and repository audit
    ├── evidence-sources.md                    <- Verified facts, official API endpoints, and source policies
    ├── source-support-matrix.md               <- Comprehensive source capability and tier evaluation
    ├── source-support-matrix.csv              <- Tabular CSV export of candidate sources and tiers
    ├── product-requirements.md                <- PRD: problem statement, personas, and 22 functional requirements
    ├── core-user-journeys.md                  <- 14 end-to-end user workflows with error and success states
    ├── collection-and-compliance-policy.md    <- Legal, ethical, and rate-limiting collection rules
    ├── system-workflows-and-logic.md          <- System logic, flowcharts, deduplication, and download pipeline
    ├── domain-model.md                        <- SQLite schema, entities, indexes, and FTS5 virtual tables
    ├── domain-model.mmd                       <- Mermaid Entity Relationship diagram
    ├── architecture-overview.md               <- System subsystem boundaries, IPC bridge, and headless browser analysis
    ├── ui-and-interaction-specification.md    <- 11 desktop screens, layout frames, accessibility, and error states
    ├── security-privacy-risk-register.md      <- 12 STRIDE risks (SSRF, path traversal, XSS) and test specs
    ├── non-functional-requirements.md         <- Measurable NFRs, reference hardware, and benchmark protocol
    ├── phase-plan.md                          <- Ten-phase engineering execution roadmap
    ├── assumptions-and-open-questions.md      <- Verified facts, explicit assumptions, and non-blocking choices
    ├── phase-1-acceptance-checklist.md        <- Stop/go acceptance audit (16/16 gates passed)
    └── adr/
        ├── ADR-001-local-first-architecture.md         <- Tauri 2 + Rust + React + SQLite choice
        ├── ADR-002-source-connector-model.md           <- Trait-based connectors and capability tiers
        ├── ADR-003-paper-identity-and-deduplication.md <- Multi-tiered deduplication strategy
        └── ADR-004-local-file-storage-and-indexing.md  <- Relative storage paths and FTS5 indexing
```

---

## 2. Executive Summary of Key Architectural Choices

1. **Local-First & Offline Usability (ADR-001):**  
   The application requires zero mandatory remote servers or cloud accounts. All metadata, notes, collections, and PDFs reside on the researcher's local machine in SQLite (WAL mode) and a user-managed document directory.
2. **Strict Compliance & Ethics (Collection Policy):**  
   The app will never attempt to evade paywalls, crack CAPTCHAs, spoof browser fingerprints, or rotate proxies. If full text is restricted, the app preserves metadata and provides an official link-out.
3. **Multi-Source Federated Search (Source Support Matrix):**  
   P0 MVP integrates OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC, and Local PDF Import. All network access utilizes official JSON/XML APIs bounded by strict per-host token bucket rate limiters.
4. **No Headless Browser Overhead (Architecture Overview):**  
   Because all prioritized sources offer official APIs, bundling a heavy Chromium/Puppeteer runtime is avoided. This preserves a lightweight $\approx 25\text{ MB}$ installer, $< 120\text{ MB}$ RAM footprint, and eliminates anti-bot blocking risks.
5. **Multi-Tiered Deduplication (ADR-003):**  
   Automatic merging is strictly restricted to verified canonical DOIs and stable repository IDs (e.g. arXiv IDs). Fuzzy title similarity matches are surfaced to an interactive review workspace to prevent citation corruption.
6. **Robust Anti-SSRF and Safe Ingestion Pipeline (Security Register):**  
   Pre-connection DNS filtering blocks private RFC 1918, loopback, and cloud metadata addresses. Streaming downloads verify `%PDF-` magic bytes and enforce a 100 MB limit, discarding HTML error pages disguised as PDFs.

---

## 3. Stop / Go Gate Verdict

All 16 acceptance criteria defined in the Phase 1 Master Contract have been verified and documented. **Phase 1 is complete.** The project is ready for **Phase 2 — Architecture and Project Foundation**.
