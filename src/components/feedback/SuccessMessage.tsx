import React from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SuccessMessageProps {
  message: string;
  description?: string;
  onDismiss?: () => void;
  className?: string;
}

export const SuccessMessage: React.FC<SuccessMessageProps> = ({
  message,
  description,
  onDismiss,
  className = "",
}) => {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-foreground transition-all animate-in fade-in duration-200",
        className
      )}
    >
      <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
      <div className="flex-1 space-y-0.5">
        <p className="text-xs font-semibold text-foreground">{message}</p>
        {description && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="text-muted-foreground hover:text-foreground p-1 rounded-xs transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default SuccessMessage;
