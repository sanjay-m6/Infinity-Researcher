/**
 * Evidence Validator & Citation Verifier
 * Phase 14: Strict client-side and hybrid evidence verification layer.
 * Confirms that cited snippets genuinely originate from the source paper chunks.
 */

import type { VerifiedEvidence } from "./types";

/**
 * Normalizes text by lowercasing, stripping punctuation, and collapsing whitespace.
 */
export function normalizeEvidenceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes Jaccard / token-containment overlap between candidate snippet and source chunk.
 */
export function calculateTokenOverlap(
  sourceText: string,
  snippetText: string
): { overlapRatio: number; matchedCount: number; totalSnippetTokens: number } {
  const normSource = normalizeEvidenceText(sourceText);
  const normSnippet = normalizeEvidenceText(snippetText);

  if (!normSource || !normSnippet) {
    return { overlapRatio: 0, matchedCount: 0, totalSnippetTokens: 0 };
  }

  const sourceTokens = new Set(normSource.split(" ").filter((t) => t.length > 2));
  const snippetTokens = normSnippet.split(" ").filter((t) => t.length > 2);

  if (snippetTokens.length === 0) {
    return { overlapRatio: 0, matchedCount: 0, totalSnippetTokens: 0 };
  }

  let matched = 0;
  for (const token of snippetTokens) {
    if (sourceTokens.has(token)) {
      matched++;
    }
  }

  const overlapRatio = matched / snippetTokens.length;
  return {
    overlapRatio,
    matchedCount: matched,
    totalSnippetTokens: snippetTokens.length,
  };
}

export interface CandidateChunk {
  id: string;
  paper_id: string;
  content_text: string;
  page_number: number;
  section_heading?: string | null;
}

export interface RawCitationInput {
  chunk_id: string;
  paper_id?: string;
  snippet: string;
  page_number: number;
  section_heading?: string | null;
}

/**
 * Verifies a single citation against candidate chunks.
 */
export function verifySingleCitation(
  citation: RawCitationInput,
  availableChunks: CandidateChunk[]
): VerifiedEvidence {
  const matchedChunk = availableChunks.find((c) => c.id === citation.chunk_id);
  const fallbackChunk =
    matchedChunk ||
    availableChunks.find(
      (c) =>
        c.page_number === citation.page_number &&
        (!citation.paper_id || c.paper_id === citation.paper_id)
    );

  if (!matchedChunk && !fallbackChunk) {
    return {
      chunk_id: citation.chunk_id,
      paper_id: citation.paper_id || "unknown",
      page_number: citation.page_number,
      section_heading: citation.section_heading,
      snippet: citation.snippet,
      is_verified: false,
      verification_method: "unverified",
      confidence: 0.0,
    };
  }

  const targetChunk = matchedChunk || fallbackChunk!;
  const targetContent = targetChunk.content_text;
  const normTarget = normalizeEvidenceText(targetContent);
  const normSnippet = normalizeEvidenceText(citation.snippet);

  // Exact substring match
  if (normSnippet.length > 10 && normTarget.includes(normSnippet)) {
    return {
      chunk_id: targetChunk.id,
      paper_id: targetChunk.paper_id,
      page_number: targetChunk.page_number,
      section_heading: targetChunk.section_heading ?? citation.section_heading,
      snippet: citation.snippet,
      is_verified: true,
      verification_method: "exact_match",
      confidence: 1.0,
    };
  }

  // Token overlap check
  const { overlapRatio } = calculateTokenOverlap(targetContent, citation.snippet);
  if (overlapRatio >= 0.55) {
    return {
      chunk_id: targetChunk.id,
      paper_id: targetChunk.paper_id,
      page_number: targetChunk.page_number,
      section_heading: targetChunk.section_heading ?? citation.section_heading,
      snippet: citation.snippet,
      is_verified: true,
      verification_method: "token_overlap",
      confidence: Math.min(1.0, 0.6 + overlapRatio * 0.4),
    };
  }

  // Insufficient overlap: reject
  return {
    chunk_id: targetChunk.id,
    paper_id: targetChunk.paper_id,
    page_number: targetChunk.page_number,
    section_heading: targetChunk.section_heading ?? citation.section_heading,
    snippet: citation.snippet,
    is_verified: false,
    verification_method: "unverified",
    confidence: overlapRatio,
  };
}

/**
 * Validates a batch of citations against available chunks.
 */
export function validateCitationsList(
  availableChunks: CandidateChunk[],
  citations: RawCitationInput[]
): VerifiedEvidence[] {
  return citations.map((citation) => verifySingleCitation(citation, availableChunks));
}

