# Phase 2 — Component Standards & shadcn/ui Integration
**Project:** Infinity Researcher  
**Phase:** 2 of 30 — Design System Foundation  
**Directory:** [`src/components/ui/`](file:///d:/Paper/src/components/ui/)  

---

## 1. Component Philosophy & Authoring Standards

All components created and maintained in Infinity Researcher adhere to these rules:

1. **WAI-ARIA Accessibility First:** Every interactive primitive includes appropriate `role`, `aria-*` states, and full keyboard navigation (Tab, Enter, Space, Arrows, Escape).
2. **Forwarded Refs:** Interactive elements implement `React.forwardRef` allowing smooth animation wrapping and focus management.
3. **Class Name Composability:** All components accept a `className` prop merged via [`src/lib/utils.ts`](file:///d:/Paper/src/lib/utils.ts) `cn()`.
4. **Zero Layout Shifts:** Skeletons and predefined dimensions ensure no jarring layout reflows occur when async data (crawl streams, AI chunks) loads.

---

## 2. Standardized Primitives

### 2.1 `Button`
- **Variants:** `default`, `primary`, `secondary`, `outline`, `ghost`, `destructive`, `link`
- **Sizes:** `sm` (compact tables), `md` (standard actions), `lg` (onboarding call-to-action), `icon` (toolbars)
- **State Props:** `isLoading` (renders spinner, sets `aria-busy="true"`, disables interaction)

### 2.2 `Badge`
- **Variants:** `default`, `secondary`, `outline`, `destructive`, `success`, `warning`, `info`
- **Domain Variants:** `open-access` (emerald), `restricted` (amber), `saved` (indigo), `running` (cyan)

### 2.3 `Card` Composite
- Modular composite components: `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardDescription>`, `<CardContent>`, `<CardFooter>`.
- Supports hoverable interactions with `cursor-pointer hover:border-primary/50 transition-all`.

### 2.4 `Tabs` Composite
- Keyboard accessible tab list: `<Tabs defaultValue="...">`, `<TabsList>`, `<TabsTrigger value="...">`, `<TabsContent value="...">`.
- Implements arrow key navigation between triggers and automatic ARIA relationship anchoring (`aria-selected`, `aria-controls`).

### 2.5 `Progress`
- Provides semantic progress bar for download pipelines, web scraping, and AI analysis.
- Supports determinate percentages (`value={75}`) and indeterminate pulsing mode when total file size is unknown.

### 2.6 `Alert`
- Accessible callout notification (`role="alert"`) supporting `default`, `destructive`, `warning`, `success` styling.

### 2.7 `Switch` & `Label`
- Form toggle switch conforming to WAI-ARIA switch pattern (`role="switch"`, `aria-checked`).
- Pairable with `<Label htmlFor="...">` with active/disabled state synchronization.

### 2.8 `Tooltip`
- Hover and focus activated contextual help popover with delay duration control (`delayDuration={200}`).

### 2.9 `Skeleton`
- Smooth pulsing placeholder matching shadcn specifications to hold geometry while background engines retrieve full-text PDFs.

