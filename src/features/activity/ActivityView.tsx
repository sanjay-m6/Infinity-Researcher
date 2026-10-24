import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ActivityStatus } from "../../types/domain";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Copy,
  Check,
  Filter,
} from "lucide-react";

export const ActivityView: React.FC = () => {
  const { activity, showToast } = useApp();

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredActivity = activity.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    return true;
  });

  const handleCopyLog = (item: (typeof activity)[0]) => {
    const text = `[${item.timestamp}] [${item.status.toUpperCase()}] [${item.type.toUpperCase()}] ${item.title}: ${item.details}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    showToast("Event log entry copied to clipboard.", "info");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statusIcons: Record<ActivityStatus, React.ReactNode> = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-sky-500 shrink-0" />,
  };

  const statusBadges: Record<ActivityStatus, React.ReactNode> = {
    success: (
      <Badge variant="success" size="sm">
        Success
      </Badge>
    ),
    warning: (
      <Badge variant="warning" size="sm">
        Warning
      </Badge>
    ),
    error: (
      <Badge variant="destructive" size="sm">
        Error
      </Badge>
    ),
    info: (
      <Badge variant="info" size="sm">
        Info
      </Badge>
    ),
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Activity & Event Logs"
        description="Audit log of search operations, downloads, collection adjustments, and system events."
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Types</option>
              <option value="search">Search</option>
              <option value="download">Download</option>
              <option value="collection">Collection</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 ml-2">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-400">
          {filteredActivity.length} events logged
        </span>
      </div>

      {/* Activity Timeline Table */}
      {filteredActivity.length > 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-2xs">
          {filteredActivity.map((item) => (
            <div
              key={item.id}
              className="flex items-start sm:items-center justify-between p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 sm:mt-0">{statusIcons[item.status]}</div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </span>
                    <Badge variant="outline" size="sm">
                      {item.type}
                    </Badge>
                    {statusBadges[item.status]}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    {item.details}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-mono text-slate-400">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyLog(item)}
                  title="Copy log entry"
                  aria-label="Copy log entry"
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                >
                  {copiedId === item.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Clock className="w-6 h-6" />}
          title="No activity events found"
          description="Try selecting 'All Types' and 'All Statuses' to view all system events."
        />
      )}
    </div>
  );
};
