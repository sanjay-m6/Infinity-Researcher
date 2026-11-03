import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Shadcn-compatible Skeleton component.
 * Displays a muted pulsing block to reserve layout space and prevent layout shifts.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = "", ...props }) => {
  return (
    <div
      data-slot="skeleton"
      className={`animate-pulse rounded-md bg-slate-200/80 dark:bg-white/[0.08] ${className}`}
      {...props}
    />
  );
};

export default Skeleton;

/**
 * Pre-composed Skeleton for paper cards (Discover search results, library list items).
 */
export const PaperCardSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 1,
  className = "",
}) => {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          data-slot="skeleton-paper-card"
          className="p-3 rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-white/60 dark:bg-[#0e1524]/60 space-y-2.5"
        >
          {/* Title (2 lines ragged) */}
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>

          {/* Authors & Year */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-2.5 w-12" />
          </div>

          {/* Badges / metadata pills */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Pre-composed multi-line ragged paragraph text skeleton.
 */
export const TextSkeleton: React.FC<{
  lines?: number;
  lastLineWidth?: string;
  className?: string;
}> = ({ lines = 3, lastLineWidth = "60%", className = "" }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          style={{
            width: i === lines - 1 ? lastLineWidth : "100%",
          }}
        />
      ))}
    </div>
  );
};

/**
 * Pre-composed Avatar + text row skeleton.
 */
export const AvatarSkeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="space-y-1.5 flex-1">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    </div>
  );
};

/**
 * Pre-composed Card skeleton with optional media banner, header, body lines, and footer.
 */
export const CardSkeleton: React.FC<{
  hasMedia?: boolean;
  lines?: number;
  className?: string;
}> = ({ hasMedia = false, lines = 2, className = "" }) => {
  return (
    <div
      data-slot="skeleton-card"
      className={`p-4 rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-white/60 dark:bg-[#0e1524]/60 space-y-3 ${className}`}
    >
      {hasMedia && <Skeleton className="h-28 w-full rounded-lg" />}
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <TextSkeleton lines={lines} lastLineWidth="70%" />
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
        <Skeleton className="h-6 w-16 rounded-md" />
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
    </div>
  );
};

/**
 * Pre-composed Table skeleton showing placeholder rows and columns.
 */
export const TableSkeleton: React.FC<{
  rows?: number;
  cols?: number;
  className?: string;
}> = ({ rows = 4, cols = 4, className = "" }) => {
  return (
    <div
      data-slot="skeleton-table"
      className={`w-full divide-y divide-slate-100 dark:divide-white/[0.04] rounded-lg border border-slate-200/70 dark:border-white/[0.06] overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-4 bg-slate-50/70 dark:bg-white/[0.02] p-3">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 p-3 bg-white/40 dark:bg-[#0e1524]/40"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-3 flex-1"
              style={{ opacity: Math.max(0.4, 0.9 - c * 0.15) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Pre-composed Academic PDF Document Page Skeleton.
 * Emulates a real scientific paper layout (standard A4 ratio, title, authors, abstract, 2-column layout, figure/equation boxes).
 */
export const PdfDocumentSkeleton: React.FC<{
  className?: string;
  showOverlay?: boolean;
  overlayContent?: React.ReactNode;
}> = ({ className = "", showOverlay = false, overlayContent }) => {
  return (
    <div
      data-slot="skeleton-pdf-document"
      className={`relative w-full h-full flex flex-col items-center p-4 md:p-6 overflow-y-auto bg-slate-100/90 dark:bg-slate-950/80 ${className}`}
    >
      {/* Simulated A4/Letter Paper Sheet Canvas */}
      <div className="relative w-full max-w-[720px] min-h-[960px] bg-white dark:bg-[#161f30] rounded-lg shadow-md border border-slate-200/90 dark:border-slate-800/90 p-8 md:p-12 space-y-6 select-none shrink-0 overflow-hidden">
        {/* Subtle shimmer accent line at very top of paper sheet */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500/20 via-indigo-500/80 to-indigo-500/20 animate-pulse" />

        {/* Top Journal / Conference Header Meta */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-28 rounded-full" />
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-32 rounded-full" />
        </div>

        {/* Paper Title (Ragged multi-line) */}
        <div className="space-y-2.5 pt-2">
          <Skeleton className="h-6 w-11/12 rounded" />
          <Skeleton className="h-6 w-3/4 rounded" />
        </div>

        {/* Authors, Affiliations & Corresponding Email */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-3.5 w-36 rounded" />
            <Skeleton className="h-3.5 w-24 rounded" />
          </div>
          <Skeleton className="h-2.5 w-3/5 rounded" />
        </div>

        {/* Abstract Container */}
        <div className="p-4 rounded-lg bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/50 space-y-2.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-16 font-bold rounded" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
          <Skeleton className="h-2.5 w-full rounded" />
          <Skeleton className="h-2.5 w-full rounded" />
          <Skeleton className="h-2.5 w-11/12 rounded" />
          <Skeleton className="h-2.5 w-4/5 rounded" />
        </div>

        {/* 2-Column Academic Article Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Column 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-6 rounded" />
              <Skeleton className="h-3.5 w-36 rounded" />
            </div>
            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-11/12 rounded" />
            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-4/5 rounded" />

            {/* Embedded Figure / Diagram Placeholder */}
            <div className="p-3 rounded-md border border-dashed border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/40 space-y-2 my-3">
              <Skeleton className="h-28 w-full rounded" />
              <div className="flex justify-center">
                <Skeleton className="h-2 w-48 rounded" />
              </div>
            </div>

            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-11/12 rounded" />
            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-3/4 rounded" />
          </div>

          {/* Column 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-6 rounded" />
              <Skeleton className="h-3.5 w-40 rounded" />
            </div>
            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-5/6 rounded" />

            {/* Mathematical Equation Placeholder */}
            <div className="p-2.5 rounded bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/40 flex items-center justify-between my-2">
              <Skeleton className="h-3 w-3/4 rounded" />
              <Skeleton className="h-2.5 w-6 rounded" />
            </div>

            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-4/5 rounded" />
            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-11/12 rounded" />
            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-2/3 rounded" />
          </div>
        </div>
      </div>

      {/* Floating Status & Action Overlay */}
      {showOverlay && overlayContent && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-900/10 dark:bg-black/30 backdrop-blur-[2px] z-20 pointer-events-auto">
          {overlayContent}
        </div>
      )}
    </div>
  );
};
