import { forwardRef, InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  shortcutHint?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = "Search papers, authors, DOIs...",
      shortcutHint,
      className = "",
      ...props
    },
    ref
  ) => {
    const hasValue = Boolean(value && String(value).length > 0);

    return (
      <div className={`relative flex items-center w-full ${className}`}>
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full pl-9 pr-14 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          {...props}
        />
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {hasValue && onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear search"
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {shortcutHint && (
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 select-none">
              {shortcutHint}
            </kbd>
          )}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
