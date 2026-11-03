import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indeterminate?: boolean;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ value = 0, max = 100, indeterminate = false, className = "", ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : Math.round(value)}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-muted",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full flex-1 bg-primary transition-all duration-300 ease-in-out",
            indeterminate ? "w-1/3 animate-pulse bg-primary/80" : ""
          )}
          style={{
            transform: indeterminate ? undefined : `translateX(-${100 - percentage}%)`,
          }}
        />
      </div>
    );
  }
);

Progress.displayName = "Progress";
export default Progress;
