/**
 * Deterministic Academic Paper Deduplication Engine
 * Phase 12: Infinity Researcher
 *
 * Implements non-destructive, explainable deduplication across multiple academic sources.
 * Prefers strong cryptographic/persistent identifiers (DOI, arXiv ID) over fuzzy heuristics.
 */

import { DiscoveredSearchResult } from "../desktop-api";

/**
 * Normalizes a DOI for exact matching.
 * Strips URL prefixes (https://doi.org/, dx.doi.org, doi:), trailing punctuation, and lowercases.
 */
export function normalizeDoi(doi?: string | null): string {
  if (!doi) return "";
  const clean = doi.trim();
  const lower = clean.toLowerCase();
  const index = lower.indexOf("10.");
  const stripped = index !== -1 ? lower.slice(index) : lower;
  return stripped.replace(/[\s.;/]+$/, "");
}

/**
 * Normalizes an academic paper title for matching:
 * - Lowercases
 * - Strips punctuation and symbols
 * - Collapses consecutive whitespace
 */
export function normalizeTitle(title?: string | null): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Determines whether two paper records represent the same academic work.
 */
export function isDuplicatePaper(
  paperA: {
    canonical_doi?: string | null;
    title: string;
    publication_year?: number | null;
    id?: string;
  },
  paperB: {
    canonical_doi?: string | null;
    title: string;
    publication_year?: number | null;
    id?: string;
  }
): boolean {
  // 1. Direct ID match
  if (paperA.id && paperB.id && paperA.id === paperB.id) {
    return true;
  }

  // 2. Strong match: Normalized canonical DOI
  const doiA = normalizeDoi(paperA.canonical_doi);
  const doiB = normalizeDoi(paperB.canonical_doi);
  if (doiA && doiB && doiA === doiB) {
    return true;
  }

  // 3. Fallback match: Normalized title + Publication year
  const normTitleA = normalizeTitle(paperA.title);
  const normTitleB = normalizeTitle(paperB.title);

  // Require title to be of reasonable length (>= 15 chars) to prevent false positives on short generic titles
  if (normTitleA.length >= 15 && normTitleA === normTitleB) {
    // If both have publication years, verify they match or differ by at most 1 (preprints vs published)
    if (paperA.publication_year && paperB.publication_year) {
      if (Math.abs(paperA.publication_year - paperB.publication_year) <= 1) {
        return true;
      }
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Merges two duplicate paper records non-destructively, retaining the richest metadata.
 */
export function mergeDuplicateRecords<T extends DiscoveredSearchResult>(
  existing: T,
  incoming: T
): T {
  // Merge provenance URLs
  const provenanceSet = new Set<string>();
  for (const url of existing.provenance_urls || []) {
    if (url) provenanceSet.add(url);
  }
  for (const url of incoming.provenance_urls || []) {
    if (url) provenanceSet.add(url);
  }
  if (existing.landing_url) provenanceSet.add(existing.landing_url);
  if (incoming.landing_url) provenanceSet.add(incoming.landing_url);

  // Pick richest abstract (longest non-empty)
  const existingAbs = existing.abstract_text || "";
  const incomingAbs = incoming.abstract_text || "";
  const bestAbstract = incomingAbs.length > existingAbs.length ? incomingAbs : existingAbs;

  // Pick best PDF URL (prefer direct PDF ending with .pdf or verified link)
  const bestPdfUrl = existing.pdf_url || incoming.pdf_url;

  // Pick highest citation count if available
  const citationA = (existing as unknown as Record<string, unknown>).citation_count as number | undefined;
  const citationB = (incoming as unknown as Record<string, unknown>).citation_count as number | undefined;
  let bestCitations = existing.citation_count;
  if (typeof citationB === "number" && (typeof citationA !== "number" || citationB > citationA)) {
    bestCitations = citationB;
  }

  // Pick publication year if missing
  const bestYear = existing.publication_year || incoming.publication_year;
  const bestDate = existing.publication_date || incoming.publication_date;

  // Canonical DOI
  const bestDoi = existing.canonical_doi || incoming.canonical_doi;

  // Open access status (if either source proves OA, paper is OA)
  const isOpenAccess = existing.is_open_access || incoming.is_open_access;

  // Peer-reviewed status
  const isPeerReviewed = existing.peer_reviewed || incoming.peer_reviewed;

  // Merge authors (retain longer list)
  const bestAuthors =
    (incoming.authors?.length || 0) > (existing.authors?.length || 0)
      ? incoming.authors
      : existing.authors;

  return {
    ...existing,
    canonical_doi: bestDoi,
    abstract_text: bestAbstract || existing.abstract_text,
    pdf_url: bestPdfUrl,
    is_open_access: isOpenAccess,
    peer_reviewed: isPeerReviewed,
    publication_year: bestYear,
    publication_date: bestDate,
    authors: bestAuthors,
    citation_count: bestCitations,
    provenance_urls: Array.from(provenanceSet),
  };
}

/**
 * Deduplicates a list of discovered results in place.
 */
export function deduplicatePaperList<T extends DiscoveredSearchResult>(papers: T[]): T[] {
  const result: T[] = [];

  for (const paper of papers) {
    const existingIndex = result.findIndex((item) => isDuplicatePaper(item, paper));
    if (existingIndex >= 0) {
      result[existingIndex] = mergeDuplicateRecords(result[existingIndex], paper);
    } else {
      result.push({
        ...paper,
        provenance_urls: Array.from(
          new Set([...(paper.provenance_urls || []), paper.landing_url].filter(Boolean))
        ),
      });
    }
  }

  return result;
}

