/**
 * Academic Source Capability Registry
 * Phase 12: Infinity Researcher
 *
 * Defines strongly-typed capabilities, constraints, rate limits, and known limitations
 * across all supported academic sources.
 */

import { AcademicSourceCapability } from "./advancedSearchTypes";

export const ACADEMIC_SOURCE_REGISTRY: Record<string, AcademicSourceCapability> = {
  arxiv: {
    id: "arxiv",
    displayName: "arXiv",
    supportsFreeText: true,
    supportsTitle: true,
    supportsAuthor: true,
    supportsDoi: true,
    supportsYearFilter: true,
    supportsContentType: true,
    supportsOpenAccessFilter: true,
    supportsVenueFilter: false,
    supportsPagination: true,
    nativePaginationType: "offset",
    maxPageSize: 200,
    defaultRateLimitMs: 3000,
    knownLimitations: [
      "Rate limited to 1 request per 3 seconds per arXiv API guidelines.",
      "All documents are open-access preprints.",
    ],
  },
  biorxiv: {
    id: "biorxiv",
    displayName: "bioRxiv",
    supportsFreeText: true,
    supportsTitle: true,
    supportsAuthor: false,
    supportsDoi: true,
    supportsYearFilter: false,
    supportsContentType: true,
    supportsOpenAccessFilter: true,
    supportsVenueFilter: false,
    supportsPagination: true,
    nativePaginationType: "page",
    maxPageSize: 75,
    defaultRateLimitMs: 2000,
    knownLimitations: [
      "HTML search matches free-text keywords; author and year filters are verified via post-filtering.",
      "All documents are biological science preprints.",
    ],
  },
  medrxiv: {
    id: "medrxiv",
    displayName: "medRxiv",
    supportsFreeText: true,
    supportsTitle: true,
    supportsAuthor: false,
    supportsDoi: true,
    supportsYearFilter: false,
    supportsContentType: true,
    supportsOpenAccessFilter: true,
    supportsVenueFilter: false,
    supportsPagination: true,
    nativePaginationType: "page",
    maxPageSize: 75,
    defaultRateLimitMs: 2000,
    knownLimitations: [
      "HTML search matches free-text keywords; author and year filters are verified via post-filtering.",
      "All documents are medical and clinical preprints.",
    ],
  },
  plos: {
    id: "plos",
    displayName: "PLOS ONE / Journals",
    supportsFreeText: true,
    supportsTitle: true,
    supportsAuthor: true,
    supportsDoi: true,
    supportsYearFilter: true,
    supportsContentType: true,
    supportsOpenAccessFilter: true,
    supportsVenueFilter: true,
    supportsPagination: true,
    nativePaginationType: "page",
    maxPageSize: 50,
    defaultRateLimitMs: 1000,
    knownLimitations: [
      "PLOS Search API returns peer-reviewed open-access journal articles.",
    ],
  },
  nature_srep: {
    id: "nature_srep",
    displayName: "Nature Scientific Reports",
    supportsFreeText: true,
    supportsTitle: true,
    supportsAuthor: false,
    supportsDoi: true,
    supportsYearFilter: false,
    supportsContentType: true,
    supportsOpenAccessFilter: true,
    supportsVenueFilter: false,
    supportsPagination: true,
    nativePaginationType: "page",
    maxPageSize: 50,
    defaultRateLimitMs: 2000,
    knownLimitations: [
      "HTML scraper parses open-access Nature Scientific Reports articles; field-specific filters verified via post-filter.",
    ],
  },
  pmc: {
    id: "pmc",
    displayName: "PubMed Central (PMC)",
    supportsFreeText: true,
    supportsTitle: true,
    supportsAuthor: true,
    supportsDoi: true,
    supportsYearFilter: true,
    supportsContentType: true,
    supportsOpenAccessFilter: true,
    supportsVenueFilter: true,
    supportsPagination: true,
    nativePaginationType: "offset",
    maxPageSize: 100,
    defaultRateLimitMs: 1000,
    knownLimitations: [
      "NCBI E-utilities limits to 3 requests/sec without API key.",
      "Provides full-text open access biomedical articles.",
    ],
  },
  ieee_xplore: {
    id: "ieee_xplore",
    displayName: "IEEE Xplore",
    supportsFreeText: true,
    supportsTitle: true,
    supportsAuthor: true,
    supportsDoi: true,
    supportsYearFilter: true,
    supportsContentType: true,
    supportsOpenAccessFilter: true,
    supportsVenueFilter: true,
    supportsPagination: true,
    nativePaginationType: "page",
    maxPageSize: 50,
    defaultRateLimitMs: 1500,
    knownLimitations: [
      "Mixed access: open access papers provide direct PDF URLs; subscription items require institutional access.",
    ],
  },
  local_library: {
    id: "local_library",
    displayName: "Local Research Library",
    supportsFreeText: true,
    supportsTitle: true,
    supportsAuthor: true,
    supportsDoi: true,
    supportsYearFilter: true,
    supportsContentType: true,
    supportsOpenAccessFilter: true,
    supportsVenueFilter: true,
    supportsPagination: true,
    nativePaginationType: "offset",
    maxPageSize: 500,
    defaultRateLimitMs: 0,
    knownLimitations: [
      "Searches locally saved papers and collections in the SQLite database.",
    ],
  },
};

/**
 * Returns capability object for a source ID or a fallback default.
 */
export function getSourceCapability(sourceId: string): AcademicSourceCapability {
  const normalized = sourceId.toLowerCase().trim();
  if (ACADEMIC_SOURCE_REGISTRY[normalized]) {
    return ACADEMIC_SOURCE_REGISTRY[normalized];
  }

  // Graceful fallback for dynamic or unknown sources
  return {
    id: normalized,
    displayName: normalized,
    supportsFreeText: true,
    supportsTitle: false,
    supportsAuthor: false,
    supportsDoi: true,
    supportsYearFilter: false,
    supportsContentType: false,
    supportsOpenAccessFilter: false,
    supportsVenueFilter: false,
    supportsPagination: false,
    nativePaginationType: "none",
    maxPageSize: 25,
    defaultRateLimitMs: 2000,
    knownLimitations: [
      "Source capabilities unverified; falling back to generic post-filter pipeline.",
    ],
  };
}

/**
 * Validates which sources can satisfy a given structured query.
 */
export function evaluateSourcesForQuery(
  sourceIds: string[],
  requestedSource?: string,
  requestedSources?: string[]
): {
  activeSources: string[];
  skippedSources: Array<{ sourceId: string; reason: string }>;
} {
  const activeSources: string[] = [];
  const skippedSources: Array<{ sourceId: string; reason: string }> = [];

  // If query explicitly specified a source (e.g. source:arxiv or source:arxiv,plos)
  const explicitSources =
    requestedSources && requestedSources.length > 0
      ? requestedSources
      : requestedSource
        ? [requestedSource]
        : null;

  for (const src of sourceIds) {
    const norm = src.toLowerCase().trim();
    if (explicitSources) {
      if (explicitSources.includes(norm)) {
        activeSources.push(norm);
      } else {
        skippedSources.push({
          sourceId: norm,
          reason: `Excluded by query source constraint (${explicitSources.join(", ")})`,
        });
      }
    } else {
      activeSources.push(norm);
    }
  }

  return { activeSources, skippedSources };
}
