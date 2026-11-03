# Phase 2 — Typography Specification
**Project:** Infinity Researcher  
**Phase:** 2 of 30 — Design System Foundation  

---

## 1. Font Family Stacks

Infinity Researcher uses a clean, high-legibility typographic stack optimized for academic density, complex formula reading, and desktop windowing:

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
```

- **Sans Stack (`--font-sans`):** Used for application navigation, toolbars, metadata chips, modal dialogues, and tabular metrics.
- **Mono Stack (`--font-mono`):** Used for DOIs, checksums, Python log outputs, BibTeX exports, and raw extraction streams.

---

## 2. Type Scale & Hierarchy

| Semantic Token | Font Size | Line Height | Tracking | Weight | Common Application |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `text-3xl` | `1.875rem` (30px) | `2.25rem` (36px) | `-0.025em` | 700 (Bold) | Dashboard welcome, major section headers |
| `text-2xl` | `1.5rem` (24px) | `2rem` (32px) | `-0.02em` | 700 (Bold) | Paper title in PDF viewer & reading drawer |
| `text-xl` | `1.25rem` (20px) | `1.75rem` (28px) | `-0.015em` | 600 (Semibold) | Modal headers, feature workspace titles |
| `text-lg` | `1.125rem` (18px) | `1.75rem` (28px) | `-0.01em` | 600 (Semibold) | Card titles, column headers in matrix |
| `text-base` | `1rem` (16px) | `1.5rem` (24px) | `0em` | 400 (Regular) | Primary manuscript body, abstract paragraphs |
| `text-sm` | `0.875rem` (14px) | `1.25rem` (20px) | `0em` | 400 / 500 | Standard UI text, buttons, table cell content |
| `text-xs` | `0.75rem` (12px) | `1rem` (16px) | `+0.01em` | 500 (Medium) | Metadata labels, timestamp chips, sidebar sub-items |
| `text-[10px]` | `0.625rem` (10px) | `0.875rem` (14px) | `+0.02em` | 600 (Semibold) | Mini status badges, keyboard shortcut hints (Ctrl+K) |

---

## 3. Typographic Readability Standards

For academic readability and eye fatigue reduction during extended literature reviews:
- **Max Prose Line Width:** In reading panes and abstract cards, `max-w-prose` (65ch) is enforced to ensure optimal reading cadence.
- **Tabular Figures:** Numbers in metrics cards, crawl progress counters, and matrix cells use `tabular-nums` to eliminate layout jitter during live updates.
- **Heading Line Clamping:** Paper titles in compact grid/list views use `line-clamp-2` with full tooltips on hover to prevent card height blowouts.

