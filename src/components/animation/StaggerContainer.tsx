import { forwardRef, HTMLAttributes, ReactNode } from "react";
import { motion, HTMLMotionProps, Variants } from "motion/react";
import {
  staggerItemVariants,
  reducedMotionVariants,
} from "../../lib/animations/variants";
import { useReducedMotionPreference } from "../../hooks/use-reduced-motion-preference";

export interface StaggerContainerProps
  extends
    Omit<HTMLMotionProps<"div">, "children">,
    Omit<HTMLAttributes<HTMLDivElement>, keyof HTMLMotionProps<"div">> {
  children?: ReactNode;
  /**
   * Delay between each child animation in seconds. Defaults to 0.03 (30ms).
   */
  staggerDelay?: number;
  /**
   * Initial delay before the first child animates in seconds. Defaults to 0.01.
   */
  delayChildren?: number;
  className?: string;
}

/**
 * Container that choreographs the entrance of child StaggerItem components.
 */
export const StaggerContainer = forwardRef<HTMLDivElement, StaggerContainerProps>(
  (
    {
      children,
      staggerDelay = 0.03,
      delayChildren = 0.01,
      className = "",
      transition: customTransition,
      ...motionProps
    },
    ref
  ) => {
    const prefersReducedMotion = useReducedMotionPreference();

    const variants: Variants = prefersReducedMotion
      ? reducedMotionVariants
      : {
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: staggerDelay,
              delayChildren,
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

StaggerContainer.displayName = "StaggerContainer";

export interface StaggerItemProps
  extends
    Omit<HTMLMotionProps<"div">, "children">,
    Omit<HTMLAttributes<HTMLDivElement>, keyof HTMLMotionProps<"div">> {
  children?: ReactNode;
  className?: string;
}

/**
 * Individual item component to be placed inside a StaggerContainer.
 */
export const StaggerItem = forwardRef<HTMLDivElement, StaggerItemProps>(
  ({ children, className = "", ...motionProps }, ref) => {
    const prefersReducedMotion = useReducedMotionPreference();
    const variants = prefersReducedMotion ? reducedMotionVariants : staggerItemVariants;

    return (
      <motion.div ref={ref} variants={variants} className={className} {...motionProps}>
        {children}
      </motion.div>
    );
  }
);

StaggerItem.displayName = "StaggerItem";

export default StaggerContainer;
