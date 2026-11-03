import React, { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { useReducedMotionPreference } from "../../hooks/use-reduced-motion-preference";

export interface ReducedMotionProviderProps {
  children: ReactNode;
  /**
   * Override reduced-motion behavior manually (e.g. from user accessibility settings).
   * If omitted, inherits from the host operating system preference.
   */
  reducedMotion?: "user" | "always" | "never";
}

/**
 * Top-level provider that configures Motion for React's reduced-motion policy.
 * Defaults to "user" (respecting system preferences).
 */
export const ReducedMotionProvider: React.FC<ReducedMotionProviderProps> = ({
  children,
  reducedMotion,
}) => {
  const isReduced = useReducedMotionPreference();
  const policy = reducedMotion ?? (isReduced ? "always" : "user");

  return <MotionConfig reducedMotion={policy}>{children}</MotionConfig>;
};

export default ReducedMotionProvider;
