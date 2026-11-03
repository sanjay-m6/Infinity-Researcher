import React, { useState } from "react";
import { UnifiedIntegrityReport } from "../types";
import { Download, Copy, Check, FileCode, FileText, X, Printer } from "lucide-react";
import { Button } from "../../../components/ui/Button";

interface ExportReportModalProps {
  report: UnifiedIntegrityReport;
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string, type: "success" | "info" | "warning" | "error") => void;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  report,
  isOpen,
  onClose,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<"html" | "json">("html");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateStandaloneHtml = (): string => {
    const findingsRows = report.findings
      .map(
        (f) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748b;">${f.dimension}</td>
          <td style="padding: 10px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: ${
              f.status === "verified"
                ? "#dcfce7; color: #166534;"
                : f.status === "concern"
                  ? "#ffe4e6; color: #9f1239;"
                  : f.status === "technical_error"
                    ? "#e0f2fe; color: #075985;"
                    : "#f1f5f9; color: #334155;"
            }">${f.status.replace("_", " ")}</span>
          </td>
          <td style="padding: 10px;">
            <div style="font-weight: 600; font-size: 13px; color: #0f172a; margin-bottom: 4px;">${f.title}</div>
            <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">${f.description}</div>
            ${
              f.evidence
                ? `<div style="background: #f8fafc; border-left: 3px solid #6366f1; padding: 6px 10px; font-family: monospace; font-size: 11px; color: #1e293b; margin-bottom: 6px;"><strong>Evidence:</strong> ${f.evidence}</div>`
                : ""
            }
            <div style="font-size: 11px; color: #4338ca;"><strong>Action:</strong> ${f.suggestedAction}</div>
            ${
              f.reviewerNotes
                ? `<div style="margin-top: 6px; font-size: 11px; color: #047857; background: #ecfdf5; padding: 4px 8px; border-radius: 4px;"><strong>Reviewer Note:</strong> ${f.reviewerNotes}</div>`
                : ""
            }
          </td>
          <td style="padding: 10px; font-size: 11px; font-family: monospace; color: #64748b;">${f.location}</td>
          <td style="padding: 10px; font-size: 11px; color: #64748b;">${f.confidence}</td>
        </tr>
      `
      )
      .join("");

    const dimensionCardsHtml = Object.values(report.dimensions)
      .map(
        (d) => `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="font-weight: 700; font-size: 12px; color: #0f172a;">${d.label}</div>
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 9999px; background: ${
              d.status === "pass"
                ? "#dcfce7; color: #166534;"
                : d.status === "attention_needed"
                  ? "#fef3c7; color: #92400e;"
                  : "#ffe4e6; color: #9f1239;"
            }">${d.statusLabel}</span>
          </div>
          <div style="font-size: 11px; color: #64748b; line-height: 1.4;">${d.summaryText}</div>
          <div style="margin-top: 8px; font-size: 10px; font-weight: 600; color: #475569;">Findings: ${d.findingsCount} (${d.unreviewedCount} unreviewed)</div>
        </div>
      `
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Research Integrity Audit — ${report.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; line-height: 1.5; }
    .container { max-width: 1100px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; }
    .meta { font-size: 12px; color: #64748b; }
    .disclaimer { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #1e40af; margin-bottom: 24px; line-height: 1.5; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th { text-align: left; padding: 10px; background: #f1f5f9; color: #475569; font-size: 11px; text-transform: uppercase; font-weight: 700; border-bottom: 2px solid #cbd5e1; }
    @media print { body { background: #fff; padding: 0; } .container { border: none; box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 class="title">Research Integrity Audit Report</h1>
        <div class="meta">
          <strong>Document:</strong> ${report.fileName} &bull; <strong>Title:</strong> ${report.title} &bull; <strong>Word Count:</strong> ${report.wordCount.toLocaleString()} &bull; <strong>Analyzed:</strong> ${new Date(report.analyzedAt).toLocaleString()}
        </div>
      </div>
    </div>

    <div class="disclaimer">
      <strong>Transparent Integrity Protocol:</strong> ${report.ethicalDisclaimer}
    </div>

    <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">Audited Dimensions</h2>
    <div class="grid">
      ${dimensionCardsHtml}
    </div>

    <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Detailed Traceable Findings (${report.findings.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Dimension</th>
          <th>Status</th>
          <th>Finding & Evidence</th>
          <th>Location</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        ${findingsRows}
      </tbody>
    </table>

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
      Generated by Infinity Researcher &bull; Academic Research Integrity Auditor &bull; ${new Date().toUTCString()}
    </div>
  </div>
</body>
</html>`;
  };

  const handleDownloadHtml = () => {
    const htmlContent = generateStandaloneHtml();
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `integrity-audit-${report.fileName.replace(/\.[^/.]+$/, "")}.html`;
    link.click();
    URL.revokeObjectURL(url);
    onToast("HTML audit report downloaded.", "success");
  };

  const handleDownloadJson = () => {
    const jsonContent = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `integrity-audit-${report.fileName.replace(/\.[^/.]+$/, "")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onToast("JSON audit report downloaded.", "success");
  };

  const handleCopyJson = () => {
    const jsonContent = JSON.stringify(report, null, 2);
    navigator.clipboard.writeText(jsonContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onToast("Copied JSON audit report to clipboard.", "info");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      onToast("Could not open print window. Please allow popups.", "error");
      return;
    }
    printWindow.document.write(generateStandaloneHtml());
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Export Research Integrity Audit
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate traceable audit artifacts for documentation and peer review.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-5 pt-4 flex gap-2 border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("html")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "html"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            Standalone HTML Report
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("json")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "json"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <FileCode className="w-4 h-4" />
            Machine-Readable JSON Artifact
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === "html" ? (
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Ready-to-Print Self-Contained Document
                </p>
                Includes all 7 audited integrity dimensions, transparent status badges,
                primary evidence excerpts, auditor reviewer notes, and ethical disclaimers
                with zero external dependencies.
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleDownloadHtml} variant="primary" size="md">
                  <Download className="w-4 h-4" />
                  Download HTML Report
                </Button>
                <Button onClick={handlePrint} variant="outline" size="md">
                  <Printer className="w-4 h-4" />
                  Print / Save as PDF
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Compliance and Archival Schema
                </p>
                Provides a structured JSON format containing full dimensional breakdown,
                finding identifiers, confidence levels, timestamps, and reviewer notes.
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleDownloadJson} variant="primary" size="md">
                  <Download className="w-4 h-4" />
                  Download JSON File
                </Button>
                <Button onClick={handleCopyJson} variant="outline" size="md">
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy JSON to Clipboard
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
