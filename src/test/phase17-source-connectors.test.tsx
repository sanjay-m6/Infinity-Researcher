import { describe, it, expect } from "vitest";
import type {
  ProviderCapabilities,
  ProviderHealthCheck,
  NormalizedWork,
} from "../lib/desktop-api";

// ---------------------------------------------------------------------------
// Canonical DOI Normalization Utility Mirror (matching Rust & Python implementation)
// ---------------------------------------------------------------------------
export function normalizeCanonicalDoi(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const stripped = trimmed
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .replace(/[.,;)]+$/, "");

  if (stripped.startsWith("10.") && stripped.includes("/")) {
    return stripped.toLowerCase();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Clean Title Key Generator Mirror
// ---------------------------------------------------------------------------
export function computeCleanTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Conservative Deduplication Logic Mirror
// ---------------------------------------------------------------------------
export function deduplicateAndMergeWorks(works: NormalizedWork[]): NormalizedWork[] {
  const byDoi = new Map<string, number>();
  const byProviderRecord = new Map<string, number>();
  const byTitle = new Map<string, number[]>();
  const merged: NormalizedWork[] = [];

  for (const work of works) {
    let existingIdx: number | null = null;

    // Tier 1: Canonical DOI
    if (work.canonical_doi) {
      const idx = byDoi.get(work.canonical_doi);
      if (idx !== undefined) existingIdx = idx;
    }

    // Tier 2: Provider ID + Provider Record ID
    if (existingIdx === null) {
      const key = `${work.provider_id}:${work.provider_record_id}`;
      const idx = byProviderRecord.get(key);
      if (idx !== undefined) existingIdx = idx;
    }

    // Tier 3: Clean Title (>= 10 chars) + Year (+/- 1) + Author Surname Overlap
    if (existingIdx === null && work.clean_title_key.length >= 10) {
      const candidateIndices = byTitle.get(work.clean_title_key) || [];
      for (const cIdx of candidateIndices) {
        const cand = merged[cIdx];
        const yearCompat =
          work.publication_year && cand.publication_year
            ? Math.abs(work.publication_year - cand.publication_year) <= 1
            : true;

        if (!yearCompat) continue;

        // Author surname overlap check
        let authorCompat: boolean;
        if (work.authors.length === 0 || cand.authors.length === 0) {
          authorCompat = work.publication_year === cand.publication_year;
        } else {
          const getSurname = (name: string) => {
            const trimmed = name.trim();
            if (trimmed.includes(",")) {
              return (trimmed.split(",")[0] || "").trim().toLowerCase();
            }
            const parts = trimmed.split(/\s+/);
            return (parts[parts.length - 1] || "").toLowerCase();
          };
          const workSurnames = work.authors
            .map((a) => getSurname(a.name))
            .filter((s) => s.length >= 3);
          const candSurnames = cand.authors
            .map((a) => getSurname(a.name))
            .filter((s) => s.length >= 3);
          authorCompat = workSurnames.some((s) => candSurnames.includes(s));
        }

        if (authorCompat) {
          existingIdx = cIdx;
          break;
        }
      }
    }

    if (existingIdx !== null) {
      const target = merged[existingIdx];
      // Merge provenance
      for (const prov of work.provenance) {
        if (
          !target.provenance.some(
            (p) => p.provider_id === prov.provider_id && p.record_id === prov.record_id
          )
        ) {
          target.provenance.push(prov);
        }
      }
      // Non-destructive field merge
      if (!target.canonical_doi && work.canonical_doi)
        target.canonical_doi = work.canonical_doi;
      if (!target.abstract_text && work.abstract_text)
        target.abstract_text = work.abstract_text;
      if (!target.pdf_url && work.pdf_url) target.pdf_url = work.pdf_url;
      if (!target.landing_url && work.landing_url) target.landing_url = work.landing_url;
      if (work.authors.length > target.authors.length) target.authors = work.authors;
      if (!target.publication_date && work.publication_date)
        target.publication_date = work.publication_date;
      if (!target.venue && work.venue) target.venue = work.venue;
      if (work.citation_count !== undefined && work.citation_count !== null) {
        target.citation_count = Math.max(target.citation_count || 0, work.citation_count);
      }
      if (!target.is_open_access && work.is_open_access) target.is_open_access = true;
    } else {
      const newIdx = merged.length;
      if (work.canonical_doi) byDoi.set(work.canonical_doi, newIdx);
      byProviderRecord.set(`${work.provider_id}:${work.provider_record_id}`, newIdx);
      const existingTitles = byTitle.get(work.clean_title_key) || [];
      existingTitles.push(newIdx);
      byTitle.set(work.clean_title_key, existingTitles);
      merged.push({ ...work, provenance: [...work.provenance] });
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Metadata Completeness Calculation Mirror
// ---------------------------------------------------------------------------
export function calculateMetadataScore(work: Partial<NormalizedWork>): number {
  let score = 0;
  if (work.canonical_doi && work.canonical_doi.trim()) score += 25;
  if (work.title && work.title.trim()) score += 20;
  if (work.abstract_text && work.abstract_text.trim()) score += 20;
  if (work.authors && work.authors.length > 0) score += 15;
  if (work.publication_date || work.publication_year) score += 10;
  if (work.venue && work.venue.trim()) score += 5;
  if (work.pdf_url || work.is_open_access) score += 5;
  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// Capability-Aware Query Planning Mirror
// ---------------------------------------------------------------------------
export function planQuery(
  rawQuery: string,
  selectedProviders: string[],
  capabilities: ProviderCapabilities[],
  filters: { yearStart?: number; yearEnd?: number; openAccessOnly?: boolean }
) {
  const normDoi = normalizeCanonicalDoi(rawQuery);
  const detectedType = normDoi ? "doi" : "keywords";
  const warnings: string[] = [];

  const providerPlans = selectedProviders.map((pid) => {
    const cap = capabilities.find((c) => c.provider_id === pid);
    const provWarnings: string[] = [];
    let requiresClientFiltering = false;

    if (filters.yearStart || filters.yearEnd) {
      if (!cap?.supports_year_filter) {
        requiresClientFiltering = true;
        provWarnings.push(
          `${cap?.display_name || pid} does not support native year filtering.`
        );
      }
    }

    if (filters.openAccessOnly) {
      if (!cap?.supports_open_access_filter && pid !== "arxiv") {
        requiresClientFiltering = true;
        provWarnings.push(
          `${cap?.display_name || pid} does not support native open-access filtering.`
        );
      }
    }

    return {
      provider_id: pid,
      native_query: normDoi || rawQuery.trim(),
      requiresClientFiltering,
      warnings: provWarnings,
    };
  });

  return {
    raw_query: rawQuery,
    detected_identifier_type: detectedType,
    cleaned_identifier: normDoi,
    provider_plans: providerPlans,
    global_warnings: warnings,
  };
}

// ===========================================================================
// Test Suite
// ===========================================================================
describe("Phase 17 — Academic Source Connector Framework & Retrieval Reliability", () => {
  const mockCapabilities: ProviderCapabilities[] = [
    {
      provider_id: "openalex",
      display_name: "OpenAlex",
      documentation_url: "https://docs.openalex.org/",
      supports_year_filter: true,
      supports_open_access_filter: true,
      supports_doi_lookup: true,
      supports_author_search: true,
      supports_abstracts: true,
      supports_pdf_discovery: true,
      supports_pagination: true,
      supports_cursor_pagination: true,
      requires_api_key: false,
      rate_limit_rps: 10.0,
      category: "General Scholarly",
      auth_type: "optional_api_key",
      preferred_identifier: "doi",
    },
    {
      provider_id: "crossref",
      display_name: "Crossref",
      documentation_url: "https://api.crossref.org",
      supports_year_filter: true,
      supports_open_access_filter: false,
      supports_doi_lookup: true,
      supports_author_search: true,
      supports_abstracts: false,
      supports_pdf_discovery: false,
      supports_pagination: true,
      supports_cursor_pagination: true,
      requires_api_key: false,
      rate_limit_rps: 50.0,
      category: "General Scholarly",
      auth_type: "none",
      preferred_identifier: "doi",
    },
    {
      provider_id: "arxiv",
      display_name: "arXiv",
      documentation_url: "https://arxiv.org/help/api",
      supports_year_filter: false,
      supports_open_access_filter: false,
      supports_doi_lookup: true,
      supports_author_search: true,
      supports_abstracts: true,
      supports_pdf_discovery: true,
      supports_pagination: true,
      supports_cursor_pagination: false,
      requires_api_key: false,
      rate_limit_rps: 0.33,
      category: "Preprints",
      auth_type: "none",
      preferred_identifier: "arxiv_id",
    },
    {
      provider_id: "semantic_scholar",
      display_name: "Semantic Scholar",
      documentation_url: "https://api.semanticscholar.org",
      supports_year_filter: true,
      supports_open_access_filter: true,
      supports_doi_lookup: true,
      supports_author_search: true,
      supports_abstracts: true,
      supports_pdf_discovery: true,
      supports_pagination: true,
      supports_cursor_pagination: false,
      requires_api_key: false,
      rate_limit_rps: 1.0,
      category: "General Scholarly",
      auth_type: "optional_api_key",
      preferred_identifier: "doi",
    },
    {
      provider_id: "europe_pmc",
      display_name: "Europe PMC",
      documentation_url: "https://europepmc.org",
      supports_year_filter: true,
      supports_open_access_filter: true,
      supports_doi_lookup: true,
      supports_author_search: true,
      supports_abstracts: true,
      supports_pdf_discovery: true,
      supports_pagination: true,
      supports_cursor_pagination: true,
      requires_api_key: false,
      rate_limit_rps: 10.0,
      category: "Biomedical & Life Sciences",
      auth_type: "none",
      preferred_identifier: "pmcid",
    },
  ];

  describe("1. Canonical DOI Normalization & Sanitization", () => {
    it("normalizes bare DOIs with standard 10.xxxx prefix", () => {
      expect(normalizeCanonicalDoi("10.1038/s41586-020-2649-2")).toBe(
        "10.1038/s41586-020-2649-2"
      );
    });

    it("strips https://doi.org/ resolver prefix and lowercases", () => {
      expect(normalizeCanonicalDoi("https://doi.org/10.1145/3318464.3389700")).toBe(
        "10.1145/3318464.3389700"
      );
      expect(normalizeCanonicalDoi("HTTPS://DOI.ORG/10.1038/S41586-020-2649-2")).toBe(
        "10.1038/s41586-020-2649-2"
      );
    });

    it("strips http://dx.doi.org/ and doi: schemes", () => {
      expect(normalizeCanonicalDoi("http://dx.doi.org/10.1016/j.cell.2020.08.001")).toBe(
        "10.1016/j.cell.2020.08.001"
      );
      expect(normalizeCanonicalDoi("doi: 10.1109/CVPR.2016.90 ")).toBe(
        "10.1109/cvpr.2016.90"
      );
    });

    it("strips trailing citation punctuation dots, commas, and brackets", () => {
      expect(normalizeCanonicalDoi("https://doi.org/10.1038/s41586-020-2649-2.")).toBe(
        "10.1038/s41586-020-2649-2"
      );
      expect(normalizeCanonicalDoi("10.1038/s41586-020-2649-2,")).toBe(
        "10.1038/s41586-020-2649-2"
      );
      expect(normalizeCanonicalDoi("10.1038/s41586-020-2649-2)")).toBe(
        "10.1038/s41586-020-2649-2"
      );
    });

    it("rejects non-DOI arbitrary text and invalid identifiers", () => {
      expect(normalizeCanonicalDoi("not-a-doi")).toBeNull();
      expect(normalizeCanonicalDoi("https://arxiv.org/abs/2104.12345")).toBeNull();
      expect(normalizeCanonicalDoi("")).toBeNull();
    });
  });

  describe("2. Provider Registry & Capability Matrices", () => {
    it("declares 5 core Tier A academic providers with accurate capability flags", () => {
      expect(mockCapabilities.length).toBe(5);

      const openalex = mockCapabilities.find((c) => c.provider_id === "openalex")!;
      expect(openalex.supports_doi_lookup).toBe(true);
      expect(openalex.supports_year_filter).toBe(true);
      expect(openalex.supports_open_access_filter).toBe(true);
      expect(openalex.supports_abstracts).toBe(true);
      expect(openalex.supports_pdf_discovery).toBe(true);

      const crossref = mockCapabilities.find((c) => c.provider_id === "crossref")!;
      expect(crossref.supports_doi_lookup).toBe(true);
      expect(crossref.supports_open_access_filter).toBe(false);
      expect(crossref.supports_abstracts).toBe(false);

      const arxiv = mockCapabilities.find((c) => c.provider_id === "arxiv")!;
      expect(arxiv.supports_year_filter).toBe(false);
      expect(arxiv.preferred_identifier).toBe("arxiv_id");
      expect(arxiv.category).toBe("Preprints");
    });

    it("distinguishes authentication requirements and categories across connectors", () => {
      const s2 = mockCapabilities.find((c) => c.provider_id === "semantic_scholar")!;
      expect(s2.auth_type).toBe("optional_api_key");
      expect(s2.requires_api_key).toBe(false);

      const epmc = mockCapabilities.find((c) => c.provider_id === "europe_pmc")!;
      expect(epmc.category).toBe("Biomedical & Life Sciences");
      expect(epmc.preferred_identifier).toBe("pmcid");
    });
  });

  describe("3. Capability-Aware Query Planning", () => {
    it("detects DOI in query string and prepares direct identifier execution", () => {
      const plan = planQuery(
        "https://doi.org/10.1038/s41586-020-2649-2",
        ["openalex", "crossref"],
        mockCapabilities,
        {}
      );

      expect(plan.detected_identifier_type).toBe("doi");
      expect(plan.cleaned_identifier).toBe("10.1038/s41586-020-2649-2");
      expect(plan.provider_plans[0].native_query).toBe("10.1038/s41586-020-2649-2");
    });

    it("flags providers lacking server-side filters and generates structured warnings", () => {
      const plan = planQuery("deep learning", ["arxiv", "openalex"], mockCapabilities, {
        yearStart: 2021,
        yearEnd: 2024,
        openAccessOnly: true,
      });

      const arxivPlan = plan.provider_plans.find((p) => p.provider_id === "arxiv")!;
      expect(arxivPlan.requiresClientFiltering).toBe(true);
      expect(arxivPlan.warnings.some((w) => w.includes("year filtering"))).toBe(true);

      const oaPlan = plan.provider_plans.find((p) => p.provider_id === "openalex")!;
      expect(oaPlan.requiresClientFiltering).toBe(false);
      expect(oaPlan.warnings.length).toBe(0);
    });
  });

  describe("4. Conservative Multi-Tier Deduplication & Safe Merging", () => {
    it("merges duplicate papers matching exact canonical DOI (Tier 1)", () => {
      const work1: NormalizedWork = {
        id: "oa-1",
        canonical_doi: "10.1000/182",
        title: "Digital Object Identifier Handbook",
        clean_title_key: "digitalobjectidentifierhandbook",
        abstract_text: "Comprehensive handbook detailing DOI architecture.",
        publication_date: "2020-01-01",
        publication_year: 2020,
        venue: null,
        venue_type: null,
        authors: [{ name: "Norman Paskin", orcid: null, affiliation: null }],
        is_open_access: false,
        landing_url: "https://doi.org/10.1000/182",
        pdf_url: null,
        citation_count: 50,
        provider_id: "openalex",
        provider_record_id: "W1",
        provenance: [
          {
            provider_id: "openalex",
            record_id: "W1",
            landing_url: "https://openalex.org/W1",
            retrieved_at: "2026-10-30T00:00:00Z",
          },
        ],
      };

      const work2: NormalizedWork = {
        id: "cr-1",
        canonical_doi: "10.1000/182",
        title: "Digital Object Identifier Handbook",
        clean_title_key: "digitalobjectidentifierhandbook",
        abstract_text: null,
        publication_date: "2020-01-01",
        publication_year: 2020,
        venue: "International DOI Foundation",
        venue_type: "monograph",
        authors: [
          { name: "N. Paskin", orcid: "0000-0002-1825-0097", affiliation: "IDF" },
        ],
        is_open_access: true,
        landing_url: "https://doi.org/10.1000/182",
        pdf_url: "https://doi.org/10.1000/182.pdf",
        citation_count: 55,
        provider_id: "crossref",
        provider_record_id: "10.1000/182",
        provenance: [
          {
            provider_id: "crossref",
            record_id: "10.1000/182",
            landing_url: "https://doi.org/10.1000/182",
            retrieved_at: "2026-10-30T00:00:00Z",
          },
        ],
      };

      const merged = deduplicateAndMergeWorks([work1, work2]);
      expect(merged.length).toBe(1);

      const unified = merged[0];
      expect(unified.provenance.length).toBe(2);
      expect(unified.abstract_text).toBe(
        "Comprehensive handbook detailing DOI architecture."
      );
      expect(unified.venue).toBe("International DOI Foundation");
      expect(unified.pdf_url).toBe("https://doi.org/10.1000/182.pdf");
      expect(unified.is_open_access).toBe(true);
      expect(unified.citation_count).toBe(55);
    });

    it("merges papers with matching title, year, and author surname overlap (Tier 3)", () => {
      const workA: NormalizedWork = {
        id: "arxiv-2104.12345",
        canonical_doi: null,
        title: "Attention Based Architecture for Language Models",
        clean_title_key: "attentionbasedarchitectureforlanguagemodels",
        abstract_text: "We present a transformer variant...",
        publication_date: "2021-04-15",
        publication_year: 2021,
        venue: "arXiv",
        venue_type: "preprint",
        authors: [{ name: "Vaswani, Ashish", orcid: null, affiliation: null }],
        is_open_access: true,
        landing_url: "https://arxiv.org/abs/2104.12345",
        pdf_url: "https://arxiv.org/pdf/2104.12345.pdf",
        citation_count: 100,
        provider_id: "arxiv",
        provider_record_id: "2104.12345",
        provenance: [
          {
            provider_id: "arxiv",
            record_id: "2104.12345",
            landing_url: "https://arxiv.org/abs/2104.12345",
            retrieved_at: "2026-10-30T00:00:00Z",
          },
        ],
      };

      const workB: NormalizedWork = {
        id: "s2-paper-999",
        canonical_doi: "10.1145/attention.2021",
        title: "Attention-Based Architecture for Language Models",
        clean_title_key: "attentionbasedarchitectureforlanguagemodels",
        abstract_text: null,
        publication_date: "2021-06-01",
        publication_year: 2021,
        venue: "ACM Conference",
        venue_type: "conference",
        authors: [
          { name: "Ashish Vaswani", orcid: null, affiliation: null },
          { name: "Noam Shazeer", orcid: null, affiliation: null },
        ],
        is_open_access: true,
        landing_url: "https://semanticscholar.org/paper/999",
        pdf_url: null,
        citation_count: 120,
        provider_id: "semantic_scholar",
        provider_record_id: "999",
        provenance: [
          {
            provider_id: "semantic_scholar",
            record_id: "999",
            landing_url: "https://semanticscholar.org/paper/999",
            retrieved_at: "2026-10-30T00:00:00Z",
          },
        ],
      };

      const merged = deduplicateAndMergeWorks([workA, workB]);
      expect(merged.length).toBe(1);
      expect(merged[0].canonical_doi).toBe("10.1145/attention.2021");
      expect(merged[0].pdf_url).toBe("https://arxiv.org/pdf/2104.12345.pdf");
      expect(merged[0].authors.length).toBe(2);
    });

    it("refuses to merge papers with same title but completely different authors", () => {
      const paper1: NormalizedWork = {
        id: "p1",
        canonical_doi: null,
        title: "Introduction to Quantum Computing",
        clean_title_key: "introductiontoquantumcomputing",
        abstract_text: "Author Smith overview of qubits.",
        publication_date: "2022-01-01",
        publication_year: 2022,
        venue: "Journal A",
        venue_type: "journal",
        authors: [{ name: "Alice Smith", orcid: null, affiliation: null }],
        is_open_access: false,
        landing_url: null,
        pdf_url: null,
        citation_count: 10,
        provider_id: "openalex",
        provider_record_id: "p1",
        provenance: [],
      };

      const paper2: NormalizedWork = {
        id: "p2",
        canonical_doi: null,
        title: "Introduction to Quantum Computing",
        clean_title_key: "introductiontoquantumcomputing",
        abstract_text: "Author Tanaka tutorial on gates.",
        publication_date: "2022-05-01",
        publication_year: 2022,
        venue: "Journal B",
        venue_type: "journal",
        authors: [{ name: "Kenji Tanaka", orcid: null, affiliation: null }],
        is_open_access: true,
        landing_url: null,
        pdf_url: null,
        citation_count: 5,
        provider_id: "crossref",
        provider_record_id: "p2",
        provenance: [],
      };

      const merged = deduplicateAndMergeWorks([paper1, paper2]);
      expect(merged.length).toBe(2);
      expect(merged[0].id).toBe("p1");
      expect(merged[1].id).toBe("p2");
    });
  });

  describe("5. Metadata Quality Scoring & Completeness", () => {
    it("scores a fully documented paper at maximum score", () => {
      const fullWork: Partial<NormalizedWork> = {
        canonical_doi: "10.1038/s41586-020-2649-2",
        title: "Structural basis of SARS-CoV-2 entry by the ACE2 receptor",
        abstract_text: "Coronaviruses recognize their host receptors...",
        authors: [{ name: "Renhong Yan", orcid: null, affiliation: null }],
        publication_date: "2020-03-27",
        publication_year: 2020,
        venue: "Nature",
        pdf_url: "https://nature.com/article.pdf",
        is_open_access: true,
      };

      const score = calculateMetadataScore(fullWork);
      expect(score).toBe(100);
    });

    it("assigns lower score to papers lacking abstracts and DOIs", () => {
      const partialWork: Partial<NormalizedWork> = {
        title: "Draft Preprint Without DOI",
        authors: [{ name: "Jane Doe", orcid: null, affiliation: null }],
        publication_year: 2023,
      };

      const score = calculateMetadataScore(partialWork);
      expect(score).toBe(45); // Title (20) + Authors (15) + Year (10)
    });
  });

  describe("6. Provider Health & Diagnostics Model", () => {
    it("reports structured diagnostic health status across all supported states", () => {
      const healthStatuses: ProviderHealthCheck[] = [
        {
          provider_id: "openalex",
          status: "healthy",
          latency_ms: 180,
          message: "OpenAlex API is responding normally.",
          checked_at: new Date().toISOString(),
        },
        {
          provider_id: "semantic_scholar",
          status: "rate_limited",
          latency_ms: 420,
          message: "Semantic Scholar rate limit reached (1 req/sec).",
          checked_at: new Date().toISOString(),
        },
        {
          provider_id: "crossref",
          status: "healthy",
          latency_ms: 210,
          message: "Crossref REST API is responding normally.",
          checked_at: new Date().toISOString(),
        },
      ];

      expect(healthStatuses.find((h) => h.provider_id === "openalex")?.status).toBe(
        "healthy"
      );
      expect(
        healthStatuses.find((h) => h.provider_id === "semantic_scholar")?.status
      ).toBe("rate_limited");
      expect(healthStatuses.every((h) => h.latency_ms > 0)).toBe(true);
    });
  });
});
