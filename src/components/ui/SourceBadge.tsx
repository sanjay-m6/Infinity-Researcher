import React from "react";

export interface SourceBadgeProps {
  sourceName?: string | null;
  size?: "sm" | "md";
  className?: string;
  showDot?: boolean;
}

interface SourceTheme {
  label: string;
  dotColor: string;
  containerClass: string;
}

export function getSourceTheme(sourceName?: string | null): SourceTheme {
  const norm = (sourceName || "").trim().toLowerCase();

  if (norm.includes("plos")) {
    return {
      label: sourceName?.replace(/open access journals/i, "OA").trim() || "PLOS",
      dotColor: "bg-fuchsia-500",
      containerClass:
        "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 dark:border-fuchsia-800/80",
    };
  }

  if (norm.includes("arxiv")) {
    return {
      label: "arXiv",
      dotColor: "bg-emerald-500",
      containerClass:
        "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80",
    };
  }

  if (norm.includes("pubmed") || norm.includes("pmc") || norm.includes("europe pmc") || norm.includes("europepmc")) {
    return {
      label: norm.includes("europe") ? "Europe PMC" : "PubMed",
      dotColor: "bg-sky-500",
      containerClass:
        "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/80",
    };
  }

  if (norm.includes("biorxiv") || norm.includes("medrxiv") || norm.includes("chemrxiv")) {
    const name = norm.includes("biorxiv")
      ? "bioRxiv"
      : norm.includes("medrxiv")
      ? "medRxiv"
      : "ChemRxiv";
    return {
      label: name,
      dotColor: "bg-rose-500",
      containerClass:
        "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/80",
    };
  }

  if (norm.includes("nature") || norm.includes("springer")) {
    return {
      label: norm.includes("srep") ? "Scientific Reports" : "Nature",
      dotColor: "bg-amber-500",
      containerClass:
        "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80",
    };
  }

  if (norm.includes("ieee")) {
    return {
      label: "IEEE Xplore",
      dotColor: "bg-cyan-500",
      containerClass:
        "bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800/80",
    };
  }

  if (norm.includes("semantic") || norm.includes("crossref") || norm.includes("openalex")) {
    return {
      label: norm.includes("crossref")
        ? "Crossref"
        : norm.includes("openalex")
        ? "OpenAlex"
        : "Semantic Scholar",
      dotColor: "bg-indigo-500",
      containerClass:
        "bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/80",
    };
  }

  return {
    label: sourceName || "Academic Article",
    dotColor: "bg-slate-400",
    containerClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  };
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  sourceName,
  size = "sm",
  className = "",
  showDot = true,
}) => {
  const theme = getSourceTheme(sourceName);

  const sizeClasses =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5 font-medium"
      : "text-xs px-2 py-0.5 font-semibold";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border tracking-tight select-none shadow-2xs ${theme.containerClass} ${sizeClasses} ${className}`}
      title={`Academic Provider: ${sourceName || theme.label}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme.dotColor}`}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{theme.label}</span>
    </span>
  );
};
