import React, { useState, useEffect, useMemo } from "react";
import { Search, Check, ChevronRight, Plus, X } from "lucide-react";
import {
  ResearchDomain,
  listResearchDomains,
  createCustomResearchDomain,
} from "../../../lib/desktop-api";
import { Button } from "../../../components/ui/Button";

interface DomainSelectorProps {
  selectedDomainId: string | null;
  selectedSubdomainId: string | null;
  customDomainText?: string | null;
  onChange: (
    domainId: string | null,
    subdomainId: string | null,
    customText?: string
  ) => void;
  allowCustom?: boolean;
}

export const DomainSelector: React.FC<DomainSelectorProps> = ({
  selectedDomainId,
  selectedSubdomainId,
  customDomainText,
  onChange,
  allowCustom = true,
}) => {
  const [domains, setDomains] = useState<ResearchDomain[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newCustomName, setNewCustomName] = useState("");

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      const data = await listResearchDomains();
      setDomains(data);
    } catch (e) {
      console.error("Failed to load research domains:", e);
    }
  };

  const primaryDomains = useMemo(() => {
    return domains.filter((d) => !d.parent_id);
  }, [domains]);

  const subdomainsMap = useMemo(() => {
    const map = new Map<string, ResearchDomain[]>();
    for (const d of domains) {
      if (d.parent_id) {
        if (!map.has(d.parent_id)) {
          map.set(d.parent_id, []);
        }
        map.get(d.parent_id)!.push(d);
      }
    }
    return map;
  }, [domains]);

  const selectedPrimary = useMemo(() => {
    return domains.find((d) => d.id === selectedDomainId) || null;
  }, [domains, selectedDomainId]);

  const selectedSub = useMemo(() => {
    return domains.find((d) => d.id === selectedSubdomainId) || null;
  }, [domains, selectedSubdomainId]);

  const filteredPrimaryDomains = useMemo(() => {
    if (!searchQuery.trim()) return primaryDomains;
    const q = searchQuery.toLowerCase();
    return primaryDomains.filter((p) => {
      const matchP =
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q);
      const subs = subdomainsMap.get(p.id) || [];
      const matchSub = subs.some((s) => s.name.toLowerCase().includes(q));
      return matchP || matchSub;
    });
  }, [primaryDomains, subdomainsMap, searchQuery]);

  const handleSelectPrimary = (pId: string) => {
    if (selectedDomainId === pId) {
      // Toggle off
      onChange(null, null, customDomainText || undefined);
    } else {
      onChange(pId, null, customDomainText || undefined);
    }
  };

  const handleSelectSub = (pId: string, sId: string) => {
    if (selectedSubdomainId === sId) {
      onChange(pId, null, customDomainText || undefined);
    } else {
      onChange(pId, sId, customDomainText || undefined);
    }
  };

  const handleCreateCustom = async () => {
    if (!newCustomName.trim()) return;
    try {
      const created = await createCustomResearchDomain({
        name: newCustomName.trim(),
        parent_id: selectedDomainId,
      });
      setDomains((prev) => [...prev, created]);
      if (selectedDomainId) {
        onChange(selectedDomainId, created.id, customDomainText || undefined);
      } else {
        onChange(created.id, null, customDomainText || undefined);
      }
      setNewCustomName("");
      setIsAddingCustom(false);
    } catch (e) {
      console.error("Failed to create custom domain:", e);
    }
  };

  return (
    <div className="space-y-2 text-xs">
      {/* Selected Domain Chips Summary */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        {selectedPrimary ? (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold text-[11px]">
            <span>{selectedPrimary.name}</span>
            {selectedSub && (
              <>
                <ChevronRight className="w-3 h-3 text-indigo-400" />
                <span className="font-bold text-indigo-900 dark:text-indigo-100">
                  {selectedSub.name}
                </span>
              </>
            )}
            <button
              type="button"
              onClick={() => onChange(null, null, customDomainText || undefined)}
              className="ml-1 hover:text-indigo-900 p-0.5 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">
            No domain selected (defaults to Interdisciplinary)
          </span>
        )}

        {customDomainText && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px]">
            <span>Custom: {customDomainText}</span>
            <button
              type="button"
              onClick={() => {
                onChange(selectedDomainId, selectedSubdomainId, "");
              }}
              className="ml-0.5 hover:text-purple-900 p-0.5 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-auto text-[11px] h-6 px-2"
        >
          {isExpanded ? "Hide Taxonomy" : "Browse Domains"}
        </Button>
      </div>

      {/* Expanded Domain Selector Tree */}
      {isExpanded && (
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search research domains & subfields (e.g. Machine Learning, NLP, Robotics)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Hierarchical Categories */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {filteredPrimaryDomains.map((p) => {
              const subs = subdomainsMap.get(p.id) || [];
              const isPSelected = selectedDomainId === p.id;

              return (
                <div
                  key={p.id}
                  className={`p-2.5 rounded-lg border transition-all ${
                    isPSelected
                      ? "border-indigo-200 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-950/20"
                      : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleSelectPrimary(p.id)}
                      className="flex items-center gap-2 text-left font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: p.color || "#6366f1" }}
                      />
                      <span>{p.name}</span>
                    </button>

                    {isPSelected && !selectedSubdomainId && (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Selected Domain
                      </span>
                    )}
                  </div>

                  {p.description && (
                    <p className="text-[11px] text-slate-400 mt-0.5 ml-4">
                      {p.description}
                    </p>
                  )}

                  {/* Subdomain Chips */}
                  {subs.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 ml-4 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                      {subs.map((s) => {
                        const isSSelected = selectedSubdomainId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSelectSub(p.id, s.id)}
                            className={`px-2 py-0.5 rounded-md text-[11px] transition-colors flex items-center gap-1 ${
                              isSSelected
                                ? "bg-indigo-600 text-white font-medium"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                            }`}
                          >
                            <span>{s.name}</span>
                            {isSSelected && <Check className="w-2.5 h-2.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom Domain Input */}
          {allowCustom && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {isAddingCustom ? (
                <div className="flex items-center gap-1.5 w-full">
                  <input
                    type="text"
                    placeholder="Enter custom subfield name..."
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    className="flex-1 px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={handleCreateCustom}
                    className="text-xs h-7"
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddingCustom(false)}
                    className="text-xs h-7"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(true)}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Custom Subfield
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
