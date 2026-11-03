/**
 * PageLoadingView — Compact particle loading indicator for
 * route/workspace transitions and major data loading states.
 *
 * Uses a smaller particle cluster instead of the full-screen overlay.
 * Suitable for in-view loading states where the app shell remains visible.
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { useReducedMotionPreference } from "../../hooks/use-reduced-motion-preference";
import { LiveOrb } from "../ui/live-orb";

export interface PageLoadingViewProps {
  /** Whether loading is active */
  visible: boolean;
  /** Status message */
  message?: string;
  /** Additional CSS class */
  className?: string;
}

export const PageLoadingView: React.FC<PageLoadingViewProps> = ({
  visible,
  message = "Loading",
  className = "",
}) => {
  const reducedMotion = useReducedMotionPreference();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.05 : 0.25 }}
          className={`flex flex-col items-center justify-center py-16 space-y-6 ${className}`}
          role="status"
          aria-live="polite"
        >
          {/* Compact particle cluster */}
          <div className="relative w-20 h-20">
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const radius = 20 + (i % 3) * 8;
              const size = 2 + (i % 4);
              return (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: size,
                    height: size,
                    left: "50%",
                    top: "50%",
                    background:
                      i % 3 === 0
                        ? "rgba(129, 140, 248, 0.7)"
                        : i % 3 === 1
                        ? "rgba(226, 232, 240, 0.6)"
                        : "rgba(167, 139, 250, 0.5)",
                  }}
                  animate={
                    reducedMotion
                      ? {
                          x: Math.cos(angle) * radius - size / 2,
                          y: Math.sin(angle) * radius - size / 2,
                          opacity: [0.3, 0.7, 0.3],
                        }
                      : {
                          x: [
                            Math.cos(angle) * radius - size / 2,
                            Math.cos(angle + 0.5) * (radius + 4) - size / 2,
                            Math.cos(angle) * radius - size / 2,
                          ],
                          y: [
                            Math.sin(angle) * radius - size / 2,
                            Math.sin(angle + 0.5) * (radius + 4) - size / 2,
                            Math.sin(angle) * radius - size / 2,
                          ],
                          opacity: [0.2, 0.8, 0.2],
                          scale: [0.7, 1.2, 0.7],
                        }
                  }
                  transition={{
                    duration: 2.5 + (i % 3) * 0.5,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: "easeInOut",
                  }}
                />
              );
            })}
            {/* Center Live Orb */}
            <div className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none">
              <LiveOrb size={36} interactive blink variant="webgl" className="shadow-md" />
            </div>
          </div>

          {/* Message */}
          {message && (
            <motion.p
              key={message}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-slate-500 dark:text-slate-400 font-medium"
            >
              {message}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PageLoadingView;

