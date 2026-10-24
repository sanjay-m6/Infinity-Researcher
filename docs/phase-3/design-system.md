# Phase 3 Design System & UI Specifications

Project: Research Paper Scraper  
Framework: Tailwind CSS v4 + React 19 + TypeScript  
Design Paradigm: Desktop-First, Information-Dense Scholarly Workbench  

---

## 1. Visual Principles & Aesthetic Tokens

The design is engineered as a professional, distraction-free academic workbench. It replaces generic dashboard templates with subtle surface elevations, crisp borders, semantic color signaling, and readable typography.

### 1.1 Color Tokens & Semantic Variables

Semantic tokens are declared in [`src/styles/index.css`](file:///d:/Paper/src/styles/index.css) using CSS custom properties with `@custom-variant dark`:

```css
:root {
  --bg-app: #f8fafc;
  --surface: #ffffff;
  --surface-hover: #f1f5f9;
  --surface-active: #e2e8f0;
  --card: #ffffff;
  --border: #e2e8f0;
  --border-subtle: #f1f5f9;
  --text-main: #0f172a;
  --text-muted: #64748b;
  --primary: #4f46e5;
  --primary-hover: #4338ca;
  --primary-fg: #ffffff;
  --success: #059669;
  --success-bg: #ecfdf5;
  --warning: #d97706;
  --warning-bg: #fffbeb;
  --destructive: #dc2626;
  --destructive-bg: #fef2f2;
}

.dark {
  --bg-app: #090d16;
  --surface: #0f172a;
  --surface-hover: #1e293b;
  --surface-active: #334155;
  --card: #131c31;
  --border: #1e293b;
  --border-subtle: #172338;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --primary-fg: #ffffff;
  --success: #10b981;
  --success-bg: #064e3b;
  --warning: #f59e0b;
  --warning-bg: #451a03;
  --destructive: #ef4444;
  --destructive-bg: #450a0a;
}
```

### 1.2 Typography & Scale
- **Font Stack:** Native system font hierarchy (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`) to ensure instant zero-latency loading without external webfont network calls.
- **Sizes & Weights:**
  - `text-xl sm:text-2xl font-bold`: Page Titles
  - `text-base font-semibold`: Modal titles, paper titles in detail drawer
  - `text-sm font-semibold`: Card headings, paper row titles
  - `text-xs text-slate-500`: Metadata, authors, publication dates, journal venues
  - `font-mono text-xs`: DOIs, version numbers, timestamps, and citation keys

---

## 2. Reusable UI Components

| Component | Path | Description & Props |
| :--- | :--- | :--- |
| **Button** | [`src/components/ui/Button.tsx`](file:///d:/Paper/src/components/ui/Button.tsx) | Variants: `primary`, `secondary`, `outline`, `ghost`, `destructive`. Sizes: `sm`, `md`, `lg`, `icon`. Supports `isLoading` with animated spinner and visible focus ring. |
| **Badge** | [`src/components/ui/Badge.tsx`](file:///d:/Paper/src/components/ui/Badge.tsx) | Semantic statuses: `default`, `primary`, `success`, `warning`, `destructive`, `info`, `outline`. |
| **Input** | [`src/components/ui/Input.tsx`](file:///d:/Paper/src/components/ui/Input.tsx) | Standard text input with floating label, helper text, inline error state, and icon support. |
| **SearchInput** | [`src/components/ui/SearchInput.tsx`](file:///d:/Paper/src/components/ui/SearchInput.tsx) | Includes search magnifying glass, clear button (`X`), and keyboard shortcut badge (`/` or `Ctrl+K`). |
| **Modal** | [`src/components/ui/Modal.tsx`](file:///d:/Paper/src/components/ui/Modal.tsx) | Accessible dialog with `aria-modal="true"`, backdrop blur, `Escape` key listener, and focus trapping. |
| **ConfirmDialog** | [`src/components/ui/ConfirmDialog.tsx`](file:///d:/Paper/src/components/ui/ConfirmDialog.tsx) | Specialized confirmation dialog with warning icon, confirm CTA, and cancel button. |
| **Drawer** | [`src/components/ui/Drawer.tsx`](file:///d:/Paper/src/components/ui/Drawer.tsx) | Slide-over side panel for Paper Details and Source Details with `Escape` listener and smooth transition. |
| **EmptyState** | [`src/components/ui/EmptyState.tsx`](file:///d:/Paper/src/components/ui/EmptyState.tsx) | Centered illustration/icon, title, explanation, and primary action CTA. |
| **CommandPalette** | [`src/components/ui/CommandPalette.tsx`](file:///d:/Paper/src/components/ui/CommandPalette.tsx) | Fast global search popup for keyboard-centric researchers (`Ctrl+K` / `Cmd+K`). |
| **ToastContainer** | [`src/components/ui/ToastContainer.tsx`](file:///d:/Paper/src/components/ui/ToastContainer.tsx) | Dispatches non-intrusive floating feedback for user operations. |

---

## 3. Layout Sizing & Window Responsiveness

Target desktop dimensions verified:
- **1440 × 900 (Primary Target):** Full two-column and three-column layouts, expanded sidebar (`w-60`), complete metadata grids.
- **1280 × 720 (Standard Laptop):** Fluid container wrapping (`max-w-7xl mx-auto`), table horizontal internal scrolling where columns exceed viewport.
- **1024 × 768 (Narrow Window):** Sidebar collapsible to compact rail (`w-16`), multi-column cards collapse gracefully to 1 or 2 columns, zero horizontal application scroll.

---

## 4. Accessibility Compliance (WCAG 2.2 AA)

1. **Semantic Landmarks:** Uses `<header>`, `<aside>`, `<nav aria-label="Main Navigation">`, `<main id="main-content">`, `<section>`, and `<dialog>`.
2. **Contrast Standards:** All text, badges, borders, and button labels satisfy minimum 4.5:1 contrast ratios in both light and dark themes.
3. **Keyboard Operability:**
   - `Ctrl+K` opens the Command Palette from anywhere in the app.
   - `Escape` dismisses modals, drawers, and the command palette.
   - Visible `focus-visible:ring-2 focus-visible:ring-indigo-500` rings on all interactive elements.
4. **No Dead Controls:** Every visible interactive button performs an immediate client-side action or is visibly disabled with a tooltip explaining its planned phase.
