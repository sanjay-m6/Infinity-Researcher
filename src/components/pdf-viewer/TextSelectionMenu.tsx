import React, { useState } from "react";
import { Sparkles, StickyNote, Search, Copy, Check, Quote, X } from "lucide-react";

export interface TextSelectionMenuProps {
  selectedText: string;
  position: { x: number; y: number } | null;
  currentPage: number;
  onAskAi: (text: string) => void;
  onSaveNote: (text: string, page: number) => void;
  onSearchInDoc: (text: string) => void;
  onCopyText: (text: string) => void;
  onCopyCitation: (text: string) => void;
  onClose: () => void;
}

export const TextSelectionMenu: React.FC<TextSelectionMenuProps> = ({
  selectedText,
  position,
  currentPage,
  onAskAi,
  onSaveNote,
  onSearchInDoc,
  onCopyText,
  onCopyCitation,
  onClose,
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedCitation, setCopiedCitation] = useState(false);

  if (!position || !selectedText.trim()) return null;

  const handleCopyText = () => {
    onCopyText(selectedText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1500);
  };

  const handleCopyCitation = () => {
    onCopyCitation(selectedText);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 1500);
  };

  return (
    <div
      data-testid="text-selection-menu"
      style={{
        position: "absolute",
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -100%) translateY(-10px)",
      }}
      className="z-50 flex items-center bg-slate-900/95 dark:bg-slate-800/95 text-white rounded-xl shadow-2xl p-1 gap-0.5 border border-slate-700/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      {/* Ask AI */}
      <button
        type="button"
        onClick={() => onAskAi(selectedText)}
        title="Ask AI Assistant about selected text"
        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-600/80 text-indigo-200 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span>Ask AI</span>
      </button>

      <div className="h-4 w-px bg-slate-700 mx-0.5" />

      {/* Save Note */}
      <button
        type="button"
        onClick={() => onSaveNote(selectedText, currentPage)}
        title={`Save excerpt to research notes for Page ${currentPage}`}
        className="px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700/80 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
      >
        <StickyNote className="w-3.5 h-3.5 text-amber-400" />
        <span>Save Note</span>
      </button>

      {/* Find in Doc */}
      <button
        type="button"
        onClick={() => onSearchInDoc(selectedText)}
        title="Find other occurrences in document"
        className="px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700/80 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
      >
        <Search className="w-3.5 h-3.5 text-sky-400" />
        <span>Find</span>
      </button>

      {/* Copy Text */}
      <button
        type="button"
        onClick={handleCopyText}
        title="Copy plain text"
        className="px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700/80 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
      >
        {copiedText ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400">Copied</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy</span>
          </>
        )}
      </button>

      {/* Copy Citation / Quote */}
      <button
        type="button"
        onClick={handleCopyCitation}
        title="Copy as cited quotation with page reference"
        className="px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700/80 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
      >
        {copiedCitation ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400">Cited!</span>
          </>
        ) : (
          <>
            <Quote className="w-3.5 h-3.5 text-purple-400" />
            <span>Cite</span>
          </>
        )}
      </button>

      <div className="h-4 w-px bg-slate-700 mx-0.5" />

      {/* Dismiss */}
      <button
        type="button"
        onClick={onClose}
        title="Dismiss menu"
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
