import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { SourceProvider } from "../../types/domain";
import { ExternalLink, Clock, Info } from "lucide-react";

export const SourcesView: React.FC = () => {
  const { sources, showToast } = useApp();

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedSourceForDetails, setSelectedSourceForDetails] =
    useState<SourceProvider | null>(null);

  const filteredSources = sources.filter((s) => {
    if (categoryFilter === "all") return true;
    return s.category === categoryFilter;
  });

  const categories = [
    "all",
    "API",
    "Repository",
    "Structured Feed",
    "Commercial (Link-Out)",
  ];

  const statusBadges = {
    Supported: <Badge variant="success">Supported</Badge>,
    "Not configured": <Badge variant="default">Not configured</Badge>,
    "Needs credentials": <Badge variant="warning">Needs API Key</Badge>,
    Restricted: <Badge variant="destructive">Restricted</Badge>,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Academic Sources & Provider Directory"
        description="Supported academic search engines, open repositories, and publisher metadata feeds."
      />

      {/* Demo Notice Banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold">Provider directory:</span> These 8 academic
          sources are aligned with the Phase 1 Source Support Matrix. Live API
          integrations and credential vaults will be connected in Phase 5.
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors shrink-0 ${
              categoryFilter === cat
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {cat === "all" ? `All Sources (${sources.length})` : cat}
          </button>
        ))}
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSources.map((source) => (
          <div
            key={source.id}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {source.name}
                    </h3>
                    <Badge variant="outline" size="sm">
                      {source.tier}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {source.category}
                  </span>
                </div>
                {statusBadges[source.status]}
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {source.description}
              </p>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {source.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                  >
                    ✓ {cap}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>Rate limit: {source.rateLimit}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSourceForDetails(source)}
                  className="text-xs"
                >
                  Details
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    showToast(
                      `Live API connector for ${source.name} is scheduled for Phase 5.`,
                      "info"
                    );
                  }}
                  className="text-xs"
                >
                  Configure
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Source Details Modal */}
      {selectedSourceForDetails && (
        <Modal
          isOpen={Boolean(selectedSourceForDetails)}
          onClose={() => setSelectedSourceForDetails(null)}
          title={`${selectedSourceForDetails.name} Details`}
          description={`${selectedSourceForDetails.category} • ${selectedSourceForDetails.tier}`}
          footer={
            <>
              <a
                href={selectedSourceForDetails.docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Documentation
              </a>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedSourceForDetails(null);
                  showToast(
                    `Provider credential setup for ${selectedSourceForDetails.name} is scheduled for Phase 5.`,
                    "info"
                  );
                }}
              >
                Done
              </Button>
            </>
          }
        >
          <div className="space-y-4 py-1 text-xs">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Description:
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                {selectedSourceForDetails.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-400">Rate Limits:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedSourceForDetails.rateLimit}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Connection State:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedSourceForDetails.status}
                </p>
              </div>
            </div>

            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Supported Features:
              </span>
              <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-400">
                {selectedSourceForDetails.capabilities.map((c) => (
                  <li key={c} className="flex items-center gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
