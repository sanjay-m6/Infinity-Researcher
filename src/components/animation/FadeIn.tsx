import { forwardRef, HTMLAttributes, ReactNode } from "react";
import { motion, HTMLMotionProps, Variants } from "motion/react";
import { motionDuration, motionEase, motionDistance } from "../../lib/animations/tokens";
import { useReducedMotionPreference } from "../../hooks/use-reduced-motion-preference";

export type FadeInDirection = "up" | "down" | "left" | "right" | "none";

export interface FadeInProps
  extends
    Omit<HTMLMotionProps<"div">, "children" | "direction">,
    Omit<HTMLAttributes<HTMLDivElement>, keyof HTMLMotionProps<"div">> {
  children?: ReactNode;
  direction?: FadeInDirection;
  distance?: number;
  delay?: number;
  duration?: number;
  className?: string;
}

/**
 * Directional fade-in component with subtle, accessible motion.
 */
export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(
  (
    {
      children,
      direction = "up",
      distance = motionDistance.md,
      delay = 0,
      duration = motionDuration.normal,
      className = "",
      transition: customTransition,
      ...motionProps
    },
    ref
  ) => {
    const prefersReducedMotion = useReducedMotionPreference();

    const getInitialOffsets = () => {
      if (prefersReducedMotion || direction === "none") {
        return { x: 0, y: 0 };
      }
      switch (direction) {
        case "up":
          return { x: 0, y: distance };
        case "down":
          return { x: 0, y: -distance };
        case "left":
          return { x: distance, y: 0 };
        case "right":
          return { x: -distance, y: 0 };
        default:
          return { x: 0, y: 0 };
      }
    };

    const offsets = getInitialOffsets();

    const variants: Variants = {
      hidden: {
        opacity: 0,
        x: offsets.x,
        y: offsets.y,
      },
      visible: {
        opacity: 1,
        x: 0,
        y: 0,
        transition: {
          duration: prefersReducedMotion ? 0 : duration,
          ease: motionEase.enter,
          delay,
          ...(typeof customTransition === "object" && customTransition !== null
            ? customTransition
            : {}),
        },
      },
    };

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate="visible"
        variants={variants}
        className={className}
        {...motionProps}
      >
        {children}
      </motion.div>
    );
  }
);

FadeIn.displayName = "FadeIn";

export default FadeIn;
