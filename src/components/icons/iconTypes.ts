import React from "react";
import { LucideProps } from "lucide-react";

/**
 * Standard semantic icon sizes mapped to the Phase 2 typography and spacing scale.
 */
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * Purposeful micro-interaction animation presets powered by Motion for React.
 */
export type IconAnimation =
  | "none"
  | "spin"
  | "pulse"
  | "hover-scale"
  | "hover-rotate"
  | "tap-bounce"
  | "success-check"
  | "error-shake"
  | "expand-chevron";

/**
 * Trigger source for the icon animation.
 */
export type IconAnimationTrigger = "always" | "hover" | "tap" | "state";

/**
 * Base props accepted by the standardized AppIcon component.
 */
export interface AppIconProps extends React.SVGAttributes<SVGSVGElement> {
  /**
   * The Lucide icon component or equivalent SVG component to render.
   */
  icon: React.ComponentType<LucideProps>;
  /**
   * Standard semantic size token or explicit numeric pixel dimension.
   * Default: "md" (18px)
   */
  size?: IconSize | number;
  /**
   * Stroke width override. Default: 2.0 (1.75 for display sizes)
   */
  strokeWidth?: number;
  /**
   * Additional Tailwind classes applied to the icon.
   */
  className?: string;
  /**
   * Optional accessible name when the icon represents a meaningful standalone symbol.
   * When omitted, the icon automatically defaults to aria-hidden="true".
   */
  "aria-label"?: string;
  /**
   * Optional tooltip/title attribute for browser native hovering.
   */
  title?: string;
}

/**
 * Props for AnimatedIcon incorporating Motion for React micro-interactions.
 */
export interface AnimatedIconProps extends AppIconProps {
  /**
   * The animation preset to apply. Default: "none"
   */
  animation?: IconAnimation;
  /**
   * Controlled animation state flag (e.g. true while an async task is running).
   * When false, loop animations like "spin" or "pulse" stop immediately.
   */
  isAnimating?: boolean;
  /**
   * Controlled expansion state for "expand-chevron".
   */
  isExpanded?: boolean;
  /**
   * Rotation angle for chevron expansion: 90 degrees or 180 degrees.
   * Default: 180
   */
  chevronAngle?: 90 | 180;
  /**
   * Animation trigger behavior: "always", "hover", "tap", or "state".
   * Default: depends on animation type (e.g. "always" for spin, "hover" for hover-scale)
   */
  trigger?: IconAnimationTrigger;
}

/**
 * Button variants consistent with Phase 5 Button primitives.
 */
export type IconButtonVariant =
  "default" | "primary" | "secondary" | "outline" | "ghost" | "destructive";

/**
 * Size scale for icon buttons ensuring minimum accessible touch/click targets.
 */
export type IconButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Props for the accessible IconButton component.
 */
export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  /**
   * The Lucide icon component to display within the button.
   */
  icon: React.ComponentType<LucideProps>;
  /**
   * Mandatory accessible name for screen readers (WCAG 2.1 AA requirement).
   */
  "aria-label": string;
  /**
   * Optional tooltip content. When provided, automatically wraps the button in a Tooltip.
   */
  tooltip?: React.ReactNode;
  /**
   * Placement side of the tooltip. Default: "top"
   */
  tooltipSide?: "top" | "bottom" | "left" | "right";
  /**
   * Button dimensions and target size. Default: "md" (36x36px)
   */
  size?: IconButtonSize;
  /**
   * Visual variant matching the Phase 5 button system. Default: "ghost"
   */
  variant?: IconButtonVariant;
  /**
   * Indicates an in-progress async action. Replaces the icon with a spinning loader and sets aria-busy="true".
   */
  isLoading?: boolean;
  /**
   * Micro-interaction animation preset applied to the inner icon.
   */
  animation?: IconAnimation;
  /**
   * Controlled animation state flag for the inner icon.
   */
  isAnimating?: boolean;
  /**
   * Expansion state for collapsible disclosures, synchronizing aria-expanded and chevron rotation.
   */
  isExpanded?: boolean;
  /**
   * Rotation angle when isExpanded is true. Default: 180
   */
  chevronAngle?: 90 | 180;
}
