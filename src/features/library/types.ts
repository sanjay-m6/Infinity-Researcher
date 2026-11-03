export type LibraryViewMode = "table" | "grid" | "compact";

export type ReadingStatus = "unread" | "in_progress" | "read" | "archived";

export interface SemanticColorToken {
  name: string;
  badgeClass: string;
  dotClass: string;
  hex: string;
}

export const SEMANTIC_TAG_COLORS: Record<string, SemanticColorToken> = {
  indigo: {
    name: "Indigo",
    badgeClass: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    dotClass: "bg-indigo-500",
    hex: "#6366f1",
  },
  emerald: {
    name: "Emerald",
    badgeClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    dotClass: "bg-emerald-500",
    hex: "#10b981",
  },
  amber: {
    name: "Amber",
    badgeClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    dotClass: "bg-amber-500",
    hex: "#f59e0b",
  },
  rose: {
    name: "Rose",
    badgeClass: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    dotClass: "bg-rose-500",
    hex: "#f43f5e",
  },
  cyan: {
    name: "Cyan",
    badgeClass: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    dotClass: "bg-cyan-500",
    hex: "#06b6d4",
  },
  violet: {
    name: "Violet",
    badgeClass: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
    dotClass: "bg-violet-500",
    hex: "#8b5cf6",
  },
  slate: {
    name: "Slate",
    badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    dotClass: "bg-slate-500",
    hex: "#64748b",
  },
};

/** Deterministically assigns a semantic color token based on tag string hash */
export function getSemanticTagColor(tagName: string): SemanticColorToken {
  const keys = Object.keys(SEMANTIC_TAG_COLORS);
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = (hash << 5) - hash + tagName.charCodeAt(i);
    hash |= 0;
  }
  const key = keys[Math.abs(hash) % keys.length];
  return SEMANTIC_TAG_COLORS[key];
}

export const READING_STATUS_CONFIG: Record<
  ReadingStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  unread: {
    label: "Unread",
    badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    dotClass: "bg-slate-400",
  },
  in_progress: {
    label: "In Progress",
    badgeClass: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    dotClass: "bg-blue-500 animate-pulse",
  },
  read: {
    label: "Read",
    badgeClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    dotClass: "bg-emerald-500",
  },
  archived: {
    label: "Archived",
    badgeClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    dotClass: "bg-amber-500",
  },
};

