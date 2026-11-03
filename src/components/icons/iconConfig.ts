import { IconSize } from "./iconTypes";

/**
 * Standard semantic icon sizes mapped to pixels and Tailwind utility dimensions.
 */
export const ICON_SIZES: Record<IconSize, { px: number; tw: string; strokeWidth: number }> = {
  xs: { px: 12, tw: "w-3 h-3", strokeWidth: 2.0 },
  sm: { px: 16, tw: "w-4 h-4", strokeWidth: 2.0 },
  md: { px: 18, tw: "w-[18px] h-[18px]", strokeWidth: 2.0 },
  lg: { px: 20, tw: "w-5 h-5", strokeWidth: 1.75 },
  xl: { px: 24, tw: "w-6 h-6", strokeWidth: 1.75 },
  "2xl": { px: 32, tw: "w-8 h-8", strokeWidth: 1.5 },
};

/**
 * Resolves numeric pixel dimensions from an IconSize token or custom number.
 */
export function resolveIconPixelSize(size: IconSize | number | undefined): number {
  if (typeof size === "number") return size;
  if (size && size in ICON_SIZES) return ICON_SIZES[size].px;
  return ICON_SIZES.md.px;
}

/**
 * Resolves standard stroke width for a given size.
 */
export function resolveStrokeWidth(
  size: IconSize | number | undefined,
  override?: number
): number {
  if (typeof override === "number") return override;
  if (typeof size === "number") {
    if (size >= 32) return 1.5;
    if (size >= 20) return 1.75;
    return 2.0;
  }
  if (size && size in ICON_SIZES) return ICON_SIZES[size].strokeWidth;
  return ICON_SIZES.md.strokeWidth;
}

/**
 * Resolves Tailwind sizing class for a given IconSize token or returns empty string for custom pixel numbers.
 */
export function resolveIconClassName(size: IconSize | number | undefined): string {
  if (typeof size === "string" && size in ICON_SIZES) {
    return ICON_SIZES[size].tw;
  }
  return "";
}

/**
 * Standard transitions for animated icon micro-interactions.
 */
export const ICON_ANIMATION_TRANSITIONS = {
  spin: {
    repeat: Infinity,
    duration: 1.1,
    ease: "linear",
  },
  pulse: {
    repeat: Infinity,
    duration: 1.6,
    ease: "easeInOut",
  },
  spring: {
    type: "spring",
    stiffness: 400,
    damping: 25,
  },
  snappy: {
    duration: 0.18,
    ease: "easeOut",
  },
  expand: {
    duration: 0.22,
    ease: "easeInOut",
  },
} as const;

