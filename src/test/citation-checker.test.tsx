import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { CitationCheckerWorkspaceView } from "../features/citation-checker/CitationCheckerWorkspaceView";
import { validateDoiSyntax, evaluateDoi } from "../features/citation-checker/doiValidator";
import { extractInTextCitations, parseBibliographyReferences, splitDocumentSections } from "../features/citation-checker/citationParser";
import { performCitationAudit } from "../features/citation-checker/consistencyEngine";
import {
  formatAsIeee,
  formatAsApa,
  formatAsMla,
  formatAsChicago,
  formatAsHarvard,
  formatAsBibtex,
  formatReferenceInStyle,
} from "../features/citation-checker/styleFormatters";
import { ParsedReference } from "../features/citation-checker/types";

describe("Phase 6 — DOI Syntax & Registry Validation", () => {
  it("validates correct canonical DOI syntax according to Crossref/IDF standards", () => {
    const validDois = [
      "10.1109/ACCESS.2023.1042918",
      "10.48550/arXiv.1706.03762",
      "10.1038/nature14539",
      "10.1145/3097983.3098194",
      "https://doi.org/10.1109/CVPR.2016.90",
      "doi: 10.1016/j.neucom.2021.05.012",
    ];

    for (const d of validDois) {
      const res = validateDoiSyntax(d);
      expect(res.isValid).toBe(true);
      expect(res.canonicalDoi).toBeTruthy();
      expect(res.canonicalDoi?.startsWith("10.")).toBe(true);
    }
  });

  it("detects malformed DOIs (missing 10. prefix, spaces, invalid registrants, empty suffix)", () => {
    const malformed = [
      { raw: "1109/ACCESS.2023.1042918", reason: /must begin with "10\."/i },
      { raw: "10.1109/ ACCESS.2023", reason: /whitespace/i },
      { raw: "10.ieee/access.2023", reason: /registrant/i },
      { raw: "10.1109/", reason: /suffix/i },
      { raw: "10.12/a", reason: /registrant/i },
    ];

    for (const item of malformed) {
      const res = validateDoiSyntax(item.raw);
      expect(res.isValid).toBe(false);
      expect(res.errorNote).toMatch(item.reason);
    }
  });

  it("evaluates DOI resolution and retrieves verified metadata from canonical registry", () => {
    const res = evaluateDoi("10.48550/arXiv.1706.03762");
    expect(res.syntaxValid).toBe(true);
    expect(res.resolved).toBe(true);
    expect(res.verifiedMetadata?.title).toBe("Attention Is All You Need");
    expect(res.verifiedMetadata?.year).toBe(2017);
    expect(res.resolutionStatusLabel).toMatch(/Resolved & Verified/i);
  });
});

describe("Phase 6 — Citation & Reference Parsing", () => {
  it("splits document body from bibliography headers", () => {
    const doc = `This is the manuscript body text citing [1].\n\nREFERENCES\n[1] Author, "Paper Title," 2020.`;
    const split = splitDocumentSections(doc);

    expect(split.bodyText).toContain("manuscript body text citing [1]");
    expect(split.referenceText).toContain('[1] Author, "Paper Title," 2020');
  });

  it("extracts in-text citations across numeric, author-year, and LaTeX formats", () => {
    const body = `Landmark neural models [1] and multi-head attention [2, 3] revolutionized NLP. Previous work by (Vaswani et al., 2017) and \\cite{bert2018} corroborated these findings.`;
    const citations = extractInTextCitations(body);

    expect(citations.length).toBeGreaterThanOrEqual(4);
    const styles = citations.map((c) => c.style);
    expect(styles).toContain("numeric");
    expect(styles).toContain("author_year");
    expect(styles).toContain("latex_cite");

    const multiCite = citations.find((c) => c.raw === "[2, 3]");
    expect(multiCite?.keys).toEqual(["2", "3"]);
  });

  it("parses bibliography references and extracts bibliographic fields", () => {
    const refText = `[1] A. Vaswani, N. Shazeer, et al., "Attention Is All You Need," NeurIPS, 2017. doi: 10.48550/arXiv.1706.03762.\n[2] J. Devlin, "BERT: Pre-training," NAACL, 2018.`;
    const refs = parseBibliographyReferences(refText);

    expect(refs).toHaveLength(2);
    expect(refs[0].key).toBe("1");
    expect(refs[0].title).toBe("Attention Is All You Need");
    expect(refs[0].year).toBe(2017);
    expect(refs[0].doi).toBe("10.48550/arXiv.1706.03762");
    expect(refs[0].doiStatus.syntaxValid).toBe(true);
  });
});

describe("Phase 6 — Consistency & Discrepancy Engine", () => {
  it("flags orphan in-text citations that have no bibliography entry", () => {
    const manuscript = `We cite [1] and [99] in this section.\n\nREFERENCES\n[1] A. Author, "Existing Title," 2020.`;
    const audit = performCitationAudit(manuscript);

    expect(audit.summary.orphanCitationsCount).toBe(1);
    const orphanIssue = audit.issues.find((i) => i.category === "missing_reference");
    expect(orphanIssue).toBeDefined();
    expect(orphanIssue?.severity).toBe("critical");
    expect(orphanIssue?.title).toMatch(/Unmatched In-Text Citation/i);
    expect(orphanIssue?.description).toContain("99");
  });

  it("flags references that are never cited in the body text", () => {
    const manuscript = `We cite only [1] in this section.\n\nREFERENCES\n[1] A. Author, "Existing Title," 2020.\n[2] B. Uncited, "Unused Paper Title," 2021.`;
    const audit = performCitationAudit(manuscript);

    expect(audit.summary.uncitedReferencesCount).toBe(1);
    const uncitedIssue = audit.issues.find((i) => i.category === "uncited_reference");
    expect(uncitedIssue).toBeDefined();
    expect(uncitedIssue?.severity).toBe("warning");
    expect(uncitedIssue?.title).toMatch(/Uncited Reference in Bibliography/i);
  });

  it("detects duplicate references with identical DOI or near-identical titles", () => {
    const manuscript = `Comparing models [1] and [2].\n\nREFERENCES\n[1] K. He et al., "Deep Residual Learning for Image Recognition," CVPR, 2016. doi: 10.1109/cvpr.2016.90.\n[2] Kaiming He et al., "Deep Residual Learning for Image Recognition," CVPR, 2016. doi: 10.1109/cvpr.2016.90.`;
    const audit = performCitationAudit(manuscript);

    expect(audit.summary.duplicateReferencesCount).toBeGreaterThanOrEqual(1);
    const dupIssue = audit.issues.find((i) => i.category === "duplicate_reference");
    expect(dupIssue).toBeDefined();
    expect(dupIssue?.title).toMatch(/Duplicate Reference Detected/i);
  });

  it("flags metadata discrepancies when reference year or title differs from canonical registry", () => {
    // Attention Is All You Need was published in 2017, but reference claims 2024
    const manuscript = `We cite [1] here.\n\nREFERENCES\n[1] A. Vaswani et al., "Attention Is All You Need," NeurIPS, 2024. doi: 10.48550/arXiv.1706.03762.`;
    const audit = performCitationAudit(manuscript);

    expect(audit.summary.metadataDiscrepancyCount).toBeGreaterThan(0);
    const yearIssue = audit.issues.find((i) => i.id.startsWith("discrep_year_"));
    expect(yearIssue).toBeDefined();
    expect(yearIssue?.comparison?.referenceValue).toBe("2024");
    expect(yearIssue?.comparison?.registryValue).toBe("2017");
  });

  it("flags incomplete reference information when publication year or venue is missing", () => {
    const manuscript = `We cite [1].\n\nREFERENCES\n[1] S. Incomplete, "Title Without Year Or Venue."`;
    const audit = performCitationAudit(manuscript);

    expect(audit.summary.incompleteMetadataCount).toBeGreaterThan(0);
    const incIssue = audit.issues.find((i) => i.category === "incomplete_metadata");
    expect(incIssue).toBeDefined();
    expect(incIssue?.description).toMatch(/Publication Year/i);
  });

  it("detects mixed in-text citation styles (numeric and author-year)", () => {
    const manuscript = `Neural search is studied in [1]. Contrastingly, (Vaswani et al., 2017) explored self-attention.\n\nREFERENCES\n[1] Author, "Paper," 2020.\n[2] Vaswani, "Attention," 2017.`;
    const audit = performCitationAudit(manuscript);

    expect(audit.summary.hasMixedStyles).toBe(true);
    const mixedIssue = audit.issues.find((i) => i.category === "mixed_citation_styles");
    expect(mixedIssue).toBeDefined();
  });

  it("enforces important distinction: DOI resolution does not equal claim truthfulness", () => {
    const manuscript = `Our claim is supported by [1].\n\nREFERENCES\n[1] A. Vaswani et al., "Attention Is All You Need," NeurIPS, 2017. doi: 10.48550/arXiv.1706.03762.`;
    const audit = performCitationAudit(manuscript);

    expect(audit.summary.claimSupportDisclaimer).toContain("does NOT verify that the cited paper supports the author's claim");
  });
});

describe("Phase 6 — Modular Citation Style Formatters", () => {
  const dummyRef: ParsedReference = {
    id: "ref_1",
    key: "1",
    rawText: '[1] A. Vaswani et al., "Attention Is All You Need," NeurIPS, 2017.',
    authors: ["Ashish Vaswani", "Noam Shazeer"],
    title: "Attention Is All You Need",
    year: 2017,
    venue: "NeurIPS",
    doi: "10.48550/arXiv.1706.03762",
    detectedStyle: "ieee",
    doiStatus: {
      syntaxValid: true,
      rawInput: "10.48550/arXiv.1706.03762",
      canonicalDoi: "10.48550/arxiv.1706.03762",
      syntaxErrorNote: null,
      resolved: true,
      resolutionSource: "Crossref",
      verifiedMetadata: null,
      resolutionStatusLabel: "Resolved",
    },
    inTextCitationCount: 1,
  };

  it("formats reference into IEEE numbered style", () => {
    const ieee = formatAsIeee(dummyRef, 1);
    expect(ieee).toContain("[1]");
    expect(ieee).toContain('"Attention Is All You Need,"');
    expect(ieee).toContain("2017");
  });

  it("formats reference into APA 7th style", () => {
    const apa = formatAsApa(dummyRef);
    expect(apa).toContain("(2017).");
    expect(apa).toContain("https://doi.org/10.48550/arXiv.1706.03762");
  });

  it("formats reference into MLA 9th style", () => {
    const mla = formatAsMla(dummyRef);
    expect(mla).toContain('"Attention Is All You Need."');
    expect(mla).toContain("DOI: 10.48550/arXiv.1706.03762.");
  });

  it("formats reference into Chicago style", () => {
    const chicago = formatAsChicago(dummyRef);
    expect(chicago).toContain("2017.");
    expect(chicago).toContain('"Attention Is All You Need."');
  });

  it("formats reference into Harvard style", () => {
    const harvard = formatAsHarvard(dummyRef);
    expect(harvard).toContain("(2017)");
    expect(harvard).toContain("'Attention Is All You Need',");
  });

  it("formats reference into BibTeX style", () => {
    const bibtex = formatAsBibtex(dummyRef);
    expect(bibtex).toContain("@article{");
    expect(bibtex).toContain("title     = {{Attention Is All You Need}}");
    expect(bibtex).toContain("year      = {2017}");
  });

  it("reformats reference modularly through formatReferenceInStyle", () => {
    expect(formatReferenceInStyle(dummyRef, "ieee")).toContain("[1]");
    expect(formatReferenceInStyle(dummyRef, "bibtex")).toContain("@article{");
  });
});

describe("Phase 6 — Citation Checker Workspace UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Citation Checker workspace with Crossref verified badge and Claim Support Notice", () => {
    render(
      <AppProvider>
        <CitationCheckerWorkspaceView />
      </AppProvider>
    );

    expect(screen.getByText(/Citation Checker & Reference Verifier/i)).toBeInTheDocument();
    expect(screen.getByText(/Crossref & Registry Verified/i)).toBeInTheDocument();
    expect(screen.getByText(/Crucial Distinction: Identifier Resolution vs. Claim Validity/i)).toBeInTheDocument();
    expect(screen.getByText(/DOI resolution does NOT prove that the cited paper supports/i)).toBeInTheDocument();
  });

  it("renders KPI summary cards with health score and orphan metrics", async () => {
    render(
      <AppProvider>
        <CitationCheckerWorkspaceView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Health Score/i)).toBeInTheDocument();
      expect(screen.getAllByText(/In-Text Citations/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Missing References/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Uncited Entries/i).length).toBeGreaterThan(0);
    });
  });

  it("filters findings by issue category tabs", async () => {
    render(
      <AppProvider>
        <CitationCheckerWorkspaceView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/All Findings/i)).toBeInTheDocument();
    });

    // Click Missing References tab
    const missingTab = screen.getByRole("button", { name: /Missing References/i });
    fireEvent.click(missingTab);

    // Click DOI & Metadata tab
    const doiTab = screen.getByRole("button", { name: /DOI & Metadata/i });
    fireEvent.click(doiTab);
  });

  it("opens Reference Inspector drawer and reformats citation when clicking Inspect Ref", async () => {
    render(
      <AppProvider>
        <CitationCheckerWorkspaceView />
      </AppProvider>
    );

    await waitFor(() => {
      const inspectBtns = screen.getAllByRole("button", { name: /Inspect Ref/i });
      expect(inspectBtns.length).toBeGreaterThan(0);
      fireEvent.click(inspectBtns[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Reference Inspector/i)).toBeInTheDocument();
      expect(screen.getByText(/Reformat in Standard Styles/i)).toBeInTheDocument();
    });
  });

  it("opens Audit Report modal with download options", async () => {
    render(
      <AppProvider>
        <CitationCheckerWorkspaceView />
      </AppProvider>
    );

    const reportBtn = screen.getByRole("button", { name: /Audit Report/i });
    await waitFor(() => {
      expect(reportBtn).toBeEnabled();
    });
    fireEvent.click(reportBtn);

    await waitFor(() => {
      expect(screen.getByText(/Citation Audit & Verification Report/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Download \.MD Report/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Download \.JSON/i })).toBeInTheDocument();
    });
  });
});
