import { Variants } from "motion/react";
import { motionDistance, motionDuration, motionEase } from "./tokens";
import {
  transitionFast,
  transitionNormal,
  transitionEnter,
  transitionExit,
} from "./transitions";

/**
 * Pure opacity fade variants.
 */
export const fadeVariants: Variants = {
  hidden: {
    opacity: 0,
    transition: transitionExit,
  },
  visible: {
    opacity: 1,
    transition: transitionEnter,
  },
  exit: {
    opacity: 0,
    transition: transitionFast,
  },
};

/**
 * Subtle vertical entrance variants (6px offset).
 * Used for cards, panels, and standard content sections.
 */
export const subtleEntranceVariants: Variants = {
  hidden: {
    opacity: 0,
    y: motionDistance.md,
    transition: transitionExit,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionEnter,
  },
  exit: {
    opacity: 0,
    y: -motionDistance.sm,
    transition: transitionFast,
  },
};

/**
 * Small horizontal entrance variants (6px offset).
 * Used for sidebar flyouts, drawers, and breadcrumbs.
 */
export const horizontalEntranceVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -motionDistance.md,
    transition: transitionExit,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitionEnter,
  },
  exit: {
    opacity: 0,
    x: motionDistance.sm,
    transition: transitionFast,
  },
};

/**
 * Dropdown menu & popover variants.
 * Crisp entrance with minimal scaling (0.98) and small vertical shift.
 */
export const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -motionDistance.sm,
    scale: 0.98,
    transition: transitionExit,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: motionDuration.fast,
      ease: motionEase.enter,
    },
  },
  exit: {
    opacity: 0,
    y: -motionDistance.xs,
    scale: 0.98,
    transition: {
      duration: 0.08,
      ease: motionEase.exit,
    },
  },
};

/**
 * Modal backdrop variants.
 */
export const modalBackdropVariants: Variants = {
  hidden: {
    opacity: 0,
    transition: { duration: motionDuration.fast },
  },
  visible: {
    opacity: 1,
    transition: { duration: motionDuration.normal },
  },
  exit: {
    opacity: 0,
    transition: { duration: motionDuration.fast },
  },
};

/**
 * Modal content dialog variants.
 * Gentle scale and vertical entrance.
 */
export const modalContentVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.98,
    y: motionDistance.lg,
    transition: transitionExit,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: motionDuration.moderate,
      ease: motionEase.enter,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: motionDistance.sm,
    transition: {
      duration: motionDuration.fast,
      ease: motionEase.exit,
    },
  },
};

/**
 * Expand and collapse variants for accordions and detail drawers.
 */
export const expandCollapseVariants: Variants = {
  collapsed: {
    opacity: 0,
    height: 0,
    overflow: "hidden",
    transition: {
      duration: motionDuration.fast,
      ease: motionEase.exit,
    },
  },
  expanded: {
    opacity: 1,
    height: "auto",
    transition: {
      duration: motionDuration.normal,
      ease: motionEase.enter,
    },
  },
};

/**
 * Stagger container variants.
 * Staggers children entrance by 30ms to create a natural, organized cascade.
 */
export const staggerContainerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.01,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

/**
 * Item variant used inside a StaggerContainer.
 */
export const staggerItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: motionDistance.sm,
    transition: transitionExit,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionNormal,
  },
  exit: {
    opacity: 0,
    y: -motionDistance.xs,
    transition: transitionFast,
  },
};

/**
 * Page & route transition variants.
 * Features a subtle 4px vertical entrance and fast fade for high-velocity research navigation.
 */
export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    y: motionDistance.sm,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: motionDuration.normal,
      ease: motionEase.enter,
    },
  },
  exit: {
    opacity: 0,
    y: -motionDistance.xs,
    transition: {
      duration: motionDuration.fast,
      ease: motionEase.exit,
    },
  },
};

/**
 * Reduced-motion page transition fallback.
 * Strictly avoids vertical displacement and resolves instantaneously.
 */
export const pageTransitionReducedMotionVariants: Variants = {
  initial: {
    opacity: 0,
    y: 0,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0 },
  },
  exit: {
    opacity: 0,
    y: 0,
    transition: { duration: 0 },
  },
};

/**
 * Reduced-motion compliant fallback variants.
 * Replaces all translations and scaling with immediate or instantaneous opacity changes.
 */
export const reducedMotionVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 0,
    y: 0,
    scale: 1,
    transition: { duration: 0 },
  },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: { duration: 0 },
  },
  exit: {
    opacity: 0,
    x: 0,
    y: 0,
    scale: 1,
    transition: { duration: 0 },
  },
};
