import React, { useState } from "react";
import {
  X,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { ParsedReference, CitationStyleType, InTextCitation } from "../types";
import { formatReferenceInStyle } from "../styleFormatters";
import { Button } from "../../../components/ui/Button";

interface ReferenceInspectorDrawerProps {
  reference: ParsedReference | null;
  onClose: () => void;
  inTextCitations: InTextCitation[];
}

export const ReferenceInspectorDrawer: React.FC<ReferenceInspectorDrawerProps> = ({
  reference,
  onClose,
  inTextCitations,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<CitationStyleType>("ieee");
  const [hasCopied, setHasCopied] = useState(false);

  if (!reference) return null;

  const reformatted = formatReferenceInStyle(reference, selectedStyle);

  const matchedCitations = inTextCitations.filter((c) =>
    c.matchedReferenceIds.includes(reference.id)
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(reformatted);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400">
              {reference.key}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Reference Inspector
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                {reference.inTextCitationCount} citation instance(s) in body text
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Raw Text Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Manuscript Raw Entry
            </span>
            <p className="text-slate-800 dark:text-slate-200 font-sans leading-relaxed">
              {reference.rawText}
            </p>
          </div>

          {/* Parsed Metadata Breakdown */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Bibliographic Fields
            </span>

            <div className="grid grid-cols-2 gap-2.5 text-[11px]">
              <div>
                <span className="text-slate-400 block">Title</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {reference.title || <span className="text-amber-500 italic">Missing Title</span>}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Publication Year</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {reference.year || <span className="text-rose-500 italic">Missing Year</span>}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Venue / Journal</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {reference.venue || <span className="text-amber-500 italic">Missing Venue</span>}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Authors</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {reference.authors.length > 0 ? reference.authors.join(", ") : <span className="text-rose-500 italic">Missing Authors</span>}
                </span>
              </div>
            </div>
          </div>

          {/* DOI Syntax & Verification Status */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              reference.doiStatus.syntaxValid && reference.doiStatus.resolved
                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                : !reference.doiStatus.syntaxValid && reference.doi
                ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                DOI & Registry Status
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  reference.doiStatus.syntaxValid && reference.doiStatus.resolved
                    ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                    : !reference.doiStatus.syntaxValid && reference.doi
                    ? "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {reference.doiStatus.resolutionStatusLabel}
              </span>
            </div>

            {reference.doi ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {reference.doi}
                  </span>
                  {reference.doiStatus.canonicalDoi && (
                    <a
                      href={`https://doi.org/${reference.doiStatus.canonicalDoi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {reference.doiStatus.syntaxErrorNote && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                    {reference.doiStatus.syntaxErrorNote}
                  </p>
                )}

                {reference.doiStatus.verifiedMetadata && (
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 text-[11px] text-emerald-900 dark:text-emerald-200 space-y-1">
                    <span className="font-bold block">Canonical Registry Record:</span>
                    <div>Title: {reference.doiStatus.verifiedMetadata.title}</div>
                    <div>Year: {reference.doiStatus.verifiedMetadata.year} · Venue: {reference.doiStatus.verifiedMetadata.venue}</div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-[11px] italic">
                No DOI attached to this reference. Adding a canonical DOI improves citation indexability.
              </p>
            )}
          </div>

          {/* In-Text Occurrence Sentences */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              In-Text Mentions ({matchedCitations.length})
            </span>

            {matchedCitations.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px]">
                This reference is never cited in the body of the manuscript.
              </div>
            ) : (
              matchedCitations.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[11px] leading-relaxed"
                >
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold mr-1">
                    {c.raw}:
                  </span>
                  <span>"{c.contextSentence}"</span>
                </div>
              ))
            )}
          </div>

          {/* Modular Re-Formatter */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Reformat in Standard Styles
              </span>
              <div className="flex items-center gap-1">
                {(["ieee", "apa", "mla", "chicago", "harvard", "bibtex"] as CitationStyleType[]).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSelectedStyle(st)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer ${
                        selectedStyle === st
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap select-text">
              {reformatted}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="w-full text-xs h-8"
            >
              {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              <span>{hasCopied ? "Copied Reformatted Citation" : `Copy as ${selectedStyle.toUpperCase()}`}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
