# Phase 5 — Component Library Inventory & Standardization Matrix

**Project:** Infinity Researcher  
**Phase:** 5 of 30 (Global Component Library Modernization)  
**Document:** Component Inventory, Audit, and Architecture Specification  
**Status:** Complete & Verified  

---

## 1. Executive Summary

Phase 5 unifies and standardizes the shared UI components across Infinity Researcher, transitioning scattered ad-hoc styles into a consistent design-token-driven component library. The primitives follow shadcn/ui architectural conventions, strict WCAG 2.1 AA accessibility guidelines, Phase 2 design system tokens, and Phase 4 Motion for React animation standards.

---

## 2. Component Categorization & Inventory

### 2.1 Foundational UI Primitives (`src/components/ui/`)

| Component | Status | Source / Type | Public Props & Variants | Notes & Adoption |
| :--- | :--- | :--- | :--- | :--- |
| `Button` | Standardized | Native / shadcn | `variant`: default, primary, secondary, outline, ghost, destructive, link; `size`: xs, sm, default, md, lg, icon; `isLoading` | Preserves refs, `aria-busy`, and keyboard navigation. |
| `Input` | Standardized | Native / shadcn | `label`, `error`, `helperText`, `leadingIcon`, `trailingIcon`, semantic tokens | Aligned with theme tokens; removed hardcoded colors. |
| `SearchInput` | Standardized | Composite | `onClear`, `shortcutHint`, semantic tokens | Used in query search and library filtering. |
| `Textarea` | Standardized | Native / shadcn | `label`, `error`, `helperText`, `rows` | Supports expandable scholarly text editing. |
| `Label` | Standardized | Native / shadcn | `required`, `htmlFor`, peer-disabled styling | Accessible form control labeling. |
| `Checkbox` | **New** | shadcn / Radix-like | `checked`, `onCheckedChange`, `label`, `description` | Accessible `role="checkbox"`, Space/Enter toggling. |
| `Select` | **New** | Native / shadcn | `options`, `label`, `error`, `helperText` | Native select wrapper with custom chevron & focus ring. |
| `RadioGroup` | **New** | Compound | `RadioGroup`, `RadioGroupItem` (`role="radiogroup"`) | Keyboard arrow navigation and screen reader labels. |
| `Switch` | Standardized | shadcn | `checked`, `onCheckedChange`, `label`, `description` | Spring-animated toggle for binary preferences. |
| `Card` | Standardized | Compound | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Semantic design tokens (`bg-card text-card-foreground`). |
| `Badge` | Standardized | shadcn / Custom | `default`, `primary`, `secondary`, `success`, `warning`, `destructive`, `info`, `outline`, `open-access`, `saved` | High-density status chips. |
| `Progress` | Standardized | Radix-like | `value`, `max`, `indeterminate` | Real task progress visualization. |
| `Separator` | Standardized | Radix-like | `orientation` ("horizontal" \| "vertical"), `decorative` | Non-obtrusive layout boundaries. |
| `Skeleton` | Standardized | shadcn | Responsive shimmering placeholder blocks | Matches expected container geometry without FOUC. |
| `Tooltip` | Standardized | Floating | `content`, `side`, `delayDuration` | Accessible tooltip with hover/focus disclosure. |
| `Dialog` | **New** | Compound Portal | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` | Escape dismissal, click-outside, Motion modal entrance. |
| `DropdownMenu`| **New** | Compound | `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` | Menu popup with Phase 4 `dropdownVariants`. |
| `ConfirmDialog`| Preserved | Custom Dialog | `isOpen`, `onConfirm`, `onClose`, `isDestructive` | Backward-compatible confirmation dialog. |
| `Drawer` | Preserved | Custom Portal | `isOpen`, `onClose`, `title`, `side` | Slide-in drawer for paper metadata and details. |

---

### 2.2 Form Composition Components (`src/components/forms/`)

| Component | Status | Purpose | Key Features |
| :--- | :--- | :--- | :--- |
| `FormField` | **New** | Accessible form group wrapper | Provides context for `id`, `error`, and `required` states. |
| `FieldDescription`| **New** | Secondary hint/caption | Automatically associates `id-desc` with the input. |
| `ValidationMessage`| **New** | Error alert message | Shows `AlertCircle` icon and `role="alert"` text. |

---

### 2.3 Feedback Components (`src/components/feedback/`)

| Component | Status | Layout Support | Key Features |
| :--- | :--- | :--- | :--- |
| `EmptyState` | Standardized | Standard & Compact | Icon, title, description, and primary call-to-action button. |
| `LoadingState` | **New** | Spinner, Skeleton, Inline | Clear message, accessible `role="status"` live region. |
| `ErrorState` | **New** | Standard & Compact | Error icon, title, message, optional retry button, technical details toggle. |
| `SuccessMessage`| **New** | Alert banner | Confirmation alert with `CheckCircle2` and optional dismiss. |

---

### 2.4 Data Display Components (`src/components/data-display/`)

| Component | Status | Academic Domain Focus | Key Features |
| :--- | :--- | :--- | :--- |
| `StatusBadge` | **New** | Research & task states | Maps states (`discovered`, `saved`, `downloading`, `completed`, `failed`, `open_access`, `exact_match`, `verified`) to badges with icons. |
| `SectionHeader` | **New** | Section title & actions | Header with title, description, badge slot, and actions button group. |
| `MetadataList` | **New** | Scholarly metadata key-values | Dense listing for authors, venue, year, DOI with one-click copy. |
| `MetadataItem` | **New** | Single metadata entry | Label + value with copy-to-clipboard action. |
| `TruncatedText` | **New** | Abstract & claim clamping | Multi-line clamp with expand/collapse toggle. |

---

## 3. Deprecation & Modernization Backlog

- **Ad-hoc Buttons:** Raw `<button className="px-3 py-1 bg-indigo-600...">` elements across legacy views will be migrated incrementally to `<Button variant="primary">`.
- **Hardcoded Progress Bars:** Replaced raw `div` width calculations with `<Progress value={...} />`.
- **Manual Status Badges:** Replaced custom switch-statements in `DownloadsView` with `<StatusBadge status={...} />`.

