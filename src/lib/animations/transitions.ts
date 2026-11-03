import { Transition, Easing } from "motion/react";
import { motionDuration, motionEase, motionSpring } from "./tokens";

/**
 * Standard transition presets built from centralized motion tokens.
 */
export const transitionFast: Transition = {
  duration: motionDuration.fast,
  ease: motionEase.standard,
};

export const transitionNormal: Transition = {
  duration: motionDuration.normal,
  ease: motionEase.standard,
};

export const transitionModerate: Transition = {
  duration: motionDuration.moderate,
  ease: motionEase.standard,
};

export const transitionSlow: Transition = {
  duration: motionDuration.slow,
  ease: motionEase.standard,
};

export const transitionEnter: Transition = {
  duration: motionDuration.normal,
  ease: motionEase.enter,
};

export const transitionExit: Transition = {
  duration: motionDuration.fast,
  ease: motionEase.exit,
};

export const transitionSpringSnappy: Transition = {
  ...motionSpring.snappy,
};

export const transitionSpringGentle: Transition = {
  ...motionSpring.gentle,
};

/**
 * Reduced-motion instantaneous transition.
 */
export const reducedMotionTransition: Transition = {
  duration: 0,
  ease: "linear",
};

/**
 * Helper to construct custom transitions while honoring system tokens.
 */
export function createTransition(options?: {
  duration?: number;
  ease?: Easing;
  delay?: number;
  staggerChildren?: number;
  delayChildren?: number;
}): Transition {
  return {
    duration: options?.duration ?? motionDuration.normal,
    ease: options?.ease ?? motionEase.standard,
    delay: options?.delay ?? 0,
    ...(options?.staggerChildren ? { staggerChildren: options.staggerChildren } : {}),
    ...(options?.delayChildren ? { delayChildren: options.delayChildren } : {}),
  };
}
