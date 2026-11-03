import React from "react";
import { ShieldAlert } from "lucide-react";

export const ClaimSupportNotice: React.FC = () => {
  return (
    <div className="rounded-2xl border bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/60 p-4 sm:p-4.5 space-y-2 text-xs shadow-xs">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
          <ShieldAlert className="w-4 h-4" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-amber-950 dark:text-amber-200">
              Crucial Distinction: Identifier Resolution vs. Claim Validity
            </h4>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
              Academic Guardrail
            </span>
          </div>

          <p className="text-amber-900/90 dark:text-amber-300/90 leading-relaxed">
            A DOI that resolves successfully confirms that the publication exists in formal registries (such as Crossref, IDF, or publisher repositories). 
            <strong> DOI resolution does NOT prove that the cited paper supports the author's scientific claim.</strong> 
            Always cross-check empirical claims against the actual full-text passages and data using our Literature Review Matrix or Embedded PDF Reader.
          </p>
        </div>
      </div>
    </div>
  );
};
