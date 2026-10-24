import React from "react";
import { useApp } from "../../context/AppContext";
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";

export const ToastContainer: React.FC = () => {
  const { toast } = useApp();

  if (!toast) return null;

  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-sky-500 shrink-0" />,
  };

  const borderStyles = {
    success: "border-emerald-200 dark:border-emerald-800/60",
    warning: "border-amber-200 dark:border-amber-800/60",
    error: "border-rose-200 dark:border-rose-800/60",
    info: "border-sky-200 dark:border-sky-800/60",
  }[toast.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 pointer-events-none flex flex-col gap-2 max-w-sm"
    >
      <div
        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border ${borderStyles} rounded-xl shadow-lg text-sm text-slate-800 dark:text-slate-100 transition-all duration-300 animate-in slide-in-from-bottom-3`}
      >
        {iconMap[toast.type]}
        <span className="font-medium text-xs sm:text-sm leading-snug">
          {toast.message}
        </span>
      </div>
    </div>
  );
};
