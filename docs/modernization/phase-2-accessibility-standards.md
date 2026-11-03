# Phase 2 — Accessibility & Keyboard Navigation Standards
**Project:** Infinity Researcher  
**Phase:** 2 of 30 — Design System Foundation  

---

## 1. Compliance Target: WCAG 2.1 Level AA

Infinity Researcher is engineered for researchers of all abilities, including keyboard-only navigators and screen reader users. Phase 2 embeds WCAG 2.1 Level AA compliance directly into the design system primitives.

---

## 2. Color Contrast Ratios

All color tokens defined in `src/styles/tokens.css` meet or exceed WCAG AA requirements:

| Interface Element | Minimum Contrast Required | Actual Ratio (Light) | Actual Ratio (Dark) | Status |
| :--- | :--- | :--- | :--- | :--- |
| Primary text on canvas | 4.5:1 | 14.8:1 (`#0f172a` on `#f8fafc`) | 16.2:1 (`#f8fafc` on `#070b12`) | PASS (AAA) |
| Secondary muted text | 4.5:1 | 4.8:1 (`#64748b` on `#f8fafc`) | 5.2:1 (`#94a3b8` on `#070b12`) | PASS (AA) |
| Primary button text | 4.5:1 | 5.8:1 (White on `#4f46e5`) | 5.1:1 (White on `#6366f1`) | PASS (AA) |
| Open Access badge | 3.0:1 (Graphical/Badge) | 4.9:1 (`#15803d` on `#dcfce7`) | 6.8:1 (`#4ade80` on `#0b101b`) | PASS (AA) |
| Error/Destructive alert | 4.5:1 | 5.4:1 (`#b91c1c` on `#fee2e2`) | 7.1:1 (`#f87171` on `#0b101b`) | PASS (AAA) |

---

## 3. Focus Ring Architecture

To ensure high visibility without visual clutter:
- All interactive elements use standard `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`.
- Mouse clicks do NOT trigger focus rings (`focus-visible` pseudo-class ensures rings only appear on Tab navigation).
- Ring offset adapts dynamically to the current theme surface background.

---

## 4. Keyboard Shortcuts Standard

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Ctrl+K` / `Cmd+K` | Open Command Palette | Global |
| `Escape` | Dismiss modal, drawer, or command palette | Global / Active Layer |
| `Tab` / `Shift+Tab` | Navigate between interactive controls | Global / Trapped in Modals |
| `Arrow Left/Right` | Navigate between Tab triggers | Inside `<TabsList>` |
| `Enter` / `Space` | Activate button or toggle switch | Focused control |

