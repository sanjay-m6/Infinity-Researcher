/**
 * Advanced Search Query Parser
 * Phase 12: Infinity Researcher
 *
 * Parses user input into a structured query AST supporting:
 * - Free-text terms and quoted phrases
 * - Field filters: title:, author:, year:, doi:, source:, type:, open_access: (oa:), venue:, peer_reviewed:
 * - Year ranges (year:2020..2024, year:>=2020, year:<=2023)
 * - Safe DOI extraction preserving slashes and periods
 * - Fault tolerance for unclosed quotes, empty values, and unknown fields
 */

import { StructuredQuery, StructuredQueryFields } from "./advancedSearchTypes";

const SUPPORTED_FIELDS = new Set([
  "title",
  "author",
  "authors",
  "year",
  "doi",
  "source",
  "sources",
  "type",
  "content_type",
  "open_access",
  "oa",
  "venue",
  "peer_reviewed",
]);

/**
 * Tokenize a raw query string into tokens while respecting quotes and colons.
 */
function tokenizeQuery(raw: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let insideQuote = false;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];

    if (char === '"') {
      insideQuote = !insideQuote;
      current += char;
    } else if (char === " " || char === "\t" || char === "\n") {
      if (insideQuote) {
        current += char;
      } else {
        if (current.trim().length > 0) {
          tokens.push(current.trim());
        }
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.trim().length > 0) {
    tokens.push(current.trim());
  }

  return tokens;
}

/**
 * Strips surrounding quotes if present.
 */
function stripQuotes(str: string): string {
  if (
    (str.startsWith('"') && str.endsWith('"') && str.length >= 2) ||
    (str.startsWith("'") && str.endsWith("'") && str.length >= 2)
  ) {
    return str.slice(1, -1);
  }
  // Strip trailing quote if unclosed leading quote was tokenized with it
  if (str.startsWith('"') && !str.endsWith('"')) {
    return str.slice(1);
  }
  return str;
}

/**
 * Parse a year expression which could be:
 * - "2024"
 * - "2020..2024" or "2020-2024"
 * - ">=2020" or ">2019"
 * - "<=2024" or "<2025"
 */
function parseYearExpression(
  expr: string
): {
  year?: number;
  yearStart?: number;
  yearEnd?: number;
  error?: string;
} {
  const clean = stripQuotes(expr.trim());

  // Range: 2020..2024 or 2020-2024
  const rangeMatch = clean.match(/^(\d{4})\s*(?:\.\.|-)\s*(\d{4})$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (start > end) {
      return { error: `Invalid year range: start year (${start}) cannot exceed end year (${end}).` };
    }
    return { yearStart: start, yearEnd: end };
  }

  // Greater than or equal: >=2020 or >2019
  const gteMatch = clean.match(/^>=\s*(\d{4})$/);
  if (gteMatch) {
    return { yearStart: parseInt(gteMatch[1], 10) };
  }
  const gtMatch = clean.match(/^>\s*(\d{4})$/);
  if (gtMatch) {
    return { yearStart: parseInt(gtMatch[1], 10) + 1 };
  }

  // Less than or equal: <=2024 or <2025
  const lteMatch = clean.match(/^<=\s*(\d{4})$/);
  if (lteMatch) {
    return { yearEnd: parseInt(lteMatch[1], 10) };
  }
  const ltMatch = clean.match(/^<\s*(\d{4})$/);
  if (ltMatch) {
    return { yearEnd: parseInt(ltMatch[1], 10) - 1 };
  }

  // Single exact 4-digit year: 2024
  const exactMatch = clean.match(/^(\d{4})$/);
  if (exactMatch) {
    const y = parseInt(exactMatch[1], 10);
    return { year: y, yearStart: y, yearEnd: y };
  }

  return { error: `Invalid year specification "${clean}". Use a 4-digit year, range (2020..2024), or inequality (>=2020).` };
}

/**
 * Parse boolean strings (true, false, yes, no, 1, 0)
 */
function parseBoolean(val: string): boolean | undefined {
  const clean = stripQuotes(val).trim().toLowerCase();
  if (["true", "yes", "1", "y"].includes(clean)) return true;
  if (["false", "no", "0", "n"].includes(clean)) return false;
  return undefined;
}

/**
 * Main query parser function.
 */
export function parseStructuredQuery(rawInput: string): StructuredQuery {
  const rawQuery = (rawInput || "").trim();
  const textTerms: string[] = [];
  const fields: StructuredQueryFields = {};
  const syntaxErrors: string[] = [];
  const warnings: string[] = [];
  let hasSyntax = false;

  if (!rawQuery) {
    return {
      rawQuery: "",
      textTerms: [],
      fields: {},
      hasSyntax: false,
      syntaxErrors: [],
      warnings: [],
    };
  }

  const tokens = tokenizeQuery(rawQuery);

  for (const token of tokens) {
    const colonIndex = token.indexOf(":");

    // Check if token looks like a field:value expression
    // Note: avoid treating standalone DOIs like "10.1000/182" as field if no recognized prefix
    if (colonIndex > 0) {
      const prefix = token.slice(0, colonIndex).toLowerCase();
      const rawValue = token.slice(colonIndex + 1);

      if (SUPPORTED_FIELDS.has(prefix)) {
        hasSyntax = true;
        const val = stripQuotes(rawValue);

        if (!val) {
          warnings.push(`Field "${prefix}:" has an empty value and was ignored.`);
          continue;
        }

        switch (prefix) {
          case "title":
            fields.title = val;
            break;

          case "author":
          case "authors": {
            fields.author = val;
            // Split comma-separated author list if present
            if (val.includes(",")) {
              fields.authors = val.split(",").map((a) => a.trim()).filter(Boolean);
            } else {
              fields.authors = [val];
            }
            break;
          }

          case "year": {
            const yrParsed = parseYearExpression(val);
            if (yrParsed.error) {
              syntaxErrors.push(yrParsed.error);
            } else {
              if (yrParsed.year !== undefined) fields.year = yrParsed.year;
              if (yrParsed.yearStart !== undefined) fields.yearStart = yrParsed.yearStart;
              if (yrParsed.yearEnd !== undefined) fields.yearEnd = yrParsed.yearEnd;
            }
            break;
          }

          case "doi": {
            // Clean up DOI (strip https://doi.org/ or dx.doi.org/ if user included it)
            let cleanDoi = val;
            const doiUrlMatch = cleanDoi.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
            if (doiUrlMatch) {
              cleanDoi = doiUrlMatch[0];
            }
            fields.doi = cleanDoi;
            break;
          }

          case "source":
          case "sources": {
            fields.source = val.toLowerCase();
            fields.sources = val
              .toLowerCase()
              .split(/[,+]/)
              .map((s) => s.trim())
              .filter(Boolean);
            break;
          }

          case "type":
          case "content_type":
            fields.contentType = val.toLowerCase();
            break;

          case "open_access":
          case "oa": {
            const b = parseBoolean(val);
            if (b !== undefined) {
              fields.openAccess = b;
            } else {
              warnings.push(`Unrecognized open_access value "${val}". Expected true or false.`);
            }
            break;
          }

          case "venue":
            fields.venue = val;
            break;

          case "peer_reviewed": {
            const b = parseBoolean(val);
            if (b !== undefined) {
              fields.peerReviewed = b;
            } else {
              warnings.push(`Unrecognized peer_reviewed value "${val}". Expected true or false.`);
            }
            break;
          }
        }
        continue;
      } else {
        // Unknown prefix before colon: could be an unquoted DOI (e.g., "doi:10.xxx" was matched, but what about "arXiv:2301.12345"?)
        if (prefix === "arxiv") {
          hasSyntax = true;
          fields.source = "arxiv";
          textTerms.push(token);
          continue;
        }

        // If it looks like an unsupported field prefix (alphabetic letters followed by colon)
        if (/^[a-z_]{2,15}$/.test(prefix)) {
          warnings.push(`Field "${prefix}:" is not a recognized filter field; treated as search keyword.`);
        }
      }
    }

    // Direct standalone DOI check: 10.xxxx/...
    if (/^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(token)) {
      hasSyntax = true;
      fields.doi = token;
      continue;
    }

    // Standard free-text term or quoted phrase
    const cleanTerm = stripQuotes(token);
    if (cleanTerm) {
      textTerms.push(cleanTerm);
      if (token.startsWith('"')) {
        hasSyntax = true;
      }
    }
  }

  return {
    rawQuery,
    textTerms,
    fields,
    hasSyntax,
    syntaxErrors,
    warnings,
  };
}

/**
 * Formats a StructuredQuery back into a readable query string.
 */
export function serializeStructuredQuery(
  fields: StructuredQueryFields,
  textTerms: string[] = []
): string {
  const parts: string[] = [];

  if (fields.title) {
    parts.push(`title:"${fields.title}"`);
  }
  if (fields.author) {
    parts.push(`author:"${fields.author}"`);
  }
  if (fields.doi) {
    parts.push(`doi:${fields.doi}`);
  }
  if (fields.yearStart && fields.yearEnd && fields.yearStart === fields.yearEnd) {
    parts.push(`year:${fields.yearStart}`);
  } else if (fields.yearStart && fields.yearEnd) {
    parts.push(`year:${fields.yearStart}..${fields.yearEnd}`);
  } else if (fields.yearStart) {
    parts.push(`year:>=${fields.yearStart}`);
  } else if (fields.yearEnd) {
    parts.push(`year:<=${fields.yearEnd}`);
  }
  if (fields.source) {
    parts.push(`source:${fields.source}`);
  }
  if (fields.contentType && fields.contentType !== "all") {
    parts.push(`type:${fields.contentType}`);
  }
  if (fields.openAccess !== undefined) {
    parts.push(`open_access:${fields.openAccess}`);
  }
  if (fields.venue && fields.venue !== "all") {
    parts.push(`venue:"${fields.venue}"`);
  }
  if (fields.peerReviewed) {
    parts.push("peer_reviewed:true");
  }

  for (const term of textTerms) {
    if (term.includes(" ")) {
      parts.push(`"${term}"`);
    } else {
      parts.push(term);
    }
  }

  return parts.join(" ");
}

