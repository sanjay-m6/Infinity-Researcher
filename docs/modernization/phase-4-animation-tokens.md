# Phase 4 — Motion & Animation Tokens Specification

**Project:** Infinity Researcher  
**Phase:** 4 of 30 (Motion Infrastructure & Animation Architecture)  
**Document:** Centralized Motion Tokens, Easing Curves, and Distance Standards  
**Status:** Complete & Verified  

---

## 1. Overview & Token Design Goals

Scholarly desktop applications require precision and responsiveness. Unlike promotional websites, a research workstation must never impose artificial wait times.

The Phase 4 animation token system standardizes:
- **Durations:** 0ms to 300ms maximum.
- **Easings:** Physically natural deceleration curves for elements appearing on screen.
- **Distances:** Subtle 2px to 20px spatial offsets to preserve optical focus.

---

## 2. Duration Tokens

Defined in `src/lib/animations/tokens.ts` (in seconds) and `src/styles/motion.css` (in milliseconds):

| Token Name | TypeScript (`motionDuration`) | CSS (`--motion-duration-*`) | Recommended Usage |
| :--- | :--- | :--- | :--- |
| `instant` | `0s` | `0ms` | Reduced-motion mode, instant resets, immediate status updates |
| `fast` | `0.12s` | `120ms` | Micro-interactions, dropdown appearances, icon rotations, button states |
| `normal` | `0.18s` | `180ms` | Standard component entrances, card appearances, tab content switches |
| `moderate` | `0.24s` | `240ms` | Dialog/modal entrances, floating drawers, multi-step wizards |
| `slow` | `0.30s` | `300ms` | Broad layout rearrangements, full-width canvas shifts |

> [!IMPORTANT]
> No UI animation in Infinity Researcher may exceed `0.30s` (300ms). Lengthy animations impede research flow and produce perceived latency.

---

## 3. Easing Tokens (Cubic Bezier Curves)

All easings are defined as standard 4-point cubic bezier coordinates `[x1, y1, x2, y2]`:

| Token Name | Coordinates | CSS Equivalent | Description & Context |
| :--- | :--- | :--- | :--- |
| `standard` | `[0.2, 0, 0, 1]` | `cubic-bezier(0.2, 0, 0, 1)` | Natural deceleration for settling elements and general state changes |
| `enter` | `[0, 0, 0.2, 1]` | `cubic-bezier(0, 0, 0.2, 1)` | Brisk entrance curve with rapid arrival and gentle landing |
| `exit` | `[0.4, 0, 1, 1]` | `cubic-bezier(0.4, 0, 1, 1)` | Swift exit acceleration for disappearing elements |
| `emphasized` | `[0.2, 0, 0, 1]` | `cubic-bezier(0.2, 0, 0, 1)` | Key user actions (e.g. saving a paper, confirming deletion) |

---

## 4. Spatial Distance Tokens

Spatial movement is kept minimal to avoid disorientation on high-resolution displays:

| Token Name | Pixel Offset (`motionDistance`) | Usage Example |
| :--- | :--- | :--- |
| `xs` | `2px` | Subtle hover lift on secondary action buttons |
| `sm` | `4px` | Dropdown menu appearance, tooltip pop, toast slide |
| `md` | `6px` | Standard card entrance (`subtleEntranceVariants`), list items |
| `lg` | `12px` | Modal dialog entrance (`modalContentVariants`), slide-in banners |
| `xl` | `20px` | Full flyout drawers, floating inspect panels |

---

## 5. Micro-Interaction Spring Configurations

For physical gestures, toggles, and icon state changes:

```typescript
export const motionSpring = {
  snappy: {
    type: "spring",
    stiffness: 400,
    damping: 30,
  },
  gentle: {
    type: "spring",
    stiffness: 260,
    damping: 24,
  },
} as const;
```

---

## 6. CSS Integration (`src/styles/motion.css`)

CSS custom properties are mirrored directly in the global stylesheet:

```css
:root {
  --motion-duration-fast: 120ms;
  --motion-duration-normal: 180ms;
  --motion-duration-moderate: 240ms;
  --motion-duration-slow: 300ms;

  --motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --motion-ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --motion-ease-exit: cubic-bezier(0.4, 0, 1, 1);

  --motion-distance-sm: 4px;
  --motion-distance-md: 6px;
  --motion-distance-lg: 12px;
}
```

---

## 7. Implementation Rules

1. **Token Exclusivity:** Hardcoded numerical animation values (e.g. `duration: 0.5`, `y: 40`) are strictly prohibited in view components. Always import from `@/lib/animations`.
2. **Transform Only:** Animate `transform` (`x`, `y`, `scale`) and `opacity`. Never animate `width`, `height`, `margin`, `padding`, `top`, `left`, or `border-width`.
3. **GPU Layer Promotion:** Apply `.will-change-transform` or `.gpu-accelerated` only to active animated elements, removing them upon animation completion.

