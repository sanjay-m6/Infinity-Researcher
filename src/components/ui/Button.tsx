import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    "default" | "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "xs" | "sm" | "md" | "lg" | "icon" | "default";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "default",
      size = "default",
      isLoading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer";

    // Both "default" and "primary" resolve to the scholarly primary action
    const variantStyles: Record<string, string> = {
      default:
        "bg-primary text-primary-foreground hover:bg-primary-hover active:opacity-90 shadow-xs",
      primary:
        "bg-primary text-primary-foreground hover:bg-primary-hover active:opacity-90 shadow-xs",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary-hover active:opacity-90",
      outline: "border border-border text-foreground hover:bg-muted active:bg-accent",
      ghost: "text-foreground hover:bg-muted active:bg-accent",
      destructive:
        "bg-destructive text-destructive-foreground hover:opacity-90 active:opacity-80 shadow-xs",
      link: "text-primary underline-offset-4 hover:underline p-0 h-auto font-normal",
    };

    const sizeStyles = {
      xs: "text-[11px] px-2 py-1 gap-1",
      sm: "text-xs px-2.5 py-1.5 gap-1.5",
      default: "text-sm px-3.5 py-2 gap-2",
      md: "text-sm px-3.5 py-2 gap-2",
      lg: "text-base px-5 py-2.5 gap-2.5",
      icon: "p-2 w-9 h-9",
    }[size];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading ? "true" : undefined}
        className={cn(baseStyles, variantStyles[variant], sizeStyles, className)}
        {...props}
      >
        {isLoading && (
          <span className="inline-flex gap-1 items-center shrink-0" aria-hidden="true">
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-100 animate-pulse [animation-delay:300ms]" />
          </span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
