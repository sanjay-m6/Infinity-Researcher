import {
  fadeVariants,
  subtleEntranceVariants,
  horizontalEntranceVariants,
  dropdownVariants,
  modalBackdropVariants,
  modalContentVariants,
  staggerContainerVariants,
  staggerItemVariants,
  expandCollapseVariants,
  pageTransitionVariants,
  pageTransitionReducedMotionVariants,
  reducedMotionVariants,
} from "./variants";

/**
 * Standard animation prop bundle for motion components.
 */
export interface MotionPresetProps {
  initial: string;
  animate: string;
  exit?: string;
  variants: typeof fadeVariants;
}

export const presetFade: MotionPresetProps = {
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  variants: fadeVariants,
};

export const presetSubtleEntrance: MotionPresetProps = {
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  variants: subtleEntranceVariants,
};

export const presetHorizontalEntrance: MotionPresetProps = {
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  variants: horizontalEntranceVariants,
};

export const presetDropdown: MotionPresetProps = {
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  variants: dropdownVariants,
};

export const presetModalBackdrop: MotionPresetProps = {
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  variants: modalBackdropVariants,
};

export const presetModalContent: MotionPresetProps = {
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  variants: modalContentVariants,
};

export const presetStaggerContainer: MotionPresetProps = {
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  variants: staggerContainerVariants,
};

export const presetStaggerItem: MotionPresetProps = {
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  variants: staggerItemVariants,
};

export const presetExpandCollapse = {
  initial: "collapsed",
  animate: "expanded",
  exit: "collapsed",
  variants: expandCollapseVariants,
};

export const presetPageTransition: MotionPresetProps = {
  initial: "initial",
  animate: "animate",
  exit: "exit",
  variants: pageTransitionVariants,
};

export const presetPageTransitionReducedMotion: MotionPresetProps = {
  initial: "initial",
  animate: "animate",
  exit: "exit",
  variants: pageTransitionReducedMotionVariants,
};

export const presetReducedMotion: MotionPresetProps = {
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  variants: reducedMotionVariants,
};

export type AnimationPresetName =
  | "fade"
  | "subtleEntrance"
  | "horizontalEntrance"
  | "dropdown"
  | "modalContent"
  | "modalBackdrop"
  | "staggerContainer"
  | "staggerItem"
  | "pageTransition";

/**
 * Resolves a preset by name, automatically returning the reduced-motion safe
 * variant when user prefers reduced motion.
 */
export function getAnimationPreset(
  name: AnimationPresetName,
  prefersReducedMotion = false
): MotionPresetProps {
  if (prefersReducedMotion) {
    if (name === "pageTransition") return presetPageTransitionReducedMotion;
    return presetReducedMotion;
  }

  switch (name) {
    case "fade":
      return presetFade;
    case "subtleEntrance":
      return presetSubtleEntrance;
    case "horizontalEntrance":
      return presetHorizontalEntrance;
    case "dropdown":
      return presetDropdown;
    case "modalContent":
      return presetModalContent;
    case "modalBackdrop":
      return presetModalBackdrop;
    case "staggerContainer":
      return presetStaggerContainer;
    case "staggerItem":
      return presetStaggerItem;
    case "pageTransition":
      return presetPageTransition;
    default:
      return presetSubtleEntrance;
  }
}
