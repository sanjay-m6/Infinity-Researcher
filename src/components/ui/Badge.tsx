import React from "react";

export interface BadgeProps {
  variant?:
    "default" | "primary" | "success" | "warning" | "destructive" | "info" | "outline";
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  size = "sm",
  className = "",
  children,
}) => {
  const variantStyles = {
    default:
      "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    primary:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
    success:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    warning:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    destructive:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    info: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    outline:
      "bg-transparent text-slate-600 border-slate-300 dark:text-slate-400 dark:border-slate-700",
  }[variant];

  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${variantStyles} ${sizeStyles} ${className}`}
    >
      {children}
    </span>
  );
};
