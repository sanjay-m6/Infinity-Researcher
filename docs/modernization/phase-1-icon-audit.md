# Phase 1: Icon Audit and Standardization Plan

This audit reviews icon usage, consistency, libraries, and animation opportunities across **Infinity Researcher**.

---

## 1. Icon Libraries and Sources

1. **Primary Library**: **`lucide-react` (v1.61.0)**:
   - Consistent stroke-based icon family with extensive scholarly and technical symbols.
   - Clean SVG rendering with tree-shaking support.
2. **Specialized Inline SVGs**:
   - `src/components/ui/GithubIcon.tsx`: Handcrafted SVG for the GitHub mark used in about modals, feedback center, and repository links.
3. **Emoji as Icons**:
   - Emoji are used sparingly in some empty states (e.g., 📚, 🔍, 📝 in demo text) but should be standardized into Lucide icons for desktop visual elegance.

---

## 2. Icon Inventory by Workspace Category

| Category | Primary Lucide Icons Used | Sizing Conventions | Stroke Width | Accessibility / ARIA Status |
| :--- | :--- | :--- | :--- | :--- |
| **Navigation & AppShell** | `Compass`, `Library`, `Layers`, `Sparkles`, `FolderOpen`, `Clock`, `Settings`, `Shield`, `LayoutDashboard`, `PanelLeftClose`, `ChevronLeft`, `ChevronRight`, `Lock`, `LogOut` | `w-4 h-4` (sub-nav), `w-5 h-5` (rail) | 2px | Labels present in text; rail icons need explicit tooltips when secondary bar is collapsed. |
| **Search & Discovery** | `Search`, `Globe`, `Key`, `Play`, `Pause`, `RefreshCw`, `Filter`, `Plus`, `BookOpen`, `AlertCircle`, `Unlock`, `Cloud` | `w-3.5 h-3.5`, `w-4 h-4` | 2px | Mixed. Action buttons have labels; table action buttons need `aria-label`. |
| **PDF Viewer & Canvas** | `ZoomIn`, `ZoomOut`, `RotateCw`, `Maximize2`, `Minimize2`, `Search`, `FileText`, `Download`, `ExternalLink`, `ChevronUp`, `ChevronDown` | `w-4 h-4` | 2px | Good. Title attributes present on toolbar icon buttons. |
| **AI Hub & Writing Tools**| `Sparkles`, `PenTool`, `ScanEye`, `FileSearch`, `RefreshCw`, `CheckCircle2`, `BarChart2`, `MessageSquare`, `Lightbulb`, `Send`, `Copy`, `BookmarkPlus` | `w-3.5 h-3.5` to `w-5 h-5` | 2px | Good. Buttons include accompanying descriptive text. |
| **Authentication & Lock** | `Lock`, `Unlock`, `ShieldCheck`, `Eye`, `EyeOff`, `UserCheck`, `KeyRound` | `w-4 h-4`, `w-5 h-5` | 2px | Excellent. Show/hide password button has explicit `aria-label` and `title`. |
| **Review Matrix** | `TableProperties`, `Plus`, `Search`, `Check`, `ExternalLink`, `FileSpreadsheet`, `Sparkles` | `w-3.5 h-3.5` | 2px | Cell badges use consistent micro-icons (`w-3 h-3`). |

---

## 3. Inconsistencies & Issues Identified

1. **Size Variations Across Buttons**:
   - Secondary action buttons alternate between `w-3.5 h-3.5` and `w-4 h-4` without a clear rule.
   - **Standardization Rule**:
     - `sm` buttons / table rows: `w-3.5 h-3.5`
     - `md` buttons / standard inputs: `w-4 h-4`
     - Card headers & drawer titles: `w-5 h-5`
     - Empty states / modal hero badges: `w-7 h-7` or `w-8 h-8`
2. **Missing Tooltips on Collapsed Sidebar**:
   - When the secondary sidebar column is collapsed, only the primary rail is visible. Icons without text must have `<Tooltip>` overlays for accessibility.
3. **Static Spinners vs Interactive Feedback**:
   - Standard spinning `Loader2` is used for every loading state. In modern interfaces, icons should transition between states (e.g. `Download` -> `Loader2` -> `Check`).

---

## 4. Animated Icon Opportunities (Phase 4)

Using Motion for React, specific high-frequency user actions will receive animated icon transitions:

1. **Copy to Clipboard (`Copy` -> `Check`)**:
   - Smooth scale-and-morph transition with a 1.5s auto-revert to `Copy`.
2. **Password Reveal (`Eye` -> `EyeOff`)**:
   - Slash line animation drawing across the eye icon on click.
3. **Application Lock (`Unlock` -> `Lock`)**:
   - Padlock shackle snapping downward when auto-lock or manual lock engages.
4. **Download In-Progress (`Download` -> Animated downward pulse)**:
   - Subtle vertical bouncing arrow indicating active background network stream.
5. **Bookmark Toggle (`Bookmark` outline -> filled with pop scale)**:
   - Bouncy elastic pop (`scale: 1.25 -> 1.0`) when paper is saved offline.

