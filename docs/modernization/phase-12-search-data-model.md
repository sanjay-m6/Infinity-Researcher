# Phase 12: Search Query Data Model & Type System

## 1. Overview

Infinity Researcher Phase 12 establishes strongly-typed representations across the search lifecycle. Structured query trees, source capabilities, planner outputs, multi-signal scores, and deduplicated paper candidates are unified across TypeScript and Rust IPC.

All core interfaces are defined in `src/lib/search/advancedSearchTypes.ts` with direct mappings to Rust data structures in `src-tauri/src/scrapers/types.rs`.

---

## 2. Core Domain Models

### 2.1. Structured Query (`StructuredQuery` & `StructuredQueryFields`)
Represents the parsed abstract syntax tree of a user's search query:

```typescript
export interface StructuredQueryFields {
  title?: string;
  author?: string;
  authors?: string[];
  year?: number;
  yearStart?: number;
  yearEnd?: number;
  doi?: string;
  source?: string;
  sources?: string[];
  contentType?: string;
  openAccess?: boolean;
  venue?: string;
  peerReviewed?: boolean;
}

export interface StructuredQuery {
  rawQuery: string;
  textTerms: string[];
  fields: StructuredQueryFields;
  hasSyntax: boolean;
  syntaxErrors: string[];
  warnings: string[];
}
```

### 2.2. Source Capability Descriptor (`AcademicSourceCapability`)
Declares supported parameters and constraints per academic source:

```typescript
export type PaginationType = "offset" | "cursor" | "page" | "none";

export interface AcademicSourceCapability {
  id: string;
  displayName: string;
  supportsFreeText: boolean;
  supportsTitle: boolean;
  supportsAuthor: boolean;
  supportsDoi: boolean;
  supportsYearFilter: boolean;
  supportsContentType: boolean;
  supportsOpenAccessFilter: boolean;
  supportsVenueFilter: boolean;
  supportsPagination: boolean;
  nativePaginationType: PaginationType;
  maxPageSize: number;
  defaultRateLimitMs: number;
  knownLimitations: string[];
}
```

### 2.3. Search Plan (`SearchPlan`)
Separates remote source-delegated queries from client-side in-memory post-filters:

```typescript
export interface SearchPlan {
  rawQuery: string;
  structuredQuery: StructuredQuery;
  targetSources: string[];
  excludedSources: Array<{
    sourceId: string;
    reason: string;
  }>;
  sourceQuery: string;
  sourceFilters: {
    author?: string;
    year_start?: number;
    year_end?: number;
    content_type?: string;
    open_access_only?: boolean;
  };
  clientPostFilters: {
    title?: string;
    author?: string;
    yearStart?: number;
    yearEnd?: number;
    contentType?: string;
    openAccessOnly?: boolean;
    venue?: string;
    doi?: string;
    peerReviewedOnly?: boolean;
    textTerms?: string[];
  };
}
```

### 2.4. Multi-Signal Score Model (`RankedPaperScore`)
Provides an explainable, multi-dimensional ranking breakdown:

```typescript
export interface RankingSignals {
  exactDoiMatch?: boolean;
  exactTitleMatch?: boolean;
  titlePrefixMatch?: boolean;
  titleTokenOverlap?: number;
  authorMatch?: boolean;
  abstractTokenOverlap?: number;
  venueMatch?: boolean;
  recencyBonus?: number;
  citationBonus?: number;
  openAccessBonus?: number;
  pdfAvailableBonus?: number;
}

export interface RankedPaperScore {
  totalScore: number;
  signals: RankingSignals;
  explanation: string;
}
```

---

## 3. Frontend-to-Backend Type Alignment

| TypeScript Interface | Rust Struct (`src-tauri/`) | Mapping Behavior |
| :--- | :--- | :--- |
| `SearchPlan.sourceQuery` | `WebsiteSearchQuery.query` | Sanitized keyword string stripped of raw syntax prefixes. |
| `SearchPlan.sourceFilters.author` | `WebsiteSearchQuery.author` | Delegated to supported adapters (e.g. arXiv, PLOS, PMC). |
| `SearchPlan.sourceFilters.year_start` | `WebsiteSearchQuery.year_start` | Native 4-digit start year boundary. |
| `SearchPlan.sourceFilters.year_end` | `WebsiteSearchQuery.year_end` | Native 4-digit end year boundary. |
| `SearchPlan.sourceFilters.open_access_only` | `WebsiteSearchQuery.open_access_only` | Filters upstream sources for open-access licensing. |
| `DiscoveredSearchResult` | `DiscoveredSearchResult` | Emitted via `paper_found` stream event; includes `provenance_urls` and `citation_count`. |

---

## 4. State Persistence & Serialization

1. **Local Storage Session Cache (`discoverSessionStore.ts`)**:
   - `searchQuery` and `submittedQuery` are stored in `localStorage` (`paper_desktop_discover_session_v1`).
   - The query AST is recomputed reactively on mount via `useMemo(() => parseStructuredQuery(searchQuery), [searchQuery])`, avoiding serialization drift.
2. **Recent Searches (`research_recent_searches`)**:
   - Persisted as a FIFO ring buffer of up to 8 unique query strings, enabling one-click query re-execution.

