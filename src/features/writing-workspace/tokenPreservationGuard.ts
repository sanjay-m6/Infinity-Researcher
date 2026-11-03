import {
  PreservedToken,
  TokenType,
  ValidationIssue,
  SemanticValidationResult,
} from "./types";

// ---------------------------------------------------------------------------
// REGEX PATTERNS FOR TOKEN EXTRACTION
// ---------------------------------------------------------------------------

// Citations: [1], [1, 2], [1-4], [Vaswani et al., 2017], (Smith & Jones, 2021), (Doe et al., 2019)
const BRACKET_CITATION_REGEX = /\[(?:\d+(?:[–\-,\s]+\d+)*|[A-Z][a-zA-Z\s.&-]+(?:et\s+al\.)?,?\s*(?:19|20)\d{2}[a-z]?)\]/g;
const PARENTHETICAL_CITATION_REGEX = /\((?:[A-Z][a-zA-Z\s.&-]+(?:et\s+al\.)?,?\s*(?:19|20)\d{2}[a-z]?(?:;\s*)?)+\)/g;

// Equations & Mathematical Notation: $...$, $$...$$, or equation patterns like f(x) = y, \alpha, etc.
const LATEX_INLINE_MATH_REGEX = /\$[^$\n]+\$/g;
const LATEX_BLOCK_MATH_REGEX = /\$\$[^$]+\$\$/g;

// DOIs & URLs
const DOI_REGEX = /\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/gi;
const URL_REGEX = /https?:\/\/[^\s)\]]+/gi;

// Quantities with units: e.g. "14.2%", "250 mg", "3.5 GHz", "100 ms", "45 nm", "22 °C"
const QUANTITY_UNIT_REGEX = /\b\d+(?:[.,]\d+)?\s*(?:mg|g|kg|kHz|MHz|GHz|THz|Hz|ms|ns|μs|us|s|min|h|nm|μm|um|mm|cm|m|km|°C|K|V|mV|mA|A|W|kW|MW|dB|dBm|bps|kbps|Mbps|Gbps|%|percent)(?!\w)/gi;

// Standalone numbers & percentages
const STANDALONE_NUMBER_REGEX = /\b\d+(?:[.,]\d+)?%?(?!\w)/g;

// Dates: e.g. "2024", "October 2021", "May 14, 2020", "1998-05-12"
const DATE_REGEX = /\b(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+)?(?:19|20)\d{2}(?:-\d{2}-\d{2})?\b/gi;

// Technical Identifiers & Architecture Names
const TECH_IDENTIFIER_REGEX = /\b(?:GPT-[34o.-]+|BERT(?:-[A-Za-z0-9]+)?|ResNet-\d+|LLaMA(?:-[0-9.]+)?|IEEE\s*\d+(?:\.\d+[a-z]*)?|AdamW|SGD|CUDA(?:\s*\d+(?:\.\d+)?)?|Transformer|LSTM|CNN|RNN|U-Net|ViT|BERT-Large|PyTorch|TensorFlow)\b/gi;

// Named Entities (frequent academic entities & publishers)
const NAMED_ENTITY_REGEX = /\b(?:IEEE|ACM|Springer|Nature|Elsevier|ArXiv|PubMed|Crossref|OpenAlex|Google|Stanford|MIT|DeepMind|OpenAI|Harvard|Oxford)\b/g;

// Negations
const NEGATION_WORDS = [
  "not",
  "never",
  "neither",
  "nor",
  "fails to",
  "failed to",
  "without",
  "cannot",
  "can't",
  "unable to",
  "no statistically significant",
  "no significant",
  "no evidence",
  "did not",
  "does not",
];

// Uncertainty / Hedging Language
const HEDGING_WORDS = [
  "may",
  "might",
  "could",
  "suggests",
  "suggested",
  "suggesting",
  "indicates possibility",
  "potential",
  "potentially",
  "hypothetical",
  "tentative",
  "presumably",
  "preliminary",
  "unclear",
  "conceivably",
  "appears to",
];

// Statistical Formulations
const STATISTICAL_RESULT_REGEX = /\b(?:p\s*[<>=]\s*0?\.\d+|t\s*\(\d+\)\s*=\s*-?\d+(?:\.\d+)?|F\s*\(\d+,\s*\d+\)\s*=\s*\d+(?:\.\d+)?|R²\s*=\s*0?\.\d+|95%\s*CI\s*(?:\[[^\]]+\]|\([^)]+\)))\b/gi;

/**
 * Extracts invariant tokens from academic text.
 */
export function extractInvariantTokens(text: string): PreservedToken[] {
  const tokens: PreservedToken[] = [];
  const addedSpans = new Set<string>();

  const addMatch = (type: TokenType, match: RegExpExecArray) => {
    const raw = match[0];
    const key = `${type}:${match.index}:${raw}`;
    if (!addedSpans.has(key)) {
      addedSpans.add(key);
      tokens.push({
        type,
        value: raw.trim(),
        raw,
        index: match.index,
      });
    }
  };

  const scan = (regex: RegExp, type: TokenType) => {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      addMatch(type, m);
    }
  };

  // 1. Equations & Math
  scan(LATEX_BLOCK_MATH_REGEX, "equation");
  scan(LATEX_INLINE_MATH_REGEX, "equation");

  // 2. DOIs and URLs
  scan(DOI_REGEX, "doi");
  scan(URL_REGEX, "url");

  // 3. Citations
  scan(BRACKET_CITATION_REGEX, "citation");
  scan(PARENTHETICAL_CITATION_REGEX, "citation");

  // 4. Statistical Results
  scan(STATISTICAL_RESULT_REGEX, "statistical_result");

  // 5. Quantities with Units
  scan(QUANTITY_UNIT_REGEX, "unit");

  // 6. Technical Identifiers
  scan(TECH_IDENTIFIER_REGEX, "technical_term");

  // 7. Named Entities
  scan(NAMED_ENTITY_REGEX, "named_entity");

  // 8. Dates
  scan(DATE_REGEX, "date");

  // 9. Standalone Numbers
  scan(STANDALONE_NUMBER_REGEX, "number");

  // 10. Negations
  for (const neg of NEGATION_WORDS) {
    const negRegex = new RegExp(`\\b${neg}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = negRegex.exec(text)) !== null) {
      addMatch("negation", m);
    }
  }

  // 11. Uncertainty / Hedging Language
  for (const hedge of HEDGING_WORDS) {
    const hedgeRegex = new RegExp(`\\b${hedge}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = hedgeRegex.exec(text)) !== null) {
      addMatch("uncertainty", m);
    }
  }

  return tokens.sort((a, b) => a.index - b.index);
}

/**
 * Normalizes a token string for comparison.
 */
function normalizeTokenVal(val: string): string {
  return val.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Validates token preservation and checks for semantic drift between original and revised text.
 */
export function validatePreservationAndSemantics(
  originalText: string,
  revisedText: string
): SemanticValidationResult {
  const origTokens = extractInvariantTokens(originalText);
  const revTokens = extractInvariantTokens(revisedText);

  const issues: ValidationIssue[] = [];

  // Group tokens by type
  const origByType = new Map<TokenType, PreservedToken[]>();
  origTokens.forEach((t) => {
    if (!origByType.has(t.type)) origByType.set(t.type, []);
    origByType.get(t.type)!.push(t);
  });

  const revByType = new Map<TokenType, PreservedToken[]>();
  revTokens.forEach((t) => {
    if (!revByType.has(t.type)) revByType.set(t.type, []);
    revByType.get(t.type)!.push(t);
  });

  let preservedCount = 0;
  let missingCount = 0;

  // 1. Invariant Tokens Check: Citations, DOIs, URLs, Equations
  const strictInvariants: TokenType[] = ["citation", "doi", "url", "equation", "statistical_result"];
  for (const invType of strictInvariants) {
    const origList = origByType.get(invType) || [];
    const revList = revByType.get(invType) || [];
    const revVals = new Set(revList.map((t) => normalizeTokenVal(t.value)));

    for (const token of origList) {
      const norm = normalizeTokenVal(token.value);
      // Check exact or partial inclusion
      const foundInRev = revVals.has(norm) || revisedText.includes(token.raw);
      if (foundInRev) {
        preservedCount++;
      } else {
        missingCount++;
        issues.push({
          id: `missing_${invType}_${token.index}`,
          severity: "critical",
          category: "token_preservation",
          title: `Missing ${invType.replace("_", " ").toUpperCase()}: "${token.value}"`,
          description: `The original ${invType} "${token.value}" was not found in the revised text. Scholarly references and mathematical formulations must be retained verbatim.`,
          originalSnippet: token.raw,
          token,
          suggestedFix: `Re-insert "${token.raw}" at the appropriate location in the revision.`,
        });
      }
    }
  }

  // 2. Numerical Quantities & Measurement Units Check
  const origQuantities = origByType.get("unit") || [];
  const revQuantities = revByType.get("unit") || [];
  const revQuantVals = new Set(revQuantities.map((t) => normalizeTokenVal(t.value)));

  for (const token of origQuantities) {
    const norm = normalizeTokenVal(token.value);
    const found = revQuantVals.has(norm) || revisedText.toLowerCase().includes(norm);
    if (found) {
      preservedCount++;
    } else {
      missingCount++;
      issues.push({
        id: `missing_qty_${token.index}`,
        severity: "warning",
        category: "token_preservation",
        title: `Altered Measurement or Quantity: "${token.value}"`,
        description: `The quantitative value "${token.value}" was modified or removed in the revision. Quantitative metrics must remain consistent with experimental data.`,
        originalSnippet: token.raw,
        token,
        suggestedFix: `Ensure "${token.value}" is restored in the revised text.`,
      });
    }
  }

  // 3. Technical Identifiers Check
  const origTech = origByType.get("technical_term") || [];
  const revTech = revByType.get("technical_term") || [];
  const revTechVals = new Set(revTech.map((t) => normalizeTokenVal(t.value)));

  for (const token of origTech) {
    const norm = normalizeTokenVal(token.value);
    const found = revTechVals.has(norm) || revisedText.toLowerCase().includes(norm);
    if (found) {
      preservedCount++;
    } else {
      issues.push({
        id: `tech_id_${token.index}`,
        severity: "warning",
        category: "token_preservation",
        title: `Missing Technical Terminology: "${token.value}"`,
        description: `The specific technical identifier "${token.value}" was omitted or altered.`,
        originalSnippet: token.raw,
        token,
        suggestedFix: `Keep the exact technical name "${token.value}".`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // SEMANTIC DRIFT & SCIENTIFIC CERTAINTY CHECKS
  // ---------------------------------------------------------------------------

  const lowerOrig = originalText.toLowerCase();
  const lowerRev = revisedText.toLowerCase();

  // A. Correlation vs Causation Inversion
  const correlationPhrases = ["correlated with", "correlation", "associated with", "linked to"];
  const causationPhrases = ["causes", "caused by", "causing", "causation", "proves that"];

  const origHasCorrelation = correlationPhrases.some((p) => lowerOrig.includes(p));
  const origHasCausation = causationPhrases.some((p) => lowerOrig.includes(p));
  const revHasCausation = causationPhrases.some((p) => lowerRev.includes(p));

  if (origHasCorrelation && !origHasCausation && revHasCausation) {
    issues.push({
      id: "drift_correlation_causation",
      severity: "critical",
      category: "scientific_certainty",
      title: "Potential Semantic Drift: Correlation transformed into Causation",
      description: `The original text specified an association or correlation ("${
        correlationPhrases.find((p) => lowerOrig.includes(p)) || "correlated"
      }"), but the revision introduces causative terminology ("${
        causationPhrases.find((p) => lowerRev.includes(p)) || "causes"
      }"). In scientific literature, correlation must never be reported as causation without rigorous experimental proof.`,
      suggestedFix: `Rephrase causative language back to "associated with", "correlated with", or "demonstrates an association".`,
    });
  }

  // B. Inversion of Statistical Significance
  const origNotSig = lowerOrig.includes("not statistically significant") || lowerOrig.includes("no statistically significant");
  const revIsSig = lowerRev.includes("statistically significant") && !lowerRev.includes("not statistically significant") && !lowerRev.includes("no statistically significant");

  if (origNotSig && revIsSig) {
    issues.push({
      id: "drift_significance_inverted",
      severity: "critical",
      category: "scientific_certainty",
      title: "Critical Inversion: Statistical Non-Significance Altered",
      description: `The original document stated the finding was "not statistically significant", but the revised text asserts "statistically significant". This inverts the scientific empirical finding.`,
      suggestedFix: `Restore the negative qualifier: "not statistically significant".`,
    });
  }

  // C. Removed Hedging / Scientific Uncertainty Language
  // e.g. "may improve" vs "improves", "could potentially" vs "will"
  const origHedges = (origByType.get("uncertainty") || []).map((t) => t.value.toLowerCase());
  const revHedges = (revByType.get("uncertainty") || []).map((t) => t.value.toLowerCase());

  if (origHedges.length > 0 && revHedges.length === 0 && origHedges.length >= 2) {
    issues.push({
      id: "drift_hedging_stripped",
      severity: "warning",
      category: "hedging_alteration",
      title: "Scientific Uncertainty & Hedging Reduced",
      description: `The original text used cautionary language (${origHedges.slice(0, 3).join(", ")}), but the revision omitted these hedges, making the claims sound overly absolute.`,
      suggestedFix: `Re-introduce appropriate hedges such as "may", "suggests", or "potential" to maintain scholarly prudence.`,
    });
  }

  // D. Negation Preservation Check
  const origNegations = origByType.get("negation") || [];
  const revNegations = revByType.get("negation") || [];
  if (origNegations.length > revNegations.length) {
    const diffNegs = origNegations.filter((on) => !revNegations.some((rn) => rn.value.toLowerCase() === on.value.toLowerCase()));
    if (diffNegs.length > 0) {
      issues.push({
        id: "drift_negation_missing",
        severity: "warning",
        category: "semantic_drift",
        title: "Important Negation Qualifier Missing",
        description: `The original text contained negation phrasing ("${diffNegs[0].value}"), which may alter the truth value of the clause if removed.`,
        originalSnippet: diffNegs[0].raw,
        suggestedFix: `Confirm that removing "${diffNegs[0].value}" does not reverse the intended meaning.`,
      });
    }
  }

  // E. Removed Study Limitations Check
  const limitationKeywords = ["limitation", "preliminary", "constrained by", "further research is warranted", "small sample size"];
  const origHasLimitations = limitationKeywords.some((k) => lowerOrig.includes(k));
  const revHasLimitations = limitationKeywords.some((k) => lowerRev.includes(k));

  if (origHasLimitations && !revHasLimitations) {
    issues.push({
      id: "drift_limitation_removed",
      severity: "warning",
      category: "missing_content",
      title: "Study Limitation or Cautionary Note Removed",
      description: `The original manuscript stated study limitations or boundary conditions that appear to have been omitted in the revision. Academic integrity requires preserving caveats and scope boundaries.`,
      suggestedFix: `Ensure the limitations and boundary conditions are explicitly preserved in the revision.`,
    });
  }

  // Compute overall score (100 is perfect preservation)
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  let score = 100;
  score -= criticalCount * 30;
  score -= warningCount * 10;
  if (origTokens.length > 0 && missingCount > 0) {
    score -= Math.round((missingCount / origTokens.length) * 20);
  }
  score = Math.max(0, Math.min(100, score));

  const passed = criticalCount === 0 && warningCount <= 1;

  return {
    passed,
    score,
    issues,
    preservedTokensCount: preservedCount,
    missingTokensCount: missingCount,
    criticalIssuesCount: criticalCount,
    warningIssuesCount: warningCount,
    disclaimer:
      "Semantic validation is advisory. Disciplinary nuances and conceptual equivalence are not mathematically guaranteed; authors must inspect and approve all scientific claims.",
  };
}
