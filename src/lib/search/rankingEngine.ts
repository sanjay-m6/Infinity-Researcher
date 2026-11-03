import { Paper, Collection } from "../../types/domain";
import { CommandDefinition } from "./searchTypes";
import {
  PaperCandidateForRanking,
  RankedPaperScore,
  RankingSignals,
  StructuredQuery,
} from "./advancedSearchTypes";
import { parseStructuredQuery } from "./queryParser";

export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

/**
 * Splits text into segments marking which parts match the search query.
 */
export function getHighlightSegments(text: string, query: string): HighlightSegment[] {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery || !text) {
    return [{ text, isMatch: false }];
  }

  const cleanText = text.toLowerCase();
  const index = cleanText.indexOf(cleanQuery);

  if (index === -1) {
    return [{ text, isMatch: false }];
  }

  const segments: HighlightSegment[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    const matchIndex = cleanText.indexOf(cleanQuery, currentIndex);
    if (matchIndex === -1) {
      segments.push({
        text: text.slice(currentIndex),
        isMatch: false,
      });
      break;
    }

    if (matchIndex > currentIndex) {
      segments.push({
        text: text.slice(currentIndex, matchIndex),
        isMatch: false,
      });
    }

    segments.push({
      text: text.slice(matchIndex, matchIndex + cleanQuery.length),
      isMatch: true,
    });

    currentIndex = matchIndex + cleanQuery.length;
  }

  return segments;
}

/**
 * Calculate deterministic score for a paper given a search query.
 * (Backward-compatible with Global Search & Command Palette)
 */
export function scorePaper(paper: Paper, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 0;

  let score = 0;
  const title = (paper.title || "").toLowerCase();
  const doi = (paper.doi || "").toLowerCase();
  const authors = (paper.authors || []).map((a) => a.toLowerCase());
  const venue = (paper.venue || "").toLowerCase();

  // 1. Exact DOI match
  if (doi && doi === query) {
    score = 1000;
  } else if (doi && doi.includes(query)) {
    score = 700;
  }

  // 2. Exact Title match
  else if (title === query) {
    score = 900;
  }

  // 3. Title starts with query
  else if (title.startsWith(query)) {
    score = 800;
  }

  // 4. Title contains query as full word or phrase
  else if (title.includes(query)) {
    score = 650;
  }

  // 5. Author match
  else if (authors.some((a) => a === query)) {
    score = 600;
  } else if (authors.some((a) => a.startsWith(query))) {
    score = 550;
  } else if (authors.some((a) => a.includes(query))) {
    score = 500;
  }

  // 6. Venue match
  else if (venue && (venue === query || venue.startsWith(query))) {
    score = 450;
  } else if (venue && venue.includes(query)) {
    score = 400;
  }

  // If matched at all, add deterministic contextual bonuses
  if (score > 0) {
    // Saved paper bonus
    if (paper.isSaved) {
      score += 20;
    }

    // Citation metric bonus (max +50 points)
    if (paper.citationCount > 0) {
      score += Math.min(50, Math.floor(paper.citationCount / 2000));
    }

    // Recent publication year bonus (up to +10 points)
    if (paper.year && paper.year >= 2020) {
      score += Math.min(10, paper.year - 2019);
    }
  }

  return score;
}

/**
 * Calculate deterministic score for a collection given a search query.
 */
export function scoreCollection(collection: Collection, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 0;

  const name = (collection.name || "").toLowerCase();
  const desc = (collection.description || "").toLowerCase();

  if (name === query) return 850;
  if (name.startsWith(query)) return 750;
  if (name.includes(query)) return 600;
  if (desc.includes(query)) return 350;

  return 0;
}

/**
 * Calculate deterministic score for an application command.
 */
export function scoreCommand(cmd: CommandDefinition, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 0;

  const title = cmd.title.toLowerCase();
  const desc = (cmd.description || "").toLowerCase();
  const keywords = (cmd.keywords || []).map((k) => k.toLowerCase());

  // Exact command title
  if (title === query) return 920;

  // Title prefix
  if (title.startsWith(query)) return 820;

  // Exact keyword match
  if (keywords.includes(query)) return 760;

  // Title contains query
  if (title.includes(query)) return 680;

  // Keyword prefix
  if (keywords.some((k) => k.startsWith(query))) return 620;

  // Keyword substring
  if (keywords.some((k) => k.includes(query))) return 520;

  // Description contains query
  if (desc.includes(query)) return 420;

  return 0;
}

// ---------------------------------------------------------------------------
// Phase 12: Advanced Multi-Signal Academic Paper Ranking Engine
// ---------------------------------------------------------------------------

function normalizeDoi(doi?: string | null): string {
  if (!doi) return "";
  const clean = doi.trim().toLowerCase();
  const idx = clean.indexOf("10.");
  return idx !== -1 ? clean.slice(idx).replace(/[\s.;/]+$/, "") : clean;
}

/**
 * Calculate token overlap ratio between query tokens and target text.
 */
function calculateTokenOverlap(tokens: string[], text?: string | null): number {
  if (!tokens.length || !text) return 0;
  const lower = text.toLowerCase();
  let matches = 0;
  for (const token of tokens) {
    if (lower.includes(token.toLowerCase())) {
      matches++;
    }
  }
  return matches / tokens.length;
}

/**
 * Calculates a multi-signal, explainable relevance score for an academic paper candidate.
 */
export function calculateMultiSignalPaperScore(
  paper: PaperCandidateForRanking,
  queryInput: string | StructuredQuery
): RankedPaperScore {
  const query: StructuredQuery =
    typeof queryInput === "string" ? parseStructuredQuery(queryInput) : queryInput;

  const rawClean = query.rawQuery.trim().toLowerCase();
  const title = (paper.title || "").toLowerCase();
  const doi = normalizeDoi(paper.canonical_doi);
  const authors = (paper.authors || []).map((a) => a.toLowerCase());
  const venue = (paper.venue || "").toLowerCase();
  const abstract = (paper.abstract_text || "").toLowerCase();

  const signals: RankingSignals = {};
  const explanations: string[] = [];
  let baseScore = 0;

  // Query tokens to evaluate (excluding syntax prefixes)
  const queryTokens = query.textTerms.length > 0
    ? query.textTerms
    : rawClean.split(/\s+/).filter((w) => w.length > 1);

  // 1. Exact DOI match (Priority 1000)
  const targetDoi = query.fields.doi ? normalizeDoi(query.fields.doi) : normalizeDoi(rawClean);
  if (targetDoi && doi && doi === targetDoi) {
    baseScore = 1000;
    signals.exactDoiMatch = true;
    explanations.push("Exact DOI Match (+1000)");
  } else if (targetDoi && doi && doi.includes(targetDoi)) {
    baseScore = 750;
    signals.exactDoiMatch = false;
    explanations.push("Partial DOI Match (+750)");
  }

  // 2. Exact Title Match (Priority 900)
  const targetTitle = (query.fields.title || rawClean).trim().toLowerCase();
  if (baseScore === 0 && targetTitle && title === targetTitle) {
    baseScore = 900;
    signals.exactTitleMatch = true;
    explanations.push("Exact Title Match (+900)");
  }

  // 3. Title Prefix Match (Priority 800)
  else if (baseScore === 0 && targetTitle && title.startsWith(targetTitle)) {
    baseScore = 800;
    signals.titlePrefixMatch = true;
    explanations.push("Title Prefix Match (+800)");
  }

  // 4. Title Token Coverage (Priority up to 650)
  if (baseScore === 0 && queryTokens.length > 0) {
    const titleOverlap = calculateTokenOverlap(queryTokens, title);
    if (titleOverlap > 0) {
      signals.titleTokenOverlap = titleOverlap;
      baseScore = Math.round(titleOverlap * 650);
      explanations.push(`Title Token Overlap (${Math.round(titleOverlap * 100)}% -> +${baseScore})`);
    }
  }

  // 5. Author Match (Priority up to 400)
  const targetAuthor = (query.fields.author || "").toLowerCase();
  if (targetAuthor) {
    if (
      authors.some(
        (a) => a === targetAuthor || a.split(/\s+/).some((part) => part === targetAuthor)
      )
    ) {
      signals.authorMatch = true;
      baseScore += 400;
      explanations.push("Exact Author Match (+400)");
    } else if (authors.some((a) => a.includes(targetAuthor))) {
      signals.authorMatch = true;
      baseScore += 250;
      explanations.push("Partial Author Match (+250)");
    }
  } else if (baseScore === 0 && queryTokens.length > 0) {
    // If author wasn't explicitly tagged but tokens match author
    const matchesAuthor = authors.some((a) => queryTokens.some((t) => a.includes(t.toLowerCase())));
    if (matchesAuthor) {
      signals.authorMatch = true;
      baseScore = 300;
      explanations.push("Author Keyword Match (+300)");
    }
  }

  // 6. Abstract Token Overlap (Priority up to 250)
  if (abstract && queryTokens.length > 0) {
    const absOverlap = calculateTokenOverlap(queryTokens, abstract);
    if (absOverlap > 0) {
      signals.abstractTokenOverlap = absOverlap;
      const absScore = Math.round(absOverlap * 250);
      baseScore += absScore;
      explanations.push(`Abstract Token Overlap (${Math.round(absOverlap * 100)}% -> +${absScore})`);
    }
  }

  // 7. Venue Match (Priority up to 150)
  const targetVenue = (query.fields.venue || "").toLowerCase();
  if (targetVenue && venue && venue.includes(targetVenue)) {
    signals.venueMatch = true;
    baseScore += 150;
    explanations.push("Venue Match (+150)");
  }

  // Add deterministic contextual bonuses only if there was a baseline match
  let totalScore = baseScore;
  if (baseScore > 0) {
    // Recency bonus (+15 to +30)
    if (paper.publication_year) {
      if (paper.publication_year >= 2024) {
        signals.recencyBonus = 30;
        totalScore += 30;
        explanations.push("Recent Publication (2024+ -> +30)");
      } else if (paper.publication_year >= 2020) {
        signals.recencyBonus = 15;
        totalScore += 15;
        explanations.push("Modern Publication (2020-2023 -> +15)");
      }
    }

    // Citation metric bonus (max +40)
    if (paper.citation_count && paper.citation_count > 0) {
      const citBonus = Math.min(40, Math.floor(paper.citation_count / 500));
      if (citBonus > 0) {
        signals.citationBonus = citBonus;
        totalScore += citBonus;
        explanations.push(`Citation Count (${paper.citation_count} -> +${citBonus})`);
      }
    }

    // Open Access bonus (+15)
    if (paper.is_open_access) {
      signals.openAccessBonus = 15;
      totalScore += 15;
      explanations.push("Open Access Available (+15)");
    }

    // Direct PDF bonus (+15)
    if (paper.pdf_url || paper.local_pdf_path) {
      signals.pdfAvailableBonus = 15;
      totalScore += 15;
      explanations.push("Direct PDF Available (+15)");
    }
  }

  return {
    totalScore,
    signals,
    explanation: explanations.join("; ") || "Default relevance order",
  };
}

/**
 * Deterministic paper comparator using multi-signal scores with strict tie-breaking.
 */
export function compareRankedPapers(
  a: PaperCandidateForRanking,
  b: PaperCandidateForRanking,
  query: string | StructuredQuery
): number {
  const scoreA = calculateMultiSignalPaperScore(a, query).totalScore;
  const scoreB = calculateMultiSignalPaperScore(b, query).totalScore;

  // Primary: Score descending
  if (scoreB !== scoreA) {
    return scoreB - scoreA;
  }

  // Secondary: Publication year descending
  const yearA = a.publication_year || 0;
  const yearB = b.publication_year || 0;
  if (yearB !== yearA) {
    return yearB - yearA;
  }

  // Tertiary: Citation count descending
  const citA = a.citation_count || 0;
  const citB = b.citation_count || 0;
  if (citB !== citA) {
    return citB - citA;
  }

  // Quaternary: Lexicographical ID ascending for absolute determinism
  return a.id.localeCompare(b.id);
}
