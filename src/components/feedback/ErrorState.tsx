import React, { useState } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

export interface ErrorStateProps {
  title?: string;
  description: string;
  details?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  description,
  details,
  onRetry,
  retryLabel = "Try Again",
  compact = false,
  className = "",
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-xl border border-destructive/20 bg-destructive/5 p-6",
        compact ? "p-4 space-y-2" : "p-8 space-y-4",
        className
      )}
    >
      <div className="rounded-full bg-destructive/10 text-destructive p-3">
        <AlertTriangle className={compact ? "w-4 h-4" : "w-6 h-6"} />
      </div>

      <div className="space-y-1 max-w-md">
        <h3 className={cn("font-bold text-foreground", compact ? "text-xs" : "text-sm")}>
          {title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {details && (
        <div className="w-full max-w-md text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {showDetails ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {showDetails ? "Hide technical details" : "View technical details"}
          </button>
          {showDetails && (
            <pre className="mt-2 p-3 rounded-lg bg-card border border-border text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {details}
            </pre>
          )}
        </div>
      )}

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{retryLabel}</span>
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
