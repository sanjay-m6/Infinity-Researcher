# Phase 8 — Layout Animation Guidelines

## 1. Principles of Restraint

In an academic research desktop environment, visual stability and immediate responsiveness take precedence over decorative motion. The application adheres to strict animation guidelines:

1. **Micro-Displacements Only**: Page entrances are restricted to `4px` or fewer of vertical movement. Large slide-ins (>20px) or dramatic scale zooms (>1.05x) are strictly prohibited.
2. **Fast Cadence**: Durations never exceed `180ms` for entrances and `120ms` for exits. Navigation must feel instantaneous to experienced researchers.
3. **No Decorative Layout Shifts**: Tables, matrices, literature review canvases, and search feeds must not animate their height or position continuously during ordinary data loading.
4. **Zero Input Blocking**: Exiting views must not intercept mouse or keyboard events.

## 2. Component Layout Transitions

### 2.1 Two-Column Navigation Sidebar (`Sidebar.tsx`)
- **Secondary Column Collapse**: Smooth width transition (`duration-200`) accompanied by an exit fade (`duration-150`).
- **Chevron Toggle**: Renders `<IconButton isExpanded={!isSecondaryCollapsed} chevronAngle={180} />` providing a 180-degree rotation that immediately communicates state without displacing other icons.
- **Roving Focus**: Keyboard focus transfers immediately without waiting for CSS transitions to settle.

### 2.2 Flyout Drawers & Modals (`Dialog.tsx`, `Drawer.tsx`, `CommandPalette.tsx`)
- **Backdrop**: Gentle opacity fade (`duration: 120ms`).
- **Modal Container**: 98% to 100% subtle scale settle with a `12px` vertical entrance.
- **Escape Dismissal**: Immediate response to `Escape` keypress, restoring focus to the initiating button.

### 2.3 Interactive Detail Panels
- **Abstract Expand/Collapse**: Smooth disclosure toggle in paper details drawer using content-height animation without jitter.
- **Filter Panels**: Bounded accordion behavior without full-page re-rendering.

