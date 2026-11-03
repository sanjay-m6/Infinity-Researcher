# Phase 15: Collection Management & Safe Dissociation Report

## 1. Executive Summary

Collection management in Infinity Researcher enables scholars to group literature thematically across projects, reviews, and systematic surveys. Phase 15 enforces strict safe-unlinking semantics: deleting or modifying collections never cascades into paper record destruction or local PDF file deletion.

---

## 2. Relational Model & Safe Dissociation

The relational schema decouples collections from core paper records via a many-to-many junction table:

```sql
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    color_hex TEXT NOT NULL DEFAULT '#6366f1',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paper_collections (
    paper_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (paper_id, collection_id),
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);
```

### Safety Guarantee Matrix:

| Operation | Papers Table | Local PDF Files | Junction Records |
| :--- | :--- | :--- | :--- |
| **Delete Collection** | Preserved (untouched) | Preserved on disk | Unlinked (`DELETE FROM paper_collections`) |
| **Remove Paper from Collection** | Preserved (untouched) | Preserved on disk | Specific pair unlinked |
| **Rename Collection** | Preserved (untouched) | Preserved on disk | Name updated in `collections` |
| **Remove Paper from Library** | Flagged `is_saved = 0` | Preserved in storage | Membership retained for restore |

---

## 3. Real-Time Counter & Bulk Operations

1. **Live Paper Counts:**
   - Both the sidebar and library filter dropdown display dynamic counts calculated by joining `paper_collections` with active papers.
2. **Bulk Assignment:**
   - Researchers can select multiple papers using multi-select checkboxes and assign them simultaneously to any target collection via `handleBulkAddToCollection`.
3. **Filtering by Collection:**
   - In `LibraryView`, filtering by collection isolates papers linked to that collection ID while maintaining active search query and status filters.

