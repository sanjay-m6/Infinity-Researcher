import { useState, useEffect } from "react";
import { useReducedMotion } from "motion/react";
import { isReducedMotionPreferred } from "../lib/animations/animation-utils";

/**
 * Hook providing reactive reduced-motion preference detection.
 * Respects OS settings and provides real-time event updates.
 */
export function useReducedMotionPreference(): boolean {
  // Motion for React built-in hook
  const motionReduced = useReducedMotion();

  // Local state for dynamic MediaQueryList change events
  const [osReduced, setOsReduced] = useState<boolean>(() => {
    return isReducedMotionPreferred();
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    try {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setOsReduced(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        setOsReduced(e.matches);
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    } catch {
      // Graceful fallback for non-standard environments
    }
  }, []);

  // Return true if either Motion's internal hook or the window media query signals reduced motion
  return Boolean(motionReduced || osReduced);
}

export default useReducedMotionPreference;
