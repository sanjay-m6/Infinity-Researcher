# Empirical Challenge Report: Milestone M3 Foreign Key Stability

**Agent**: challenger_m3_1 (teamwork_challenger)  
**Roles**: critic, specialist  
**Target**: `src-tauri/src/repositories/ai_tools_repo.rs` (`save_writing_revision`) & Milestone M3 deliverables  
**Test Suite**: `src-tauri/tests/ai_tools_fk_stress_tests.rs`  
**Date**: 2026-11-03T08:14:00Z  

---

## Challenge Summary

**Overall risk assessment**: LOW

Worker M3's foreign key stabilization fix for `save_writing_revision` was empirically stress-tested using adversarial generators, extreme edge cases, unseeded random identifiers, high-volume batches, and concurrent multi-threaded writes. Under strict `PRAGMA foreign_keys = ON;`, the two-stage self-healing parent row ensurance pattern (`integrity_documents` -> `writing_sessions` -> `writing_revisions`) demonstrated 100% integrity with zero SQLite constraint errors and zero dangling child rows across all stress scenarios.

---

## Challenges & Adversarial Scenarios

### [Low Risk] Challenge 1: Unparented Random `session_id` and `document_id` Ingestion
- **Assumption challenged**: `save_writing_revision` relies on pre-existing rows in `writing_sessions` and `integrity_documents`. If arbitrary random UUIDs are passed without pre-seeding, SQLite will raise `FOREIGN KEY constraint failed (code 787)`.
- **Attack scenario**: Calling `save_writing_revision` with a randomly generated UUID `sess_<uuid>` on an empty database with strict `PRAGMA foreign_keys = ON`.
- **Blast radius**: If this fails, UI clients creating revisions for standalone or pasted text sessions crash on database write.
- **Empirical verification**: Executed in `test_fk_stability_arbitrary_random_nonexistent_ids`.
- **Mitigation/Behavior**: `save_writing_revision` executes:
  1. `INSERT OR IGNORE INTO integrity_documents` with default record `'doc_default_session'`.
  2. `INSERT OR IGNORE INTO writing_sessions` with `id = rev.session_id` and `document_id = 'doc_default_session'`.
  3. `INSERT INTO writing_revisions` with `session_id = rev.session_id`.
  Both parent rows were automatically synthesized, the revision was inserted, and SQLite's `pragma_foreign_key_check()` verified 0 constraint violations.

### [Low Risk] Challenge 2: High-Volume Session Churn and Repeated Revision Batches
- **Assumption challenged**: Repeatedly inserting revisions for 100 distinct random sessions in rapid succession could trigger primary key collision on the default document or cascading foreign key errors.
- **Attack scenario**: 100 distinct random UUID sessions, each receiving 2 sequential revisions (200 total revisions) in a tight loop.
- **Blast radius**: High throughput writing sessions could fail or drop revisions.
- **Empirical verification**: Executed in `test_fk_stability_stress_100_random_sessions`.
- **Result**: 200 revisions and 100 sessions created and verified via `list_writing_revisions` reverse-chronological ordering. Full database audit via `pragma_foreign_key_check()` confirmed 0 violations across all 300 database rows.

### [Low Risk] Challenge 3: Custom Document ID Preservation vs Default Session Overwriting
- **Assumption challenged**: The fallback logic might overwrite or clobber custom `document_id` associations if a `writing_sessions` row was previously bound to a specific document.
- **Attack scenario**: Ingest custom document `doc_custom_<uuid>`, manually bind `sess_custom_<uuid>` to it, and invoke `save_writing_revision`.
- **Blast radius**: User sessions could lose their association with their parent research papers and mistakenly revert to the default document.
- **Empirical verification**: Executed in `test_fk_stability_with_custom_document_id_preservation`.
- **Result**: Because `INSERT OR IGNORE` was used, existing rows are untouched. The session's `document_id` remained strictly bound to `doc_custom_<uuid>`. `pragma_foreign_key_check()` returned 0 violations.

### [Low Risk] Challenge 4: Edge Case Session Identifiers and Cascade Deletion Resilience
- **Assumption challenged**: Special characters (tabs, spaces, unicode emojis, non-Latin scripts, punctuation symbols) or extreme string lengths in `session_id` might fail escaping or corrupt SQLite indexing. Additionally, deleting parent rows might leave dangling child revisions.
- **Attack scenario**: Tested session IDs with `\t`, emojis (`🔥`), multi-script text (`日本語_русский_عربي`), punctuation (`!@#$%^&*()_+-=[]{}|;':",.<>?/~`), and 250-character strings. Tested cascading deletes by deleting `writing_sessions` and `integrity_documents`. Tested self-healing recovery after deleting `'doc_default_session'`.
- **Blast radius**: Encoding crashes, orphaned records in SQLite, or broken state after cleanup.
- **Empirical verification**: Executed in `test_fk_stability_edge_cases_special_characters_and_cascade`.
- **Result**: All special strings saved and retrieved with 100% fidelity. `ON DELETE CASCADE` cleanly removed associated child rows with 0 dangling records. Post-deletion insert cleanly self-healed `'doc_default_session'`. `pragma_foreign_key_check()` returned 0 violations throughout.

### [Low Risk] Challenge 5: Multi-threaded Concurrent Revision Writes
- **Assumption challenged**: Concurrent threads inserting revisions for random sessions into a shared connection could cause race conditions between parent creation and child revision insertion.
- **Attack scenario**: 8 concurrent OS threads executing 25 random session revision writes each (200 concurrent operations) across `Arc<Database>`.
- **Blast radius**: Intermittent `FOREIGN KEY constraint failed` or deadlocks during background AI writing streaming.
- **Empirical verification**: Executed in `test_fk_stability_concurrent_threads_random_sessions`.
- **Result**: All 200 revisions successfully committed. `pragma_foreign_key_check()` returned 0 violations.

---

## Stress Test Results

| Test Name | Scenario Description | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| `test_fk_stability_arbitrary_random_nonexistent_ids` | Unparented random UUID session_id on fresh DB with `foreign_keys=ON` | Auto-ensures parents; no FK errors; 0 FK check violations | Parents ensured; 1 doc, 1 session, 1 rev created; 0 violations | **PASS** |
| `test_fk_stability_stress_100_random_sessions` | 100 distinct random sessions, 200 revisions | All saved, ordered DESC, 0 FK check violations | 200 revisions, 100 sessions saved; 0 violations | **PASS** |
| `test_fk_stability_with_custom_document_id_preservation` | Revision saved to pre-existing session with custom `document_id` | Preserves custom `document_id` via `INSERT OR IGNORE` | Custom `document_id` preserved intact; 0 violations | **PASS** |
| `test_fk_stability_edge_cases_special_characters_and_cascade` | Emojis, UTF-8, punctuation, 250-char IDs, and cascade deletion | Exact retrieval; clean cascade delete; self-healing recreation | 100% string fidelity; 0 orphaned rows; self-heals cleanly | **PASS** |
| `test_fk_stability_concurrent_threads_random_sessions` | 8 threads x 25 random sessions (200 concurrent writes) | No race conditions or FK violations | All 200 revisions persisted cleanly; 0 violations | **PASS** |
| `ai_tools_persistence_tests` (worker suite) | 6 persistence integration tests covering reports, audits, jobs | All 6 tests pass without panic | 6 passed, 0 failed, 0 errors in 1.00s | **PASS** |

---

## Unchallenged Areas

- **Frontend Revision Diff Visualization Rendering**: In-scope for M4/M5 UI testing; excluded here as M3 focuses strictly on backend SQLite persistence and Tauri commands.
