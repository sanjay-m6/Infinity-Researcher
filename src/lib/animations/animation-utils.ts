import { Transition, Variants } from "motion/react";
import { reducedMotionTransition } from "./transitions";
import { reducedMotionVariants } from "./variants";

/**
 * Checks whether the user or host operating system has requested reduced motion.
 * Safe for server/headless environments.
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Conditionally returns instantaneous transition when reduced motion is preferred.
 */
export function safeTransition(
  transition: Transition,
  prefersReducedMotion: boolean
): Transition {
  if (prefersReducedMotion) {
    return reducedMotionTransition;
  }
  return transition;
}

/**
 * Conditionally returns reduced-motion variants when reduced motion is preferred.
 */
export function safeVariants(
  variants: Variants,
  prefersReducedMotion: boolean
): Variants {
  if (prefersReducedMotion) {
    return reducedMotionVariants;
  }
  return variants;
}
