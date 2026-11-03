# Phase 8 — Page Transition Architecture

## 1. Overview

The page transition system in Infinity Researcher provides restrained, responsive, and hardware-accelerated view transitions across all 24 scholarly workspaces.

```
                    Navigation Action (activeSection change)
                                      │
                                      ▼
                      Does route opt out of transition?
                                     ╱ ╲
                               YES  ╱   ╲  NO
                                   ▼     ▼
                <div data-slot="opt-out">  <AnimatePresence mode="wait">
                       (Immediate)                     │
                                                       ▼
                                          <motion.div data-slot="page-transition">
                                            ├── Exit: opacity 1 -> 0, y: 0 -> -2px (120ms)
                                            └── Enter: opacity 0 -> 1, y: 4px -> 0 (180ms)
                                                       │
                                          Reduced Motion Preference Active?
                                            ├── YES: duration 0s, y: 0 (Immediate)
                                            └── NO: standard 180ms curve
```

## 2. Shared Transition Tokens & Curves

The transition system strictly follows centralized motion tokens defined in Phase 4:

| Parameter | Normal Motion | Reduced Motion (`prefers-reduced-motion`) | Easing Curve |
|---|---|---|---|
| **Entrance Duration** | `180ms` (`motionDuration.normal`) | `0ms` (`motionDuration.instant`) | `motionEase.enter` (`[0, 0, 0.2, 1]`) |
| **Exit Duration** | `120ms` (`motionDuration.fast`) | `0ms` (`motionDuration.instant`) | `motionEase.exit` (`[0.4, 0, 1, 1]`) |
| **Entrance Offset** | `+4px` (`motionDistance.sm`) | `0px` | Natural deceleration |
| **Exit Offset** | `-2px` (`motionDistance.xs`) | `0px` | Swift acceleration |

## 3. `<PageTransition>` Component API

Located at `src/components/animation/PageTransition.tsx`:

```tsx
export interface PageTransitionProps {
  /** The child page or view content to render */
  children: ReactNode;
  /** Unique key representing the active route/workspace (e.g., activeSection) */
  routeKey: string;
  /** Optional layout CSS classes */
  className?: string;
  /** Whether this route opts out of animated translations (default: false) */
  optOut?: boolean;
}
```

### Component Contract
1. **Renders Semantic Markers**: Attaches `data-slot="page-transition"` and `data-route={routeKey}` for automated validation and DOM introspection.
2. **Accessible by Default**: Detects user motion preferences via `useReducedMotionPreference()`, substituting zero-duration / zero-motion variants without requiring per-page logic.
3. **Interruption Resilience**: Handled cleanly by Motion for React's `AnimatePresence mode="wait"` without dangling timers, memory leaks, or click-blocking overlays.
4. **Zero-Displacement Opt-Out**: Routes with `optOut={true}` render inside a lightweight wrapper with `data-slot="page-transition-opt-out"` to preserve table virtualization and multi-pane split layouts.

