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
import {
  getDatabaseInfo,
  listPapers as listPapersApi,
  createPaper as createPaperApi,
  toggleSavePaper as toggleSavePaperApi,
  listCollections as listCollectionsApi,
  createCollection as createCollectionApi,
  updateCollection as updateCollectionApi,
  deleteCollection as deleteCollectionApi,
  addPaperToCollection as addPaperToCollectionApi,
  removePaperFromCollection as removePaperFromCollectionApi,
  getAppSetting,
  setAppSetting,
  dbPaperToPaper,
  dbCollectionToCollection,
  DatabaseInfo,
} from "../lib/desktop-api";
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

  // Data State
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

  // Database Diagnostics & Persistence State
  databaseInfo: DatabaseInfo | null;
  isDbLoading: boolean;
  refreshDatabase: () => Promise<void>;
  seedSampleData: () => Promise<void>;
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

  // Database Persistence State
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
  const [isDbLoading, setIsDbLoading] = useState<boolean>(false);

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

  // Theme application and persistent sync
  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      setThemeState(newTheme);
      localStorage.setItem("rps_theme", newTheme);
      if (isTauriEnvironment()) {
        void setAppSetting("theme_mode", newTheme).catch(() => {});
      }
    },
    []
  );

  useEffect(() => {
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

  // Database refresh logic
  const refreshDatabase = useCallback(async () => {
    if (!isTauriEnvironment()) return;
    setIsDbLoading(true);
    try {
      const info = await getDatabaseInfo();
      setDatabaseInfo(info);

      const dbCollections = await listCollectionsApi();
      const pagedPapers = await listPapersApi({ page: 1, page_size: 100 });

      if (dbCollections.length > 0 || pagedPapers.items.length > 0) {
        // Map SQLite records to domain models
        const mappedCollections = dbCollections.map((c) =>
          dbCollectionToCollection(c)
        );
        const mappedPapers = pagedPapers.items.map((p) => dbPaperToPaper(p));

        setCollections(mappedCollections);
        if (mappedPapers.length > 0) {
          setPapers(mappedPapers);
        }
      }

      // Read persistent theme setting if saved in SQLite
      const savedTheme = await getAppSetting("theme_mode");
      if (savedTheme && (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system")) {
        setThemeState(savedTheme);
      }
    } catch {
      // Gracefully maintain in-memory state on error
    } finally {
      setIsDbLoading(false);
    }
  }, []);

  // Initial startup probe & database load
  useEffect(() => {
    void refreshHealth();
    void refreshDatabase();
  }, [refreshHealth, refreshDatabase]);

  // Seed sample data into SQLite
  const seedSampleData = useCallback(async () => {
    if (!isTauriEnvironment()) {
      setPapers(INITIAL_DEMO_PAPERS);
      setCollections(INITIAL_DEMO_COLLECTIONS);
      showToast("Seeded sample papers into memory.", "success");
      return;
    }

    try {
      setIsDbLoading(true);
      // Create sample collections in SQLite
      for (const col of INITIAL_DEMO_COLLECTIONS) {
        try {
          await createCollectionApi({
            name: col.name,
            description: col.description,
            color_hex: col.colorHex,
          });
        } catch {
          // Ignore duplicate collection error
        }
      }

      // Create sample papers in SQLite
      for (const paper of INITIAL_DEMO_PAPERS) {
        try {
          await createPaperApi({
            title: paper.title,
            canonical_doi: paper.doi,
            abstract_text: paper.abstract,
            publication_date: paper.publicationDate,
            publication_year: paper.year,
            venue: paper.venue,
            is_open_access: paper.accessStatus === "open_access",
            primary_landing_url: paper.landingUrl,
            pdf_url: paper.pdfUrl,
            is_saved: paper.isSaved,
            authors: paper.authors,
            tags: paper.tags,
            source_id: paper.sourceId,
          });
        } catch {
          // Ignore duplicate paper error
        }
      }

      await refreshDatabase();
      showToast("Seeded research library in SQLite database.", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to seed sample papers.";
      showToast(msg, "error");
    } finally {
      setIsDbLoading(false);
    }
  }, [refreshDatabase, showToast]);

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

      const newId = `col-${Date.now()}`;
      const newCol: Collection = {
        id: newId,
        name: trimmed,
        description: description.trim(),
        colorHex,
        paperIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDemo: !isTauriEnvironment(),
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

      if (isTauriEnvironment()) {
        void createCollectionApi({
          name: trimmed,
          description: description.trim(),
          color_hex: colorHex,
        })
          .then((created) => {
            setCollections((prev) =>
              prev.map((c) => (c.id === newId ? dbCollectionToCollection(created) : c))
            );
          })
          .catch((err) => {
            showToast(`Database error: ${err.message}`, "error");
          });
      }

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

      if (isTauriEnvironment()) {
        void updateCollectionApi({
          id,
          name: trimmed,
          description: description.trim(),
        }).catch((err) => {
          showToast(`Database error updating collection: ${err.message}`, "error");
        });
      }

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

      if (isTauriEnvironment()) {
        void deleteCollectionApi(id).catch((err) => {
          showToast(`Database error deleting collection: ${err.message}`, "error");
        });
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

          if (isTauriEnvironment()) {
            void toggleSavePaperApi(paperId, nextSaved).catch(() => {});
          }

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

      if (isTauriEnvironment()) {
        void toggleSavePaperApi(paperId, false).catch(() => {});
      }

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

      if (isTauriEnvironment()) {
        void addPaperToCollectionApi(collectionId, paperId).catch((err) => {
          showToast(`Database error: ${err.message}`, "error");
        });
      }

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

      if (isTauriEnvironment()) {
        void removePaperFromCollectionApi(collectionId, paperId).catch((err) => {
          showToast(`Database error: ${err.message}`, "error");
        });
      }

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
        setTheme,
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
        databaseInfo,
        isDbLoading,
        refreshDatabase,
        seedSampleData,
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
