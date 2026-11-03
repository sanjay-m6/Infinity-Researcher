# Phase 8 — Loading and Data State Transitions

## 1. Overview

A critical requirement of Phase 8 is guaranteeing visual stability during async operations, data fetches, and view transitions. In academic research software, abrupt layout shifts cause disorientation and break cognitive focus during literature analysis.

## 2. Skeleton Loading Patterns

Infinity Researcher standardizes on Shadcn-compatible `Skeleton` components (`src/components/ui/Skeleton.tsx`) that match the approximate dimensions and contours of final content blocks:

| Component | Target Surface | Pulse Behavior | Layout Shielding |
|---|---|---|---|
| `Skeleton` | Generic elements, metric values | Low-contrast `bg-slate-200/80 dark:bg-white/[0.08]` | Matches text line height |
| `PaperCardSkeleton` | Discover search results, library cards | Multi-line ragged title, authors, badge strip | Prevents card collapse / jump |
| `TableSkeleton` | Matrix rows, history, download queues | Alternating column widths | Preserves table header alignment |
| `DetailsSkeleton` | Slide-over metadata drawer | Header, action bar, abstract blocks | Eliminates drawer content jumping |

## 3. Threshold-Aware Loading

To avoid distracting visual flicker on near-instantaneous operations (<100ms):
- Skeletons are reserved for operations with noticeable latency (e.g. streaming web scraping, candidate paper verification, database initial indexing).
- Fast in-memory filter updates and local collection switching swap instantaneously without flashing intermediate skeleton states.
- Error states retain retry actions and descriptive diagnostic messages without hiding failures behind persistent loading spinners.

## 4. Empty State to Content Transition

When empty states (`EmptyState.tsx`) transition into populated content:
- The transition employs pure opacity crossfading without vertical layout expansion.
- Container scroll position is preserved so researchers do not lose their place.

