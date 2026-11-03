/**
 * Search Planner & Query Routing Engine
 * Phase 12: Infinity Researcher
 *
 * Coordinates query parsing, source capability evaluation, and filter distribution
 * into an optimized, executable SearchPlan.
 */

import { parseStructuredQuery } from "./queryParser";
import { evaluateSourcesForQuery, getSourceCapability } from "./sourceRegistry";
import { SearchPlan, StructuredQuery } from "./advancedSearchTypes";

export interface UiSearchFilterOptions {
  yearStart?: number | null;
  yearEnd?: number | null;
  contentType?: string;
  accessStatus?: string;
  author?: string;
  venue?: string;
  peerReviewedOnly?: boolean;
}

/**
 * Creates an executable search plan from a user query string, selected sources, and UI filter options.
 */
export function createSearchPlan(
  rawQuery: string,
  selectedSources: string[],
  uiFilters: UiSearchFilterOptions = {}
): SearchPlan {
  const structuredQuery: StructuredQuery = parseStructuredQuery(rawQuery);
  const fields = structuredQuery.fields;

  // 1. Source resolution: determine which sources should be targeted
  const { activeSources, skippedSources } = evaluateSourcesForQuery(
    selectedSources,
    fields.source,
    fields.sources
  );

  // If user explicitly specified a source that wasn't in selectedSources, include it if registered
  if (fields.source && activeSources.length === 0) {
    activeSources.push(fields.source.toLowerCase());
  } else if (fields.sources && fields.sources.length > 0 && activeSources.length === 0) {
    activeSources.push(...fields.sources.map((s) => s.toLowerCase()));
  }

  // 2. Resolve Year boundaries (query fields override UI filter if present)
  let effectiveYearStart: number | undefined = fields.yearStart ?? fields.year ?? (uiFilters.yearStart ?? undefined);
  let effectiveYearEnd: number | undefined = fields.yearEnd ?? fields.year ?? (uiFilters.yearEnd ?? undefined);

  if (effectiveYearStart && effectiveYearEnd && effectiveYearStart > effectiveYearEnd) {
    structuredQuery.syntaxErrors.push(
      `Start year (${effectiveYearStart}) cannot be greater than end year (${effectiveYearEnd}).`
    );
    const temp = effectiveYearStart;
    effectiveYearStart = effectiveYearEnd;
    effectiveYearEnd = temp;
  }

  // 3. Resolve Author
  const effectiveAuthor: string | undefined = fields.author || (uiFilters.author?.trim() || undefined);

  // 4. Resolve Content Type
  const effectiveContentType: string | undefined =
    fields.contentType || (uiFilters.contentType && uiFilters.contentType !== "all" ? uiFilters.contentType : undefined);

  // 5. Resolve Open Access status
  let effectiveOpenAccess: boolean | undefined = fields.openAccess;
  if (effectiveOpenAccess === undefined && uiFilters.accessStatus) {
    if (uiFilters.accessStatus === "open_access") {
      effectiveOpenAccess = true;
    }
  }

  // 6. Resolve Venue
  const effectiveVenue: string | undefined =
    fields.venue || (uiFilters.venue && uiFilters.venue !== "all" ? uiFilters.venue : undefined);

  // 7. Resolve Peer-Reviewed Only
  const effectivePeerReviewed: boolean =
    fields.peerReviewed !== undefined ? fields.peerReviewed : Boolean(uiFilters.peerReviewedOnly);

  // 8. Construct clean source query for remote scraping
  // When sending queries to external engines (arXiv, bioRxiv, etc.), we don't want raw "title:foo author:bar"
  // syntax to pollute simple text fields. We extract the core search keywords:
  const queryParts: string[] = [];

  // If a specific title was specified, add it
  if (fields.title) {
    queryParts.push(fields.title);
  }

  // If DOI was specified
  if (fields.doi) {
    queryParts.push(fields.doi);
  }

  // Add all unstructured text terms
  for (const term of structuredQuery.textTerms) {
    queryParts.push(term);
  }

  // If user only provided author and no other keywords
  if (queryParts.length === 0 && effectiveAuthor) {
    queryParts.push(effectiveAuthor);
  }

  const cleanSourceQuery = queryParts.join(" ").trim() || rawQuery.trim();

  // 9. Distribute parameters into sourceFilters and clientPostFilters
  const sourceFilters = {
    author: effectiveAuthor,
    year_start: effectiveYearStart,
    year_end: effectiveYearEnd,
    content_type: effectiveContentType,
    open_access_only: effectiveOpenAccess,
  };

  const clientPostFilters = {
    title: fields.title,
    author: effectiveAuthor,
    yearStart: effectiveYearStart,
    yearEnd: effectiveYearEnd,
    contentType: effectiveContentType,
    openAccessOnly: effectiveOpenAccess,
    venue: effectiveVenue,
    doi: fields.doi,
    peerReviewedOnly: effectivePeerReviewed,
    textTerms: structuredQuery.textTerms,
  };

  // 10. Check source capability coverage and log warnings if client post-filtering is needed
  for (const srcId of activeSources) {
    const cap = getSourceCapability(srcId);
    if (effectiveYearStart && !cap.supportsYearFilter) {
      structuredQuery.warnings.push(
        `${cap.displayName} does not natively support year range filtering; applying in-memory post-filter.`
      );
    }
    if (effectiveAuthor && !cap.supportsAuthor) {
      structuredQuery.warnings.push(
        `${cap.displayName} does not support native author filtering; verifying authors via client post-filter.`
      );
    }
  }

  return {
    rawQuery,
    structuredQuery,
    targetSources: activeSources,
    excludedSources: skippedSources,
    sourceQuery: cleanSourceQuery,
    sourceFilters,
    clientPostFilters,
  };
}

/**
 * Applies client post-filters to a paper record.
 * Returns true if the paper satisfies all active post-filters.
 */
export function satisfiesClientPostFilters(
  paper: {
    title: string;
    authors?: string[];
    publication_year?: number | null;
    canonical_doi?: string | null;
    venue?: string | null;
    is_open_access?: boolean;
    content_type?: string | null;
    peer_reviewed?: boolean | null;
    abstract_text?: string | null;
  },
  filters: SearchPlan["clientPostFilters"]
): boolean {
  // 1. Title filter
  if (filters.title) {
    const titleNeedle = filters.title.toLowerCase();
    if (!paper.title.toLowerCase().includes(titleNeedle)) {
      return false;
    }
  }

  // 2. Author filter
  if (filters.author) {
    const authorNeedle = filters.author.toLowerCase();
    const authors = (paper.authors || []).map((a) => a.toLowerCase());
    const matched = authors.some((a) => a.includes(authorNeedle));
    if (!matched) return false;
  }

  // 3. DOI filter
  if (filters.doi) {
    const cleanFilterDoi = filters.doi.toLowerCase().trim();
    const paperDoi = (paper.canonical_doi || "").toLowerCase().trim();
    if (!paperDoi || !paperDoi.includes(cleanFilterDoi)) {
      return false;
    }
  }

  // 4. Year Start filter (strict: if paper has no year, exclude it when start year is active)
  if (filters.yearStart !== undefined) {
    if (paper.publication_year === null || paper.publication_year === undefined) {
      return false;
    }
    if (paper.publication_year < filters.yearStart) {
      return false;
    }
  }

  // 5. Year End filter
  if (filters.yearEnd !== undefined) {
    if (paper.publication_year === null || paper.publication_year === undefined) {
      return false;
    }
    if (paper.publication_year > filters.yearEnd) {
      return false;
    }
  }

  // 6. Content Type filter
  if (filters.contentType && filters.contentType !== "all") {
    if (paper.content_type && paper.content_type.toLowerCase() !== filters.contentType.toLowerCase()) {
      return false;
    }
  }

  // 7. Open Access filter
  if (filters.openAccessOnly === true) {
    if (!paper.is_open_access) {
      return false;
    }
  }

  // 8. Venue filter
  if (filters.venue && filters.venue !== "all") {
    const venueNeedle = filters.venue.toLowerCase();
    const paperVenue = (paper.venue || "").toLowerCase();
    if (!paperVenue.includes(venueNeedle)) {
      return false;
    }
  }

  // 9. Peer-reviewed filter
  if (filters.peerReviewedOnly === true) {
    if (!paper.peer_reviewed) {
      return false;
    }
  }

  return true;
}
