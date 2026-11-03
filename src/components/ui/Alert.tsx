import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success" | "warning" | "info";
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = "default", className = "", children, ...props }, ref) => {
    const variantStyles = {
      default:
        "bg-card text-foreground border-border",
      destructive:
        "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/60 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-400",
      success:
        "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400",
      warning:
        "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400",
      info:
        "bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/60 [&>svg]:text-sky-600 dark:[&>svg]:text-sky-400",
    }[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative w-full rounded-xl border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
          variantStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Alert.displayName = "Alert";

export const AlertTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = "", ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-semibold leading-none tracking-tight text-sm", className)}
      {...props}
    />
  )
);
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xs leading-relaxed opacity-90", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export default Alert;

