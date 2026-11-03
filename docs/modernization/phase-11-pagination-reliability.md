# Phase 11: Pagination Reliability & Infinite Loading Safeguards

## 1. Architectural Strategy

In desktop academic research tools, pagination and infinite loading must balance two opposing concerns:
1. **DOM & Rendering Responsiveness**: Displaying hundreds of complex paper cards with abstracts, badges, and interactive controls simultaneously can degrade scrolling framerates and memory usage.
2. **Exhaustive Academic Coverage**: Researchers often need to inspect 50–200 papers per topic across multiple sources.

Phase 11 implements a dual-tier pagination architecture:
1. **Tier 1 (Client-Side Progressive Slicing)**:
   - Slices already-discovered results using `visibleCount` (defaulting to 50, incrementing by +50 on user request).
   - Guarantees instantaneous responsiveness without DOM bloat.
2. **Tier 2 (Source-Level Query Expansion)**:
   - Connects to remote academic endpoints via `handleLoadMoreFromSources()`.
   - Expands `limitPerSource` from 50 to 100+ papers, re-querying active connectors and deduplicating new papers into existing state.

---

## 2. Safeguards Against Common Pagination Failures

| Failure Mode | Root Cause | Phase 11 Prevention Mechanism |
| :--- | :--- | :--- |
| **Overlapping Identical Requests** | Rapid user clicking on "Load More" while query is streaming | `isSearching` check guard (`if (isSearching) return;`) and disabled button state with spinner. |
| **Infinite Loading Loops** | Cursors repeating or empty pages re-triggering auto-scroll | Explicit end-of-results detection. When `visibleCount >= filteredPapers.length`, button shifts to static message: `"Showing all {filteredPapers.length} matching papers"`. |
| **Duplicate Card Ingestion** | Successive pages returning overlapping papers | Real-time deduplication in `paper_found` matching against canonical DOI and title. |
| **Out-of-Order Responses** | Previous slow page arriving after a new search is initiated | Session isolation tags (`event.session_id !== currentSearchSessionRef.current`) drop stale responses immediately. |
| **Partial Source Timeout** | One slow repository hanging the entire pagination batch | Independent source state tracking (`sourceStatuses`). Finished sources display results while slow sources time out gracefully after polite delays. |

---

## 3. User Experience & Status Telemetry

1. **Load More Button**:
   - Displays clear counts: `"Load More Papers (Showing {visiblePapers.length} of {filteredPapers.length})"`.
2. **Query More from Sources Button**:
   - Active state displays an animated spinner: `<Loader2 className="animate-spin" /> Fetching more papers from sources...`.
   - Normal state: `<RefreshCw /> Fetch +50 More from Academic Sources`.
3. **End of Results**:
   - Reaching the end of current results displays: `"Showing all {filteredPapers.length} matching papers"`.

