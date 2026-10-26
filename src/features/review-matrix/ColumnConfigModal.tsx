import React, { useState } from "react";
import { X, Plus, Trash2, Columns3, Check, RotateCcw } from "lucide-react";
import { MatrixColumnConfig } from "../../lib/desktop-api/types";
import { Button } from "../../components/ui/Button";

interface ColumnConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: MatrixColumnConfig[];
  onSaveColumns: (updated: MatrixColumnConfig[]) => Promise<void>;
}

export const ColumnConfigModal: React.FC<ColumnConfigModalProps> = ({
  isOpen,
  onClose,
  columns,
  onSaveColumns,
}) => {
  const [cols, setCols] = useState<MatrixColumnConfig[]>(columns);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleAddColumn = () => {
    if (!newLabel.trim()) return;
    const key = newKey.trim() || newLabel.trim().toLowerCase().replace(/\s+/g, "_");
    if (cols.some((c) => c.key === key)) return;

    setCols((prev) => [
      ...prev,
      {
        key,
        label: newLabel.trim(),
        col_type: "text",
        required: false,
        width: 200,
      },
    ]);
    setNewKey("");
    setNewLabel("");
  };

  const handleRemoveColumn = (key: string) => {
    setCols((prev) => prev.filter((c) => c.key !== key));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveColumns(cols);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setCols([
      { key: "research_question", label: "Research Question", col_type: "text", required: true, width: 240 },
      { key: "methodology", label: "Methodology", col_type: "text", required: true, width: 220 },
      { key: "dataset", label: "Dataset / Benchmark", col_type: "text", required: false, width: 180 },
      { key: "sample_size", label: "Sample Size", col_type: "text", required: false, width: 130 },
      { key: "model_architecture", label: "Model / Architecture", col_type: "text", required: false, width: 190 },
      { key: "eval_metrics", label: "Key Metrics", col_type: "text", required: false, width: 160 },
      { key: "main_findings", label: "Main Findings", col_type: "text", required: true, width: 260 },
      { key: "limitations", label: "Limitations", col_type: "text", required: false, width: 200 },
      { key: "future_work", label: "Future Work", col_type: "text", required: false, width: 180 },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Columns3 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white text-base">
              Customize Matrix Columns
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Column List */}
        <div className="p-5 overflow-y-auto max-h-[50vh] space-y-2">
          {cols.map((col) => (
            <div
              key={col.key}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-sm"
            >
              <div>
                <span className="font-medium text-slate-900 dark:text-white">{col.label}</span>
                <span className="text-xs text-slate-400 ml-2 font-mono">({col.key})</span>
              </div>
              <div className="flex items-center gap-2">
                {col.required && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Core
                  </span>
                )}
                {!col.required && (
                  <button
                    onClick={() => handleRemoveColumn(col.key)}
                    className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Custom Column Section */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Add Custom Dimension
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Hardware Used, Loss Function, Compute Budget..."
              className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddColumn}
              disabled={!newLabel.trim()}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <button
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Standard PRISMA Columns</span>
          </button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Apply Columns"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
