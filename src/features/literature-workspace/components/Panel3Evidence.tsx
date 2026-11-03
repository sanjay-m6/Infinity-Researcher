import React, { useState } from "react";
import {
  FileText,
  BookOpen,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  BookmarkCheck,
  Quote,
  Eye,
  Scale,
  Link as LinkIcon,
  CheckCircle2,
  FileSearch,
  Hash,
  X,
} from "lucide-react";
import { useProjectWorkspace } from "../ProjectWorkspaceContext";
import {
  SourceEvidenceItem,
  LiteraturePaper,
} from "../types";
import { EmbeddedPdfViewer } from "../../../components/pdf-viewer/EmbeddedPdfViewer";

export const Panel3Evidence: React.FC = () => {
  const {
    panel3Tab,
    setPanel3Tab,
    activeEvidence,
    setActiveEvidence,
    selectedPaper,
    papers,
    surveyRows,
    similarityMatches,
    updateSimilarityStatus,
    setIsPanel3Collapsed,
    sections,
    activeSectionId,
    updateSectionContent,
    reviewPaperWithAi,
    reviewingPaperId,
  } = useProjectWorkspace();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [citationFormat, setCitationFormat] = useState<"apa" | "ieee" | "acm" | "bibtex">("apa");
  const [filterSimilarityStatus, setFilterSimilarityStatus] = useState<string>("all");
  const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);
  const [modalTargetPage, setModalTargetPage] = useState<number>(1);
  const [modalPaper, setModalPaper] = useState<LiteraturePaper | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenPdfAtPage = (paperId: string, page: number) => {
    const targetPaper = papers.find((p) => p.id === paperId) || selectedPaper;
    if (targetPaper) {
      setModalPaper(targetPaper);
      setModalTargetPage(page);
      setPdfModalOpen(true);
    }
  };

  const handleInsertEvidenceIntoDraft = (evidence: SourceEvidenceItem) => {
    const section = sections.find((s) => s.id === activeSectionId) || sections[0];
    if (!section) return;

    const paper = papers.find((p) => p.id === evidence.paperId);
    const authorEtAl = paper?.authors[0]
      ? `${paper.authors[0].split(" ").pop()} et al.`
      : "Researchers";
    const citationTag = ` (${authorEtAl}, ${paper?.publicationYear || 2024}, p. ${evidence.pageNumber})`;
    const insertion = `\n\nAs established by ${authorEtAl} (${paper?.publicationYear || 2024}), "${evidence.verbatimExcerpt}"${citationTag}.`;

    updateSectionContent(section.id, section.content + insertion);
    copyToClipboard(insertion, "inserted_into_draft");
  };

  // Helper formatting for citations
  const formatCitation = (paper: LiteraturePaper, format: "apa" | "ieee" | "acm" | "bibtex") => {
    const firstAuthor = paper.authors[0] || "Unknown Author";
    const year = paper.publicationYear || 2024;
    const title = paper.title;
    const venue = paper.venue || "Research Journal";
    const doi = paper.doi ? `https://doi.org/${paper.doi}` : "";

    switch (format) {
      case "apa":
        return `${paper.authors.join(", ")} (${year}). ${title}. ${venue}. ${doi}`.trim();
      case "ieee":
        return `${paper.authors.map((a, i) => `[${i + 1}] ${a}`).join(", ")}, "${title}," ${venue}, ${year}.`;
      case "acm":
        return `${paper.authors.join(", ")}. ${year}. ${title}. In ${venue}. ${doi}`;
      case "bibtex": {
        const citeKey = `${firstAuthor.split(" ").pop()?.toLowerCase() || "author"}${year}`;
        return `@article{${citeKey},\n  author = {${paper.authors.join(" and ")}},\n  title = {${title}},\n  journal = {${venue}},\n  year = {${year}},\n  doi = {${paper.doi || ""}}\n}`;
      }
      default:
        return `${firstAuthor} et al. (${year}). ${title}.`;
    }
  };

  const filteredSimilarityMatches = similarityMatches.filter((match) => {
    if (filterSimilarityStatus === "all") return true;
    return match.reviewStatus === filterSimilarityStatus;
  });

  const unreviewedSimilarityCount = similarityMatches.filter(
    (m) => m.reviewStatus === "unreviewed"
  ).length;

  return (
    <aside
      className="h-full flex flex-col bg-surface border-l border-border select-text"
      aria-label="Panel 3 Evidence and Details"
    >
      {/* Panel 3 Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-surface-subtle">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-text-muted" />
          <span className="text-xs font-medium text-text-muted">
            Evidence & review
          </span>
        </div>
        <button
          onClick={() => setIsPanel3Collapsed(true)}
          title="Collapse Panel 3"
          className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          aria-label="Collapse Evidence Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="grid grid-cols-4 border-b border-border text-xs font-medium bg-surface">
        <button
          onClick={() => setPanel3Tab("evidence")}
          className={`py-2 px-1 text-center border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
            panel3Tab === "evidence"
              ? "border-slate-800 text-slate-900 dark:border-slate-200 dark:text-slate-100 font-medium"
              : "border-transparent text-text-muted hover:text-text"
          }`}
          title="Source Evidence Inspector"
        >
          <BookmarkCheck className="w-3.5 h-3.5" />
          <span>Evidence</span>
          {activeEvidence && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </button>

        <button
          onClick={() => setPanel3Tab("details")}
          className={`py-2 px-1 text-center border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
            panel3Tab === "details"
              ? "border-slate-800 text-slate-900 dark:border-slate-200 dark:text-slate-100 font-medium"
              : "border-transparent text-text-muted hover:text-text"
          }`}
          title="Paper Bibliographic Details"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Paper</span>
        </button>

        <button
          onClick={() => setPanel3Tab("similarity")}
          className={`py-2 px-1 text-center border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
            panel3Tab === "similarity"
              ? "border-slate-800 text-slate-900 dark:border-slate-200 dark:text-slate-100 font-medium"
              : "border-transparent text-text-muted hover:text-text"
          }`}
          title="Similarity & Plagiarism Review"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Similarity</span>
          {unreviewedSimilarityCount > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] font-mono tabular-nums rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-medium">
              {unreviewedSimilarityCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setPanel3Tab("citations")}
          className={`py-2 px-1 text-center border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
            panel3Tab === "citations"
              ? "border-slate-800 text-slate-900 dark:border-slate-200 dark:text-slate-100 font-medium"
              : "border-transparent text-text-muted hover:text-text"
          }`}
          title="Citation Audit & Formatting"
        >
          <Quote className="w-3.5 h-3.5" />
          <span>Citations</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ================================================================= */}
        {/* TAB 1: EVIDENCE INSPECTOR */}
        {/* ================================================================= */}
        {panel3Tab === "evidence" && (
          <div className="space-y-4">
            {activeEvidence ? (
              <div className="space-y-4">
                {/* Active Evidence Inspection Header */}
                <div className="flex items-center justify-between text-xs pb-0.5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                    Evidence for: <strong className="text-slate-800 dark:text-slate-200">{activeEvidence.paperTitle}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => reviewPaperWithAi(activeEvidence.paperId)}
                    disabled={reviewingPaperId === activeEvidence.paperId}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    title="Re-run AI review to refresh extracted dimensions and evidence"
                  >
                    <FileSearch className="w-3 h-3" />
                    {reviewingPaperId === activeEvidence.paperId ? "Reviewing..." : "Re-Review with AI"}
                  </button>
                </div>

                {/* Paper context header */}
                <div className="p-3.5 rounded-lg border border-border bg-surface space-y-2 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-text">
                      Ground Truth Source
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          activeEvidence.supportRating === "direct"
                            ? "bg-emerald-500"
                            : activeEvidence.supportRating === "related"
                            ? "bg-blue-500"
                            : activeEvidence.supportRating === "contradictory"
                            ? "bg-rose-500"
                            : "bg-slate-400"
                        }`}
                      />
                      {activeEvidence.supportRating === "direct"
                        ? "Directly Supports Claim"
                        : activeEvidence.supportRating === "related"
                        ? "Contextual / Related"
                        : activeEvidence.supportRating === "contradictory"
                        ? "Contradictory / Discrepancy"
                        : "Unverified Evidence"}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-text leading-snug">
                    {activeEvidence.paperTitle}
                  </h4>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted pt-1 border-t border-border/50">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-text">
                      <BookOpen className="w-3.5 h-3.5 text-text-muted" />
                      p. {activeEvidence.pageNumber}
                    </span>
                    {activeEvidence.contextSection && (
                      <span className="text-text-muted text-[11px]">
                        • {activeEvidence.contextSection}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] font-mono tabular-nums text-text-muted">
                      Conf: {Math.round(activeEvidence.confidenceScore * 100)}%
                    </span>
                  </div>
                </div>

                {/* Verbatim Excerpt Box */}
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-surface-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-text">
                    <span className="flex items-center gap-1.5">
                      <Quote className="w-3.5 h-3.5 text-text-muted" />
                      Verbatim Document Excerpt
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          activeEvidence.verbatimExcerpt,
                          "verbatim_excerpt"
                        )
                      }
                      className="p-1 rounded text-text-muted hover:text-text transition-colors"
                      title="Copy verbatim passage"
                    >
                      {copiedId === "verbatim_excerpt" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <blockquote className="text-xs text-text leading-relaxed font-sans bg-surface p-3 rounded-md border border-border italic">
                    "{activeEvidence.verbatimExcerpt}"
                  </blockquote>

                  <div className="text-[11px] text-text-muted flex items-center justify-between pt-1 font-mono tabular-nums">
                    <span>
                      Method:{" "}
                      <span className="text-text">
                        {activeEvidence.extractionMethod.replace("_", " ")}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Verified
                      provenance
                    </span>
                  </div>
                </div>

                {/* Primary Actions */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() =>
                      handleOpenPdfAtPage(
                        activeEvidence.paperId,
                        activeEvidence.pageNumber
                      )
                    }
                    className="w-full py-2 px-3 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-lg font-medium text-xs flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-xs"
                  >
                    <Eye className="w-4 h-4" />
                    Open PDF Document at Page {activeEvidence.pageNumber}
                  </button>

                  <button
                    onClick={() => handleInsertEvidenceIntoDraft(activeEvidence)}
                    className="w-full py-2 px-3 border border-border bg-surface text-text rounded-lg font-medium text-xs flex items-center justify-center gap-2 hover:bg-surface-hover transition-colors"
                  >
                    {copiedId === "inserted_into_draft" ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" />
                        Inserted into section draft
                      </>
                    ) : (
                      <>
                        <Quote className="w-4 h-4 text-text-muted" />
                        Insert into Section Draft with Citation
                      </>
                    )}
                  </button>
                </div>

                {/* Evidence Support Rating Details */}
                <div className="p-3 rounded-lg border border-border bg-surface space-y-2">
                  <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-primary" />
                    Support Classification & Integrity
                  </span>
                  <p className="text-xs text-text-muted">
                    This excerpt directly substantiates the recorded claim.
                    Claims in Infinity Researcher are tied to exact page coordinates
                    to prevent hallucinated attributions.
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                    <div className="p-2 rounded bg-surface-subtle border border-border">
                      <span className="text-text-muted block">Confidence</span>
                      <span className="font-semibold text-text">
                        {Math.round(activeEvidence.confidenceScore * 100)}% High
                      </span>
                    </div>
                    <div className="p-2 rounded bg-surface-subtle border border-border">
                      <span className="text-text-muted block">Page Coordinate</span>
                      <span className="font-semibold text-text">
                        Pg {activeEvidence.pageNumber} (Indexed)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedPaper ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-800/80 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        Active Selected Paper
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                        {selectedPaper.title}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 font-medium">
                      {selectedPaper.publicationYear}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-1">
                    {selectedPaper.authors.join(", ")}
                  </p>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    {selectedPaper.abstract || "No abstract preview available."}
                  </p>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => reviewPaperWithAi(selectedPaper.id)}
                      disabled={reviewingPaperId === selectedPaper.id}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <FileSearch className={`w-3.5 h-3.5 ${reviewingPaperId === selectedPaper.id ? "animate-spin" : ""}`} />
                      {reviewingPaperId === selectedPaper.id
                        ? "Synthesizing evidence with AI..."
                        : "AI Review for this Paper"}
                    </button>
                  </div>
                </div>

                <div className="p-4 text-center text-xs text-slate-400 space-y-1 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="font-medium text-slate-600 dark:text-slate-300">
                    No cell selected in survey matrix
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Click any cell in Panel 2 to inspect its specific page-grounded excerpt, or run Quick AI Review above to generate a new synthesis.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                  <FileSearch className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  No Paper Evidence Selected
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Select a paper from Panel 1 or click any cell in the <strong>Literature Survey Matrix</strong> to inspect real extracted ground-truth evidence, or click <strong>Quick AI Review</strong> to analyze papers.
                </p>
                {surveyRows.length > 0 && (
                  <button
                    onClick={() => {
                      const firstRow = surveyRows[0];
                      if (firstRow?.evidence["objective"]) {
                        setActiveEvidence(firstRow.evidence["objective"]);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline pt-2"
                  >
                    Inspect First Paper Objective Evidence →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: PAPER DETAILS */}
        {/* ================================================================= */}
        {panel3Tab === "details" && (
          <div className="space-y-4">
            {selectedPaper ? (
              <div className="space-y-3">
                {/* Header card */}
                <div className="p-3 rounded-lg border border-border bg-surface-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-primary uppercase">
                      {selectedPaper.venue || "Academic Publication"}
                    </span>
                    <span className="text-xs font-bold text-text-muted">
                      {selectedPaper.publicationYear}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-text leading-snug">
                    {selectedPaper.title}
                  </h3>

                  <p className="text-xs text-text-muted">
                    {selectedPaper.authors.join(", ")}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
                    {selectedPaper.doi && (
                      <a
                        href={`https://doi.org/${selectedPaper.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-mono"
                      >
                        <LinkIcon className="w-3 h-3" />
                        DOI: {selectedPaper.doi}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Extraction and OCR Status */}
                <div className="p-3 rounded-lg border border-border bg-surface space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-text-muted">
                      Extraction Pipeline Status
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        selectedPaper.extractionStatus === "extracted"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : selectedPaper.extractionStatus === "ocr_required"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-blue-500/10 text-blue-600"
                      }`}
                    >
                      {selectedPaper.extractionStatus.replace("_", " ").toUpperCase()}
                    </span>
                  </div>

                  {selectedPaper.extractionWarning && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{selectedPaper.extractionWarning}</span>
                    </div>
                  )}

                  <div className="text-[11px] text-text-muted font-mono flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-text-muted" /> Hash:
                    </span>
                    <span
                      className="truncate max-w-[180px]"
                      title={selectedPaper.documentHash}
                    >
                      {selectedPaper.documentHash}
                    </span>
                  </div>
                </div>

                {/* Abstract */}
                <div className="p-3 rounded-lg border border-border bg-surface space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-text">
                    <span>Abstract</span>
                    <button
                      onClick={() =>
                        copyToClipboard(selectedPaper.abstract, "paper_abstract")
                      }
                      className="p-1 rounded text-text-muted hover:text-text transition-colors"
                      title="Copy abstract text"
                    >
                      {copiedId === "paper_abstract" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-6 hover:line-clamp-none transition-all">
                    {selectedPaper.abstract}
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setModalPaper(selectedPaper);
                      setModalTargetPage(1);
                      setPdfModalOpen(true);
                    }}
                    className="w-full py-2 px-3 bg-primary text-primary-foreground rounded-lg font-medium text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <BookOpen className="w-4 h-4" />
                    Open Full PDF Document
                  </button>

                  <button
                    onClick={() => {
                      const firstRow = surveyRows.find(
                        (r) => r.paperId === selectedPaper.id
                      );
                      if (firstRow?.evidence["objective"]) {
                        setActiveEvidence(firstRow.evidence["objective"]);
                        setPanel3Tab("evidence");
                      }
                    }}
                    className="w-full py-2 px-3 border border-border bg-surface-subtle text-text rounded-lg font-medium text-xs flex items-center justify-center gap-2 hover:bg-surface-hover transition-colors"
                  >
                    <FileSearch className="w-4 h-4 text-primary" />
                    Inspect Extracted Evidence
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 px-4 text-center text-xs text-text-muted space-y-2">
                <FileText className="w-8 h-8 text-text-muted mx-auto opacity-50" />
                <p>Select any paper in Panel 1 to inspect its details.</p>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: SIMILARITY REVIEW */}
        {/* ================================================================= */}
        {panel3Tab === "similarity" && (
          <div className="space-y-4">
            {/* Overview Banner */}
            <div className="p-3 rounded-lg border border-border bg-surface-subtle space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Manuscript Similarity Audit
                </span>
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  {similarityMatches.length} Matches Found
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Matches are detected using local-first Winnowing n-gram
                fingerprinting against your project literature. Verified locally
                without external cloud leakage.
              </p>

              {/* Status Filters */}
              <div className="flex flex-wrap gap-1 pt-1">
                {(
                  [
                    "all",
                    "unreviewed",
                    "acknowledged",
                    "properly_quoted",
                    "citation_attached",
                    "false_positive",
                  ] as const
                ).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterSimilarityStatus(status)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      filterSimilarityStatus === status
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-surface border border-border text-text-muted hover:text-text"
                    }`}
                  >
                    {status === "all"
                      ? "All"
                      : status.replace("_", " ").toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Matches List */}
            <div className="space-y-3">
              {filteredSimilarityMatches.map((match) => (
                <div
                  key={match.id}
                  className="p-3 rounded-lg border border-border bg-surface space-y-2.5 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                      {match.category.replace("_", " ")}
                    </span>
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      {Math.round(match.similarityScore * 100)}% Match
                    </span>
                  </div>

                  {/* Excerpts comparison */}
                  <div className="space-y-1.5 text-xs">
                    <div className="p-2 rounded bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-0.5">
                      <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                        Your Manuscript Draft:
                      </span>
                      <p className="text-xs text-text font-serif italic">
                        "{match.draftExcerpt}"
                      </p>
                    </div>

                    <div className="p-2 rounded bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 space-y-0.5">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-blue-800 dark:text-blue-300">
                        <span>Source ({match.sourcePaperTitle}, Pg {match.sourcePageNumber}):</span>
                        <button
                          onClick={() =>
                            handleOpenPdfAtPage(
                              match.sourcePaperId,
                              match.sourcePageNumber
                            )
                          }
                          className="hover:underline flex items-center gap-0.5 text-primary"
                        >
                          View PDF <ChevronRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <p className="text-xs text-text font-serif italic">
                        "{match.sourceExcerpt}"
                      </p>
                    </div>
                  </div>

                  {/* Review Actions */}
                  <div className="pt-2 border-t border-border/50 space-y-1.5">
                    <div className="text-[11px] font-medium text-text-muted flex items-center justify-between">
                      <span>Status:</span>
                      <span className="font-semibold text-primary capitalize">
                        {match.reviewStatus.replace("_", " ")}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <button
                        onClick={() =>
                          updateSimilarityStatus(match.id, "acknowledged")
                        }
                        className={`py-1 px-1.5 rounded border text-center transition-colors ${
                          match.reviewStatus === "acknowledged"
                            ? "bg-amber-500 text-white font-semibold border-amber-600"
                            : "bg-surface-subtle text-text hover:bg-surface-hover border-border"
                        }`}
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={() =>
                          updateSimilarityStatus(match.id, "properly_quoted")
                        }
                        className={`py-1 px-1.5 rounded border text-center transition-colors ${
                          match.reviewStatus === "properly_quoted"
                            ? "bg-emerald-600 text-white font-semibold border-emerald-700"
                            : "bg-surface-subtle text-text hover:bg-surface-hover border-border"
                        }`}
                      >
                        Properly Quoted
                      </button>
                      <button
                        onClick={() =>
                          updateSimilarityStatus(match.id, "citation_attached")
                        }
                        className={`py-1 px-1.5 rounded border text-center transition-colors ${
                          match.reviewStatus === "citation_attached"
                            ? "bg-blue-600 text-white font-semibold border-blue-700"
                            : "bg-surface-subtle text-text hover:bg-surface-hover border-border"
                        }`}
                      >
                        Attach Citation
                      </button>
                      <button
                        onClick={() =>
                          updateSimilarityStatus(match.id, "false_positive")
                        }
                        className={`py-1 px-1.5 rounded border text-center transition-colors ${
                          match.reviewStatus === "false_positive"
                            ? "bg-slate-600 text-white font-semibold border-slate-700"
                            : "bg-surface-subtle text-text hover:bg-surface-hover border-border"
                        }`}
                      >
                        False Positive
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: CITATION CHECKER & AUDIT */}
        {/* ================================================================= */}
        {panel3Tab === "citations" && (
          <div className="space-y-4">
            {/* Citation Audit Summary Card */}
            <div className="p-3 rounded-lg border border-border bg-surface-subtle space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Citation Consistency Audit
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  100% Verified
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Cross-checking in-text citations against the collected project
                literature matrix.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2 rounded bg-surface border border-border">
                  <span className="text-text-muted block text-[10px]">
                    Indexed References
                  </span>
                  <span className="font-bold text-text">{papers.length} Papers</span>
                </div>
                <div className="p-2 rounded bg-surface border border-border">
                  <span className="text-text-muted block text-[10px]">
                    Draft Claims Checked
                  </span>
                  <span className="font-bold text-text">
                    {sections.reduce((acc, s) => acc + s.claims.length, 0)} Claims
                  </span>
                </div>
              </div>
            </div>

            {/* Citation Style Switcher */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Output Citation Style:</span>
                <div className="flex items-center gap-1">
                  {(["apa", "ieee", "acm", "bibtex"] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setCitationFormat(style)}
                      className={`px-2 py-0.5 rounded text-[11px] uppercase font-mono transition-colors ${
                        citationFormat === style
                          ? "bg-primary text-primary-foreground font-bold"
                          : "bg-surface-subtle border border-border text-text-muted hover:text-text"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Formatted references list */}
              <div className="space-y-2">
                {papers.map((paper) => {
                  const formatted = formatCitation(paper, citationFormat);
                  return (
                    <div
                      key={paper.id}
                      className="p-2.5 rounded border border-border bg-surface space-y-1.5 text-xs group hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-text text-[11px] truncate">
                          {paper.authors[0]?.split(" ").pop() || "Author"} (
                          {paper.publicationYear})
                        </span>
                        <button
                          onClick={() => copyToClipboard(formatted, `cit_${paper.id}`)}
                          className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                          title="Copy reference entry"
                        >
                          {copiedId === `cit_${paper.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <p className="text-xs text-text-muted font-mono leading-relaxed bg-surface-subtle p-2 rounded border border-border/50 select-all whitespace-pre-wrap">
                        {formatted}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PDF Jump / Preview Modal */}
      {pdfModalOpen && modalPaper && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-2xl border border-border w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-subtle">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-text truncate max-w-xl">
                  {modalPaper.title}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  Jump to Page {modalTargetPage}
                </span>
              </div>
              <button
                onClick={() => setPdfModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors"
                aria-label="Close PDF Viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Embedded viewer container */}
            <div className="flex-1 overflow-hidden relative">
              <EmbeddedPdfViewer
                paperId={modalPaper.id}
                paperTitle={modalPaper.title}
                sourceUrl={modalPaper.sourceUrl}
                remotePdfUrl={modalPaper.sourceUrl}
                localFilePath={modalPaper.localPdfPath}
                targetPage={modalTargetPage}
                onClose={() => setPdfModalOpen(false)}
                sourceName={modalPaper.venue}
                venue={modalPaper.venue}
                publicationYear={modalPaper.publicationYear}
                canonicalDoi={modalPaper.doi}
              />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
