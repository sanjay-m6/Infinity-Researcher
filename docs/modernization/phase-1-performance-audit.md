# Phase 1: Frontend and Runtime Performance Audit

This audit evaluates application bundle sizes, memory footprints, rendering bottlenecks, and build telemetry in **Infinity Researcher**.

---

## 1. Production Build Baseline Measurements

The production build was executed using `tsc && vite build`:

| Asset File | Uncompressed Size | Gzipped Size | Purpose & Analysis |
| :--- | :--- | :--- | :--- |
| **`dist/index.html`** | 1.04 kB | 0.53 kB | Minimal HTML entry point. |
| **`dist/assets/index-*.css`** | 168.31 kB | 21.51 kB | Tailwind v4 compiled utility styles & design tokens. |
| **`dist/assets/index-*.js`** | 1,758.49 kB | 453.50 kB | Main application bundle containing all 24 views and libraries. |
| **`dist/assets/pdf.worker.min.mjs`** | 1,264.34 kB | ~380 kB | Bundled PDF.js web worker for background text extraction. |
| **`dist/assets/application-*.png`** | 1,496.65 kB | N/A | Hero artwork used in onboarding wizard and about dialogs. |

- **Build Time**: **7.3 to 9.0 seconds** (Vite 8 with Rolldown asset optimizer).
- **TypeScript Typecheck Time**: ~12 seconds (`tsc --noEmit`).

---

## 2. Performance Findings & Bottlenecks

1. **Large Monolithic Bundle (1.75 MB uncompressed)**:
   - All 24 feature views are currently bundled together in a single `index-*.js` chunk.
   - Vite emits a chunk warning: `Some chunks are larger than 500 kB after minification`.
   - **Modernization Remedy (Phase 4)**: Implement React `lazy()` and dynamic `import()` for rarely accessed sub-views (e.g., `SettingsView`, `SavedReportsView`, `PrivacySecurityView`, `FeedbackCenterModal`), reducing initial load bundle by over 40%.
2. **Virtualization on Long Result Lists**:
   - `DiscoverView` and `LibraryView` render items up to `visibleCount` (50 papers default).
   - While DOM node count is manageable up to 100 items, searching with queries returning 500+ papers can degrade scroll frame rate on lower-end hardware.
   - **Remedy**: Integrate lightweight windowing (e.g. `@tanstack/react-virtual` or CSS content-visibility) for paper cards.
3. **Canvas Memory Cleanup in PDF Viewer**:
   - High-DPI canvas rendering allocates significant graphic memory for 2K/4K pages.
   - `EmbeddedPdfViewer` properly cancels in-flight render tasks (`renderTask.cancel()`) and clears canvas context before drawing subsequent pages, avoiding GPU memory leaks.
4. **GSAP Redundant Payload**:
   - GSAP is bundled purely for a single 15-line view transition in `AppShell.tsx`.
   - Replacing GSAP with Motion for React will remove GSAP and streamline animation logic.

---

## 3. Performance Modernization Target Metrics (Phase 7)

| Metric | Current Measured Value | Modernization Target |
| :--- | :--- | :--- |
| **Initial JS Chunk Size (gzipped)** | 453.5 kB | < 250 kB (via code-splitting) |
| **Frame Rate During Transitions** | 50–55 fps | Constant 60 fps (GPU composites) |
| **Time to Interactive (TTI)** | ~450 ms | < 200 ms |
| **Memory Footprint at Idle** | ~85 MB (Tauri webview) | < 75 MB |

