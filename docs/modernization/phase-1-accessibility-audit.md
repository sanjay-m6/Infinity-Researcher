# Phase 1: Accessibility (a11y) and Inclusive Design Audit

This audit evaluates the accessibility posture of **Infinity Researcher** against the **WCAG 2.1 Level AA** standards and the **WAI-ARIA Authoring Practices Guide (APG)**.

---

## 1. Accessibility Baseline Evaluation

| Accessibility Criterion | Current Status | Findings & Identified Deficiencies | Remediation Action Plan |
| :--- | :--- | :--- | :--- |
| **Keyboard Navigation** | **Partial** | Most buttons and links are navigable via `Tab`. However, modal dialogs do not consistently trap focus inside the dialog, allowing focus to escape into the background canvas. | Wrap modals in Radix Dialog primitive with automated focus trapping and initial focus setting. |
| **Focus Visibility** | **Needs Improvement** | Focus rings rely on default browser outlines or are suppressed via `focus:outline-none` without replacing them with accessible custom rings. | Standardize `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` on all interactive elements. |
| **Screen-Reader Labels** | **Partial** | Several icon-only buttons (such as PDF zoom controls, table action triggers, and window controls) lack explicit `aria-label` or `title` attributes. | Add descriptive `aria-label` to all icon-only buttons (e.g. `aria-label="Zoom in document"`). |
| **Color Contrast (WCAG AA)**| **Good** | Standard text (`#0f172a` on `#ffffff` = 15.4:1; `#f8fafc` on `#070b12` = 17.8:1) passes comfortably. Muted text (`#64748b` on `#ffffff` = 4.6:1) meets the 4.5:1 minimum threshold. | Maintain high-contrast ratios in all new Phase 2 semantic color tokens. |
| **Semantic Heading Structure**| **Good** | Views use structured `h1` -> `h2` -> `h3` hierarchy for main page sections. | Ensure markdown renderers in AI chat and reports adhere to valid heading levels. |
| **Live Region Announcements**| **Needs Improvement** | Search streaming results and download progress update visually, but screen readers are not notified when papers arrive. | Add `aria-live="polite"` and `role="status"` containers for streaming search counts and job completions. |
| **Reduced Motion Support** | **Missing** | Current GSAP and CSS animations run regardless of the user's OS reduced-motion preference. | Implement `useReducedMotion()` in Motion for React to disable spatial translation when requested. |

---

## 2. Reduced Motion Strategy (Phase 3 & 4)

When a user enables "Reduce Motion" in Windows or macOS settings:
1. **Never Disable Information**: Progress indicators and state changes must remain visible.
2. **Replace Spatial Translation with Instant or Subtle Opacity Fades**:
   - Standard mode: `initial={{ opacity: 0, y: 10 }}`, `animate={{ opacity: 1, y: 0 }}`
   - Reduced motion mode: `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}` (duration: 0.1s)
3. **Disable Infinite Continuous Looping**:
   - Replace continuous spinning loaders with static status icons accompanied by clear textual labels.

---

## 3. Keyboard Shortcut Standards

- `Ctrl+K` / `Cmd+K`: Open global Command Palette.
- `Escape`: Close active modal, drawer, or embedded PDF reader.
- `Enter` / `Space`: Activate focused button or expand list item.
- `Arrow Up` / `Arrow Down`: Navigate command palette results and suggestion lists.
- `Ctrl+F` / `Cmd+F` (inside PDF Viewer): Focus internal document search field.

