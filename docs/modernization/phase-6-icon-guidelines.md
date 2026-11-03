# Phase 6 — Icon System Guidelines

**Project:** Infinity Researcher  
**Phase:** 6 of 30 — Animated Icon System Modernization  
**Audience:** Frontend Engineers & UI Designers  

---

## 1. Icon Selection & Usage Rules

1. **Single Library Standard**: Use `lucide-react` icons exclusively. Do not import or bundle auxiliary icon sets.
2. **Stroke Visual Harmony**: Lucide stroke styling must be maintained across all workspaces. Avoid filled variant hacks unless indicating an active toggle state (e.g., filled `Bookmark` for a saved paper).
3. **No Unicode Emojis**: Do not use emojis (e.g., 📚, 🔍, ⚠️) as interface controls or status indicators. Emojis render inconsistently across Windows, macOS, and Linux, and lack theme contrast adaptation.
4. **Semantic Sizing Tokens**: Use standardized semantic tokens rather than arbitrary Tailwind dimensions:
   - `xs` (12px): Inline status chips, micro-badges, tags.
   - `sm` (16px): Compact controls, dropdown menu options, nested lists.
   - `md` (18px): Standard buttons, input adornments, table row actions.
   - `lg` (20px): Primary rail navigation, card headers, section titles.
   - `xl` (24px): Dialog titles, drawer banners, major feature hubs.
   - `2xl` (32px): Empty state illustrations, first-run onboarding banners.

---

## 2. Component Usage Examples

### 2.1 Decorative Icon
When an icon accompanies descriptive text, omit `aria-label` so `AppIcon` automatically sets `aria-hidden="true"`:
```tsx
import { AppIcon } from "@/components/icons";
import { Search } from "lucide-react";

<Button variant="primary">
  <AppIcon icon={Search} size="sm" />
  <span>Search Literature</span>
</Button>
```

### 2.2 Meaningful Standalone Icon
When an icon is rendered standalone without adjacent text, supply an explicit `aria-label`:
```tsx
<AppIcon
  icon={Lock}
  size="md"
  aria-label="Encrypted local database"
  title="Your database is encrypted with Argon2id"
  className="text-emerald-500"
/>
```

### 2.3 Interactive Icon Button
Always use `IconButton` for standalone icon actions. `aria-label` is required by TypeScript:
```tsx
import { IconButton } from "@/components/icons";
import { Settings } from "lucide-react";

<IconButton
  icon={Settings}
  aria-label="Open workspace preferences"
  tooltip="Preferences"
  tooltipSide="bottom"
  variant="ghost"
  size="md"
  onClick={handleOpenSettings}
/>
```

### 2.4 Controlled Task Animation
Synchronize spinning or pulsing icons with actual async task states:
```tsx
import { AnimatedIcon } from "@/components/icons";
import { RefreshCw } from "lucide-react";

<AnimatedIcon
  icon={RefreshCw}
  animation="spin"
  isAnimating={isSyncingDatabase}
  size="sm"
/>
```

### 2.5 Collapsible Disclosure
Link chevron rotation directly with section disclosure state:
```tsx
<IconButton
  icon={ChevronDown}
  aria-label={isExpanded ? "Collapse paper abstract" : "Expand paper abstract"}
  isExpanded={isExpanded}
  chevronAngle={180}
  animation="expand-chevron"
  onClick={() => setIsExpanded(!isExpanded)}
/>
```

