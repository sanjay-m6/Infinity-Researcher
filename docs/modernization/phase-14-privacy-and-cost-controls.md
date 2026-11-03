# Phase 14 Privacy and Cost Controls

## 1. Privacy Guarantees

Academic researchers frequently work with sensitive unpublished manuscripts, proprietary datasets, and confidential intellectual property. Infinity Researcher implements strict privacy enforcement at the architectural level.

### 1.1 Local-Only Enforcement (`local_only_mode`)
- When enabled in `ai_settings`, all outbound network requests to remote cloud AI endpoints are blocked at the Rust service boundary.
- Any attempt to route a query to a remote provider returns an immediate error without contacting external servers.
- The UI displays an emerald badge: **"Local-Only Mode Active"**.

### 1.2 Cloud Paper Sharing Consent (`cloud_paper_sharing_enabled`)
- Even when using remote providers (e.g., Anthropic or OpenAI), paper excerpts and RAG passages are **never** transmitted to remote models unless the user has explicitly opted into `cloud_paper_sharing_enabled`.
- If disabled, only the user's abstract query is transmitted without document context.

### 1.3 Local SQLite & Vector Storage
- All extracted chunks, FTS5 indices, chat histories, and embeddings reside exclusively on the user's local disk in SQLite (`infinity-researcher.sqlite3`).
- No telemetry, search queries, or user annotations are sent to external tracking servers.

---

## 2. Cost & Quota Controls

### 2.1 Block Paid APIs (`never_use_paid_apis`)
- When activated, prevents invoking any provider marked with pay-per-token pricing.
- Eliminates unexpected billing charges for academic labs and students.

### 2.2 In-Memory Analysis Caching
- All structured analyses (Summary, Methodology, Results, Limitations, Terminology, Comparison, Gaps) are cached using a composite key:
  $$\text{Key} = \text{operation} : \text{paper\_id} : \text{model\_id}$$
- Subsequent views or tab switches hit the cache instantly without incurring additional API calls or token consumption.
- Users can selectively invalidate or re-run analysis using the **"Re-Analyze Section"** button.

