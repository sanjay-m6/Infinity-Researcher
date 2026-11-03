# Phase 10: Keyboard Shortcuts & Focus Management Report

## 1. Executive Summary

Phase 10 standardizes global keyboard control, dialog lifecycle shortcuts, listbox navigation, and focus restoration across Infinity Researcher.

---

## 2. Keyboard Shortcuts Specification

| Shortcut Key | Scope | Action Triggered | Priority & Behavior |
| :--- | :--- | :--- | :--- |
| **`Ctrl+K`** (Win / Linux)<br>**`Cmd+K`** (macOS) | Global Application Shell | Toggles Command Palette open/closed | Intercepts default browser behavior (`e.preventDefault()`). Works from anywhere in the app. |
| **`Escape`** | Command Palette Dialog | Closes Command Palette | Restores focus to previous active element. |
| **`ArrowDown`** / **`ArrowUp`** | Inside Search Input | Moves active selection through results | Wraps around result boundaries; auto-scrolls into view via `scrollIntoView({ block: "nearest" })`. |
| **`Home`** / **`End`** | Inside Search Input | Jumps to first or last result | Instant index reassignment (`0` or `total - 1`). |
| **`Enter`** | Inside Search Input | Executes selected command / navigates | Executes `onSelect()` callback, saves clean query to recent searches, and closes modal. |

---

## 3. Focus Restoration & Conflict Avoidance

1. **Focus Restoration**:
   - When the palette opens, `previousActiveElement.current` caches `document.activeElement`.
   - On close (via Escape, Enter, or backdrop click), focus is restored immediately to the cached element.
2. **Shortcuts Conflict Audit**:
   - Audited against `EmbeddedPdfViewer.tsx` (uses `ArrowLeft`, `ArrowRight`, `PageUp`, `PageDown`, `+`, `-`, `r`, and `Ctrl+F`).
   - Audited against `ReviewMatrixView.tsx` and detail drawers.
   - Zero conflicts identified. `Ctrl+K` is uniquely dedicated to the Command Palette.

