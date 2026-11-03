import { useState, useCallback, useMemo } from "react";
import { Paper, Collection, NavSection } from "../../types/domain";
import { SearchResultCategory, SearchResultItem } from "./searchTypes";
import { APP_COMMANDS } from "./commandRegistry";
import { scorePaper, scoreCollection, scoreCommand } from "./rankingEngine";
import { getRecentSearches, addRecentSearch, clearRecentSearches } from "./searchHistory";
import {
  FileText,
  Folder,
  History,
  Globe,
} from "lucide-react";

export interface UseUnifiedSearchOptions {
  query: string;
  papers: Paper[];
  collections: Collection[];
  onSelectPaper: (paperId: string) => void;
  onSelectCollection: (collectionId: string) => void;
  onNavigateSection: (section: NavSection) => void;
  onExecuteAction: (actionId: string) => void;
  onRunOnlineSearch: (searchQuery: string) => void;
}

export interface UnifiedSearchResults {
  cleanQuery: string;
  recentSearches: string[];
  clearHistory: () => void;
  recordSearch: (q: string) => void;
  resultsByCategory: {
    history: SearchResultItem[];
    papers: SearchResultItem[];
    collections: SearchResultItem[];
    tools: SearchResultItem[];
    navigation: SearchResultItem[];
    actions: SearchResultItem[];
  };
  flattenedResults: SearchResultItem[];
  totalResultsCount: number;
}

export function useUnifiedSearch({
  query,
  papers,
  collections,
  onSelectPaper,
  onSelectCollection,
  onNavigateSection,
  onExecuteAction,
  onRunOnlineSearch,
}: UseUnifiedSearchOptions): UnifiedSearchResults {
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());

  const clearHistory = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const recordSearch = useCallback((q: string) => {
    const updated = addRecentSearch(q);
    setRecentSearches(updated);
  }, []);

  const cleanQuery = query.trim();

  const resultsByCategory = useMemo(() => {
    // -------------------------------------------------------------------------
    // 1. EMPTY QUERY STATE: Recent searches + top defaults
    // -------------------------------------------------------------------------
    if (!cleanQuery) {
      const historyItems: SearchResultItem[] = recentSearches.map((item, idx) => ({
        id: `history-${idx}`,
        title: item,
        subtitle: "Recent search query",
        category: "history",
        icon: History,
        score: 100 - idx,
        onSelect: () => onRunOnlineSearch(item),
      }));

      const topTools = APP_COMMANDS.filter((c) => c.category === "tool").slice(0, 4);
      const toolItems: SearchResultItem[] = topTools.map((cmd) => ({
        id: cmd.id,
        title: cmd.title,
        subtitle: cmd.description,
        category: "tools",
        icon: cmd.icon,
        score: 10,
        onSelect: () => cmd.section && onNavigateSection(cmd.section),
      }));

      const topNav = APP_COMMANDS.filter((c) => c.category === "navigation").slice(0, 4);
      const navItems: SearchResultItem[] = topNav.map((cmd) => ({
        id: cmd.id,
        title: cmd.title,
        subtitle: cmd.description,
        category: "navigation",
        icon: cmd.icon,
        score: 10,
        onSelect: () => cmd.section && onNavigateSection(cmd.section),
      }));

      return {
        history: historyItems,
        papers: [],
        collections: [],
        tools: toolItems,
        navigation: navItems,
        actions: [],
      };
    }

    // -------------------------------------------------------------------------
    // 2. ACTIVE QUERY SEARCH & RANKING
    // -------------------------------------------------------------------------

    // A. Papers Provider
    const scoredPapers: SearchResultItem[] = papers
      .map((p) => {
        const score = scorePaper(p, cleanQuery);
        return {
          id: `paper-${p.id}`,
          title: p.title,
          subtitle: `${p.authors && p.authors.length > 0 ? p.authors.join(", ") : "Unknown"} • ${p.venue || "Academic Article"} (${p.year || "N/A"})`,
          category: "papers" as SearchResultCategory,
          icon: FileText,
          score,
          badge: p.doi ? "DOI" : p.citationCount > 0 ? `${p.citationCount.toLocaleString()} cit.` : undefined,
          badgeVariant: p.doi ? ("info" as const) : ("secondary" as const),
          meta: {
            paperId: p.id,
            doi: p.doi,
            year: p.year,
            authors: p.authors,
          },
          onSelect: () => onSelectPaper(p.id),
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // B. Collections Provider
    const scoredCollections: SearchResultItem[] = collections
      .map((col) => {
        const score = scoreCollection(col, cleanQuery);
        return {
          id: `col-${col.id}`,
          title: col.name,
          subtitle: col.description || "Research collection binder",
          category: "collections" as SearchResultCategory,
          icon: Folder,
          score,
          badge: `${col.paperIds?.length || 0} papers`,
          badgeVariant: "outline" as const,
          meta: {
            collectionId: col.id,
          },
          onSelect: () => onSelectCollection(col.id),
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    // C. Commands: Tools, Navigation, Actions
    const scoredCommands = APP_COMMANDS.map((cmd) => {
      const score = scoreCommand(cmd, cleanQuery);
      return {
        cmd,
        score,
      };
    }).filter((res) => res.score > 0);

    const toolItems: SearchResultItem[] = scoredCommands
      .filter((res) => res.cmd.category === "tool")
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ cmd, score }) => ({
        id: cmd.id,
        title: cmd.title,
        subtitle: cmd.description,
        category: "tools" as SearchResultCategory,
        icon: cmd.icon,
        score,
        onSelect: () => cmd.section && onNavigateSection(cmd.section),
      }));

    const navItems: SearchResultItem[] = scoredCommands
      .filter((res) => res.cmd.category === "navigation")
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ cmd, score }) => ({
        id: cmd.id,
        title: cmd.title,
        subtitle: cmd.description,
        category: "navigation" as SearchResultCategory,
        icon: cmd.icon,
        score,
        onSelect: () => cmd.section && onNavigateSection(cmd.section),
      }));

    const actionItems: SearchResultItem[] = scoredCommands
      .filter((res) => res.cmd.category === "action")
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ cmd, score }) => ({
        id: cmd.id,
        title: cmd.title,
        subtitle: cmd.description,
        category: "actions" as SearchResultCategory,
        icon: cmd.icon,
        score,
        onSelect: () => onExecuteAction(cmd.id),
      }));

    const hasAnyLocalResults =
      scoredPapers.length > 0 ||
      scoredCollections.length > 0 ||
      toolItems.length > 0 ||
      navItems.length > 0 ||
      actionItems.length > 0;

    // If local results exist, append online search shortcut to actions
    const finalActions = hasAnyLocalResults
      ? [
          ...actionItems,
          {
            id: "act-online-search",
            title: `Search online for "${cleanQuery}"`,
            subtitle: "Query arXiv, OpenAlex, PubMed, and preprint servers in Discover",
            category: "actions" as SearchResultCategory,
            icon: Globe,
            score: 1,
            badge: "Discover",
            badgeVariant: "primary" as const,
            onSelect: () => onRunOnlineSearch(cleanQuery),
          },
        ]
      : [];

    return {
      history: [],
      papers: scoredPapers,
      collections: scoredCollections,
      tools: toolItems,
      navigation: navItems,
      actions: finalActions,
    };
  }, [cleanQuery, recentSearches, papers, collections, onSelectPaper, onSelectCollection, onNavigateSection, onExecuteAction, onRunOnlineSearch]);

  const flattenedResults = useMemo(() => {
    return [
      ...resultsByCategory.history,
      ...resultsByCategory.papers,
      ...resultsByCategory.collections,
      ...resultsByCategory.tools,
      ...resultsByCategory.navigation,
      ...resultsByCategory.actions,
    ];
  }, [resultsByCategory]);

  return {
    cleanQuery,
    recentSearches,
    clearHistory,
    recordSearch,
    resultsByCategory,
    flattenedResults,
    totalResultsCount: flattenedResults.length,
  };
}
