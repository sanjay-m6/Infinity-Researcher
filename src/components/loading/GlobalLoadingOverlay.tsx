/**
 * GlobalLoadingOverlay — Full-screen particle loading experience
 * for application startup and major workspace transitions.
 *
 * Displays the 3D particle morphing animation with status messages
 * connected to real initialization events.
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ParticleField } from "./ParticleField";
import { useReducedMotionPreference } from "../../hooks/use-reduced-motion-preference";
import { LiveOrb } from "../ui/live-orb";

export interface GlobalLoadingOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Current initialization status message */
  statusMessage?: string;
  /** Optional sub-status for additional detail */
  subMessage?: string;
  /** Error state — stops animation, shows retry */
  error?: string | null;
  /** Retry callback when error occurs */
  onRetry?: () => void;
  /** Variant: 'startup' for full-screen, 'workspace' for contained */
  variant?: "startup" | "workspace";
}

export const GlobalLoadingOverlay: React.FC<GlobalLoadingOverlayProps> = ({
  visible,
  statusMessage = "Preparing your research workspace",
  subMessage,
  error = null,
  onRetry,
  variant = "startup",
}) => {
  const reducedMotion = useReducedMotionPreference();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="global-loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.05 : 0.4 }}
          className={`fixed inset-0 z-[200] flex flex-col items-center justify-center ${
            variant === "startup" ? "bg-[#030508]" : "bg-[#030508]/95 backdrop-blur-sm"
          }`}
          role="status"
          aria-live="polite"
          aria-label={error ? `Loading failed: ${error}` : statusMessage}
        >
          {/* Particle Scene */}
          <div className={`relative ${variant === "startup" ? "w-full h-full" : "w-full h-full max-w-3xl max-h-[70vh]"}`}>
            <ParticleField
              active={!error}
              reducedMotion={reducedMotion}
              variant="full"
              speed={error ? 0 : 0.8}
              opacity={error ? 0.3 : 1.0}
              className="absolute inset-0"
            />

            {/* Status Content — centered over particle field */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-[18vh] pointer-events-none">
              <div className="pointer-events-auto text-center space-y-3 max-w-sm px-6">
                {/* Animated AI Avatar Emblem */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="flex justify-center mb-2"
                >
                  <LiveOrb size={80} interactive blink variant="webgl" className="shadow-2xl" />
                </motion.div>

                {/* App Identity */}
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="text-lg font-bold text-white tracking-tight"
                >
                  Infinity Researcher
                </motion.h1>

                {/* Status Message */}
                {!error && (
                  <motion.div
                    key={statusMessage}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-1"
                  >
                    <p className="text-[13px] text-slate-400 font-medium">{statusMessage}</p>
                    {subMessage && (
                      <p className="text-[11px] text-slate-500">{subMessage}</p>
                    )}
                    {/* Subtle progress dots */}
                    <div className="flex items-center justify-center gap-1.5 pt-2">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1 h-1 rounded-full bg-slate-500"
                          animate={reducedMotion ? {} : {
                            opacity: [0.3, 1, 0.3],
                            scale: [0.8, 1.2, 0.8],
                          }}
                          transition={{
                            duration: 1.4,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Error State */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto">
                      <span className="text-lg">⚠️</span>
                    </div>
                    <p className="text-sm text-red-300 font-medium">Initialization failed</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalLoadingOverlay;

