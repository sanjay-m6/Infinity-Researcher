import React, { ReactNode } from "react";
import { AnimatePresence, AnimatePresenceProps } from "motion/react";

export interface AnimatedPresenceComponentProps extends AnimatePresenceProps {
  children?: ReactNode;
}

/**
 * Production wrapper around Motion's AnimatePresence.
 * Defaults initial={false} to prevent disruptive animations during component mount.
 */
export const AnimatedPresence: React.FC<AnimatedPresenceComponentProps> = ({
  children,
  initial = false,
  mode = "sync",
  ...props
}) => {
  return (
    <AnimatePresence initial={initial} mode={mode} {...props}>
      {children}
    </AnimatePresence>
  );
};

export default AnimatedPresence;
