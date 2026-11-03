import React, { useState, forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  delayDuration?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = "top",
  className = "",
  delayDuration = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<number | null>(null);

  const show = () => {
    if (delayDuration <= 0) {
      setIsVisible(true);
      return;
    }
    const id = window.setTimeout(() => setIsVisible(true), delayDuration);
    setTimeoutId(id);
  };

  const hide = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const sideStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  }[side];

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {isVisible && content && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 overflow-hidden rounded-md bg-foreground px-2.5 py-1 text-[11px] font-medium text-background shadow-md animate-in fade-in-0 zoom-in-95 pointer-events-none whitespace-nowrap",
            sideStyles,
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export const TooltipTrigger = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  )
);
TooltipTrigger.displayName = "TooltipTrigger";

export default Tooltip;
