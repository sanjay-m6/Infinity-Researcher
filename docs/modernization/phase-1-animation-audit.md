# Phase 1: Existing Animation Audit and Motion for React Roadmap

This audit inspects all animations, transitions, and dynamic visual states across **Infinity Researcher**, establishing the migration path to **Motion for React** (`motion/react`).

---

## 1. Existing Animation Implementations

| File Location | Animation Trigger & Purpose | Technology Used | Performance & Behavior Impact | Refactoring Strategy |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/layout/AppShell.tsx` (Lines 63-76) | Page transition when `activeSection` switches. Fades in and slides up 6px. | **GSAP** (`gsap.fromTo`) | Imperative DOM manipulation via React ref. Non-declarative; cannot animate exit state. | **Replace with Motion**: Use `<AnimatePresence mode="wait">` and `<motion.div>` for declarative enter/exit transitions. |
| `src/components/ui/Skeleton.tsx` | Pulsing background for placeholder cards and text lines while loading. | Tailwind CSS (`animate-pulse`) | GPU-accelerated CSS keyframe opacity loop (0.5 to 1.0). Zero JS thread overhead. | **Retain**: Highly performant, standard shadcn pattern. |
| `src/features/discover/DiscoverView.tsx` | Spinning icons for searching academic sources and downloading. | Lucide + Tailwind (`animate-spin`) | CSS rotational keyframe animation. | **Standardize**: Retain for ongoing actions; replace static spinners with animated Lucide icons where applicable. |
| `src/components/layout/Sidebar.tsx` | Expanding and collapsing secondary category panel. | CSS `transition-all duration-300` | Smooth width change (16rem to 4.5rem). Can cause slight text reflow. | **Enhance with Motion**: Apply spring physics (`transition={{ type: "spring", stiffness: 300, damping: 30 }}`) for desktop-fluid feel. |
| `src/components/pdf-viewer/EmbeddedPdfViewer.tsx` | Modal backdrop fade-in. | Tailwind CSS (`animate-in fade-in duration-150`) | CSS keyframe opacity. | **Enhance with Motion**: Add subtle zoom-in (`scale: 0.98 -> 1.0`) on modal dialog content. |
| `src/features/writing-workspace/AcademicWritingWorkspaceView.tsx` | Diff insertion/deletion pill highlights. | CSS transitions | Instant DOM replacement when revision is applied. | **Enhance with Motion**: Add `layout` animations so reworded sentences smoothly reflow. |
| `src/features/review-matrix/ReviewMatrixView.tsx` | Row selection and cell expansion. | Static state toggles | Abrupt height jump when cell evidence quote expands. | **Enhance with Motion**: Smooth height transition with `animate={{ height: "auto" }}`. |

---

## 2. Issues with Current Imperative Animation Setup

1. **GSAP vs React 19 Concurrent Reconciliation**:
   - `gsap.fromTo` mutates DOM element inline styles (`transform: translateY(...)`, `opacity`) outside of React's render loop.
   - Requires manual cleanup (`clearProps: "transform"`) to avoid interfering with flexbox layouts.
2. **Missing Exit Animations**:
   - Modals, drawers, and notifications abruptly disappear when unmounted because native React unmounting bypasses CSS transitions unless wrapped in lifecycle helpers.
3. **No Gesture Physics**:
   - Buttons and interactive cards have simple CSS `:hover` and `:active` pseudo-classes without spring momentum, tactile feedback, or gesture cancellation.
4. **No Reduced-Motion Safeguards**:
   - Current animations lack `@media (prefers-reduced-motion: reduce)` overrides, which can disorient users with vestibular sensitivities.

---

## 3. Motion for React (`motion/react`) Target Architecture (Phase 3)

### Installation & Import:
```bash
npm install motion
npm uninstall gsap
```
```tsx
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
```

### Core Modernization Patterns:

#### A. Page Transitions with `<AnimatePresence>`:
```tsx
const shouldReduceMotion = useReducedMotion();

<AnimatePresence mode="wait">
  <motion.div
    key={activeSection}
    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
    transition={{ duration: 0.18, ease: "easeOut" }}
    className="flex-1 w-full h-full"
  >
    {renderActiveScreen()}
  </motion.div>
</AnimatePresence>
```

#### B. Tactile Micro-Interactions:
```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
  className="btn-primary"
>
  Start Discovery
</motion.button>
```

#### C. Shared Layout Transitions (Active Tab Indicators):
```tsx
{isActive && (
  <motion.div
    layoutId="active-nav-indicator"
    className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
    transition={{ type: "spring", stiffness: 350, damping: 30 }}
  />
)}
```

---

## 4. Animation Performance Guidelines

1. **Composite-Only Properties**: Animate strictly `transform` and `opacity` to avoid triggering browser layout recalculations and repaints.
2. **GPU Acceleration**: Always ensure hardware acceleration on complex lists via `will-change: transform`.
3. **Strict Accessibility**: Always honor user's operating system preferences via `useReducedMotion()`.

