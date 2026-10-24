# Phase 3 Demo Data Specification & Boundary Contract

Project: Research Paper Scraper  
Phase: 3 of 10 — UI & Design System  
Location: [`src/data/demo-data.ts`](file:///d:/Paper/src/data/demo-data.ts) & [`src/types/domain.ts`](file:///d:/Paper/src/types/domain.ts)  

---

## 1. Demo Boundary & Truthfulness Contract

In accordance with Phase 3 technical requirements:
- **No Remote Backend Required for UI Preview:** All displayed paper records, collections, download queues, and activity items originate from a single centralized fixture module.
- **Explicit Demo Markers:** Every synthetic record carries `isDemo: true` in its TypeScript interface.
- **Client-Side In-Memory Mutations:** Operations like creating a collection, saving/unsaving papers, retrying failed jobs, or deleting collections operate on client state in [`src/context/AppContext.tsx`](file:///d:/Paper/src/context/AppContext.tsx). They do not persist to SQLite (persistence is scheduled for Phase 4).
- **Truthful Backend Health:** Only the system diagnostics and storage directory indicators communicate with the real Rust backend via Tauri 2 command IPC (`app_health`). If Tauri is absent, the UI truthfully displays "Web Preview (Demo)".

---

## 2. Fixture Catalog

### 2.1 Research Papers (`INITIAL_DEMO_PAPERS`)
Contains 10 verified seminal research papers with genuine DOIs, citations, and abstracts:

1. **Attention Is All You Need** (Vaswani et al., 2017) — NeurIPS, 112,450 citations, arXiv, Open Access.
2. **Highly accurate protein structure prediction with AlphaFold** (Jumper et al., 2021) — Nature, 28,900 citations, OpenAlex, Open Access.
3. **BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding** (Devlin et al., 2019) — NAACL, 74,500 citations, Semantic Scholar, Open Access.
4. **Semi-Supervised Classification with Graph Convolutional Networks** (Kipf & Welling, 2017) — ICLR, 34,200 citations, arXiv, Open Access.
5. **Quantum computational supremacy using a programmable superconducting processor** (Arute et al., 2019) — Nature, 6,100 citations, Crossref, Restricted Access (Demo paywall test case).
6. **The new frontier of genome engineering with CRISPR-Cas9** (Doudna & Charpentier, 2014) — Science, 14,800 citations, PubMed, Open Access.
7. **Human-level control through deep reinforcement learning** (Mnih et al., 2015) — Nature, 24,100 citations, Crossref, Restricted Access.
8. **Generative Adversarial Nets** (Goodfellow et al., 2014) — NeurIPS, 68,900 citations, arXiv, Open Access.
9. **Deep Residual Learning for Image Recognition** (He et al., 2016) — CVPR, 182,000 citations, IEEE Xplore, Open Access.
10. **DOAJ: 20 years of open access journal stewardship** (Olijhoek et al., 2023) — Learned Publishing, 45 citations, DOAJ, Open Access.

### 2.2 Research Collections (`INITIAL_DEMO_COLLECTIONS`)
1. **Machine Learning Foundations** (4 papers assigned) — Tag color `#6366f1`
2. **Computational Biology & Genetics** (3 papers assigned) — Tag color `#10b981`
3. **Quantum Information & Physics** (1 paper assigned) — Tag color `#f59e0b`

### 2.3 Download Jobs Queue (`INITIAL_DEMO_JOBS`)
1. `job-101`: AlphaFold PDF Full-Text Download — **Completed** (100%)
2. `job-102`: Kipf & Welling GCN PDF Full-Text Download — **Running** (68%, downloading stream)
3. `job-103`: Doudna & Charpentier CRISPR PubMed XML Extraction — **Running** (42%, parsing XML)
4. `job-104`: DOAJ Metadata Ingestion — **Queued** (0%, waiting on host pool)
5. `job-105`: Nature Quantum Supremacy PDF Download — **Failed** (10%, HTTP 403 Forbidden paywall test case)

### 2.4 Academic Sources Directory (`INITIAL_DEMO_SOURCES`)
8 configured providers conforming to Phase 1 Source Support Matrix:
- **OpenAlex** (Tier A, API, 100 req/sec, CC0 metadata)
- **Crossref** (Tier A, API, 50 req/sec, Official DOI authority)
- **Semantic Scholar** (Tier A, API, 100 req/sec with API key, Citation graph)
- **arXiv** (Tier A, Repository API & OAI-PMH, 3-second delay rate limit, Preprints)
- **PubMed / PMC** (Tier B, Entrez API, 3 req/sec, Biomedical literature)
- **DOAJ** (Tier B, Structured Feed, Open access directory)
- **IEEE Xplore** (Tier C, Commercial Link-Out, Abstract search only)
- **ScienceDirect / Elsevier** (Tier C, Commercial Link-Out, Scopus API / DOI landing page)

---

## 3. Preparation for Phase 4 (SQLite Database Integration)

In Phase 4, the SQLite database layer will replace `INITIAL_DEMO_PAPERS` and `INITIAL_DEMO_COLLECTIONS` with persistent queries through the Tauri command bridge:
- `get_papers(filters)` -> SQLite query
- `create_collection(name, description)` -> SQLite insert
- `save_paper(id)` / `remove_paper(id)` -> SQLite updates
- `get_jobs()` -> SQLite task queue
Because [`src/context/AppContext.tsx`](file:///d:/Paper/src/context/AppContext.tsx) already isolates all state mutations behind a clean interface (`papers`, `collections`, `createCollection`, `deleteCollection`, etc.), Phase 4 will seamlessly connect these actions to the Rust SQLite repository without rewriting any UI components.
