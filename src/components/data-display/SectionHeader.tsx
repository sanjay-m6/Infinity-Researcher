import React from "react";
import { cn } from "../../lib/utils";

export interface SectionHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  badge,
  actions,
  className = "",
}) => {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80",
        className
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
          {badge}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};

export default SectionHeader;
