import {
  DiscoveredSearchResult,
  SourceSearchStatus,
  AiChatMessage,
  AiChunkCitation,
  saveAiChatMessage,
  clearAiChatSession,
} from "../../lib/desktop-api";

export interface PaperAiInsight {
  type: string;
  title: string;
  content: string;
  citations: AiChunkCitation[];
  createdAt: string;
}

export interface DiscoverSessionState {
  // Search parameters
  searchQuery: string;
  submittedQuery?: string;
  activeJobId?: string | null;
  isSearching: boolean;
  discoveredResults: DiscoveredSearchResult[];
  sourceStatuses: SourceSearchStatus[];
  selectedSources: string[];
  activeEngine: "rust" | "python";

  // Selection & View
  selectedPaperId: string | null;
  activeRightTab: "details" | "chat" | "insights" | "notes";
  isLeftPaneCollapsed: boolean;
  isRightPaneCollapsed: boolean;
  leftPaneWidth: number;
  rightPaneWidth: number;
  targetPdfPage: number | undefined;

  // Filters
  filterYearStart: number | null;
  filterYearEnd: number | null;
  filterContentType: string;
  filterAccessStatus: string;
  filterAuthor: string;
  filterVenue: string;
  filterPeerReviewedOnly: boolean;
  sortBy: "best_match" | "newest" | "oldest" | "title_az" | "author_az" | "citations";
  quickFilter: "all" | "oa" | "downloaded";
  textFilter: string;
  limitPerSource?: number;

  // AI Chat & Insights cache (keyed by paperId)
  chatHistoryByPaper: Record<string, AiChatMessage[]>;
  insightsByPaper: Record<string, Record<string, PaperAiInsight>>;
}

const STORAGE_KEY = "paper_desktop_discover_session_v1";

const initialDefaultSources = [
  "arxiv",
  "biorxiv",
  "medrxiv",
  "plos",
  "nature_srep",
  "pmc",
  "ieee_xplore",
];

const defaultSessionState: DiscoverSessionState = {
  searchQuery: "",
  submittedQuery: "",
  activeJobId: null,
  isSearching: false,
  discoveredResults: [],
  sourceStatuses: [],
  selectedSources: initialDefaultSources,
  activeEngine: "rust",

  selectedPaperId: null,
  activeRightTab: "details",
  isLeftPaneCollapsed: false,
  isRightPaneCollapsed: false,
  leftPaneWidth: 380,
  rightPaneWidth: 380,
  targetPdfPage: undefined,

  filterYearStart: null,
  filterYearEnd: null,
  filterContentType: "all",
  filterAccessStatus: "all",
  filterAuthor: "",
  filterVenue: "all",
  filterPeerReviewedOnly: false,
  sortBy: "best_match",
  quickFilter: "all",
  textFilter: "",
  limitPerSource: 50,

  chatHistoryByPaper: {},
  insightsByPaper: {},
};

// In-memory module singleton that survives component remounts
let memoryState: DiscoverSessionState = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaultSessionState,
        ...parsed,
        // Active stream flag shouldn't be resumed in searching state on fresh startup
        isSearching: false,
        targetPdfPage: undefined,
      };
    }
  } catch (e) {
    console.warn("Failed to restore Discover session state from localStorage:", e);
  }
  return { ...defaultSessionState };
})();

// Listeners for store subscriptions
const listeners = new Set<(state: DiscoverSessionState) => void>();

function notify() {
  for (const listener of listeners) {
    listener(memoryState);
  }
}

function persistState() {
  try {
    const toSave: Partial<DiscoverSessionState> = {
      searchQuery: memoryState.searchQuery,
      submittedQuery: memoryState.submittedQuery,
      activeJobId: memoryState.activeJobId,
      discoveredResults: memoryState.discoveredResults,
      sourceStatuses: memoryState.sourceStatuses,
      selectedSources: memoryState.selectedSources,
      activeEngine: memoryState.activeEngine,
      selectedPaperId: memoryState.selectedPaperId,
      activeRightTab: memoryState.activeRightTab,
      isLeftPaneCollapsed: memoryState.isLeftPaneCollapsed,
      isRightPaneCollapsed: memoryState.isRightPaneCollapsed,
      leftPaneWidth: memoryState.leftPaneWidth,
      rightPaneWidth: memoryState.rightPaneWidth,
      filterYearStart: memoryState.filterYearStart,
      filterYearEnd: memoryState.filterYearEnd,
      filterContentType: memoryState.filterContentType,
      filterAccessStatus: memoryState.filterAccessStatus,
      filterAuthor: memoryState.filterAuthor,
      filterVenue: memoryState.filterVenue,
      filterPeerReviewedOnly: memoryState.filterPeerReviewedOnly,
      sortBy: memoryState.sortBy,
      quickFilter: memoryState.quickFilter,
      textFilter: memoryState.textFilter,
      limitPerSource: memoryState.limitPerSource,
      chatHistoryByPaper: memoryState.chatHistoryByPaper,
      insightsByPaper: memoryState.insightsByPaper,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn("Failed to persist discover session state:", e);
  }
}

export const discoverSessionStore = {
  getState(): DiscoverSessionState {
    return memoryState;
  },

  setState(updates: Partial<DiscoverSessionState> | ((prev: DiscoverSessionState) => Partial<DiscoverSessionState>)) {
    const patch = typeof updates === "function" ? updates(memoryState) : updates;
    memoryState = {
      ...memoryState,
      ...patch,
    };
    notify();
    persistState();
  },

  subscribe(listener: (state: DiscoverSessionState) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  // Helper actions
  setSearchQuery(query: string) {
    this.setState({ searchQuery: query });
  },

  setSelectedPaperId(id: string | null) {
    this.setState({ selectedPaperId: id, targetPdfPage: undefined });
  },

  setActiveRightTab(tab: "details" | "chat" | "insights" | "notes") {
    this.setState({ activeRightTab: tab });
  },

  setTargetPdfPage(page: number | undefined) {
    this.setState({ targetPdfPage: page });
  },

  addChatMessage(paperId: string, message: AiChatMessage, skipPersist = false) {
    const msgWithSession: AiChatMessage = {
      ...message,
      session_id: message.session_id || `discover_${paperId}`,
    };
    this.setState((prev) => {
      const existing = prev.chatHistoryByPaper[paperId] || [];
      return {
        chatHistoryByPaper: {
          ...prev.chatHistoryByPaper,
          [paperId]: [...existing, msgWithSession],
        },
      };
    });
    if (!skipPersist) {
      saveAiChatMessage(msgWithSession).catch((e) =>
        console.warn("Failed to persist discover chat message to SQLite:", e)
      );
    }
  },

  setChatMessages(paperId: string, messages: AiChatMessage[]) {
    this.setState((prev) => ({
      chatHistoryByPaper: {
        ...prev.chatHistoryByPaper,
        [paperId]: messages,
      },
    }));
  },

  clearChat(paperId: string) {
    this.setState((prev) => {
      const updated = { ...prev.chatHistoryByPaper };
      delete updated[paperId];
      return { chatHistoryByPaper: updated };
    });
    const sessionId = `discover_${paperId}`;
    clearAiChatSession(sessionId).catch((e) =>
      console.warn("Failed to clear discover chat session in SQLite:", e)
    );
  },

  setInsight(paperId: string, insightType: string, insight: PaperAiInsight) {
    this.setState((prev) => {
      const paperInsights = prev.insightsByPaper[paperId] || {};
      return {
        insightsByPaper: {
          ...prev.insightsByPaper,
          [paperId]: {
            ...paperInsights,
            [insightType]: insight,
          },
        },
      };
    });
  },

  clearAll() {
    memoryState = { ...defaultSessionState };
    notify();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to clear discover session storage:", e);
    }
  },
};
