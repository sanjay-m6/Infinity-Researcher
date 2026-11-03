import React from "react";
import { ShieldCheck, Info } from "lucide-react";
import { generateParaphraseAttributionNotice } from "../writingEngine";

interface AttributionNoticeBannerProps {
  originalText: string;
}

export const AttributionNoticeBanner: React.FC<AttributionNoticeBannerProps> = ({
  originalText,
}) => {
  const notice = generateParaphraseAttributionNotice(originalText);
  if (!notice) return null;

  const hasCitations = notice.includes("Academic Attribution Preserved");

  return (
    <div
      className={`rounded-xl p-3 border text-xs flex items-start gap-2.5 ${
        hasCitations
          ? "bg-sky-50/70 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-200"
          : "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
      }`}
    >
      {hasCitations ? (
        <ShieldCheck className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
      ) : (
        <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
      )}
      <div className="space-y-0.5">
        <span className="font-bold block">
          {hasCitations ? "Academic Attribution Maintained" : "Mandatory Citation Notice"}
        </span>
        <p className="leading-relaxed opacity-90">{notice}</p>
      </div>
    </div>
  );
};
