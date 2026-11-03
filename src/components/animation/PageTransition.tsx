import React, { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  pageTransitionVariants,
  pageTransitionReducedMotionVariants,
} from "../../lib/animations/variants";
import { useReducedMotionPreference } from "../../hooks/use-reduced-motion-preference";

export interface PageTransitionProps {
  children: ReactNode;
  routeKey: string;
  className?: string;
  optOut?: boolean;
}

/**
 * Reusable page transition component built with Motion for React.
 * Delivers restrained 180ms fade / 4px entrance transitions across routes,
 * with instantaneous 0ms fallback under reduced-motion preference.
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  routeKey,
  className = "",
  optOut = false,
}) => {
  const prefersReducedMotion = useReducedMotionPreference();

  if (optOut) {
    return (
      <div key={routeKey} className={className} data-slot="page-transition-opt-out">
        {children}
      </div>
    );
  }

  const activeVariants = prefersReducedMotion
    ? pageTransitionReducedMotionVariants
    : pageTransitionVariants;

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={routeKey}
        data-slot="page-transition"
        data-route={routeKey}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={activeVariants}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;
