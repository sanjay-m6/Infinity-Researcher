import React from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; onClick?: () => void }[];
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5"
            aria-label="Breadcrumb"
          >
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.label}>
                {idx > 0 && <span>/</span>}
                {crumb.onClick ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">{actions}</div>
      )}
    </div>
  );
};
