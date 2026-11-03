import { ParsedReference, CitationStyleType } from "./types";

// ---------------------------------------------------------------------------
// MODULAR CITATION FORMATTERS
// ---------------------------------------------------------------------------

/**
 * Formats a reference into IEEE standard numbered format.
 */
export function formatAsIeee(ref: ParsedReference, index = 1): string {
  const authorStr =
    ref.authors.length > 0
      ? ref.authors.length > 3
        ? `${ref.authors[0]} et al.`
        : ref.authors.join(", ")
      : "[Author Unspecified]";

  const titleStr = ref.title ? `"${ref.title},"` : "";
  const venueStr = ref.venue ? `${ref.venue},` : "";
  const yearStr = ref.year ? `${ref.year}.` : "";
  const doiStr = ref.doi ? ` doi: ${ref.doi}.` : "";

  return `[${index}] ${authorStr}, ${titleStr} ${venueStr} ${yearStr}${doiStr}`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formats a reference into APA 7th edition format.
 */
export function formatAsApa(ref: ParsedReference): string {
  const authorStr =
    ref.authors.length > 0
      ? ref.authors.length > 2
        ? `${ref.authors[0]} et al.`
        : ref.authors.join(" & ")
      : "Author, Unknown";

  const yearStr = ref.year ? `(${ref.year}).` : "([n.d.]).";
  const titleStr = ref.title ? `${ref.title}.` : "";
  const venueStr = ref.venue ? `${ref.venue}.` : "";
  const doiStr = ref.doi ? ` https://doi.org/${ref.doi}` : "";

  return `${authorStr} ${yearStr} ${titleStr} ${venueStr}${doiStr}`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formats a reference into MLA 9th edition format.
 */
export function formatAsMla(ref: ParsedReference): string {
  const authorStr =
    ref.authors.length > 0
      ? ref.authors.length > 2
        ? `${ref.authors[0]}, et al.`
        : ref.authors.join(", and ")
      : "Anonymous";

  const titleStr = ref.title ? `"${ref.title}."` : "";
  const venueStr = ref.venue ? `${ref.venue},` : "";
  const yearStr = ref.year ? `${ref.year}.` : "";
  const doiStr = ref.doi ? ` DOI: ${ref.doi}.` : "";

  return `${authorStr}. ${titleStr} ${venueStr} ${yearStr}${doiStr}`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formats a reference into Chicago 17th author-date edition format.
 */
export function formatAsChicago(ref: ParsedReference): string {
  const authorStr =
    ref.authors.length > 0
      ? ref.authors.length > 3
        ? `${ref.authors[0]}, et al.`
        : ref.authors.join(", and ")
      : "Unknown Author";

  const yearStr = ref.year ? `${ref.year}.` : "n.d.";
  const titleStr = ref.title ? `"${ref.title}."` : "";
  const venueStr = ref.venue ? `${ref.venue}.` : "";
  const doiStr = ref.doi ? ` https://doi.org/${ref.doi}.` : "";

  return `${authorStr}. ${yearStr} ${titleStr} ${venueStr}${doiStr}`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formats a reference into Harvard referencing format.
 */
export function formatAsHarvard(ref: ParsedReference): string {
  const authorStr =
    ref.authors.length > 0
      ? ref.authors.length > 2
        ? `${ref.authors[0]} et al.`
        : ref.authors.join(" and ")
      : "Anon";

  const yearStr = ref.year ? `(${ref.year})` : "([n.d.])";
  const titleStr = ref.title ? `'${ref.title}',` : "";
  const venueStr = ref.venue ? `${ref.venue}.` : "";
  const doiStr = ref.doi ? ` Available at: https://doi.org/${ref.doi}.` : "";

  return `${authorStr} ${yearStr} ${titleStr} ${venueStr}${doiStr}`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formats a reference into BibTeX format.
 */
export function formatAsBibtex(ref: ParsedReference): string {
  const firstAuthor = ref.authors[0]?.split(/\s+/).pop()?.toLowerCase() || "paper";
  const yearStr = ref.year ? String(ref.year) : "nodate";
  const citeKey = `${firstAuthor}${yearStr}`;

  return `@article{${citeKey},
  author    = {${ref.authors.join(" and ") || "Unknown"}},
  title     = {{${ref.title || "Untitled Document"}}},
  journal   = {${ref.venue || "Unspecified Periodical"}},
  year      = {${ref.year || ""}},
  doi       = {${ref.doi || ""}}
}`;
}

/**
 * Re-formats reference into a specified target style.
 */
export function formatReferenceInStyle(
  ref: ParsedReference,
  style: CitationStyleType,
  index = 1
): string {
  switch (style) {
    case "ieee":
      return formatAsIeee(ref, index);
    case "apa":
      return formatAsApa(ref);
    case "mla":
      return formatAsMla(ref);
    case "chicago":
      return formatAsChicago(ref);
    case "harvard":
      return formatAsHarvard(ref);
    case "bibtex":
      return formatAsBibtex(ref);
  }
}

// ---------------------------------------------------------------------------
// TEST SAMPLES WITH INTENTIONAL DISCREPANCIES FOR SYSTEM EVALUATION
// ---------------------------------------------------------------------------

export const CITATION_CHECKER_DEMO_MANUSCRIPT = `Neural document retrieval models have demonstrated dramatic empirical progress across scholarly benchmarks [1]. In particular, multi-head attention mechanisms [2] allow networks to capture long-range semantic dependencies without recurrent constraints. Previous investigations by (Devlin et al., 2018) established that bidirectional contextual representations provide superior token embeddings. Furthermore, convolutional baselines [3] remain effective for visual embedding extraction. Recent comparative evaluations [4] corroborate these theoretical presuppositions.

REFERENCES
[1] A. Vaswani, N. Shazeer, N. Parmar, et al., "Attention Is All You Need," in Advances in Neural Information Processing Systems (NeurIPS), 2018. doi: 10.48550/arXiv.1706.03762.
[2] J. Devlin, M. Chang, K. Lee, and K. Toutanova, "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding," NAACL, 2018. doi: 10.48550/arxiv.1810.04805.
[3] K. He, X. Zhang, S. Ren, and J. Sun, "Deep Residual Learning for Image Recognition," in IEEE CVPR, 2016. doi: 10.1109/cvpr.2016.90.
[4] K. He, X. Zhang, S. Ren, and J. Sun, "Deep Residual Learning for Image Recognition," IEEE CVPR, 2016. doi: 10.1109/cvpr.2016.90.
[5] Y. LeCun, Y. Bengio, and G. Hinton, "Deep Learning," Nature, 2015. doi: 10.1038/nature14539.
[6] S. Sanjay, "Neural Document Search," 2024. doi: 1109/MALFORMED.DOI.ACCESS.
[7] P. Kumar, "Algorithmic Precision in Repositories," in IEEE Access. doi: 10.1109/access.2023.1042918.`;
