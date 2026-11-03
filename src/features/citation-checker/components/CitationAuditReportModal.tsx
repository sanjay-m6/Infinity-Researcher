import React, { useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Download, Copy, Check, FileText } from "lucide-react";
import { CitationAuditReport } from "../types";

interface CitationAuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: CitationAuditReport | null;
}

export const CitationAuditReportModal: React.FC<CitationAuditReportModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  const [hasCopied, setHasCopied] = useState(false);

  if (!report) return null;

  const { summary, issues, references } = report;

  const generateMarkdownReport = (): string => {
    return `# Citation Audit Report: ${report.documentTitle}
Generated: ${new Date(report.analyzedAt).toLocaleString()}
Overall Health Score: ${summary.overallHealthScore}/100

## Summary Metrics
- Total In-Text Citations: ${summary.totalInTextCitations}
- Total Unique References: ${summary.totalUniqueReferences}
- Matched Citations: ${summary.matchedCitationsCount}
- Orphan In-Text Citations (Missing Reference): ${summary.orphanCitationsCount}
- Uncited Bibliography Entries: ${summary.uncitedReferencesCount}
- Duplicate References: ${summary.duplicateReferencesCount}
- Malformed DOIs: ${summary.malformedDoiCount}
- Verified Canonical DOIs: ${summary.verifiedDoiCount}
- Metadata Discrepancies: ${summary.metadataDiscrepancyCount}
- Incomplete Reference Metadata: ${summary.incompleteMetadataCount}
- Dominant Citation Style: ${summary.dominantStyle.toUpperCase()}

## Important Academic Notice
${summary.claimSupportDisclaimer}

## Detected Issues (${issues.length})
${issues
  .map(
    (issue, i) => `### ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.title}
- **Category:** ${issue.category}
- **Description:** ${issue.description}
${issue.suggestedFix ? `- **Suggested Action:** ${issue.suggestedFix}` : ""}
${issue.sourceSnippet ? `- **Context:**\n\`\`\`\n${issue.sourceSnippet}\n\`\`\`` : ""}
`
  )
  .join("\n")}

## Bibliography References Analyzed (${references.length})
${references.map((r, i) => `${i + 1}. [${r.key}] ${r.rawText} (Cited: ${r.inTextCitationCount}x, DOI: ${r.doiStatus.resolutionStatusLabel})`).join("\n")}
`;
  };

  const handleDownload = (format: "md" | "txt" | "json") => {
    const content = format === "json" ? JSON.stringify(report, null, 2) : generateMarkdownReport();
    const mimeType = format === "json" ? "application/json" : "text/plain";
    const extension = format === "json" ? "json" : format === "txt" ? "txt" : "md";

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `citation-audit-report-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    const text = `Citation Audit Report: ${report.documentTitle}
Score: ${summary.overallHealthScore}/100
In-Text Citations: ${summary.totalInTextCitations} | References: ${summary.totalUniqueReferences}
Orphan Citations: ${summary.orphanCitationsCount} | Uncited References: ${summary.uncitedReferencesCount}
Critical Issues: ${issues.filter((i) => i.severity === "critical").length} | Warnings: ${issues.filter((i) => i.severity === "warning").length}`;
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Citation Audit & Verification Report"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopySummary}
            className="text-xs"
          >
            {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            <span>{hasCopied ? "Copied Summary" : "Copy Summary"}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload("json")}
              className="text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              <span>Download .JSON</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDownload("md")}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              <FileText className="w-3.5 h-3.5 mr-1" />
              <span>Download .MD Report</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300 max-h-[70vh] overflow-y-auto pr-1">
        {/* Header KPI Grid */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Health Score</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {summary.overallHealthScore}/100
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Orphan Citations</span>
            <span className={`text-xl font-black ${summary.orphanCitationsCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {summary.orphanCitationsCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Uncited References</span>
            <span className={`text-xl font-black ${summary.uncitedReferencesCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {summary.uncitedReferencesCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Verified DOIs</span>
            <span className="text-xl font-black text-emerald-600">
              {summary.verifiedDoiCount}
            </span>
          </div>
        </div>

        {/* Claim distinction notice */}
        <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
          {summary.claimSupportDisclaimer}
        </div>

        {/* Issue list */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
            Audit Findings ({issues.length})
          </h4>

          {issues.map((issue) => (
            <div
              key={issue.id}
              className={`p-3 rounded-xl border text-[11px] space-y-1 ${
                issue.severity === "critical"
                  ? "bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60"
                  : issue.severity === "warning"
                  ? "bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {issue.title}
                </span>
                <span
                  className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                    issue.severity === "critical"
                      ? "bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200"
                      : issue.severity === "warning"
                      ? "bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {issue.severity}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{issue.description}</p>
              {issue.suggestedFix && (
                <div className="text-indigo-600 dark:text-indigo-400 font-semibold pt-0.5">
                  Action: {issue.suggestedFix}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
