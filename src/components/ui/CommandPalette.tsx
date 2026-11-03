import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../../context/AppContext";
import { Search, X, Trash2, ArrowRight } from "lucide-react";
import { AppIcon } from "../icons/AppIcon";
import { Badge } from "./Badge";
import { useUnifiedSearch } from "../../lib/search/useUnifiedSearch";
import { getHighlightSegments } from "../../lib/search/rankingEngine";
import { SearchResultCategory, SearchResultItem } from "../../lib/search/searchTypes";
import { NavSection } from "../../types/domain";

/**
 * Text highlighter component rendering matched query segments
 */
const HighlightText: React.FC<{ text: string; query: string; className?: string }> = ({
  text,
  query,
  className = "",
}) => {
  const segments = getHighlightSegments(text, query);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.isMatch ? (
          <span
            key={i}
            className="text-indigo-600 dark:text-indigo-400 font-semibold underline decoration-indigo-400/60 dark:decoration-indigo-500/60 underline-offset-2"
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
};

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setActiveSection,
    setSelectedPaperId,
    setSelectedCollectionId,
    executeGlobalSearch,
    toggleTheme,
    lockApplication,
    setIsAboutModalOpen,
    openFeedbackCenter,
    setIsOnboardingOpen,
    papers,
    collections,
  } = useApp();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Focus restoration & element tracking
  useEffect(() => {
    if (isCommandPaletteOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      if (
        previousActiveElement.current &&
        typeof previousActiveElement.current.focus === "function"
      ) {
        previousActiveElement.current.focus();
      }
    }
  }, [isCommandPaletteOpen]);

  // Global Keyboard Listener for Ctrl+K / Cmd+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle command palette on Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
      }

      // Close on Escape
      if (e.key === "Escape" && isCommandPaletteOpen) {
        e.preventDefault();
        setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen]);

  // Action dispatchers
  const handleSelectPaper = useCallback(
    (paperId: string) => {
      setSelectedPaperId(paperId);
      setIsCommandPaletteOpen(false);
    },
    [setSelectedPaperId, setIsCommandPaletteOpen]
  );

  const handleSelectCollection = useCallback(
    (collectionId: string) => {
      setSelectedCollectionId(collectionId);
      setActiveSection("collections");
      setIsCommandPaletteOpen(false);
    },
    [setSelectedCollectionId, setActiveSection, setIsCommandPaletteOpen]
  );

  const handleNavigateSection = useCallback(
    (section: NavSection) => {
      setActiveSection(section);
      setIsCommandPaletteOpen(false);
    },
    [setActiveSection, setIsCommandPaletteOpen]
  );

  const handleRunOnlineSearch = useCallback(
    (searchQuery: string) => {
      executeGlobalSearch(searchQuery);
      setIsCommandPaletteOpen(false);
    },
    [executeGlobalSearch, setIsCommandPaletteOpen]
  );

  const handleExecuteAction = useCallback(
    (actionId: string) => {
      switch (actionId) {
        case "act-toggle-theme":
          toggleTheme();
          break;
        case "act-lock-app":
          void lockApplication();
          break;
        case "act-onboarding":
          setIsOnboardingOpen(true);
          break;
        case "act-about":
          setIsAboutModalOpen(true);
          break;
        case "act-feedback":
          openFeedbackCenter("bug");
          break;
        default:
          break;
      }
      setIsCommandPaletteOpen(false);
    },
    [
      toggleTheme,
      lockApplication,
      setIsOnboardingOpen,
      setIsAboutModalOpen,
      openFeedbackCenter,
      setIsCommandPaletteOpen,
    ]
  );

  // Unified Search Engine Hook
  const {
    cleanQuery,
    clearHistory,
    recordSearch,
    resultsByCategory,
    flattenedResults,
    totalResultsCount,
  } = useUnifiedSearch({
    query,
    papers,
    collections,
    onSelectPaper: handleSelectPaper,
    onSelectCollection: handleSelectCollection,
    onNavigateSection: handleNavigateSection,
    onExecuteAction: handleExecuteAction,
    onRunOnlineSearch: handleRunOnlineSearch,
  });

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(totalResultsCount - 1, 0)));
  }, [totalResultsCount]);

  // Scroll active item into view
  useEffect(() => {
    if (listContainerRef.current) {
      const activeEl = listContainerRef.current.querySelector(
        `[data-result-index="${selectedIndex}"]`
      ) as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Keyboard Navigation inside input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(totalResultsCount, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + totalResultsCount) % Math.max(totalResultsCount, 1)
      );
    } else if (e.key === "Home") {
      e.preventDefault();
      setSelectedIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setSelectedIndex(Math.max(totalResultsCount - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flattenedResults[selectedIndex];
      if (target) {
        if (query.trim()) {
          recordSearch(query.trim());
        }
        target.onSelect();
      }
    }
  };

  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearHistory();
    setQuery("");
  };

  if (!isCommandPaletteOpen) return null;

  let globalRunningIndex = 0;

  const renderCategorySection = (
    title: string,
    categoryKey: SearchResultCategory,
    items: SearchResultItem[],
    extraHeaderAction?: React.ReactNode
  ) => {
    if (items.length === 0) return null;

    return (
      <div key={categoryKey} className="mb-3 last:mb-1">
        <div className="flex items-center justify-between px-3 py-1 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {title} ({items.length})
          </span>
          {extraHeaderAction}
        </div>
        <div className="space-y-0.5">
          {items.map((item) => {
            const itemIndex = globalRunningIndex++;
            const isSelected = selectedIndex === itemIndex;

            return (
              <div
                key={item.id}
                role="option"
                id={`cmd-item-${itemIndex}`}
                aria-selected={isSelected}
                aria-label={item.title}
                data-result-index={itemIndex}
                onClick={() => {
                  if (query.trim()) recordSearch(query.trim());
                  item.onSelect();
                }}
                onMouseEnter={() => setSelectedIndex(itemIndex)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                  isSelected
                    ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  <div
                    className={`p-1.5 rounded-md shrink-0 ${
                      isSelected
                        ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <AppIcon icon={item.icon} size="xs" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-medium truncate flex items-center gap-2">
                      <HighlightText text={item.title} query={cleanQuery} />
                    </div>
                    {item.subtitle && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.badge && (
                    <Badge variant={item.badgeVariant || "default"} size="sm">
                      {item.badge}
                    </Badge>
                  )}
                  {isSelected && (
                    <AppIcon
                      icon={ArrowRight}
                      size="xs"
                      className="text-indigo-500 dark:text-indigo-400 hidden sm:inline-block ml-1"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-20 p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150 select-none"
      onClick={() => setIsCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col select-text transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <AppIcon icon={Search} size="sm" className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={true}
            aria-controls="command-palette-results"
            aria-activedescendant={
              flattenedResults[selectedIndex] ? `cmd-item-${selectedIndex}` : undefined
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a screen name or search papers..."
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              aria-label="Clear search input"
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <AppIcon icon={X} size="xs" />
            </button>
          )}

          <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Results Scroll Container */}
        <div
          ref={listContainerRef}
          role="listbox"
          id="command-palette-results"
          aria-label="Search Results"
          className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-100/50 dark:divide-slate-800/40"
        >
          {/* History / Recent Searches */}
          {renderCategorySection(
            "Recent Searches",
            "history",
            resultsByCategory.history,
            <button
              type="button"
              onClick={handleClearHistory}
              aria-label="Clear recent searches"
              className="text-[10px] text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <AppIcon icon={Trash2} size="xs" />
              <span>Clear History</span>
            </button>
          )}

          {/* Research Papers */}
          {renderCategorySection("Research Papers", "papers", resultsByCategory.papers)}

          {/* Research Collections */}
          {renderCategorySection(
            "Collections",
            "collections",
            resultsByCategory.collections
          )}

          {/* Research Tools */}
          {renderCategorySection("Research Tools", "tools", resultsByCategory.tools)}

          {/* Navigation Pages */}
          {renderCategorySection(
            "Navigation",
            "navigation",
            resultsByCategory.navigation
          )}

          {/* Application Actions */}
          {renderCategorySection("Actions", "actions", resultsByCategory.actions)}

          {/* Empty State */}
          {cleanQuery && totalResultsCount === 0 && (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <AppIcon icon={Search} size="sm" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  No matching results found for &quot;{query}&quot;
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Try searching by author surname, DOI identifier, or query academic
                  preprint repositories.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  recordSearch(cleanQuery);
                  handleRunOnlineSearch(cleanQuery);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
              >
                <span>Search Online in Discover</span>
                <AppIcon icon={ArrowRight} size="xs" />
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Use <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> to
              navigate
            </span>
            <span className="hidden sm:inline">
              <kbd className="font-mono">Home</kbd> / <kbd className="font-mono">End</kbd>{" "}
              to jump
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              Press <kbd className="font-mono">Enter</kbd> to select
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CommandPalette;
