import { flushSync } from "react-dom";
import { ThemePreference, ResolvedTheme, ThemeSplashOrigin } from "../types/theme";
import {
  resolveTheme,
  applyThemeToDocument,
  persistThemePreference,
} from "./theme-persistence";

export interface ExecuteThemeSplashOptions {
  /**
   * The origin of the circular ripple/splash.
   * Can be a MouseEvent, an HTMLElement, explicit {clientX, clientY}, or null/undefined.
   */
  origin?: ThemeSplashOrigin;
  /**
   * Callback to synchronously update React state (e.g. setThemeState).
   */
  onThemeChange?: (newTheme: ThemePreference) => void;
  /**
   * Duration of the circular reveal animation in milliseconds (defaults to 450ms).
   */
  duration?: number;
}

/**
 * Extracts viewport pixel coordinates (x, y) from an origin argument.
 * Defaults to the center of the viewport if no origin is provided or coordinates are 0.
 */
export function getSplashCoordinates(origin?: ThemeSplashOrigin): {
  x: number;
  y: number;
} {
  const fallbackX = typeof window !== "undefined" ? window.innerWidth / 2 : 0;
  const fallbackY = typeof window !== "undefined" ? window.innerHeight / 2 : 0;

  if (!origin || typeof window === "undefined") {
    return { x: fallbackX, y: fallbackY };
  }

  // 1. Direct DOM Element
  if (origin instanceof HTMLElement) {
    const rect = origin.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  // 2. React or Native Event with currentTarget
  if ("currentTarget" in origin && origin.currentTarget instanceof HTMLElement) {
    // If clientX/Y are provided and non-zero, prefer exact click position
    if (
      "clientX" in origin &&
      typeof origin.clientX === "number" &&
      (origin.clientX !== 0 || origin.clientY !== 0)
    ) {
      return { x: origin.clientX, y: origin.clientY };
    }
    const rect = origin.currentTarget.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  // 3. Object with clientX and clientY
  if (
    "clientX" in origin &&
    "clientY" in origin &&
    typeof origin.clientX === "number" &&
    typeof origin.clientY === "number"
  ) {
    if (origin.clientX === 0 && origin.clientY === 0) {
      return { x: fallbackX, y: fallbackY };
    }
    return { x: origin.clientX, y: origin.clientY };
  }

  return { x: fallbackX, y: fallbackY };
}

/**
 * Executes a circular splash effect when changing themes.
 *
 * Utilizes the native View Transitions API with circular clip-path animation
 * on `::view-transition-new(root)`. In environments without View Transitions,
 * it applies the theme immediately and triggers an overlay splash ripple.
 */
export async function executeThemeSplash(
  newTheme: ThemePreference,
  options?: ExecuteThemeSplashOptions
): Promise<void> {
  const onThemeChange = options?.onThemeChange;
  const duration = options?.duration ?? 450;
  const targetResolved: ResolvedTheme = resolveTheme(newTheme);

  // Check user preference for reduced motion
  const isReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Check if browser/webview supports document.startViewTransition
  const hasViewTransition =
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    typeof (document as any).startViewTransition === "function" &&
    !isReducedMotion;

  // 1. Fallback for reduced motion or missing View Transitions API
  if (!hasViewTransition) {
    applyThemeToDocument(targetResolved);
    onThemeChange?.(newTheme);
    void persistThemePreference(newTheme);

    // Optional visual ripple fallback for environments lacking View Transitions
    if (!isReducedMotion && typeof document !== "undefined") {
      triggerFallbackRipple(options?.origin, targetResolved);
    }
    return;
  }

  // 2. Compute circular splash center and radius
  const { x, y } = getSplashCoordinates(options?.origin);
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  document.documentElement.classList.add("theme-transitioning");

  try {
    const transition = (document as any).startViewTransition(() => {
      flushSync(() => {
        applyThemeToDocument(targetResolved);
        onThemeChange?.(newTheme);
      });
    });

    await transition.ready;

    // Animate the incoming theme snapshot expanding outward from (x, y)
    const animation = document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
        pseudoElement: "::view-transition-new(root)",
      }
    );

    await animation.finished;
  } catch {
    // If the transition is skipped/aborted by a subsequent change, ensure state is clean
    applyThemeToDocument(targetResolved);
    onThemeChange?.(newTheme);
  } finally {
    document.documentElement.classList.remove("theme-transitioning");
    void persistThemePreference(newTheme);
  }
}

/**
 * Lightweight expanding ripple overlay for engines where startViewTransition is unsupported.
 */
function triggerFallbackRipple(
  origin: ThemeSplashOrigin | undefined,
  resolved: ResolvedTheme
): void {
  try {
    const { x, y } = getSplashCoordinates(origin);
    const ripple = document.createElement("div");
    ripple.className = "fixed pointer-events-none rounded-full z-[99999]";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.width = "20px";
    ripple.style.height = "20px";
    ripple.style.transform = "translate(-50%, -50%) scale(1)";
    ripple.style.backgroundColor =
      resolved === "dark" ? "rgba(11, 16, 27, 0.4)" : "rgba(255, 255, 255, 0.4)";
    ripple.style.boxShadow =
      resolved === "dark"
        ? "0 0 40px rgba(99, 102, 241, 0.4)"
        : "0 0 40px rgba(245, 158, 11, 0.4)";
    ripple.style.transition =
      "transform 400ms cubic-bezier(0.2, 0, 0, 1), opacity 400ms ease-out";
    ripple.style.opacity = "1";

    document.body.appendChild(ripple);

    // Force layout reflow
    void ripple.offsetWidth;

    ripple.style.transform = "translate(-50%, -50%) scale(80)";
    ripple.style.opacity = "0";

    setTimeout(() => {
      ripple.remove();
    }, 450);
  } catch {
    // Non-critical fallback
  }
}
