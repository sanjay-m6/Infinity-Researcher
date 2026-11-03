# Phase 1: Implementation Dependency Map

This map outlines the sequential requirements and prerequisite dependencies governing the modernization of **Infinity Researcher**.

---

## 1. Master Dependency Flowchart

```mermaid
flowchart TD
    subgraph Foundation ["Phase 1 & Phase 2: Foundational Architecture"]
        Aud["Phase 1: Codebase Audit & Baseline Checks<br/>(COMPLETED)"] --> Tokens["Phase 2: Semantic Design Tokens & Theme Foundation<br/>(Tailwind 4 @theme, Color spaces, Dark mode)"]
        Tokens --> LintFix["Resolve Pre-Existing ESLint Errors (MOD-P0-01)"]
    end
    
    subgraph MotionAndPrimitives ["Phase 3 & Phase 4: Animation & Component Primitives"]
        Tokens --> MotionSetup["Phase 3: Motion for React Setup<br/>(Install motion, Retire GSAP, Reduced motion)"]
        Tokens --> Primitives["Phase 4: Component Library Standardization<br/>(Radix UI Dialog, Sheet, Dropdown, Animated Icons)"]
        MotionSetup --> Primitives
    end
    
    subgraph Telemetry ["Phase 5: Process Tracking & Telemetry"]
        Primitives --> TaskTray["Phase 5: Real-Time Process Tracking<br/>(True Progress Bars, BottomBar Task Tray)"]
    end
    
    subgraph Workspaces ["Phase 6: Core Workspaces Modernization"]
        TaskTray --> DiscoverMod["Modularize & Modernize DiscoverView<br/>(3-Pane layout, Skeletons, Assistant)"]
        Primitives --> LiteratureMod["Literature Workspace & Matrix Redesign<br/>(3-Panel Survey, Evidence Drawer)"]
        Primitives --> PdfMod["PDF Viewer Canvas & Thumbnails Redesign<br/>(12-State lifecycle polish)"]
        Primitives --> WritingMod["Academic Writing & Integrity Tools Redesign<br/>(Diff viewer, Token preservation)"]
    end
    
    subgraph Finalization ["Phase 7: Production Hardening"]
        DiscoverMod --> ProdHarden["Phase 7: End-to-End Verification & Performance Polish<br/>(Code-splitting, WCAG AA audit, CI/CD)"]
        LiteratureMod --> ProdHarden
        PdfMod --> ProdHarden
        WritingMod --> ProdHarden
    end
```

---

## 2. Critical Dependency Rules

1. **Tokens Before Components**:
   - Semantic color tokens (`bg-background`, `bg-card`, `border-border`, `text-primary`) must be established in `src/styles/index.css` before rewriting or restyling individual UI components. Attempting to restyle components without unified tokens results in duplicated hex codes.
2. **ESLint Resolution Before Large Refactorings**:
   - `MOD-P0-01` (resolving the 37 ESLint errors in writing and citation utilities) must be completed during Phase 2. This ensures that CI/CD and pre-commit hooks can reliably catch new syntax or type regressions.
3. **Motion Before Page Transitions**:
   - `motion` must be installed and tested in isolation (Phase 3) before removing `gsap` or attempting complex page transitions in `AppShell.tsx`.
4. **Primitives Before Workspaces**:
   - Accessible `<Dialog>`, `<Sheet>`, and `<ResizablePanelGroup>` primitives must be finalized in Phase 4 before deconstructing monolithic workspaces (`DiscoverView`, `ReviewMatrixView`, `LiteratureWorkspaceView`) in Phase 6.
5. **Continuous Regression Testing**:
   - After each phase, all **221 Vitest tests**, **109 Pytest tests**, and `cargo check` must be executed to verify zero degradation of existing functionality.

---

## 3. Parallelization Opportunities

Once Phase 2 (Design Tokens) and Phase 3 (Motion Infrastructure) are established, the following tracks can proceed independently:
- **Track A (Observability)**: Phase 5 Real-Time Process Tracking & Task Tray.
- **Track B (Document Reader)**: Embedded PDF Viewer canvas improvements.
- **Track C (Academic Tools)**: Academic Writing Workspace and Citation Checker polish.

