import { forwardRef, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer";

    const variantStyles = {
      primary:
        "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm dark:bg-indigo-500 dark:hover:bg-indigo-600",
      secondary:
        "bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
      outline:
        "border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
      ghost:
        "text-slate-700 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800/60",
      destructive:
        "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm dark:bg-rose-500 dark:hover:bg-rose-600",
    }[variant];

    const sizeStyles = {
      sm: "text-xs px-2.5 py-1.5 gap-1.5",
      md: "text-sm px-3.5 py-2 gap-2",
      lg: "text-base px-5 py-2.5 gap-2.5",
      icon: "p-2 w-9 h-9",
    }[size];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
