/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  NavSection,
  Paper,
  Collection,
  DownloadJob,
  SourceProvider,
  ActivityEvent,
} from "../types/domain";
import {
  INITIAL_DEMO_PAPERS,
  INITIAL_DEMO_COLLECTIONS,
  INITIAL_DEMO_JOBS,
  INITIAL_DEMO_SOURCES,
  INITIAL_DEMO_ACTIVITY,
} from "../data/demo-data";
import { getAppHealth, isTauriEnvironment } from "../lib/tauri-bridge";
import { HealthResponse } from "../types/health";

export type ThemeMode = "light" | "dark" | "system";

export interface ToastNotification {
  id: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
}

export interface AppContextType {
  // Navigation & View State
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;
  selectedPaperId: string | null;
  setSelectedPaperId: (id: string | null) => void;
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;

  // Search State across toolbar and Discover
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  executeGlobalSearch: (query: string) => void;

  // Theme Management
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // In-Memory Data State
  papers: Paper[];
  collections: Collection[];
  jobs: DownloadJob[];
  sources: SourceProvider[];
  activity: ActivityEvent[];

  // Mutations
  createCollection: (
    name: string,
    description: string,
    colorHex?: string
  ) => { success: boolean; error?: string };
  renameCollection: (
    id: string,
    name: string,
    description: string
  ) => { success: boolean; error?: string };
  deleteCollection: (id: string) => void;
  toggleSavePaper: (paperId: string) => void;
  removePaperFromLibrary: (paperId: string) => void;
  addPaperToCollection: (paperId: string, collectionId: string) => void;
  removePaperFromCollection: (paperId: string, collectionId: string) => void;
  retryJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;

  // Toasts
  toast: ToastNotification | null;
  showToast: (message: string, type?: ToastNotification["type"]) => void;

  // Real Backend Health State
  backendHealth: HealthResponse | null;
  isTauri: boolean;
  isHealthLoading: boolean;
  refreshHealth: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation
  const [activeSection, setActiveSection] = useState<NavSection>("dashboard");
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>("");

  // Theme
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("rps_theme");
    return (saved as ThemeMode) || "system";
  });

  // Data
  const [papers, setPapers] = useState<Paper[]>(INITIAL_DEMO_PAPERS);
  const [collections, setCollections] = useState<Collection[]>(INITIAL_DEMO_COLLECTIONS);
  const [jobs, setJobs] = useState<DownloadJob[]>(INITIAL_DEMO_JOBS);
  const [sources] = useState<SourceProvider[]>(INITIAL_DEMO_SOURCES);
  const [activity, setActivity] = useState<ActivityEvent[]>(INITIAL_DEMO_ACTIVITY);

  // Toast
  const [toast, setToast] = useState<ToastNotification | null>(null);

  // Backend Health
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [isTauri, setIsTauri] = useState<boolean>(true);
  const [isHealthLoading, setIsHealthLoading] = useState<boolean>(true);

  // Toast helper
  const showToast = useCallback(
    (message: string, type: ToastNotification["type"] = "info") => {
      const id = String(Date.now());
      setToast({ id, message, type });
      setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, 3500);
    },
    []
  );

  // Theme application
  useEffect(() => {
    localStorage.setItem("rps_theme", theme);
    const root = document.documentElement;

    const applyDark = () => {
      root.classList.add("dark");
    };
    const applyLight = () => {
      root.classList.remove("dark");
    };

    if (theme === "dark") {
      applyDark();
    } else if (theme === "light") {
      applyLight();
    } else {
      const isSystemDark =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isSystemDark) {
        applyDark();
      } else {
        applyLight();
      }
    }
  }, [theme]);

  // System theme change listener
  useEffect(() => {
    if (theme !== "system") return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  // Backend health probe
  const refreshHealth = useCallback(async () => {
    setIsHealthLoading(true);
    if (!isTauriEnvironment()) {
      setIsTauri(false);
      setIsHealthLoading(false);
      return;
    }
    setIsTauri(true);
    try {
      const h = await getAppHealth();
      setBackendHealth(h);
    } catch {
      setBackendHealth(null);
    } finally {
      setIsHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  // Global search trigger
  const executeGlobalSearch = useCallback((query: string) => {
    setGlobalSearchQuery(query);
    setActiveSection("discover");
    setSelectedPaperId(null);
  }, []);

  // Collection CRUD
  const createCollection = useCallback(
    (
      name: string,
      description: string,
      colorHex = "#6366f1"
    ): { success: boolean; error?: string } => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { success: false, error: "Collection name cannot be blank." };
      }
      if (trimmed.length > 50) {
        return {
          success: false,
          error: "Collection name must be 50 characters or less.",
        };
      }
      const duplicate = collections.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) {
        return {
          success: false,
          error: `A collection named "${trimmed}" already exists.`,
        };
      }

      const newCol: Collection = {
        id: `col-${Date.now()}`,
        name: trimmed,
        description: description.trim(),
        colorHex,
        paperIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDemo: true,
      };

      setCollections((prev) => [newCol, ...prev]);
      setActivity((prev) => [
        {
          id: `act-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "collection",
          status: "success",
          title: "Collection Created",
          details: `Created new collection "${trimmed}"`,
          isDemo: true,
        },
        ...prev,
      ]);
      showToast(`Collection "${trimmed}" created successfully.`, "success");
      return { success: true };
    },
    [collections, showToast]
  );

  const renameCollection = useCallback(
    (
      id: string,
      name: string,
      description: string
    ): { success: boolean; error?: string } => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { success: false, error: "Collection name cannot be blank." };
      }
      const duplicate = collections.some(
        (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) {
        return {
          success: false,
          error: `Another collection is already named "${trimmed}".`,
        };
      }

      setCollections((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                name: trimmed,
                description: description.trim(),
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );
      showToast(`Collection updated.`, "success");
      return { success: true };
    },
    [collections, showToast]
  );

  const deleteCollection = useCallback(
    (id: string) => {
      const target = collections.find((c) => c.id === id);
      if (!target) return;

      // Note: Deleting a collection NEVER deletes paper records
      setCollections((prev) => prev.filter((c) => c.id !== id));
      setPapers((prev) =>
        prev.map((p) => ({
          ...p,
          collectionIds: p.collectionIds.filter((cid) => cid !== id),
        }))
      );
      if (selectedCollectionId === id) {
        setSelectedCollectionId(null);
      }
      showToast(`Collection "${target.name}" removed (Papers preserved).`, "info");
    },
    [collections, selectedCollectionId, showToast]
  );

  const toggleSavePaper = useCallback(
    (paperId: string) => {
      setPapers((prev) =>
        prev.map((p) => {
          if (p.id !== paperId) return p;
          const nextSaved = !p.isSaved;
          showToast(
            nextSaved
              ? `Saved "${p.title.slice(0, 32)}..." to library.`
              : `Removed from saved library.`,
            "success"
          );
          return { ...p, isSaved: nextSaved };
        })
      );
    },
    [showToast]
  );

  const removePaperFromLibrary = useCallback(
    (paperId: string) => {
      setPapers((prev) =>
        prev.map((p) => (p.id === paperId ? { ...p, isSaved: false } : p))
      );
      showToast("Paper removed from library.", "info");
    },
    [showToast]
  );

  const addPaperToCollection = useCallback(
    (paperId: string, collectionId: string) => {
      setCollections((prev) =>
        prev.map((c) => {
          if (c.id !== collectionId) return c;
          if (c.paperIds.includes(paperId)) return c;
          return {
            ...c,
            paperIds: [...c.paperIds, paperId],
            updatedAt: new Date().toISOString(),
          };
        })
      );
      setPapers((prev) =>
        prev.map((p) => {
          if (p.id !== paperId) return p;
          if (p.collectionIds.includes(collectionId)) return p;
          return { ...p, collectionIds: [...p.collectionIds, collectionId] };
        })
      );
      showToast("Paper added to collection.", "success");
    },
    [showToast]
  );

  const removePaperFromCollection = useCallback(
    (paperId: string, collectionId: string) => {
      setCollections((prev) =>
        prev.map((c) => {
          if (c.id !== collectionId) return c;
          return {
            ...c,
            paperIds: c.paperIds.filter((id) => id !== paperId),
            updatedAt: new Date().toISOString(),
          };
        })
      );
      setPapers((prev) =>
        prev.map((p) => {
          if (p.id !== paperId) return p;
          return {
            ...p,
            collectionIds: p.collectionIds.filter((cid) => cid !== collectionId),
          };
        })
      );
      showToast("Paper removed from collection.", "info");
    },
    [showToast]
  );

  const retryJob = useCallback(
    (jobId: string) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "running",
                progressPercent: 15,
                stageMessage: "Retrying job (Demo simulation)...",
                errorMessage: undefined,
              }
            : j
        )
      );
      showToast("Job retry queued (Demo state).", "info");
    },
    [showToast]
  );

  const cancelJob = useCallback(
    (jobId: string) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "failed",
                stageMessage: "Cancelled by user (Demo state)",
                errorMessage: "Job was stopped by user request.",
              }
            : j
        )
      );
      showToast("Job cancelled.", "warning");
    },
    [showToast]
  );

  return (
    <AppContext.Provider
      value={{
        activeSection,
        setActiveSection,
        selectedPaperId,
        setSelectedPaperId,
        selectedCollectionId,
        setSelectedCollectionId,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        globalSearchQuery,
        setGlobalSearchQuery,
        executeGlobalSearch,
        theme,
        setTheme: setThemeState,
        papers,
        collections,
        jobs,
        sources,
        activity,
        createCollection,
        renameCollection,
        deleteCollection,
        toggleSavePaper,
        removePaperFromLibrary,
        addPaperToCollection,
        removePaperFromCollection,
        retryJob,
        cancelJob,
        toast,
        showToast,
        backendHealth,
        isTauri,
        isHealthLoading,
        refreshHealth,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
