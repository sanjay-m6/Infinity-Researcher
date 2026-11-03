/**
 * Infinity Researcher — Centralized Motion Tokens
 * Phase 4 Motion Infrastructure
 *
 * All motion values are defined in seconds (for Motion for React)
 * and pixels (for transform offsets).
 */

/**
 * Standard duration tokens in seconds.
 * Fast, conservative timings ensure research workflows remain snappy.
 */
export const motionDuration = {
  instant: 0,
  fast: 0.12,
  normal: 0.18,
  moderate: 0.24,
  slow: 0.3,
} as const;

export type MotionDurationKey = keyof typeof motionDuration;

/**
 * Cubic bezier easing curves optimized for desktop workstations.
 * Formatted as number tuples [x1, y1, x2, y2] for Motion transitions.
 */
export const motionEase = {
  /** Natural deceleration for elements appearing or settling into view */
  standard: [0.2, 0, 0, 1] as const,
  /** Fast entrance deceleration */
  enter: [0, 0, 0.2, 1] as const,
  /** Swift exit acceleration */
  exit: [0.4, 0, 1, 1] as const,
  /** Emphasized interaction curve */
  emphasized: [0.2, 0, 0, 1] as const,
} as const;

export type MotionEaseKey = keyof typeof motionEase;

/**
 * Spatial distance tokens in pixels.
 * Kept intentionally small (<= 8px for standard UI) to prevent visual disorientation.
 */
export const motionDistance = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 12,
  xl: 20,
} as const;

export type MotionDistanceKey = keyof typeof motionDistance;

/**
 * Subtle spring configurations for micro-interactions (e.g. toggles, subtle scale).
 */
export const motionSpring = {
  snappy: {
    type: "spring" as const,
    stiffness: 400,
    damping: 30,
  },
  gentle: {
    type: "spring" as const,
    stiffness: 260,
    damping: 24,
  },
} as const;
