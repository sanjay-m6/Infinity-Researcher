# Phase 1: Prioritized UI Modernization Backlog

This backlog categorizes all identified technical debt, component refactoring targets, styling inconsistencies, and animation requirements across **Infinity Researcher**.

---

## 1. Classification Definitions

- **P0 — Critical**: Threatens build stability, type safety, security, or core application functionality. Must be addressed immediately or before major UI changes.
- **P1 — High Priority**: Prerequisite architectural foundation that must be established before screens or components can be safely redesigned (e.g. Design Tokens, Motion installation, ESLint cleanups).
- **P2 — Normal Priority**: Component consolidations, design token migrations, accessibility improvements, and state tracking polish.
- **P3 — Enhancement**: Advanced micro-interactions, decorative animations, and visual delight.

---

## 2. Master Backlog Items

### Item `MOD-P0-01`: Fix Pre-Existing ESLint Errors Across Academic Tools
- **Title**: Resolve 37 ESLint errors in writing-workspace, citation-checker, and readability engines.
- **Description**: Running `npm run lint` currently fails with 37 errors (`no-useless-escape`, `no-useless-assignment`, `prefer-const`, and React Compiler hook ordering in `CitationCheckerWorkspaceView.tsx` / `ReadabilityAnalyzerView.tsx`).
- **Evidence**: `npm run lint` exit code 1.
- **Affected Files**:
  - `src/features/citation-checker/CitationCheckerWorkspaceView.tsx`
  - `src/features/citation-checker/citationParser.ts`
  - `src/features/readability/ReadabilityAnalyzerView.tsx`
  - `src/features/readability/readabilityEngine.ts`
  - `src/features/writing-workspace/tokenPreservationGuard.ts`
  - `src/features/writing-workspace/writingEngine.ts`
- **Priority**: **P0** | **Complexity**: Low-Medium | **Phase**: Phase 2
- **Acceptance Criteria**: `npm run lint` completes with 0 errors and 0 warnings.
- **Required Tests**: `src/test/academic-writing-workspace.test.tsx`, `citation-checker.test.tsx`, `readability-and-integrity.test.tsx`.

---

### Item `MOD-P1-01`: Centralize Semantic Design Tokens in Tailwind v4
- **Title**: Consolidate hardcoded hex colors and inconsistent opacity into CSS `@theme` variables.
- **Description**: Replace hardcoded classes (`bg-[#0e1524]`, `bg-[#070b12]`, `text-slate-900`, `border-slate-800`) with unified semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `border-border`, `ring-primary`).
- **Evidence**: Hardcoded hex values found in `DiscoverView.tsx`, `AppShell.tsx`, `Sidebar.tsx`, `LibraryView.tsx`.
- **Affected Files**: `src/styles/index.css`, shared components in `src/components/ui/`.
- **Priority**: **P1** | **Complexity**: Medium | **Phase**: Phase 2
- **Acceptance Criteria**: All primary UI components consume design tokens; zero visual regression in dark and light modes.
- **Required Tests**: Visual snapshot and `npm test`.

---

### Item `MOD-P1-02`: Install Motion for React and Retire GSAP
- **Title**: Introduce `motion/react` as the single animation library and eliminate GSAP.
- **Description**: Install `motion`, replace imperative `gsap.fromTo` in `AppShell.tsx` with `<AnimatePresence mode="wait">` and `<motion.div>`, then uninstall `gsap` to save bundle size.
- **Evidence**: `gsap: ^3.15.0` in `package.json`; only used in `AppShell.tsx:65-76`.
- **Affected Files**: `package.json`, `src/components/layout/AppShell.tsx`.
- **Priority**: **P1** | **Complexity**: Low-Medium | **Phase**: Phase 3
- **Acceptance Criteria**: Page transitions render smoothly via Motion; bundle size reduced; `gsap` removed from dependencies.
- **Required Tests**: `src/test/AppShell.test.tsx`, `src/test/two-column-sidebar-and-navigation.test.tsx`.

---

### Item `MOD-P1-03`: Modularize Monolithic Discover View
- **Title**: Deconstruct `DiscoverView.tsx` into modular subcomponents.
- **Description**: `DiscoverView.tsx` is ~3,900 lines of code. It should be partitioned into `DiscoverHeader.tsx`, `DiscoverSourceChips.tsx`, `DiscoverResultsList.tsx`, `DiscoverDetailPanel.tsx`, and `DiscoverDiagnosticsModal.tsx`.
- **Evidence**: Monolithic file size slows down editor performance and makes targeted CSS styling risky.
- **Affected Files**: `src/features/discover/DiscoverView.tsx` and new subcomponent files.
- **Priority**: **P1** | **Complexity**: High | **Phase**: Phase 6
- **Acceptance Criteria**: `DiscoverView` under 600 lines orchestrating modular subcomponents; 100% test pass rate across Discover suites.
- **Required Tests**: `discover-query-search.test.tsx`, `discover-stale-state.test.tsx`, `discover-three-pane.test.tsx`.

---

### Item `MOD-P2-01`: Standardize Dialog and Sheet Primitives with Radix UI
- **Title**: Implement accessible `<Dialog>`, `<Sheet>`, and `<Tooltip>` primitives.
- **Description**: Wrap Radix UI accessible primitives to replace custom `createPortal` implementations, ensuring automated focus trapping, `Escape` key handling, and ARIA roles.
- **Evidence**: `Modal.tsx` and `Drawer.tsx` lack full focus management and trap accessibility.
- **Affected Files**: `src/components/ui/Modal.tsx`, `src/components/ui/Drawer.tsx`.
- **Priority**: **P2** | **Complexity**: Medium | **Phase**: Phase 4
- **Acceptance Criteria**: Modals trap keyboard focus inside; screen readers announce title and description correctly.
- **Required Tests**: `npm test --run`.

---

### Item `MOD-P2-02`: Real-Time Background Activity Sheet in BottomBar
- **Title**: Expand `BottomBar` jobs counter into an interactive background task tray.
- **Description**: Allow the user to click the active jobs badge in `BottomBar.tsx` to slide open an activity sheet displaying active downloads with speed, ETA, and cancellation triggers.
- **Evidence**: `BottomBar.tsx` currently displays only a static number (`activeJobsCount`).
- **Affected Files**: `src/components/layout/BottomBar.tsx`, `src/features/downloads/DownloadsView.tsx`.
- **Priority**: **P2** | **Complexity**: Medium | **Phase**: Phase 5
- **Acceptance Criteria**: Shows live download byte progress, transfer rate, and cancel action per active job.
- **Required Tests**: `src/test/crawl-engine.test.tsx`.

---

### Item `MOD-P2-03`: Implement Operating System Reduced-Motion Compliance
- **Title**: Integrate `useReducedMotion()` across all Motion transitions.
- **Description**: Ensure all declarative animations check `shouldReduceMotion` and bypass spatial translation when reduced motion is preferred.
- **Evidence**: Currently all transitions run regardless of OS accessibility flags.
- **Affected Files**: All animated components created in Phase 3–6.
- **Priority**: **P2** | **Complexity**: Low | **Phase**: Phase 3
- **Acceptance Criteria**: With reduced motion enabled, components render instant or subtle opacity fades with 0px spatial translation.
- **Required Tests**: Unit test verifying `useReducedMotion()` override behavior.

---

### Item `MOD-P3-01`: Dynamic Code-Splitting for Heavy Workspaces
- **Title**: Lazy-load secondary feature views using `React.lazy()`.
- **Description**: Dynamically import `ReviewMatrixView`, `AiToolsHubView`, `SavedReportsView`, and `SettingsView` to reduce main bundle size below 250 kB gzipped.
- **Evidence**: Single chunk `index-*.js` is 1,758 kB minified (~453 kB gzipped).
- **Affected Files**: `src/components/layout/AppShell.tsx`, `vite.config.ts`.
- **Priority**: **P3** | **Complexity**: Medium | **Phase**: Phase 7
- **Acceptance Criteria**: Initial chunk < 250 kB gzipped; secondary chunks load on demand behind a skeleton suspense boundary.
- **Required Tests**: Production build verification (`npm run build`).

---

### Item `MOD-P3-02`: Animated Tactile Icon Micro-Interactions
- **Title**: Add interactive morphing animations on high-frequency icon triggers.
- **Description**: Copy-to-clipboard (`Copy` -> `Check`), Password toggle (`Eye` -> `EyeOff`), and App Lock (`Unlock` -> `Lock`).
- **Evidence**: Icons currently swap abruptly without transition.
- **Affected Files**: `src/features/auth/`, `src/features/discover/DiscoverPaperAssistant.tsx`, `src/components/ui/`.
- **Priority**: **P3** | **Complexity**: Low-Medium | **Phase**: Phase 4
- **Acceptance Criteria**: Tactile animated state feedback on click with automatic timeout reversion.
- **Required Tests**: Component interaction tests.

