import { forwardRef, InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

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
      <div className={cn("relative flex items-center w-full", className)}>
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            "w-full pl-9 pr-14 py-2 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted"
          )}
          {...props}
        />
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {hasValue && onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear search"
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {shortcutHint && (
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded border border-border select-none">
              {shortcutHint}
            </kbd>
          )}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
export default SearchInput;
