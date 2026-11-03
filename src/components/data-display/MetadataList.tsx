import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface MetadataItemProps {
  label: string;
  value: React.ReactNode;
  copyValue?: string;
  className?: string;
}

export const MetadataItem: React.FC<MetadataItemProps> = ({
  label,
  value,
  copyValue,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 py-1.5 text-xs border-b border-border-subtle last:border-none",
        className
      )}
    >
      <span className="font-medium text-muted-foreground shrink-0 select-none">
        {label}
      </span>
      <div className="flex items-center gap-1.5 text-right font-normal text-foreground truncate">
        <span className="truncate">{value}</span>
        {copyValue && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${label}`}
            className="p-1 rounded-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            {copied ? (
              <Check className="w-3 h-3 text-success" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export interface MetadataListProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: "compact" | "normal";
}

export const MetadataList: React.FC<MetadataListProps> = ({
  density = "normal",
  className = "",
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "w-full rounded-lg border border-border bg-card p-3 divide-y divide-border-subtle",
        density === "compact" ? "text-xs space-y-0.5" : "text-sm space-y-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default MetadataList;
