import React from "react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionNode?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionNode,
  compact = false,
  className = "",
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border bg-card/40 transition-colors",
        compact ? "p-4 space-y-2" : "p-8 space-y-3",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "rounded-full bg-muted text-muted-foreground flex items-center justify-center",
            compact ? "p-2 mb-1" : "p-3 mb-2"
          )}
        >
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3
          className={cn(
            "font-semibold text-foreground tracking-tight",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "text-muted-foreground max-w-sm leading-relaxed",
            compact ? "text-[11px]" : "text-xs"
          )}
        >
          {description}
        </p>
      </div>
      {actionNode ? (
        actionNode
      ) : actionLabel && onAction ? (
        <Button variant="default" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
};

export default EmptyState;
