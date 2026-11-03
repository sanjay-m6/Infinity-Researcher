import React, { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, helperText, leadingIcon, trailingIcon, className = "", id, ...props },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-foreground mb-1 select-none"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leadingIcon && (
            <div className="absolute left-3 text-muted-foreground pointer-events-none">
              {leadingIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-lg border bg-card text-foreground placeholder:text-muted-foreground text-sm px-3 py-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted",
              leadingIcon ? "pl-9" : "",
              trailingIcon ? "pr-9" : "",
              error
                ? "border-destructive text-destructive-foreground focus-visible:ring-destructive"
                : "border-border hover:border-border-subtle",
              className
            )}
            {...props}
          />
          {trailingIcon && (
            <div className="absolute right-3 text-muted-foreground">{trailingIcon}</div>
          )}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-destructive font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
