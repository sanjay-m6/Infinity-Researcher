import React, { useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Paper, Collection } from "../../../types/domain";
import { Download, Upload, Copy, Check } from "lucide-react";

interface LibraryImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  papers: Paper[];
  collections: Collection[];
  onImportLibrary?: (importedData: { papers: Partial<Paper>[]; collections?: Partial<Collection>[] }) => Promise<void>;
  showToast: (message: string, type?: "success" | "info" | "warning" | "error") => void;
}

export const LibraryImportExportModal: React.FC<LibraryImportExportModalProps> = ({
  isOpen,
  onClose,
  papers,
  collections,
  onImportLibrary,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [exportFormat, setExportFormat] = useState<"json" | "bibtex" | "ris">("json");
  const [copied, setCopied] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const savedPapers = papers.filter((p) => p.isSaved);

  // Generate versioned JSON backup
  const generateJsonBackup = () => {
    const backup = {
      version: "1.0",
      app: "Infinity Researcher",
      exportedAt: new Date().toISOString(),
      counts: {
        papers: savedPapers.length,
        collections: collections.length,
      },
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        colorHex: c.colorHex,
      })),
      papers: savedPapers.map((p) => ({
        id: p.id,
        title: p.title,
        authors: p.authors,
        abstract: p.abstract,
        year: p.year,
        venue: p.venue,
        doi: p.doi,
        landingUrl: p.landingUrl,
        pdfUrl: p.pdfUrl,
        tags: p.tags,
        collectionIds: p.collectionIds,
        readingStatus: p.readingStatus,
        readingProgress: p.readingProgress,
        addedAt: p.addedAt,
      })),
    };
    return JSON.stringify(backup, null, 2);
  };

  // Generate BibTeX records
  const generateBibtex = () => {
    return savedPapers
      .map((p, idx) => {
        const firstAuthor = p.authors[0]
          ? p.authors[0].split(" ").pop()?.toLowerCase() || "author"
          : "author";
        const key = `${firstAuthor}${p.year || 2024}_${idx + 1}`;
        const authorsStr = p.authors.join(" and ");

        return `@article{${key},
  title = {${p.title}},
  author = {${authorsStr}},
  year = {${p.year || 2024}},
  journal = {${p.venue || "Scholarly Publication"}},
  ${p.doi ? `doi = {${p.doi}},` : ""}
  ${p.landingUrl ? `url = {${p.landingUrl}},` : ""}
}`;
      })
      .join("\n\n");
  };

  // Generate RIS records
  const generateRis = () => {
    return savedPapers
      .map((p) => {
        const authors = p.authors.map((a) => `AU  - ${a}`).join("\n");
        return `TY  - JOUR
TI  - ${p.title}
${authors}
PY  - ${p.year || 2024}
JO  - ${p.venue || "Scholarly Publication"}
${p.doi ? `DO  - ${p.doi}` : ""}
${p.landingUrl ? `UR  - ${p.landingUrl}` : ""}
${p.abstract ? `AB  - ${p.abstract}` : ""}
ER  - `;
      })
      .join("\n\n");
  };

  const getExportContent = () => {
    if (exportFormat === "json") return generateJsonBackup();
    if (exportFormat === "bibtex") return generateBibtex();
    return generateRis();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getExportContent());
    setCopied(true);
    showToast("Export copied to clipboard.", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = getExportContent();
    let ext = "json";
    let mime = "application/json";
    if (exportFormat === "bibtex") {
      ext = "bib";
      mime = "text/plain";
    } else if (exportFormat === "ris") {
      ext = "ris";
      mime = "text/plain";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `infinity_library_export_${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded .${ext} library file.`, "success");
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJsonText.trim() || !onImportLibrary) return;
    setIsImporting(true);
    try {
      const parsed = JSON.parse(importJsonText);
      if (!parsed.papers || !Array.isArray(parsed.papers)) {
        throw new Error("Invalid format: payload must contain a 'papers' array.");
      }
      await onImportLibrary(parsed);
      showToast(`Successfully imported ${parsed.papers.length} papers.`, "success");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to parse JSON backup";
      showToast(`Import error: ${msg}`, "error");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Library Backup & Citation Export"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("export")}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === "export"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
          >
            Export Library
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === "import"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
          >
            Import JSON Backup
          </button>
        </div>

        {activeTab === "export" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Format:
              </span>
              <div className="flex gap-1">
                {(["json", "bibtex", "ris"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setExportFormat(fmt)}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${exportFormat === fmt
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              {exportFormat === "json" &&
                "Versioned full JSON backup preserving paper metadata, tags, reading progress, and collection links."}
              {exportFormat === "bibtex" &&
                "BibTeX entries compatible with Overleaf, LaTeX, TeXstudio, and JabRef."}
              {exportFormat === "ris" &&
                "Research Information Systems (RIS) format compatible with Zotero, Mendeley, and EndNote."}
            </p>

            <div className="relative">
              <textarea
                readOnly
                rows={8}
                value={getExportContent()}
                className="w-full text-[11px] font-mono p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-slate-500">
                {savedPapers.length} papers ready to export
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? (
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1" />
                  )}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  <span>Download File</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "import" && (
          <form onSubmit={handleImportSubmit} className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Paste a previously exported Infinity Researcher JSON backup below to restore or merge papers.
            </p>

            <textarea
              rows={8}
              required
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='Paste JSON backup here: { "version": "1.0", "papers": [...] }'
              className="w-full text-[11px] font-mono p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isImporting || !importJsonText.trim()}
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                <span>{isImporting ? "Importing..." : "Restore Library"}</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
