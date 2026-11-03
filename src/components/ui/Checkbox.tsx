import React, { forwardRef } from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CheckboxProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      checked = false,
      onCheckedChange,
      disabled = false,
      label,
      description,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const handleToggle = () => {
      if (!disabled) {
        onCheckedChange?.(!checked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleToggle();
      }
    };

    return (
      <div className="flex items-start gap-2.5 select-none">
        <button
          ref={ref}
          type="button"
          role="checkbox"
          aria-checked={checked}
          disabled={disabled}
          id={id}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={cn(
            "peer h-4 w-4 shrink-0 rounded-xs border transition-colors cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            checked
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border bg-card hover:border-primary/50",
            className
          )}
          {...props}
        >
          {checked && (
            <div className="flex items-center justify-center text-current">
              <Check className="h-3 w-3 stroke-[3]" />
            </div>
          )}
        </button>
        {(label || description) && (
          <div className="grid gap-0.5 leading-none">
            {label && (
              <label
                htmlFor={id}
                onClick={handleToggle}
                className={cn(
                  "text-xs font-semibold text-foreground cursor-pointer select-none",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-[11px] text-muted-foreground leading-normal">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";
export default Checkbox;
