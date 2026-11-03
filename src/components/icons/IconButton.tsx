import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { IconButtonProps, IconSize } from "./iconTypes";
import { AnimatedIcon } from "./AnimatedIcon";
import { Tooltip } from "../ui/Tooltip";
import { cn } from "../../lib/utils";

const BUTTON_SIZE_STYLES = {
  xs: "w-6 h-6 rounded-md",
  sm: "w-7 h-7 rounded-md",
  md: "w-9 h-9 rounded-lg",
  lg: "w-10 h-10 rounded-lg",
  xl: "w-12 h-12 rounded-xl",
};

const BUTTON_ICON_SIZES: Record<keyof typeof BUTTON_SIZE_STYLES, IconSize> = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
};

const BUTTON_VARIANT_STYLES = {
  ghost:
    "text-muted-foreground hover:text-foreground hover:bg-muted active:bg-accent",
  outline:
    "border border-border text-foreground hover:bg-muted active:bg-accent shadow-xs",
  default:
    "bg-primary text-primary-foreground hover:bg-primary-hover active:opacity-90 shadow-xs",
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover active:opacity-90 shadow-xs",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary-hover active:opacity-90",
  destructive:
    "bg-destructive text-destructive-foreground hover:opacity-90 active:opacity-80 shadow-xs",
};

/**
 * Standardized, accessible icon-only button primitive.
 * Enforces WCAG 2.1 AA accessible naming, keyboard focus rings, tooltip integration,
 * disabled and loading state indicators, and animated icon micro-interactions.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      "aria-label": ariaLabel,
      tooltip,
      tooltipSide = "top",
      size = "md",
      variant = "ghost",
      isLoading = false,
      disabled = false,
      animation = "none",
      isAnimating,
      isExpanded,
      chevronAngle = 180,
      className,
      type = "button",
      ...props
    },
    ref
  ) => {
    const iconSize = BUTTON_ICON_SIZES[size];
    const isDisabled = disabled || isLoading;

    const buttonElement = (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-busy={isLoading ? "true" : undefined}
        aria-expanded={isExpanded !== undefined ? isExpanded : undefined}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors cursor-pointer select-none shrink-0",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          BUTTON_SIZE_STYLES[size],
          BUTTON_VARIANT_STYLES[variant],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <AnimatedIcon
            icon={Loader2}
            size={iconSize}
            animation="spin"
            aria-hidden="true"
          />
        ) : (
          <AnimatedIcon
            icon={icon}
            size={iconSize}
            animation={animation}
            isAnimating={isAnimating}
            isExpanded={isExpanded}
            chevronAngle={chevronAngle}
            aria-hidden="true"
          />
        )}
      </button>
    );

    if (tooltip && !disabled) {
      return (
        <Tooltip content={tooltip} side={tooltipSide}>
          {buttonElement}
        </Tooltip>
      );
    }

    return buttonElement;
  }
);

IconButton.displayName = "IconButton";
export default IconButton;

