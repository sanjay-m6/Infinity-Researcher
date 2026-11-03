# Phase 15: Research Notes & Reading Progress Report

## 1. Executive Summary

Scholarly literature workflows require tracking reading lifecycle states and maintaining verifiable, anchored annotations. Phase 15 establishes persistent reading status transitions, tracks last-opened timestamps, and introduces anchored research notes with cross-document search capability.

---

## 2. Reading Status Lifecycle & Timestamps

Papers progress through four canonical reading lifecycle states:

```
┌───────────┐      Open / Start Reading       ┌─────────────┐
│  unread   │ ──────────────────────────────> │ in_progress │
└─────┬─────┘                                 └──────┬──────┘
      │                                              │ Finish
      │ Direct Mark                                  │ Reading
      ▼                                              ▼
┌───────────┐      Archive after Review       ┌─────────────┐
│ archived  │ <────────────────────────────── │    read     │
└───────────┘                                 └─────────────┘
```

### State Definitions & Schema Attributes:
- **`unread`**: Default state on paper discovery and import; progress = 0%.
- **`in_progress`**: Set automatically upon opening in reader or via inline dropdown; displays animated pulsing badge.
- **`read`**: Fully digested paper; progress = 100%.
- **`archived`**: Retained for historical reference or completed survey inclusion.
- **`last_opened_at`**: ISO 8601 timestamp touched automatically whenever the paper is opened in the integrated PDF reader or literature workspace. Enables sorting by `recently_opened`.

---

## 3. Research Notes Model & Page Anchors

The SQLite `notes` schema in Migration 0013 was expanded to support page and quotation anchors:

```sql
ALTER TABLE notes ADD COLUMN page_number INTEGER;
ALTER TABLE notes ADD COLUMN highlighted_text TEXT;
```

### Anchor Semantics:
- **`page_number`**: Specifies the exact PDF page where the note or quote originated (e.g. Page 4 for equation definition).
- **`highlighted_text`**: Excerpted quote from the paper, visually styled in a distinct quotation block.
- **`content_markdown`**: Researcher's personal analysis, critique, or synthesis.
- **User Integrity Policy:** User-authored notes are strictly protected; AI Research Assistant responses or automated summaries are never written over user research notes.

---

## 4. Cross-Document Notes Search

Researchers can discover notes across their entire literature repository using the new `search_notes` backend command. The modal displays:
- Note title and parent paper title.
- Direct page badge (e.g. "Page 4").
- Italicized quote excerpt.
- Full markdown content preview.
- "Open Paper" action button that opens the paper directly in the PDF workspace.

