import { forwardRef, HTMLAttributes, ReactNode } from "react";
import { motion, HTMLMotionProps, Variants } from "motion/react";
import {
  getAnimationPreset,
  AnimationPresetName,
} from "../../lib/animations/presets";
import { useReducedMotionPreference } from "../../hooks/use-reduced-motion-preference";

export interface AnimatedContainerProps
  extends Omit<HTMLMotionProps<"div">, "children" | "variants">,
    Omit<HTMLAttributes<HTMLDivElement>, keyof HTMLMotionProps<"div">> {
  children?: ReactNode;
  /**
   * Named preset to use for entrance/exit animations. Defaults to "subtleEntrance".
   */
  preset?: AnimationPresetName;
  /**
   * Optional custom variants overriding the preset.
   */
  variants?: Variants;
  /**
   * Animation delay in seconds.
   */
  delay?: number;
  /**
   * Animation duration in seconds (overrides preset timing).
   */
  duration?: number;
  /**
   * Whether animation should only play once on initial mount (defaults to true).
   */
  once?: boolean;
  className?: string;
}

/**
 * Reusable animated container for cards, panels, and view containers.
 * Transparently integrates reduced-motion safety and hardware-accelerated transforms.
 */
export const AnimatedContainer = forwardRef<HTMLDivElement, AnimatedContainerProps>(
  (
    {
      children,
      preset = "subtleEntrance",
      variants: customVariants,
      delay = 0,
      duration,
      className = "",
      initial,
      animate,
      exit,
      transition: customTransition,
      ...motionProps
    },
    ref
  ) => {
    const prefersReducedMotion = useReducedMotionPreference();
    const resolvedPreset = getAnimationPreset(preset, prefersReducedMotion);
    const activeVariants = customVariants ?? resolvedPreset.variants;

    const baseTransition = {
      ...(duration !== undefined ? { duration } : {}),
      ...(delay > 0 ? { delay } : {}),
      ...(prefersReducedMotion ? { duration: 0 } : {}),
      ...((typeof customTransition === "object" && customTransition !== null)
        ? customTransition
        : {}),
    };

    return (
      <motion.div
        ref={ref}
        initial={initial ?? resolvedPreset.initial}
        animate={animate ?? resolvedPreset.animate}
        exit={exit ?? resolvedPreset.exit}
        variants={activeVariants}
        transition={baseTransition}
        className={className}
        {...motionProps}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedContainer.displayName = "AnimatedContainer";

export default AnimatedContainer;
