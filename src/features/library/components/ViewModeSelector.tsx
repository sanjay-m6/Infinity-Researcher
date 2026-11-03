import React from "react";
import { LayoutGrid, List, AlignJustify } from "lucide-react";
import { LibraryViewMode } from "../types";

interface ViewModeSelectorProps {
  currentMode: LibraryViewMode;
  onChange: (mode: LibraryViewMode) => void;
}

export const ViewModeSelector: React.FC<ViewModeSelectorProps> = ({
  currentMode,
  onChange,
}) => {
  return (
    <div
      role="group"
      aria-label="Library view layout"
      className="inline-flex items-center p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300"
    >
      <button
        type="button"
        title="Table View"
        aria-label="Table View"
        aria-pressed={currentMode === "table"}
        onClick={() => onChange("table")}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
          currentMode === "table"
            ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
            : "hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        <List className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Table</span>
      </button>

      <button
        type="button"
        title="Grid View"
        aria-label="Grid View"
        aria-pressed={currentMode === "grid"}
        onClick={() => onChange("grid")}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
          currentMode === "grid"
            ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
            : "hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Grid</span>
      </button>

      <button
        type="button"
        title="Compact View"
        aria-label="Compact View"
        aria-pressed={currentMode === "compact"}
        onClick={() => onChange("compact")}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
          currentMode === "compact"
            ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
            : "hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        <AlignJustify className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Compact</span>
      </button>
    </div>
  );
};
