# Phase 10: Global Search & Command Palette Architecture

## 1. Architectural Blueprint

The modernized Infinity Researcher Global Search and Command Palette serves as the unified keyboard-driven control plane for the application. It aggregates local indexed content, application routing, research tools, and system commands into a single, cohesive interface.

```
+-----------------------------------------------------------------------------------------+
|                                    Command Palette                                      |
|  [Search Input: role="combobox" aria-autocomplete="list" aria-controls="..."]           |
+-----------------------------------------------------------------------------------------+
                                             │
                                             ▼
                                  useUnifiedSearch Hook
                                             │
        ┌───────────────────┬────────────────┴───────────────────┬───────────────────┐
        ▼                   ▼                                    ▼                   ▼
 [Papers Provider]  [Collections Provider]              [Command Registry]   [History Provider]
  - Title Matches     - Collection Name                   - Navigation Pages   - LocalStorage
  - Author Surnames   - Descriptions                      - Research Tools     - Privacy-Safe
  - DOI Identifiers   - Paper Counts                      - System Actions     - Clearable
        │                   │                                    │                   │
        └───────────────────┼────────────────────────────────────┴───────────────────┘
                            ▼
                  [Unified Ranking Engine]
                   - Exact DOI Match: 1000
                   - Exact Title Match: 900
                   - Prefix Match: 800
                   - Collection Match: 750
                   - Substring / Word Match: 650
                   - Author Match: 550
                            │
                            ▼
              [Flattened Results & AccName Options]
               - role="listbox"
               - role="option" with aria-selected
               - Highlighted text segments
```

---

## 2. Component Hierarchy & Modular Structure

1. **`src/components/ui/CommandPalette.tsx`**:
   - Centered portal modal (`createPortal`) rendered at the top layer (`z-[100]`).
   - Accessible dialog semantics (`role="dialog"`, `aria-modal="true"`, `aria-label="Command Palette"`).
   - Combobox search input with clear-search button (`X`) and `ESC` badge.
   - Categorized result sections with count chips.
   - Text highlighter (`HighlightText`) using non-destructive substring slicing.
   - Footer displaying navigation cues (`↑`, `↓`, `Home`, `End`, `Enter`).
2. **`src/lib/search/useUnifiedSearch.ts`**:
   - Synchronous, zero-lag query processor binding `papers`, `collections`, and `APP_COMMANDS`.
   - Reactive recent searches state with clear action.
   - Fallback empty state with Discover integration.
3. **`src/lib/search/commandRegistry.ts`**:
   - Strongly-typed registry of all navigation routes, analytical research tools, and application actions.
4. **`src/lib/search/rankingEngine.ts`**:
   - Multi-signal deterministic ranking algorithm and string highlighting functions.
5. **`src/lib/search/searchHistory.ts`**:
   - LocalStorage persistence wrapper (`rps_recent_searches`) bounding queries to 6 items.

---

## 3. Data Integrity & Offline Transparency

- **Zero Mock Results**: Every paper displayed in search results corresponds to a real SQLite record in `AppContext.papers`.
- **Zero Mock Collections**: Every collection displayed corresponds to a user-created or seeded binder in `AppContext.collections`.
- **No Arbitrary String Evaluation**: Commands are bound to explicit TypeScript action handlers (`setActiveSection`, `setSelectedPaperId`, `toggleTheme`, etc.).

