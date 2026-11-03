# Phase 15: Tag Management & Semantic Color System Report

## 1. Executive Summary

Phase 15 introduces a structured, secure tag management system for academic literature. Tags provide lightweight, orthogonal classification across topics, methodologies, and priority levels. The system guarantees name normalization, full Unicode support, duplicate prevention, and semantic color token assignment without unrestricted raw CSS injection.

---

## 2. Tag Normalization & Validation Rules

To prevent fragmentation and duplicate tags, the following normalization pipeline executes on all tag inputs:

1. **Whitespace Trimming:** Leading, trailing, and redundant consecutive whitespace is collapsed (`"  machine   learning  "` -> `"machine learning"`).
2. **Unicode Preservation:** Accented characters, mathematical symbols, and international scripts are fully preserved (`"Hölder inequality"`, `"λ-calculus"`).
3. **Case Sensitivity & Deduplication:** Case-insensitive comparison prevents collisions (`"Deep Learning"` and `"deep learning"` resolve to the existing canonical form).
4. **Empty Token Stripping:** Empty or punctuation-only strings are discarded during comma-separated parsing.

---

## 3. Semantic Color Token System

To maintain visual accessibility, dark/light theme harmony, and security against arbitrary CSS/style injections, tags are mapped to predefined semantic color tokens:

```typescript
export const SEMANTIC_TAG_COLORS: Record<string, SemanticColorToken> = {
  indigo:  { name: "Indigo",  hex: "#6366f1", badgeClass: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800", dotClass: "bg-indigo-500" },
  emerald: { name: "Emerald", hex: "#10b981", badgeClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", dotClass: "bg-emerald-500" },
  amber:   { name: "Amber",   hex: "#f59e0b", badgeClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800", dotClass: "bg-amber-500" },
  rose:    { name: "Rose",    hex: "#f43f5e", badgeClass: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800", dotClass: "bg-rose-500" },
  cyan:    { name: "Cyan",    hex: "#06b6d4", badgeClass: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800", dotClass: "bg-cyan-500" },
  violet:  { name: "Violet",  hex: "#8b5cf6", badgeClass: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800", dotClass: "bg-violet-500" },
  slate:   { name: "Slate",   hex: "#64748b", badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700", dotClass: "bg-slate-500" },
};
```

Deterministic assignment uses a polynomial string hash on the tag name, guaranteeing that a given tag retains consistent coloring across table rows, grid cards, and filter badges.

---

## 4. TagManagerModal Capabilities

- **Paper Counts:** Aggregates live paper counts for every unique tag across the user's library.
- **Direct Library Filtering:** Clicking "View" on any tag immediately filters the main library view to papers tagged with that token.
- **Batch Renaming:** Renaming a tag updates all paper records in the SQLite database and React context.
- **Safe Deletion:** Removing a tag unlinks the tag association from all matching papers while keeping paper entities intact.

