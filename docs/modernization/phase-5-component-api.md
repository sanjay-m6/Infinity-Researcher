# Phase 5 — Component Library API Specification

**Project:** Infinity Researcher  
**Phase:** 5 of 30 (Global Component Library Modernization)  
**Document:** Public Component API Specifications, Props, and Contracts  
**Status:** Complete & Verified  

---

## 1. Button System (`src/components/ui/Button.tsx`)

### 1.1 Props Interface
```typescript
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "xs" | "sm" | "default" | "md" | "lg" | "icon";
  isLoading?: boolean;
}
```

### 1.2 Behavior & Accessibility Contract
- **Variants:**
  - `default` / `primary`: High-contrast indigo action button (`bg-primary text-primary-foreground hover:bg-primary-hover`).
  - `secondary`: Subtle slate background for secondary actions (`bg-secondary text-secondary-foreground`).
  - `outline`: Bordered surface with hover fill (`border border-border hover:bg-muted`).
  - `ghost`: Transparent button for toolbars and compact actions.
  - `destructive`: Warning/danger action with crimson accent (`bg-destructive text-destructive-foreground`).
  - `link`: Underlined inline text button.
- **Sizes:** `xs` (20px), `sm` (28px), `default` / `md` (36px), `lg` (44px), `icon` (36x36px square).
- **Loading State:** When `isLoading={true}`, renders `<Loader2 className="animate-spin" />`, disables clicking, sets `aria-busy="true"`.
- **Keyboard:** Standard Space / Enter activation; visible focus ring via `focus-visible:ring-2 focus-visible:ring-ring`.

---

## 2. Form Controls & Inputs

### 2.1 Input (`src/components/ui/Input.tsx`)
```typescript
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}
```
- **Semantic Tokens:** `bg-card text-foreground placeholder:text-muted-foreground border-border`.
- **Error State:** Outlines field in `border-destructive` with accessible error message below.
- **Icons:** Automatically indents padding (`pl-9` for leading, `pr-9` for trailing) to prevent text clipping.

### 2.2 Checkbox (`src/components/ui/Checkbox.tsx`)
```typescript
export interface CheckboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
}
```
- **WAI-ARIA Role:** `role="checkbox"`, `aria-checked={checked}`.
- **Keyboard:** Toggles state on Space and Enter keys.
- **Visuals:** Renders stroke-3 `Check` icon when checked.

### 2.3 Select (`src/components/ui/Select.tsx`)
```typescript
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
}
```
- **Keyboard:** Full native arrow and typeahead navigation.
- **Chevron:** Custom SVG chevron aligned with `text-muted-foreground`.

### 2.4 RadioGroup (`src/components/ui/RadioGroup.tsx`)
```typescript
export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
}
export interface RadioGroupItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  value: string;
  label?: string;
  description?: string;
}
```
- **WAI-ARIA Role:** `role="radiogroup"` on container, `role="radio"` on items with `aria-checked`.
- **Labels:** Clickable label toggles radio button.

---

## 3. Overlays & Dialogs

### 3.1 Dialog (`src/components/ui/Dialog.tsx`)
Compound components: `<Dialog>`, `<DialogTrigger>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogDescription>`, `<DialogFooter>`.
- **Portaling:** Renders directly into `document.body` via React Portal.
- **Dismissal:** Closes on backdrop click, close button click, or Escape key.
- **Motion Integration:** Animated using Phase 4 `modalBackdropVariants` and `modalContentVariants`. Strips animation when `useReducedMotionPreference()` is true.

### 3.2 DropdownMenu (`src/components/ui/DropdownMenu.tsx`)
Compound components: `<DropdownMenu>`, `<DropdownMenuTrigger>`, `<DropdownMenuContent>`, `<DropdownMenuItem>`, `<DropdownMenuLabel>`, `<DropdownMenuSeparator>`.
- **WAI-ARIA:** `role="menu"` on content, `role="menuitem"` on selectable items.
- **Positioning:** Configurable alignment (`left`, `right`, `center`).
- **Dismissal:** Automatically closes on outside click or menuitem activation.

---

## 4. Feedback Primitives

### 4.1 EmptyState (`src/components/ui/EmptyState.tsx`)
```typescript
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionNode?: React.ReactNode;
  compact?: boolean;
}
```

### 4.2 LoadingState (`src/components/feedback/LoadingState.tsx`)
```typescript
export interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  variant?: "spinner" | "skeleton" | "inline";
  compact?: boolean;
}
```

### 4.3 ErrorState (`src/components/feedback/ErrorState.tsx`)
```typescript
export interface ErrorStateProps {
  title?: string;
  description: string;
  details?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}
```

### 4.4 SuccessMessage (`src/components/feedback/SuccessMessage.tsx`)
```typescript
export interface SuccessMessageProps {
  message: string;
  description?: string;
  onDismiss?: () => void;
}
```

---

## 5. Data Display Primitives

### 5.1 StatusBadge (`src/components/data-display/StatusBadge.tsx`)
```typescript
export type ResearchStatus =
  | "discovered"
  | "saved"
  | "downloading"
  | "downloaded"
  | "processing"
  | "completed"
  | "failed"
  | "paused"
  | "open_access"
  | "restricted"
  | "exact_match"
  | "verified";

export interface StatusBadgeProps {
  status: ResearchStatus;
  showIcon?: boolean;
  label?: string;
}
```

### 5.2 SectionHeader (`src/components/data-display/SectionHeader.tsx`)
```typescript
export interface SectionHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}
```

### 5.3 MetadataList & MetadataItem (`src/components/data-display/MetadataList.tsx`)
```typescript
export interface MetadataItemProps {
  label: string;
  value: React.ReactNode;
  copyValue?: string;
}
```
- Includes integrated one-click copy with visual checkmark confirmation.

