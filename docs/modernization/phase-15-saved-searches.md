# Phase 15: Saved Searches & Query Configurations Report

## 1. Executive Summary

Academic discovery often involves monitoring dynamic literature domains over months. Phase 15 introduces a persistent Saved Search subsystem that stores reusable search configurations (queries, sources, filters, and sorting criteria) rather than frozen snapshot results, allowing researchers to re-execute searches against live academic repositories and newly indexed local papers.

---

## 2. Data Model & Database Schema

The `saved_searches` table was introduced in Migration 0013:

```sql
CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    query_text TEXT,
    structured_query_json TEXT,
    selected_sources_json TEXT,
    filters_json TEXT,
    sort_by TEXT,
    result_count_estimate INTEGER NOT NULL DEFAULT 0,
    last_executed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_name ON saved_searches(name);
CREATE INDEX IF NOT EXISTS idx_saved_searches_last_executed ON saved_searches(last_executed_at);
```

### Key Field Design:
- **`name`**: Human-readable label (e.g. "Graph Neural Networks 2024").
- **`query_text`**: Raw keyword query string.
- **`structured_query_json`**: Serialized AST / structured query tokens from the Phase 12 search engine.
- **`selected_sources_json`**: List of enabled academic provider IDs (e.g. `["arxiv", "semanticscholar"]`).
- **`filters_json`**: Serialized filter criteria including publication year ranges, Open Access requirements, and document availability.
- **`sort_by`**: Sorting strategy token (`relevance`, `year_desc`, `citations`, etc.).
- **`last_executed_at`**: Timestamp recording when the configuration was last run.

---

## 3. Desktop API & Execution Lifecycle

The Rust backend exposes full CRUD operations:
- `list_saved_searches`
- `get_saved_search`
- `create_saved_search`
- `update_saved_search`
- `delete_saved_search`
- `touch_saved_search`

### User Workflow:
1. **Save Query:** When exploring literature in Discover or Library, the user clicks "Save Query" in the Saved Searches drawer.
2. **Execute / Apply:** In `SavedSearchesDrawer`, clicking "Apply" populates the search input, active filters, and sort dropdown in the Library or Discover workspace.
3. **Re-execution:** The search runs against live indexes, surfacing newly published or recently imported papers matching the saved parameters.

