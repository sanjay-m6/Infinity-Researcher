import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Skeleton } from "../ui/Skeleton";
import { PageLoadingView } from "../loading";

export interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  variant?: "spinner" | "skeleton" | "inline" | "particles";
  compact?: boolean;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading...",
  subMessage,
  variant = "particles",
  compact = false,
  className = "",
}) => {
  if (variant === "inline") {
    return (
      <div className={cn("inline-flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <span className="inline-flex gap-1 items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse [animation-delay:300ms]" />
        </span>
        <span>{message}</span>
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className={cn("w-full space-y-3 p-4", className)}>
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (variant === "spinner") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex flex-col items-center justify-center text-center",
          compact ? "p-4 space-y-2" : "p-8 space-y-3",
          className
        )}
      >
        <div className="relative flex items-center justify-center">
          <Loader2
            className={cn(
              "animate-spin text-primary shrink-0",
              compact ? "w-5 h-5" : "w-8 h-8"
            )}
          />
        </div>
        <div className="space-y-1">
          <p className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>
            {message}
          </p>
          {subMessage && (
            <p className="text-xs text-muted-foreground max-w-sm">
              {subMessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Modern 3D particle cluster presentation
  return (
    <div
      aria-live="polite"
      className={cn("w-full flex flex-col items-center justify-center", className)}
    >
      <PageLoadingView visible message={message} className={compact ? "py-6" : "py-12"} />
      {subMessage && (
        <p className="text-xs text-muted-foreground text-center max-w-sm mt-[-1rem] pb-4">
          {subMessage}
        </p>
      )}
    </div>
  );
};

export default LoadingState;

