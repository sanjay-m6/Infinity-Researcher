# Phase 2 Open Decisions and Technical Debt Register

**Project:** Research Paper Scraper  
**Phase:** Phase 2 — Architecture and Project Foundation  
**Status:** Monitored & Managed  
**Date:** 2026-10-24  

---

## 1. Status of Decisions & Blockers

* **Mandatory Architecture Blockers:** **Zero**. The desktop application foundation compiles, tests pass 100%, and the Tauri 2 IPC communication path is operational.
* **Provisional Stack Decisions:** Verified. React 19, Vite 8, Tailwind CSS v4, and Tauri 2 are operating cleanly together without version conflicts.

---

## 2. Open Technical Decisions (Forward-Looking)

### Decision OD-001: UI Component Primitives for Phase 3
* **Context:** Phase 3 requires a full visual design system and accessible navigation rail.
* **Options:**
  1. *Option A (Tailwind v4 Native Primitives):* Build lightweight bespoke accessible components with `@tailwindcss/vite` and Lucide icons without external component packages.
  2. *Option B (Radix UI / shadcn/ui Ports):* Import `@radix-ui/react-*` accessible unstyled primitives and style with Tailwind.
* **Evaluation:** Option A minimizes dependency footprint and ensures zero React 19 peer-dependency warnings. Option B offers pre-built ARIA keyboard focus management for complex modals.
* **Status:** Non-blocking; to be finalized at the start of Phase 3.

### Decision OD-002: End-to-End Desktop Automation (Playwright vs WebDriver)
* **Context:** Phase 9 requires full automated desktop E2E testing.
* **Options:**
  1. *Option A:* Use Playwright testing the Vite production web build (`dist/`) directly with mocked IPC bindings.
  2. *Option B:* Use Tauri WebDriver (`tauri-driver`) driving the actual native Windows WebView2 process.
* **Evaluation:** Option A is fast and runs in standard CI without graphical GPU runners. Option B provides high-fidelity native testing but requires specialized Windows CI runners.
* **Status:** Non-blocking; deferred to Phase 9 QA milestone.

---

## 3. Technical Debt Monitored for Future Phases

1. **Browser Fallback Mode:**  
   Currently, opening `http://localhost:1420` in a browser displays an amber warning card explaining that desktop IPC is unavailable. In Phase 3, this fallback will be enhanced with a demo mode toggle allowing UI development without starting the native desktop binary.
2. **Windows MAX_PATH File Handling:**  
   When Phase 7 implements PDF file writing, filenames will be strictly slugified and bounded to 120 characters to respect legacy Windows path limits (`MAX_PATH = 260`) unless extended length syntax (`\\?\`) is invoked.
