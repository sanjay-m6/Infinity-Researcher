import { forwardRef } from "react";
import { AppIconProps } from "./iconTypes";
import {
  resolveIconPixelSize,
  resolveStrokeWidth,
  resolveIconClassName,
} from "./iconConfig";
import { cn } from "../../lib/utils";

/**
 * Standardized icon primitive wrapping Lucide stroke icons.
 * Automatically enforces WCAG 2.1 AA accessibility (decorative aria-hidden vs meaningful role="img"),
 * consistent stroke scaling, and theme-aware sizing.
 */
export const AppIcon = forwardRef<SVGSVGElement, AppIconProps>(
  (
    {
      icon: IconComponent,
      size = "md",
      strokeWidth,
      className,
      "aria-label": ariaLabel,
      title,
      ...props
    },
    ref
  ) => {
    const pixelSize = resolveIconPixelSize(size);
    const stroke = resolveStrokeWidth(size, strokeWidth);
    const sizeTw = resolveIconClassName(size);

    const isMeaningful = Boolean(ariaLabel || title);
    const DynamicIcon = IconComponent as React.ComponentType<Record<string, unknown>>;

    return (
      <DynamicIcon
        ref={ref}
        size={pixelSize}
        strokeWidth={stroke}
        className={cn("shrink-0", sizeTw, className)}
        aria-hidden={isMeaningful ? undefined : true}
        role={isMeaningful ? "img" : undefined}
        aria-label={ariaLabel}
        title={title}
        {...props}
      />
    );
  }
);

AppIcon.displayName = "AppIcon";
export default AppIcon;
