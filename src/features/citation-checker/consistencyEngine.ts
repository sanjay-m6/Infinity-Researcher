import {
  ParsedReference,
  CitationIssue,
  CitationAuditSummary,
  CitationAuditReport,
  CitationStyleType,
} from "./types";
import { splitDocumentSections, extractInTextCitations, parseBibliographyReferences } from "./citationParser";

// ---------------------------------------------------------------------------
// STRING SIMILARITY UTILITY (NORMALIZED LEVENSHTEIN / JACCARD)
// ---------------------------------------------------------------------------

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function calculateTitleSimilarity(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  // Simple token overlap
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) intersection++;
  });
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

// ---------------------------------------------------------------------------
// CROSS-REFERENCING AUDIT ENGINE
// ---------------------------------------------------------------------------

export function performCitationAudit(rawDocument: string, documentTitle = "Manuscript"): CitationAuditReport {
  const { bodyText, referenceText, isBibtexFile } = splitDocumentSections(rawDocument);

  const inTextCitations = isBibtexFile ? [] : extractInTextCitations(bodyText);
  const references = parseBibliographyReferences(referenceText || rawDocument);

  const issues: CitationIssue[] = [];

  // Index references by various keys for robust cross-matching
  const refByKey = new Map<string, ParsedReference>();
  const refByIndex = new Map<number, ParsedReference>();

  references.forEach((ref, idx) => {
    refByKey.set(ref.key.toLowerCase(), ref);
    refByIndex.set(idx + 1, ref);
  });

  // 1. MATCH IN-TEXT CITATIONS TO REFERENCES
  let matchedCitationCount = 0;
  let orphanCitationCount = 0;

  for (const cite of inTextCitations) {
    const matchedRefs: ParsedReference[] = [];

    for (const k of cite.keys) {
      const cleanKey = k.trim().toLowerCase();

      // Numeric match: e.g. "1" matches ref with key "1" or 1st ref
      let found: ParsedReference | undefined = refByKey.get(cleanKey);
      if (!found) {
        const num = parseInt(cleanKey, 10);
        if (!isNaN(num)) {
          found = refByIndex.get(num);
        }
      }

      // Author-Year match: e.g. "vaswani et al., 2017"
      if (!found) {
        const yearMatch = cleanKey.match(/\b(19\d{2}|20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

        found = references.find((r) => {
          if (year && r.year && r.year !== year) return false;
          // Check if author surname is present
          const citeWords = cleanKey.split(/[\s,]+/);
          const authorSurname = citeWords[0];
          return r.authors.some((a) => a.toLowerCase().includes(authorSurname));
        });
      }

      if (found) {
        matchedRefs.push(found);
        found.inTextCitationCount++;
      } else {
        orphanCitationCount++;
        issues.push({
          id: `orphan_${cite.id}_${k}`,
          severity: "critical",
          category: "missing_reference",
          title: `Unmatched In-Text Citation: "${cite.raw}"`,
          description: `Citation key "${k}" appears in the text but has no corresponding entry in the References section.`,
          sourceSnippet: cite.contextSentence,
          citationId: cite.id,
          suggestedFix: `Add a bibliography entry for "${k}" in the references section, or correct the in-text citation marker.`,
        });
      }
    }

    cite.matchedReferenceIds = matchedRefs.map((r) => r.id);
    if (matchedRefs.length > 0) {
      matchedCitationCount++;
    }
  }

  // 2. CHECK UNCITED REFERENCES
  let uncitedRefCount = 0;
  for (const ref of references) {
    if (ref.inTextCitationCount === 0 && !isBibtexFile) {
      uncitedRefCount++;
      issues.push({
        id: `uncited_${ref.id}`,
        severity: "warning",
        category: "uncited_reference",
        title: `Uncited Reference in Bibliography: [${ref.key}]`,
        description: `Reference [${ref.key}] "${ref.title || ref.rawText.slice(0, 50)}..." is listed in the bibliography but is never cited in the body of the manuscript.`,
        sourceSnippet: ref.rawText,
        referenceId: ref.id,
        suggestedFix: `Cite [${ref.key}] in the text where relevant, or remove it from the bibliography.`,
      });
    }
  }

  // 3. DETECT DUPLICATE REFERENCES
  let duplicateCount = 0;
  for (let i = 0; i < references.length; i++) {
    for (let j = i + 1; j < references.length; j++) {
      const refA = references[i];
      const refB = references[j];

      // Exact DOI duplicate
      const doiDuplicate =
        refA.doiStatus.canonicalDoi &&
        refB.doiStatus.canonicalDoi &&
        refA.doiStatus.canonicalDoi === refB.doiStatus.canonicalDoi;

      // Title similarity duplicate (> 85%)
      const titleDuplicate =
        refA.title &&
        refB.title &&
        calculateTitleSimilarity(refA.title, refB.title) > 0.85;

      // Key duplicate
      const keyDuplicate = refA.key === refB.key;

      if (doiDuplicate || titleDuplicate || (keyDuplicate && refA.year && refA.year === refB.year)) {
        duplicateCount++;
        refB.isDuplicateOfId = refA.id;
        issues.push({
          id: `dup_${refA.id}_${refB.id}`,
          severity: "warning",
          category: "duplicate_reference",
          title: `Duplicate Reference Detected: [${refA.key}] and [${refB.key}]`,
          description: `References [${refA.key}] and [${refB.key}] appear to represent the same publication (${
            doiDuplicate ? `identical DOI "${refA.doiStatus.canonicalDoi}"` : `title similarity`
          }).`,
          sourceSnippet: `${refA.rawText}\n---\n${refB.rawText}`,
          referenceId: refB.id,
          suggestedFix: `Merge references [${refA.key}] and [${refB.key}] into a single entry and update in-text citation markers.`,
        });
      }
    }
  }

  // 4. VALIDATE DOIs & METADATA DISCREPANCIES
  let malformedDoiCount = 0;
  let verifiedDoiCount = 0;
  let metadataDiscrepancyCount = 0;

  for (const ref of references) {
    if (ref.doi) {
      if (!ref.doiStatus.syntaxValid) {
        malformedDoiCount++;
        issues.push({
          id: `doi_syntax_${ref.id}`,
          severity: "critical",
          category: "malformed_doi",
          title: `Malformed DOI Syntax in [${ref.key}]`,
          description: ref.doiStatus.syntaxErrorNote || `DOI "${ref.doi}" fails standard syntax validation.`,
          sourceSnippet: ref.rawText,
          referenceId: ref.id,
          suggestedFix: `Correct the DOI format to "10.<registrant>/<suffix>", or remove trailing punctuation.`,
        });
      } else if (ref.doiStatus.resolved && ref.doiStatus.verifiedMetadata) {
        verifiedDoiCount++;
        const meta = ref.doiStatus.verifiedMetadata;

        // Check Year discrepancy
        if (ref.year && meta.year && ref.year !== meta.year) {
          metadataDiscrepancyCount++;
          issues.push({
            id: `discrep_year_${ref.id}`,
            severity: "warning",
            category: "metadata_discrepancy",
            title: `Publication Year Discrepancy in [${ref.key}]`,
            description: `Reference lists publication year as ${ref.year}, but canonical registry verifies publication in ${meta.year}.`,
            sourceSnippet: ref.rawText,
            referenceId: ref.id,
            comparison: {
              field: "year",
              label: "Publication Year",
              referenceValue: String(ref.year),
              registryValue: String(meta.year),
            },
            suggestedFix: `Update publication year from ${ref.year} to ${meta.year}.`,
          });
        }

        // Check Title discrepancy
        if (ref.title && meta.title && calculateTitleSimilarity(ref.title, meta.title) < 0.65) {
          metadataDiscrepancyCount++;
          issues.push({
            id: `discrep_title_${ref.id}`,
            severity: "warning",
            category: "metadata_discrepancy",
            title: `Title Mismatch in [${ref.key}]`,
            description: `Reference title "${ref.title}" differs from the canonical registry title "${meta.title}".`,
            sourceSnippet: ref.rawText,
            referenceId: ref.id,
            comparison: {
              field: "title",
              label: "Paper Title",
              referenceValue: ref.title,
              registryValue: meta.title,
            },
            suggestedFix: `Replace reference title with verified title: "${meta.title}".`,
          });
        }
      }
    }
  }

  // 5. CHECK INCOMPLETE REFERENCE METADATA
  let incompleteCount = 0;
  for (const ref of references) {
    const missingFields: string[] = [];
    if (!ref.year) missingFields.push("Publication Year");
    if (!ref.venue) missingFields.push("Venue / Journal / Conference");
    if (ref.authors.length === 0) missingFields.push("Author Names");

    if (missingFields.length > 0) {
      incompleteCount++;
      issues.push({
        id: `incomplete_${ref.id}`,
        severity: "warning",
        category: "incomplete_metadata",
        title: `Incomplete Reference Information in [${ref.key}]`,
        description: `Reference is missing essential bibliographic fields: ${missingFields.join(", ")}. Incomplete references fail publication indexing requirements.`,
        sourceSnippet: ref.rawText,
        referenceId: ref.id,
        suggestedFix: `Supply the missing ${missingFields.join(" and ")} for this entry.`,
      });
    }
  }

  // 6. DETECT MIXED CITATION STYLES
  const numericCount = inTextCitations.filter((c) => c.style === "numeric").length;
  const authorYearCount = inTextCitations.filter((c) => c.style === "author_year").length;
  const hasMixedStyles = numericCount > 0 && authorYearCount > 0;

  if (hasMixedStyles) {
    issues.push({
      id: "mixed_styles",
      severity: "info",
      category: "mixed_citation_styles",
      title: "Mixed In-Text Citation Styles Detected",
      description: `The document mixes numeric citations (e.g. [1]) with author-year citations (e.g. (Smith, 2020)). Journals require a single unified style throughout.`,
      suggestedFix: `Standardize all citations to either IEEE numeric style or APA author-year style.`,
    });
  }

  // Determine dominant style
  let dominantStyle: CitationStyleType = "ieee";
  if (authorYearCount > numericCount) {
    dominantStyle = "apa";
  } else if (isBibtexFile) {
    dominantStyle = "bibtex";
  }

  // 7. COMPUTE HEALTH SCORE (0 - 100)
  let healthScore = 100;
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  healthScore -= criticalCount * 20;
  healthScore -= warningCount * 5;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const summary: CitationAuditSummary = {
    totalInTextCitations: inTextCitations.length,
    totalUniqueReferences: references.length,
    matchedCitationsCount: matchedCitationCount,
    orphanCitationsCount: orphanCitationCount,
    uncitedReferencesCount: uncitedRefCount,
    duplicateReferencesCount: duplicateCount,
    malformedDoiCount,
    verifiedDoiCount,
    metadataDiscrepancyCount,
    incompleteMetadataCount: incompleteCount,
    overallHealthScore: healthScore,
    dominantStyle,
    hasMixedStyles,
    claimSupportDisclaimer:
      "Important Notice: Successful DOI resolution or syntax validity confirms the identifier exists in academic registries; it does NOT verify that the cited paper supports the author's claim. Always inspect claim grounding via PDF evidence.",
  };

  return {
    id: `audit_${Date.now()}`,
    analyzedAt: new Date().toISOString(),
    documentTitle,
    summary,
    inTextCitations,
    references,
    issues,
  };
}
