# Phase 2 — Color Tokens Specification
**Project:** Infinity Researcher  
**Phase:** 2 of 30 — Design System Foundation  
**File Reference:** [`src/styles/tokens.css`](file:///d:/Paper/src/styles/tokens.css) & [`src/styles/index.css`](file:///d:/Paper/src/styles/index.css)  

---

## 1. Overview & Token Architecture

Infinity Researcher utilizes a layered token architecture conforming to modern Design Token standards and Tailwind CSS v4 `@theme` mappings. 

Tokens are defined as CSS variables with dual definitions:
1. `:root` for Light Mode
2. `.dark` for Academic Dark Slate Mode

---

## 2. Token Directory

### 2.1 Core Surface & Canvas Tokens

| Token Name | Light Mode Value | Dark Mode Value | Semantic Role |
| :--- | :--- | :--- | :--- |
| `--background` | `hsl(210, 20%, 98%)` | `hsl(222, 47%, 5%)` (`#070b12`) | Root desktop canvas background |
| `--foreground` | `hsl(222, 47%, 11%)` | `hsl(210, 40%, 98%)` | Primary high-contrast body text |
| `--card` | `hsl(0, 0%, 100%)` | `hsl(222, 47%, 8%)` (`#0b101b`) | Card, container, and elevated panel surface |
| `--card-foreground` | `hsl(222, 47%, 11%)` | `hsl(210, 40%, 98%)` | Text within cards and containers |
| `--popover` | `hsl(0, 0%, 100%)` | `hsl(222, 47%, 9%)` | Menus, dropdowns, tooltips, command palette |
| `--popover-foreground` | `hsl(222, 47%, 11%)` | `hsl(210, 40%, 98%)` | Text within popovers |

### 2.2 Brand & Interaction Tokens

| Token Name | Light Mode Value | Dark Mode Value | Semantic Role |
| :--- | :--- | :--- | :--- |
| `--primary` | `hsl(238, 84%, 59%)` (`#4f46e5`) | `hsl(238, 84%, 67%)` (`#6366f1`) | Scholarly indigo primary interactive action |
| `--primary-hover` | `hsl(238, 84%, 50%)` | `hsl(238, 84%, 72%)` | Primary hover state |
| `--primary-foreground` | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` | Text on primary buttons |
| `--secondary` | `hsl(210, 40%, 96.1%)` | `hsl(217, 33%, 17%)` | Subdued secondary interactive controls |
| `--secondary-hover` | `hsl(210, 40%, 90%)` | `hsl(217, 33%, 22%)` | Secondary hover state |
| `--secondary-foreground` | `hsl(222, 47%, 11%)` | `hsl(210, 40%, 98%)` | Text on secondary elements |
| `--accent` | `hsl(210, 40%, 96.1%)` | `hsl(217, 33%, 17%)` | Hover/active states in lists and nav items |
| `--accent-foreground` | `hsl(222, 47%, 11%)` | `hsl(210, 40%, 98%)` | Text on accented items |

### 2.3 Structural & Muted Tokens

| Token Name | Light Mode Value | Dark Mode Value | Semantic Role |
| :--- | :--- | :--- | :--- |
| `--muted` | `hsl(210, 40%, 96.1%)` | `hsl(217, 33%, 17%)` | Subtle background for table headers, disabled tabs |
| `--muted-foreground` | `hsl(215, 16%, 47%)` | `hsl(215, 20%, 65%)` | Secondary captions, timestamps, placeholder text |
| `--border` | `hsl(214, 32%, 91%)` | `hsl(217, 33%, 17%)` | Card borders, table grid lines, separators |
| `--input` | `hsl(214, 32%, 91%)` | `hsl(217, 33%, 17%)` | Form input borders and search input outlines |
| `--ring` | `hsl(238, 84%, 59%)` | `hsl(238, 84%, 67%)` | Focus ring outline for accessible keyboard nav |

### 2.4 Research-Specific State Tokens

| Token Name | Light Mode Value | Dark Mode Value | Domain Semantics |
| :--- | :--- | :--- | :--- |
| `--paper-oa` | `hsl(142, 71%, 45%)` | `hsl(142, 71%, 45%)` | Open Access paper badge & verified status |
| `--paper-oa-bg` | `hsl(142, 76%, 95%)` | `hsla(142, 71%, 45%, 0.12)` | Subtle OA chip background |
| `--paper-restricted`| `hsl(38, 92%, 50%)` | `hsl(38, 92%, 50%)` | Paywalled / institutional access required |
| `--paper-restricted-bg`| `hsl(48, 96%, 89%)` | `hsla(38, 92%, 50%, 0.12)` | Restricted chip background |
| `--task-running` | `hsl(199, 89%, 48%)` | `hsl(199, 89%, 48%)` | Crawling, downloading, or AI extraction active |
| `--task-running-bg` | `hsl(204, 94%, 94%)` | `hsla(199, 89%, 48%, 0.12)` | Task in-progress chip background |
| `--task-completed` | `hsl(142, 71%, 45%)` | `hsl(142, 71%, 45%)` | Job finished, checksum verified |
| `--task-failed` | `hsl(0, 84%, 60%)` | `hsl(0, 84%, 60%)` | HTTP error, network timeout, corrupted stream |
| `--ai-active` | `hsl(270, 75%, 60%)` | `hsl(270, 75%, 65%)` | AI Copilot / LLM synthesis in progress |
| `--ai-active-bg` | `hsl(270, 75%, 95%)` | `hsla(270, 75%, 60%, 0.12)` | AI prompt badge background |

---

## 3. Backward Compatibility Mapping

To preserve existing UI code across the application without breakage, legacy CSS custom properties are mapped directly to their corresponding semantic tokens:

```css
--bg-app: var(--background);
--bg-surface: var(--card);
--bg-surface-elevated: var(--popover);
--border-subtle: var(--border);
--text-primary: var(--foreground);
--text-secondary: var(--muted-foreground);
--accent-primary: var(--primary);
--accent-primary-hover: var(--primary-hover);
```

