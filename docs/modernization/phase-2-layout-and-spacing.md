# Phase 2 — Layout, Spacing, and Responsive Standards
**Project:** Infinity Researcher  
**Phase:** 2 of 30 — Design System Foundation  

---

## 1. Application Shell Structure

Infinity Researcher runs as a desktop application framed inside a fixed viewport shell:

```
+-------------------------------------------------------------------------------+
| Window TitleBar (Drag region, Window Controls: Minimize / Maximize / Close)   |
+-------------------+-----------------------------------------------------------+
| Sidebar           | Main Canvas                                               |
| (Primary +        | +-------------------------------------------------------+ |
|  Secondary        | | Toolbar (Global Search, Diagnostics, Profile Menu)    | |
|  Navigation       | +-------------------------------------------------------+ |
|  Columns)         | | Active View Workspace                                 | |
|                   | | (Discover / Library / Review Matrix / Integrity etc.) | |
|                   | +-------------------------------------------------------+ |
+-------------------+-----------------------------------------------------------+
| BottomBar (Status indicators, Python Engine, DB Health, Sync Telemetry)       |
+-------------------------------------------------------------------------------+
```

---

## 2. Shell Dimension Tokens

Defined as standardized CSS variables in [`src/styles/tokens.css`](file:///d:/Paper/src/styles/tokens.css):

```css
--titlebar-height: 2.25rem;       /* 36px */
--bottombar-height: 1.75rem;      /* 28px */
--sidebar-width: 16rem;           /* 256px expanded */
--sidebar-collapsed-width: 4rem;  /* 64px collapsed icon mode */
```

---

## 3. Spacing System (4px Base Grid)

The spacing scale strictly follows a 4px geometric progression:

| Token | Pixels | Rem Equivalent | Primary Application |
| :--- | :--- | :--- | :--- |
| `p-1` / `gap-1` | 4px | 0.25rem | Tight badge padding, micro status icons |
| `p-2` / `gap-2` | 8px | 0.5rem | Button internal padding, toolbar icon gaps |
| `p-3` / `gap-3` | 12px | 0.75rem | Compact card padding, list item vertical rhythm |
| `p-4` / `gap-4` | 16px | 1.0rem | Standard card internal padding, grid column gap |
| `p-6` / `gap-6` | 24px | 1.5rem | Page container padding, modal body spacing |
| `p-8` / `gap-8` | 32px | 2.0rem | Dashboard section vertical rhythm |

---

## 4. Radii & Surface Elevation Standards

- `--radius-sm`: `0.25rem` (4px) — Chips, micro tags
- `--radius-md`: `0.5rem` (8px) — Buttons, form inputs, badges
- `--radius-lg`: `0.75rem` (12px) — Cards, dropdown menus, modals
- `--radius-xl`: `1rem` (16px) — Elevated feature drawers, dialog windows
- `--radius-full`: `9999px` — Avatars, pill badges, switch thumb

