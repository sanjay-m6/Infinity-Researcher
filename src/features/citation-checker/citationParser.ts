import {
  InTextCitation,
  ParsedReference,
  CitationStyleType,
} from "./types";
import { evaluateDoi, cleanRawDoi } from "./doiValidator";

// ---------------------------------------------------------------------------
// REGEX PATTERNS FOR IN-TEXT CITATIONS
// ---------------------------------------------------------------------------

// Numeric: [1], [1, 2], [1-4], [1, 3-5]
const NUMERIC_CITATION_REGEX = /\[\s*(\d+(?:[–\-,\s]+\d+)*)\s*\]/g;

// Author-Year: (Vaswani et al., 2017), (Smith & Jones, 2020), (Devlin, 2018; Brown et al., 2020)
const AUTHOR_YEAR_CITATION_REGEX = /\((?:([A-Z][a-zA-Z\s.&-]+(?:et\s+al\.)?,?\s*(?:19|20)\d{2}[a-z]?)(?:;\s*)?)+\)/g;

// LaTeX: \cite{key}, \citep{key1, key2}, \citet{key}
const LATEX_CITE_REGEX = /\\cite[pt]?\{([^}]+)\}/g;

// Reference Section Header
const REFERENCE_HEADER_REGEX = /(?:^|\n)\s*(?:##?\s*)?(?:REFERENCES|References|BIBLIOGRAPHY|Bibliography|WORKS CITED|Works Cited|Literature Cited)\s*(?::|\n|$)/;

// DOI inside reference text
const DOI_IN_TEXT_REGEX = /(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)([^\s,;]+)|(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/i;

// ---------------------------------------------------------------------------
// DOCUMENT SPLITTER
// ---------------------------------------------------------------------------

export interface SplitDocumentResult {
  bodyText: string;
  referenceText: string;
  isBibtexFile: boolean;
}

export function splitDocumentSections(rawDocument: string): SplitDocumentResult {
  const trimmed = rawDocument.trim();

  // Check if entire file is a .bib file
  if (/@(?:article|book|inproceedings|techreport|misc)\s*\{/i.test(trimmed)) {
    // If it starts directly with bibtex or is mostly bibtex
    const bibMatches = trimmed.match(/@(?:article|book|inproceedings|techreport|misc)\s*\{/gi) || [];
    if (bibMatches.length >= 2 || trimmed.startsWith("@")) {
      return {
        bodyText: "",
        referenceText: trimmed,
        isBibtexFile: true,
      };
    }
  }

  const match = REFERENCE_HEADER_REGEX.exec(trimmed);
  if (match) {
    const splitIndex = match.index;
    return {
      bodyText: trimmed.slice(0, splitIndex).trim(),
      referenceText: trimmed.slice(splitIndex + match[0].length).trim(),
      isBibtexFile: false,
    };
  }

  // If no reference header found, treat entire document as text with references possibly at the end
  return {
    bodyText: trimmed,
    referenceText: "",
    isBibtexFile: false,
  };
}

// ---------------------------------------------------------------------------
// IN-TEXT CITATION EXTRACTOR
// ---------------------------------------------------------------------------

export function extractInTextCitations(bodyText: string): InTextCitation[] {
  const citations: InTextCitation[] = [];
  if (!bodyText.trim()) return citations;

  let counter = 0;

  const findSentenceContext = (idx: number, len: number): string => {
    const start = Math.max(0, bodyText.lastIndexOf(".", idx) + 1);
    let end = bodyText.indexOf(".", idx + len);
    if (end === -1) end = bodyText.length;
    return bodyText.slice(start, end + 1).trim();
  };

  // 1. Numeric Citations: [1], [1, 2], [1-3]
  NUMERIC_CITATION_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMERIC_CITATION_REGEX.exec(bodyText)) !== null) {
    const raw = m[0];
    const inner = m[1];

    // Expand ranges like 1-3 into 1, 2, 3
    const keys: string[] = [];
    const parts = inner.split(/[,;\s]+/);
    for (const part of parts) {
      if (part.includes("-") || part.includes("–")) {
        const [startStr, endStr] = part.split(/[–-]/);
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end) && end >= start && end - start <= 20) {
          for (let i = start; i <= end; i++) keys.push(String(i));
        } else {
          keys.push(part);
        }
      } else if (part.trim()) {
        keys.push(part.trim());
      }
    }

    citations.push({
      id: `cite_${++counter}`,
      raw,
      normalizedKey: keys[0] || inner,
      keys,
      style: "numeric",
      contextSentence: findSentenceContext(m.index, raw.length),
      startIndex: m.index,
      endIndex: m.index + raw.length,
      matchedReferenceIds: [],
    });
  }

  // 2. Author-Year Citations: (Vaswani et al., 2017)
  AUTHOR_YEAR_CITATION_REGEX.lastIndex = 0;
  while ((m = AUTHOR_YEAR_CITATION_REGEX.exec(bodyText)) !== null) {
    const raw = m[0];
    const inner = raw.slice(1, -1);
    const subCites = inner.split(/;\s*/);
    const keys = subCites.map((sc) => sc.trim().toLowerCase());

    citations.push({
      id: `cite_${++counter}`,
      raw,
      normalizedKey: keys[0] || inner.toLowerCase(),
      keys,
      style: "author_year",
      contextSentence: findSentenceContext(m.index, raw.length),
      startIndex: m.index,
      endIndex: m.index + raw.length,
      matchedReferenceIds: [],
    });
  }

  // 3. LaTeX Citations: \cite{key1, key2}
  LATEX_CITE_REGEX.lastIndex = 0;
  while ((m = LATEX_CITE_REGEX.exec(bodyText)) !== null) {
    const raw = m[0];
    const keys = m[1].split(/[,;\s]+/).map((k) => k.trim()).filter(Boolean);

    citations.push({
      id: `cite_${++counter}`,
      raw,
      normalizedKey: keys[0] || "",
      keys,
      style: "latex_cite",
      contextSentence: findSentenceContext(m.index, raw.length),
      startIndex: m.index,
      endIndex: m.index + raw.length,
      matchedReferenceIds: [],
    });
  }

  return citations.sort((a, b) => a.startIndex - b.startIndex);
}

// ---------------------------------------------------------------------------
// REFERENCE LIST PARSER
// ---------------------------------------------------------------------------

/**
 * Parses individual references from the reference text or bibtex string.
 */
export function parseBibliographyReferences(referenceText: string): ParsedReference[] {
  const references: ParsedReference[] = [];
  if (!referenceText.trim()) return references;

  // Check if BibTeX formatted
  if (/@(?:article|book|inproceedings|techreport|misc)\s*\{/i.test(referenceText)) {
    return parseBibtexEntries(referenceText);
  }

  // Split into entries by numeric markers [1], 1., or double newlines
  const lines = referenceText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const entryBlocks: string[] = [];
  let currentBlock = "";

  for (const line of lines) {
    // Check if line starts a new reference (e.g. [1], 1., (1), or Author (Year))
    const isNewNumeric = /^\[\d+\]|^\d+\.\s+|^\(\d+\)/.test(line);
    const isNewAuthorYear = /^[A-Z][a-zA-Z\s.&-]+,\s*(?:[A-Z]\.|\d{4})/.test(line);

    if ((isNewNumeric || isNewAuthorYear) && currentBlock) {
      entryBlocks.push(currentBlock);
      currentBlock = line;
    } else {
      currentBlock = currentBlock ? `${currentBlock} ${line}` : line;
    }
  }
  if (currentBlock) entryBlocks.push(currentBlock);

  let refCounter = 0;

  for (const block of entryBlocks) {
    refCounter++;
    const ref = parseSingleReferenceBlock(block, refCounter);
    references.push(ref);
  }

  return references;
}

/**
 * Parses a single text reference block.
 */
function parseSingleReferenceBlock(block: string, defaultIndex: number): ParsedReference {
  const rawText = block.trim();

  // Extract Key: [1], 1., etc.
  let key = String(defaultIndex);
  const numMatch = rawText.match(/^(?:\[(\d+)\]|(\d+)\.\s*|\((\d+)\))/);
  if (numMatch) {
    key = numMatch[1] || numMatch[2] || numMatch[3] || String(defaultIndex);
  }

  // Extract DOI
  const doiMatch = DOI_IN_TEXT_REGEX.exec(rawText);
  const rawDoi = doiMatch ? cleanRawDoi(doiMatch[1] || doiMatch[2]) : null;
  const doiStatus = rawDoi ? evaluateDoi(rawDoi) : {
    syntaxValid: false,
    rawInput: "",
    canonicalDoi: null,
    syntaxErrorNote: null,
    resolved: null,
    resolutionSource: null,
    verifiedMetadata: null,
    resolutionStatusLabel: "No DOI Attached",
  };

  // Extract Year
  let year: number | null = null;
  const yearMatch = rawText.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // Extract Title (enclosed in quotes or between author and venue)
  let title: string | null = null;
  const quoteMatch = rawText.match(/["“]([^"”]+)["”]/);
  if (quoteMatch) {
    title = quoteMatch[1].replace(/[,.;]+$/, "").trim();
  }

  // Extract Authors (everything up to first quote or year)
  const authors: string[] = [];
  const textBeforeTitle = quoteMatch ? rawText.slice(0, quoteMatch.index) : rawText;
  const authorPart = textBeforeTitle.replace(/^\[\d+\]\s*|\d+\.\s*/, "").split(/,\s*(?:and\s+)?|;\s*/);

  for (const ap of authorPart) {
    const clean = ap.trim();
    if (clean && !/^\d{4}$/.test(clean) && clean.length > 2) {
      authors.push(clean);
    }
  }

  // Extract Venue
  let venue: string | null = null;
  if (quoteMatch) {
    const textAfterTitle = rawText.slice(quoteMatch.index! + quoteMatch[0].length);
    const venueMatch = textAfterTitle.match(/(?:in\s+)?([A-Za-z0-9\s,.:-]+?)(?:,\s*vol|\s*vol|\s*\d{4}|\s*pp|\s*doi|$)/i);
    if (venueMatch && venueMatch[1].trim().length > 3) {
      venue = venueMatch[1].trim();
    }
  }

  // Detect Style
  let detectedStyle: CitationStyleType = "ieee";
  if (/^\[\d+\]/.test(rawText)) {
    detectedStyle = "ieee";
  } else if (/\(\d{4}\)/.test(rawText) && rawText.includes("&")) {
    detectedStyle = "apa";
  } else if (/["“].*?["”].*?pp\./i.test(rawText)) {
    detectedStyle = "mla";
  }

  // Author-Year Key fallback if numeric wasn't explicit
  if (!numMatch && authors.length > 0 && year) {
    const primaryAuthor = authors[0].split(/\s+/).pop()?.toLowerCase() || "author";
    key = `${primaryAuthor} et al., ${year}`;
  }

  return {
    id: `ref_${defaultIndex}`,
    key,
    rawText,
    authors: authors.slice(0, 8),
    title,
    year,
    venue,
    doi: rawDoi,
    detectedStyle,
    doiStatus,
    inTextCitationCount: 0,
  };
}

/**
 * Parses BibTeX format entries (@article, @inproceedings, etc.)
 */
function parseBibtexEntries(bibText: string): ParsedReference[] {
  const references: ParsedReference[] = [];
  const entryRegex = /@(\w+)\s*\{\s*([^,]+),([\s\S]*?)(?=\n@|\s*$)/g;

  let match: RegExpExecArray | null;
  let counter = 0;

  while ((match = entryRegex.exec(bibText)) !== null) {
    counter++;
    const key = match[2].trim();
    const body = match[3];

    const getField = (field: string): string | null => {
      const fieldRegex = new RegExp(`${field}\\s*=\\s*[{"]([^}"]+)[}"]`, "i");
      const fm = fieldRegex.exec(body);
      return fm ? fm[1].trim() : null;
    };

    const title = getField("title");
    const rawAuthors = getField("author");
    const yearStr = getField("year");
    const journal = getField("journal") || getField("booktitle");
    const doi = getField("doi");

    const authors = rawAuthors
      ? rawAuthors.split(/\s+and\s+/i).map((a) => a.trim())
      : [];

    const doiStatus = doi ? evaluateDoi(doi) : {
      syntaxValid: false,
      rawInput: "",
      canonicalDoi: null,
      syntaxErrorNote: null,
      resolved: null,
      resolutionSource: null,
      verifiedMetadata: null,
      resolutionStatusLabel: "No DOI Attached",
    };

    references.push({
      id: `ref_${counter}`,
      key,
      rawText: match[0].trim(),
      authors,
      title,
      year: yearStr ? parseInt(yearStr, 10) : null,
      venue: journal,
      doi,
      detectedStyle: "bibtex",
      doiStatus,
      inTextCitationCount: 0,
    });
  }

  return references;
}
