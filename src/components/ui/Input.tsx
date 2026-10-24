import React, { forwardRef, InputHTMLAttributes } from "react";

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
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leadingIcon && (
            <div className="absolute left-3 text-slate-400 pointer-events-none">
              {leadingIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 ${
              leadingIcon ? "pl-9" : ""
            } ${trailingIcon ? "pr-9" : ""} ${
              error
                ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                : "border-slate-300 dark:border-slate-700"
            } ${className}`}
            {...props}
          />
          {trailingIcon && (
            <div className="absolute right-3 text-slate-400">{trailingIcon}</div>
          )}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
