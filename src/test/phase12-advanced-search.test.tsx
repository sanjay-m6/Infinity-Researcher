import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { DiscoverView } from "../features/discover/DiscoverView";
import {
  parseStructuredQuery,
  serializeStructuredQuery,
  getSourceCapability,
  evaluateSourcesForQuery,
  createSearchPlan,
  satisfiesClientPostFilters,
  normalizeDoi,
  normalizeTitle,
  isDuplicatePaper,
  mergeDuplicateRecords,
  deduplicatePaperList,
  calculateMultiSignalPaperScore,
  compareRankedPapers,
} from "../lib/search";
import { DiscoveredSearchResult } from "../lib/desktop-api";

// Mock Tauri desktop-api
vi.mock("../lib/desktop-api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    listCrawlProfiles: vi.fn().mockResolvedValue([]),
    previewUrlExtraction: vi.fn().mockResolvedValue(null),
    startCrawlJob: vi.fn().mockResolvedValue({ id: "job-1", status: "running" }),
    listCrawlJobs: vi.fn().mockResolvedValue([]),
    pauseCrawlJob: vi.fn().mockResolvedValue(true),
    resumeCrawlJob: vi.fn().mockResolvedValue(true),
    cancelCrawlJob: vi.fn().mockResolvedValue(true),
    listCrawledPapers: vi.fn().mockResolvedValue([]),
    importSinglePage: vi
      .fn()
      .mockResolvedValue({ success: true, paper_id: "imported-1" }),
    enqueuePdfDownload: vi.fn().mockResolvedValue({ job_id: "dl-1" }),
    listPdfDownloadJobs: vi.fn().mockResolvedValue([]),
    resolvePaperPdf: vi.fn().mockResolvedValue(null),
    getNotesForPaper: vi.fn().mockResolvedValue([]),
    saveNote: vi.fn().mockResolvedValue({ id: "n-1", content: "test" }),
    deleteNote: vi.fn().mockResolvedValue(true),
    toggleSavePaper: vi.fn().mockResolvedValue(true),
    addPaperToCollection: vi.fn().mockResolvedValue(true),
    removePaperFromCollection: vi.fn().mockResolvedValue(true),
    listWebsiteSearchSources: vi.fn().mockResolvedValue([
      {
        id: "arxiv",
        name: "arXiv",
        domain: "arxiv.org",
        status: "enabled",
        supports_streaming: true,
      },
      {
        id: "biorxiv",
        name: "bioRxiv",
        domain: "biorxiv.org",
        status: "enabled",
        supports_streaming: true,
      },
      {
        id: "plos",
        name: "PLOS ONE",
        domain: "plos.org",
        status: "enabled",
        supports_streaming: true,
      },
    ]),
    startWebsiteSearchStream: vi.fn().mockResolvedValue(() => {}),
    cancelWebsiteSearch: vi.fn().mockResolvedValue(true),
    startPythonSearchStream: vi.fn().mockResolvedValue(() => {}),
    cancelPythonSearch: vi.fn().mockResolvedValue(true),
    getPythonEngineStatus: vi
      .fn()
      .mockResolvedValue({ available: true, version: "1.0.0" }),
    importDiscoveredSearchResult: vi.fn().mockResolvedValue("imported-paper-1"),
    getScrapingEngineDiagnostics: vi.fn().mockResolvedValue({
      total_searches: 5,
      successful_searches: 5,
      failed_searches: 0,
      active_sessions: 0,
      sources: {},
    }),
    addPaperToMatrix: vi.fn().mockResolvedValue(true),
    getErrorMessage: (err: unknown) => String(err),
  };
});

describe("Phase 12: Advanced Search and Filter Engine", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Structured Query Parser Tests
  // =========================================================================
  describe("1. Structured Query Parser (queryParser.ts)", () => {
    it("parses plain-text unstructured queries into text terms", () => {
      const q = parseStructuredQuery("machine learning healthcare");
      expect(q.hasSyntax).toBe(false);
      expect(q.textTerms).toEqual(["machine", "learning", "healthcare"]);
      expect(q.syntaxErrors).toHaveLength(0);
      expect(Object.keys(q.fields)).toHaveLength(0);
    });

    it("parses quoted phrases as unified tokens", () => {
      const q = parseStructuredQuery('"deep residual learning" optimization');
      expect(q.hasSyntax).toBe(true);
      expect(q.textTerms).toEqual(["deep residual learning", "optimization"]);
    });

    it("parses field-specific expressions (title:, author:, doi:, source:, venue:)", () => {
      const input =
        'title:"Attention Is All You Need" author:"Vaswani" doi:10.1145/123456 source:arxiv venue:"NeurIPS"';
      const q = parseStructuredQuery(input);
      expect(q.hasSyntax).toBe(true);
      expect(q.fields.title).toBe("Attention Is All You Need");
      expect(q.fields.author).toBe("Vaswani");
      expect(q.fields.authors).toEqual(["Vaswani"]);
      expect(q.fields.doi).toBe("10.1145/123456");
      expect(q.fields.source).toBe("arxiv");
      expect(q.fields.venue).toBe("NeurIPS");
      expect(q.syntaxErrors).toHaveLength(0);
    });

    it("parses multi-author lists separated by commas", () => {
      const q = parseStructuredQuery('author:"Vaswani, Shazeer, Parmar"');
      expect(q.fields.author).toBe("Vaswani, Shazeer, Parmar");
      expect(q.fields.authors).toEqual(["Vaswani", "Shazeer", "Parmar"]);
    });

    it("parses exact year and year range expressions", () => {
      const q1 = parseStructuredQuery("year:2024");
      expect(q1.fields.year).toBe(2024);
      expect(q1.fields.yearStart).toBe(2024);
      expect(q1.fields.yearEnd).toBe(2024);

      const q2 = parseStructuredQuery("year:2020..2024");
      expect(q2.fields.yearStart).toBe(2020);
      expect(q2.fields.yearEnd).toBe(2024);

      const q3 = parseStructuredQuery("year:>=2021");
      expect(q3.fields.yearStart).toBe(2021);

      const q4 = parseStructuredQuery("year:<=2023");
      expect(q4.fields.yearEnd).toBe(2023);
    });

    it("flags syntax errors on inverted year ranges", () => {
      const q = parseStructuredQuery("year:2025..2020");
      expect(q.syntaxErrors.length).toBeGreaterThan(0);
      expect(q.syntaxErrors[0]).toContain("cannot exceed end year");
    });

    it("parses boolean flags: open_access and peer_reviewed", () => {
      const q = parseStructuredQuery("open_access:true peer_reviewed:yes type:preprint");
      expect(q.fields.openAccess).toBe(true);
      expect(q.fields.peerReviewed).toBe(true);
      expect(q.fields.contentType).toBe("preprint");
    });

    it("handles standalone DOIs preserving slashes and periods without prefix", () => {
      const q = parseStructuredQuery("10.1038/s41598-021-00000-0 neural networks");
      expect(q.fields.doi).toBe("10.1038/s41598-021-00000-0");
      expect(q.textTerms).toEqual(["neural", "networks"]);
    });

    it("handles unclosed quotes gracefully without crashing", () => {
      const q = parseStructuredQuery('title:"unclosed quantum state');
      expect(q.fields.title).toBe("unclosed quantum state");
      expect(q.syntaxErrors).toHaveLength(0);
    });

    it("serializes structured query fields back to query string roundtrip", () => {
      const str = serializeStructuredQuery(
        {
          title: "Deep Learning",
          author: "LeCun",
          yearStart: 2020,
          yearEnd: 2024,
          openAccess: true,
        },
        ["survey"]
      );
      expect(str).toContain('title:"Deep Learning"');
      expect(str).toContain('author:"LeCun"');
      expect(str).toContain("year:2020..2024");
      expect(str).toContain("open_access:true");
      expect(str).toContain("survey");
    });
  });

  // =========================================================================
  // 2. Academic Source Capability Registry Tests
  // =========================================================================
  describe("2. Academic Source Capability Registry (sourceRegistry.ts)", () => {
    it("returns capabilities for known academic sources", () => {
      const arxivCap = getSourceCapability("arxiv");
      expect(arxivCap.supportsAuthor).toBe(true);
      expect(arxivCap.supportsYearFilter).toBe(true);
      expect(arxivCap.supportsOpenAccessFilter).toBe(true);
      expect(arxivCap.nativePaginationType).toBe("offset");

      const biorxivCap = getSourceCapability("biorxiv");
      expect(biorxivCap.supportsAuthor).toBe(false); // Verified via client post-filter
      expect(biorxivCap.nativePaginationType).toBe("page");
    });

    it("provides safe fallback capabilities for unknown sources", () => {
      const unknownCap = getSourceCapability("custom_repository");
      expect(unknownCap.supportsFreeText).toBe(true);
      expect(unknownCap.supportsAuthor).toBe(false);
      expect(unknownCap.nativePaginationType).toBe("none");
    });

    it("filters sources when query specifies an explicit target source", () => {
      const allSources = ["arxiv", "biorxiv", "medrxiv", "plos"];
      const { activeSources, skippedSources } = evaluateSourcesForQuery(
        allSources,
        "arxiv"
      );
      expect(activeSources).toEqual(["arxiv"]);
      expect(skippedSources).toHaveLength(3);
      expect(skippedSources[0].reason).toContain("Excluded by query source constraint");
    });
  });

  // =========================================================================
  // 3. Search Planner & Filter Engine Tests
  // =========================================================================
  describe("3. Search Planner & Client Post-Filter Engine (searchPlanner.ts)", () => {
    it("generates a clean query and distributes source filters vs client post-filters", () => {
      const plan = createSearchPlan(
        'title:"Graph Neural Networks" author:"Scarselli" year:2020..2024',
        ["arxiv", "biorxiv"],
        { accessStatus: "open_access" }
      );

      // Cleaned sourceQuery contains terms without raw field prefixes
      expect(plan.sourceQuery).toContain("Graph Neural Networks");
      expect(plan.sourceFilters.author).toBe("Scarselli");
      expect(plan.sourceFilters.year_start).toBe(2020);
      expect(plan.sourceFilters.year_end).toBe(2024);
      expect(plan.sourceFilters.open_access_only).toBe(true);

      expect(plan.clientPostFilters.title).toBe("Graph Neural Networks");
      expect(plan.clientPostFilters.yearStart).toBe(2020);
    });

    it("satisfiesClientPostFilters correctly matches paper fields", () => {
      const paper = {
        title: "Deep Residual Learning for Image Recognition",
        authors: ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren", "Jian Sun"],
        publication_year: 2016,
        canonical_doi: "10.1109/CVPR.2016.90",
        venue: "IEEE Conference on Computer Vision and Pattern Recognition",
        is_open_access: true,
        content_type: "conference",
        peer_reviewed: true,
        abstract_text: "Deeper neural networks are more difficult to train.",
      };

      // Match all criteria
      expect(
        satisfiesClientPostFilters(paper, {
          title: "residual learning",
          author: "He",
          yearStart: 2015,
          yearEnd: 2017,
          openAccessOnly: true,
          peerReviewedOnly: true,
        })
      ).toBe(true);

      // Fails on author
      expect(
        satisfiesClientPostFilters(paper, {
          author: "Bengio",
        })
      ).toBe(false);

      // Fails on year range
      expect(
        satisfiesClientPostFilters(paper, {
          yearStart: 2020,
        })
      ).toBe(false);

      // Excludes null publication years when yearStart is required
      const paperWithoutYear = { ...paper, publication_year: null };
      expect(
        satisfiesClientPostFilters(paperWithoutYear, {
          yearStart: 2015,
        })
      ).toBe(false);
    });
  });

  // =========================================================================
  // 4. Multi-Signal Deterministic Ranking Engine Tests
  // =========================================================================
  describe("4. Multi-Signal Deterministic Ranking Engine (rankingEngine.ts)", () => {
    const candidateA = {
      id: "paper-1",
      title: "Attention Is All You Need",
      authors: ["Ashish Vaswani", "Noam Shazeer"],
      canonical_doi: "10.48550/arXiv.1706.03762",
      publication_year: 2017,
      citation_count: 95000,
      is_open_access: true,
      pdf_url: "https://arxiv.org/pdf/1706.03762.pdf",
      abstract_text:
        "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.",
    };

    const candidateB = {
      id: "paper-2",
      title: "An Attention Free Transformer",
      authors: ["Shuangfei Zhai"],
      canonical_doi: "10.48550/arXiv.2105.14103",
      publication_year: 2021,
      citation_count: 350,
      is_open_access: true,
      pdf_url: "https://arxiv.org/pdf/2105.14103.pdf",
      abstract_text: "We introduce AFT, an attention free Transformer architecture.",
    };

    it("awards 1000 points to exact DOI match", () => {
      const res = calculateMultiSignalPaperScore(
        candidateA,
        "doi:10.48550/arXiv.1706.03762"
      );
      expect(res.signals.exactDoiMatch).toBe(true);
      expect(res.totalScore).toBeGreaterThanOrEqual(1000);
      expect(res.explanation).toContain("Exact DOI Match");
    });

    it("awards 900 points to exact title match", () => {
      const res = calculateMultiSignalPaperScore(
        candidateA,
        'title:"Attention Is All You Need"'
      );
      expect(res.signals.exactTitleMatch).toBe(true);
      expect(res.totalScore).toBeGreaterThanOrEqual(900);
      expect(res.explanation).toContain("Exact Title Match");
    });

    it("awards 800 points to title prefix match", () => {
      const res = calculateMultiSignalPaperScore(candidateA, 'title:"Attention Is"');
      expect(res.signals.titlePrefixMatch).toBe(true);
      expect(res.totalScore).toBeGreaterThanOrEqual(800);
    });

    it("awards author match points", () => {
      const res = calculateMultiSignalPaperScore(candidateA, 'author:"Vaswani"');
      expect(res.signals.authorMatch).toBe(true);
      expect(res.totalScore).toBeGreaterThanOrEqual(400);
    });

    it("sorts papers deterministically with strict tie-breaking", () => {
      const sorted = [candidateB, candidateA].sort((a, b) =>
        compareRankedPapers(a, b, "Attention Is All You Need")
      );
      // candidateA has exact title match, should rank first
      expect(sorted[0].id).toBe("paper-1");
      expect(sorted[1].id).toBe("paper-2");
    });
  });

  // =========================================================================
  // 5. Deduplication & Provenance Merging Tests
  // =========================================================================
  describe("5. Deduplication & Provenance Merging (deduplicationEngine.ts)", () => {
    it("normalizes DOI correctly stripping protocols and spaces", () => {
      expect(normalizeDoi("https://doi.org/10.1145/3292500.3330964;")).toBe(
        "10.1145/3292500.3330964"
      );
      expect(normalizeDoi("doi: 10.1038/s41586-020-2649-2")).toBe(
        "10.1038/s41586-020-2649-2"
      );
    });

    it("normalizes titles stripping symbols and extra whitespace", () => {
      expect(normalizeTitle("Attention  is  All You  Need!")).toBe(
        "attention is all you need"
      );
    });

    it("identifies duplicates across different sources with identical DOI", () => {
      const paperArxiv = {
        id: "arxiv-1",
        title: "Deep Residual Learning",
        canonical_doi: "10.1109/CVPR.2016.90",
        publication_year: 2016,
      };
      const paperIeee = {
        id: "ieee-1",
        title: "Deep Residual Learning for Image Recognition",
        canonical_doi: "https://doi.org/10.1109/cvpr.2016.90",
        publication_year: 2016,
      };
      expect(isDuplicatePaper(paperArxiv, paperIeee)).toBe(true);
    });

    it("identifies duplicates with identical long title and matching year", () => {
      const paper1 = {
        title: "Attention Is All You Need For Deep Language Processing",
        publication_year: 2017,
      };
      const paper2 = {
        title: "attention is all you need for deep language processing!",
        publication_year: 2017,
      };
      expect(isDuplicatePaper(paper1, paper2)).toBe(true);
    });

    it("merges duplicate records non-destructively preserving provenance and richest metadata", () => {
      const existing: DiscoveredSearchResult = {
        id: "arxiv-1",
        title: "Transformers for NLP",
        authors: ["Vaswani"],
        canonical_doi: "10.1145/12345",
        publication_year: 2017,
        landing_url: "https://arxiv.org/abs/1706.03762",
        provenance_urls: ["https://arxiv.org/abs/1706.03762"],
        source_id: "arxiv",
        source_name: "arXiv",
        content_type: "preprint",
        is_open_access: true,
        abstract_text: "Short summary.",
        pdf_url: null,
        subject_tags: [],
        relevance_score: 1.0,
      };

      const incoming: DiscoveredSearchResult = {
        id: "pmc-1",
        title: "Transformers for NLP",
        authors: ["Vaswani", "Shazeer", "Parmar"],
        canonical_doi: "10.1145/12345",
        publication_year: 2017,
        landing_url: "https://ncbi.nlm.nih.gov/pmc/articles/PMC12345",
        provenance_urls: ["https://ncbi.nlm.nih.gov/pmc/articles/PMC12345"],
        source_id: "pmc",
        source_name: "PubMed Central",
        content_type: "journal_article",
        is_open_access: true,
        abstract_text:
          "Comprehensive long abstract detailing all neural self-attention layers.",
        pdf_url: "https://ncbi.nlm.nih.gov/pmc/articles/PMC12345/pdf/main.pdf",
        subject_tags: [],
        relevance_score: 1.0,
      };

      const merged = mergeDuplicateRecords(existing, incoming);
      // Retains richest abstract
      expect(merged.abstract_text).toBe(incoming.abstract_text);
      // Retains direct PDF
      expect(merged.pdf_url).toBe(incoming.pdf_url);
      // Retains full author list
      expect(merged.authors).toHaveLength(3);
      // Retains both provenance URLs
      expect(merged.provenance_urls).toContain("https://arxiv.org/abs/1706.03762");
      expect(merged.provenance_urls).toContain(
        "https://ncbi.nlm.nih.gov/pmc/articles/PMC12345"
      );
    });

    it("deduplicates a heterogeneous paper batch cleanly", () => {
      const batch: DiscoveredSearchResult[] = [
        {
          id: "1",
          title: "Paper One",
          authors: ["Author A"],
          canonical_doi: "10.1000/1",
          landing_url: "https://example.com/1",
          source_id: "src1",
          source_name: "Source 1",
          content_type: "article",
          is_open_access: true,
          subject_tags: [],
          relevance_score: 1.0,
        },
        {
          id: "2",
          title: "Paper One (Duplicate from Source 2)",
          authors: ["Author A", "Author B"],
          canonical_doi: "10.1000/1",
          landing_url: "https://example.com/2",
          source_id: "src2",
          source_name: "Source 2",
          content_type: "article",
          is_open_access: true,
          subject_tags: [],
          relevance_score: 1.0,
        },
        {
          id: "3",
          title: "Distinct Paper Two",
          authors: ["Author C"],
          canonical_doi: "10.1000/2",
          landing_url: "https://example.com/3",
          source_id: "src1",
          source_name: "Source 1",
          content_type: "article",
          is_open_access: false,
          subject_tags: [],
          relevance_score: 1.0,
        },
      ];

      const deduped = deduplicatePaperList(batch);
      expect(deduped).toHaveLength(2);
      expect(deduped[0].provenance_urls).toContain("https://example.com/1");
      expect(deduped[0].provenance_urls).toContain("https://example.com/2");
    });
  });

  // =========================================================================
  // 6. UI Integration & Structured Feedback in DiscoverView
  // =========================================================================
  describe("6. DiscoverView UI Integration", () => {
    it("renders structured query preview badges when user types structured syntax", async () => {
      render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search by topic, title, author/i);
      fireEvent.change(searchInput, {
        target: { value: 'author:"Vaswani" year:2017..2024 source:arxiv' },
      });

      // Query plan preview should appear with parsed structured fields
      await waitFor(() => {
        const preview = screen.getByTestId("structured-query-preview");
        expect(preview).toBeDefined();
        expect(screen.getByText(/Author: "Vaswani"/i)).toBeDefined();
        expect(screen.getByText(/Year: 2017..2024/i)).toBeDefined();
        expect(screen.getByText(/Source: arxiv/i)).toBeDefined();
      });
    });
  });
});
