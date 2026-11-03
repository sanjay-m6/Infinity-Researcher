import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked = false,
      onCheckedChange,
      disabled = false,
      label,
      description,
      className = "",
      ...props
    },
    ref
  ) => {
    const handleToggle = () => {
      if (!disabled) {
        onCheckedChange?.(!checked);
      }
    };

    return (
      <div className="flex items-center justify-between gap-3 select-none">
        {(label || description) && (
          <div className="space-y-0.5">
            {label && (
              <span className="text-xs font-semibold text-foreground block">
                {label}
              </span>
            )}
            {description && (
              <span className="text-[11px] text-muted-foreground block leading-relaxed">
                {description}
              </span>
            )}
          </div>
        )}
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={handleToggle}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            checked ? "bg-primary" : "bg-muted",
            className
          )}
          {...props}
        >
          <span
            className={cn(
              "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-xs transition-transform",
              checked ? "translate-x-4" : "translate-x-0"
            )}
          />
        </button>
      </div>
    );
  }
);

Switch.displayName = "Switch";
export default Switch;

