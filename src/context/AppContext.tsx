/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
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
  INITIAL_DEMO_SOURCES,
} from "../data/demo-data";
import { getAppHealth, isTauriEnvironment, getErrorMessage } from "../lib/tauri-bridge";
import {
  getDatabaseInfo,
  listPapers as listPapersApi,
  createPaper as createPaperApi,
  toggleSavePaper as toggleSavePaperApi,
  deletePaper as deletePaperApi,
  listCollections as listCollectionsApi,
  createCollection as createCollectionApi,
  updateCollection as updateCollectionApi,
  deleteCollection as deleteCollectionApi,
  addPaperToCollection as addPaperToCollectionApi,
  removePaperFromCollection as removePaperFromCollectionApi,
  setPaperReadingStatus as setPaperReadingStatusApi,
  setPaperReadingProgress as setPaperReadingProgressApi,
  touchPaperOpened as touchPaperOpenedApi,
  assignTagToPaper as assignTagToPaperApi,
  removeTagFromPaper as removeTagFromPaperApi,
  updatePaper as updatePaperApi,
  listSavedSearches as listSavedSearchesApi,
  createSavedSearch as createSavedSearchApi,
  deleteSavedSearch as deleteSavedSearchApi,
  SavedSearch,
  SavedSearchCreateInput,
  getAppSetting,
  dbPaperToPaper,
  dbCollectionToCollection,
  DatabaseInfo,
  User,
  UserPreferences,
  authSignup,
  authLogin,
  authLogout,
  authLock,
  authUnlock,
  authRestoreRememberedSession,
  authGetPreferences,
  authUpdatePreferences,
  authChangePassword,
  authTouchActivity,
} from "../lib/desktop-api";
import { HealthResponse } from "../types/health";
import { IssueCategory } from "../lib/github/types";
import {
  ThemePreference,
  ResolvedTheme,
  ThemeMode,
  ThemeSplashOrigin,
} from "../types/theme";
import {
  getStoredThemePreference,
  applyThemeToDocument,
  loadDbThemePreference,
} from "../lib/theme-persistence";
import { executeThemeSplash } from "../lib/theme-transition";
import { ThemeContext } from "../components/theme/ThemeProvider";

export type { ThemeMode, ThemePreference, ResolvedTheme };

export interface ToastNotification {
  id: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
}

export interface ReadingPaperTarget {
  id: string;
  title: string;
  sourceUrl?: string | null;
}

export interface AppContextType {
  // Navigation & View State
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;
  selectedPaperId: string | null;
  setSelectedPaperId: (id: string | null) => void;
  readingPaper: ReadingPaperTarget | null;
  setReadingPaper: (paper: ReadingPaperTarget | null) => void;
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isAboutModalOpen: boolean;
  setIsAboutModalOpen: (open: boolean) => void;
  isDonationModalOpen: boolean;
  setIsDonationModalOpen: (open: boolean) => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  isFeedbackCenterOpen: boolean;
  setIsFeedbackCenterOpen: (open: boolean) => void;
  feedbackCategory: IssueCategory;
  openFeedbackCenter: (cat?: IssueCategory) => void;

  // Search State across toolbar and Discover
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  executeGlobalSearch: (query: string) => void;

  // Theme Management
  theme: ThemeMode;
  preference: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setTheme: (theme: ThemeMode, origin?: ThemeSplashOrigin) => void;
  toggleTheme: (origin?: ThemeSplashOrigin) => void;
  setThemeWithSplash: (theme: ThemeMode, origin?: ThemeSplashOrigin) => Promise<void>;
  isThemeInitialized: boolean;

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
  refreshPapers: () => Promise<void>;
  updatePaperReadingStatus: (paperId: string, status: string) => Promise<void>;
  updatePaperReadingProgress: (paperId: string, progress: number) => Promise<void>;
  recordPaperOpened: (paperId: string) => Promise<void>;
  assignTagToPaper: (paperId: string, tagName: string) => Promise<void>;
  removeTagFromPaper: (paperId: string, tagIdOrName: string) => Promise<void>;
  updatePaperMetadata: (paperId: string, fields: Partial<Paper>) => Promise<void>;
  savedSearches: SavedSearch[];
  refreshSavedSearches: () => Promise<void>;
  createSavedSearch: (input: SavedSearchCreateInput) => Promise<SavedSearch>;
  deleteSavedSearch: (id: string) => Promise<void>;
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
  clearAllData: () => Promise<void>;

  // Local Authentication & App Lock State
  user: User | null;
  authToken: string | null;
  isLocked: boolean;
  userPreferences: UserPreferences | null;
  continueAsGuest: () => void;
  loginUser: (identifier: string, password: string, rememberMe?: boolean) => Promise<void>;
  signupUser: (email: string, username: string, password: string, confirmPassword: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  lockApplication: () => Promise<void>;
  unlockApplication: (password: string) => Promise<void>;
  updateUserPreferences: (prefs: { auto_lock_timeout_minutes: number; remember_me: boolean; theme?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export interface AppProviderProps {
  children: ReactNode;
  initialSection?: NavSection;
  initialPapers?: Paper[];
  initialCollections?: Collection[];
  initialJobs?: DownloadJob[];
  initialActivity?: ActivityEvent[];
  initialUser?: User | null;
}

export const DEFAULT_LOCAL_RESEARCHER: User = {
  id: "usr_local_researcher",
  email: "researcher@local.workspace",
  username: "Local Researcher",
  created_at: "2026-01-01T00:00:00.000Z",
  last_login_at: new Date().toISOString(),
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<AppProviderProps> = ({
  children,
  initialSection = "dashboard",
  initialPapers = [],
  initialCollections = [],
  initialJobs = [],
  initialActivity = [],
  initialUser,
}) => {
  // Navigation
  const [activeSection, setActiveSection] = useState<NavSection>(initialSection);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [readingPaper, setReadingPaper] = useState<ReadingPaperTarget | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isFeedbackCenterOpen, setIsFeedbackCenterOpen] = useState<boolean>(false);
  const [feedbackCategory, setFeedbackCategory] = useState<IssueCategory>("bug");

  const openFeedbackCenter = useCallback((cat?: IssueCategory) => {
    if (cat) setFeedbackCategory(cat);
    setIsFeedbackCenterOpen(true);
  }, []);

  // Check if first-run onboarding is needed
  useEffect(() => {
    // In automated testing environments, do not auto-launch wizard unless explicitly invoked
    if (
      (typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || process.env?.VITEST)) ||
      (typeof window !== "undefined" && (window as unknown as { __VITEST_ENVIRONMENT__?: unknown }).__VITEST_ENVIRONMENT__)
    ) {
      return;
    }

    void (async () => {
      try {
        const completed = await getAppSetting("onboarding_completed");
        if (!completed) {
          const ls = localStorage.getItem("rps_onboarding_completed");
          if (!ls) {
            setIsOnboardingOpen(true);
          }
        }
      } catch {
        const ls = localStorage.getItem("rps_onboarding_completed");
        if (!ls) {
          setIsOnboardingOpen(true);
        }
      }
    })();
  }, []);

  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>("");

  const outerTheme = useContext(ThemeContext);

  // Theme
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    return getStoredThemePreference();
  });
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      try {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      } catch {
        // fallback
      }
    }
    return true;
  });
  const [isThemeInitialized, setIsThemeInitialized] = useState<boolean>(false);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === "dark") return "dark";
    if (theme === "light") return "light";
    return systemIsDark ? "dark" : "light";
  }, [theme, systemIsDark]);

  const isDark = resolvedTheme === "dark";

  // Data (defaults to clean 0 records in production)
  const [papers, setPapers] = useState<Paper[]>(initialPapers);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [jobs, setJobs] = useState<DownloadJob[]>(initialJobs);
  const [sources] = useState<SourceProvider[]>(INITIAL_DEMO_SOURCES);
  const [activity, setActivity] = useState<ActivityEvent[]>(initialActivity);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  // Toast
  const [toast, setToast] = useState<ToastNotification | null>(null);

  // Backend Health
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [isTauri, setIsTauri] = useState<boolean>(true);
  const [isHealthLoading, setIsHealthLoading] = useState<boolean>(true);

  // Database Persistence State
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
  const [isDbLoading, setIsDbLoading] = useState<boolean>(false);

  // Local Authentication & Lock Screen State
  const [user, setUser] = useState<User | null>(() => {
    if (initialUser !== undefined) return initialUser;
    // In test environment, default to an authenticated mock user unless explicitly set to null
    if (
      (typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || process.env?.VITEST)) ||
      (typeof window !== "undefined" && (window as unknown as { __VITEST_ENVIRONMENT__?: unknown }).__VITEST_ENVIRONMENT__)
    ) {
      return {
        id: "usr_test_default",
        email: "researcher@university.edu",
        username: "test_researcher",
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      };
    }
    return DEFAULT_LOCAL_RESEARCHER;
  });
  const [authToken, setAuthToken] = useState<string | null>(() => (user ? "token_local_researcher" : null));
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);


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

  // Restore remembered session on app launch
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const remembered = await authRestoreRememberedSession();
        if (remembered && isMounted) {
          setUser(remembered.user);
          setAuthToken(remembered.token);
          setIsLocked(false);
          const prefs = await authGetPreferences(remembered.token);
          if (isMounted) setUserPreferences(prefs);
        }
      } catch (err) {
        console.warn("Failed to restore remembered session:", err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const continueAsGuest = useCallback(() => {
    setUser(DEFAULT_LOCAL_RESEARCHER);
    setAuthToken("token_local_researcher");
    setIsLocked(false);
    showToast("Welcome to your local research workspace!", "info");
  }, [showToast]);

  // Theme application and persistent sync with optional circular splash transition
  const setTheme = useCallback(
    (newTheme: ThemePreference, origin?: ThemeSplashOrigin) => {
      if (outerTheme) {
        outerTheme.setTheme(newTheme, origin);
        return;
      }
      void executeThemeSplash(newTheme, {
        origin,
        onThemeChange: (t) => setThemeState(t),
      });
    },
    [outerTheme]
  );

  const setThemeWithSplash = useCallback(
    async (newTheme: ThemePreference, origin?: ThemeSplashOrigin) => {
      if (outerTheme) {
        await outerTheme.setThemeWithSplash(newTheme, origin);
        return;
      }
      await executeThemeSplash(newTheme, {
        origin,
        onThemeChange: (t) => setThemeState(t),
      });
    },
    [outerTheme]
  );

  const toggleTheme = useCallback(
    (origin?: ThemeSplashOrigin) => {
      if (outerTheme) {
        outerTheme.toggleTheme(origin);
        return;
      }
      const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
      setTheme(nextTheme, origin);
    },
    [outerTheme, resolvedTheme, setTheme]
  );

  // Apply theme to document element
  useEffect(() => {
    if (!outerTheme) {
      applyThemeToDocument(resolvedTheme);
    }
  }, [resolvedTheme, outerTheme]);

  // System theme change listener (reactive)
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    if (media.addEventListener) {
      media.addEventListener("change", listener);
    } else {
      media.addListener(listener);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, []);

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

      // Always synchronize state directly with real SQLite database
      const mappedCollections = dbCollections.map((c) =>
        dbCollectionToCollection(c)
      );
      const mappedPapers = pagedPapers.items.map((p) => dbPaperToPaper(p));

      setCollections(mappedCollections);
      setPapers(mappedPapers);

      try {
        const sSearches = await listSavedSearchesApi();
        setSavedSearches(sSearches);
      } catch {
        // saved searches optional
      }

      // Read persistent theme setting if saved in SQLite
      const savedTheme = await loadDbThemePreference();
      if (savedTheme) {
        setThemeState(savedTheme);
      }
      setIsThemeInitialized(true);
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
      const msg = getErrorMessage(err, "Failed to seed sample papers.");
      showToast(msg, "error");
    } finally {
      setIsDbLoading(false);
    }
  }, [refreshDatabase, showToast]);

  // Purge all mock, test, and persistent data completely
  const clearAllData = useCallback(async () => {
    try {
      setIsDbLoading(true);
      if (isTauriEnvironment()) {
        const paged = await listPapersApi({ page: 1, page_size: 1000 });
        for (const p of paged.items) {
          try {
            await deletePaperApi(p.id);
          } catch {
            // continue
          }
        }
        const cols = await listCollectionsApi();
        for (const c of cols) {
          try {
            await deleteCollectionApi(c.id);
          } catch {
            // continue
          }
        }
      }
      setPapers([]);
      setCollections([]);
      setJobs([]);
      setActivity([]);
      setSelectedPaperId(null);
      setSelectedCollectionId(null);
      await refreshDatabase();
      showToast("Cleared all library papers, collections, and mock data.", "success");
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to clear library data.");
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
        isDemo: false,
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
          isDemo: false,
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

  const refreshPapers = useCallback(async () => {
    if (!isTauriEnvironment()) return;
    try {
      const paged = await listPapersApi({ page: 1, page_size: 200 });
      setPapers(paged.items.map(dbPaperToPaper));
    } catch (err) {
      console.error("Failed to refresh papers:", err);
    }
  }, []);

  const updatePaperReadingStatus = useCallback(
    async (paperId: string, status: string) => {
      setPapers((prev) =>
        prev.map((p) => (p.id === paperId ? { ...p, readingStatus: status } : p))
      );
      if (isTauriEnvironment()) {
        try {
          await setPaperReadingStatusApi(paperId, status);
        } catch (err) {
          showToast(`Failed to update reading status: ${getErrorMessage(err)}`, "error");
        }
      }
    },
    [showToast]
  );

  const updatePaperReadingProgress = useCallback(
    async (paperId: string, progress: number) => {
      setPapers((prev) =>
        prev.map((p) => (p.id === paperId ? { ...p, readingProgress: progress } : p))
      );
      if (isTauriEnvironment()) {
        try {
          await setPaperReadingProgressApi(paperId, progress);
        } catch (err) {
          showToast(`Failed to update reading progress: ${getErrorMessage(err)}`, "error");
        }
      }
    },
    [showToast]
  );

  const recordPaperOpened = useCallback(async (paperId: string) => {
    const now = new Date().toISOString();
    setPapers((prev) =>
      prev.map((p) => (p.id === paperId ? { ...p, lastOpenedAt: now } : p))
    );
    if (isTauriEnvironment()) {
      try {
        await touchPaperOpenedApi(paperId);
      } catch (err) {
        console.warn("Failed to touch paper opened:", err);
      }
    }
  }, []);

  const assignTagToPaper = useCallback(
    async (paperId: string, tagName: string) => {
      const cleanTag = tagName.trim();
      if (!cleanTag) return;
      setPapers((prev) =>
        prev.map((p) => {
          if (p.id !== paperId) return p;
          if (p.tags.includes(cleanTag)) return p;
          return { ...p, tags: [...p.tags, cleanTag] };
        })
      );
      if (isTauriEnvironment()) {
        try {
          await assignTagToPaperApi(paperId, cleanTag);
        } catch (err) {
          showToast(`Failed to assign tag: ${getErrorMessage(err)}`, "error");
        }
      }
    },
    [showToast]
  );

  const removeTagFromPaper = useCallback(
    async (paperId: string, tagIdOrName: string) => {
      setPapers((prev) =>
        prev.map((p) => {
          if (p.id !== paperId) return p;
          return { ...p, tags: p.tags.filter((t) => t !== tagIdOrName) };
        })
      );
      if (isTauriEnvironment()) {
        try {
          await removeTagFromPaperApi(paperId, tagIdOrName);
        } catch (err) {
          showToast(`Failed to remove tag: ${getErrorMessage(err)}`, "error");
        }
      }
    },
    [showToast]
  );

  const updatePaperMetadata = useCallback(
    async (paperId: string, fields: Partial<Paper>) => {
      setPapers((prev) =>
        prev.map((p) => (p.id === paperId ? { ...p, ...fields } : p))
      );
      if (isTauriEnvironment()) {
        try {
          await updatePaperApi({
            id: paperId,
            title: fields.title,
            canonical_doi: fields.doi,
            abstract_text: fields.abstract,
            publication_year: fields.year,
            venue: fields.venue,
            tags: fields.tags,
          });
          showToast("Paper metadata updated.", "success");
        } catch (err) {
          showToast(`Failed to update metadata: ${getErrorMessage(err)}`, "error");
        }
      }
    },
    [showToast]
  );

  const refreshSavedSearches = useCallback(async () => {
    if (!isTauriEnvironment()) return;
    try {
      const searches = await listSavedSearchesApi();
      setSavedSearches(searches);
    } catch (err) {
      console.error("Failed to refresh saved searches:", err);
    }
  }, []);

  const createSavedSearch = useCallback(
    async (input: SavedSearchCreateInput): Promise<SavedSearch> => {
      if (isTauriEnvironment()) {
        const created = await createSavedSearchApi(input);
        setSavedSearches((prev) => [created, ...prev]);
        showToast(`Saved search "${input.name}" created.`, "success");
        return created;
      } else {
        const mock: SavedSearch = {
          id: `ss_${Date.now()}`,
          name: input.name,
          description: input.description ?? null,
          query_text: input.query_text ?? null,
          structured_query_json: input.structured_query_json ?? null,
          selected_sources_json: input.selected_sources_json ?? null,
          filters_json: input.filters_json ?? null,
          sort_by: input.sort_by ?? null,
          result_count_estimate: 0,
          last_executed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setSavedSearches((prev) => [mock, ...prev]);
        showToast(`Saved search "${input.name}" saved.`, "success");
        return mock;
      }
    },
    [showToast]
  );

  const deleteSavedSearch = useCallback(
    async (id: string) => {
      setSavedSearches((prev) => prev.filter((s) => s.id !== id));
      if (isTauriEnvironment()) {
        try {
          await deleteSavedSearchApi(id);
          showToast("Saved search removed.", "info");
        } catch (err) {
          showToast(`Failed to delete saved search: ${getErrorMessage(err)}`, "error");
        }
      }
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

  // Authentication Actions
  const loginUser = useCallback(
    async (identifier: string, password: string, rememberMe?: boolean) => {
      const res = await authLogin({ identifier, password, remember_me: rememberMe });
      setUser(res.user);
      setAuthToken(res.token);
      setIsLocked(false);
      try {
        const prefs = await authGetPreferences(res.token);
        setUserPreferences(prefs);
      } catch {
        // ignore
      }
      showToast(`Welcome back, ${res.user.username}!`, "success");
    },
    [showToast]
  );

  const signupUser = useCallback(
    async (email: string, username: string, password: string, confirmPassword: string) => {
      const res = await authSignup({ email, username, password, confirm_password: confirmPassword });
      setUser(res.user);
      setAuthToken(res.token);
      setIsLocked(false);
      try {
        const prefs = await authGetPreferences(res.token);
        setUserPreferences(prefs);
      } catch {
        // ignore
      }
      showToast(`Account created! Welcome, ${res.user.username}.`, "success");
    },
    [showToast]
  );

  const logoutUser = useCallback(async () => {
    if (authToken) {
      try {
        await authLogout(authToken);
      } catch {
        // ignore
      }
    }
    setUser(null);
    setAuthToken(null);
    setIsLocked(false);
    setUserPreferences(null);
    showToast("Logged out successfully.", "info");
  }, [authToken, showToast]);

  const lockApplication = useCallback(async () => {
    if (authToken) {
      try {
        await authLock(authToken);
      } catch {
        // ignore
      }
    }
    setIsLocked(true);
    showToast("Application locked.", "info");
  }, [authToken, showToast]);

  const unlockApplication = useCallback(
    async (password: string) => {
      if (!authToken) {
        throw new Error("No active session to unlock.");
      }
      const res = await authUnlock(authToken, password);
      setUser(res.user);
      setAuthToken(res.token);
      setIsLocked(false);
      showToast("Application unlocked.", "success");
    },
    [authToken, showToast]
  );

  const updateUserPreferences = useCallback(
    async (prefs: { auto_lock_timeout_minutes: number; remember_me: boolean; theme?: string }) => {
      if (!authToken) return;
      const updated = await authUpdatePreferences(authToken, prefs);
      setUserPreferences(updated);
      showToast("Preferences saved.", "success");
    },
    [authToken, showToast]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!authToken) throw new Error("Authentication required.");
      await authChangePassword(authToken, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      showToast("Password updated successfully.", "success");
    },
    [authToken, showToast]
  );

  // Inactivity Auto-Lock Detector
  useEffect(() => {
    if (!authToken || isLocked) return;
    const timeoutMin = userPreferences?.auto_lock_timeout_minutes ?? 10;
    if (timeoutMin <= 0) return;

    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
        if (authToken) {
          void authLock(authToken).catch(() => {});
        }
      }, timeoutMin * 60 * 1000);
      void authTouchActivity(authToken);
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [authToken, isLocked, userPreferences?.auto_lock_timeout_minutes]);


  return (
    <AppContext.Provider
      value={{
        activeSection,
        setActiveSection,
        selectedPaperId,
        setSelectedPaperId,
        readingPaper,
        setReadingPaper,
        selectedCollectionId,
        setSelectedCollectionId,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isAboutModalOpen,
        setIsAboutModalOpen,
        isDonationModalOpen,
        setIsDonationModalOpen,
        isOnboardingOpen,
        setIsOnboardingOpen,
        isFeedbackCenterOpen,
        setIsFeedbackCenterOpen,
        feedbackCategory,
        openFeedbackCenter,
        globalSearchQuery,
        setGlobalSearchQuery,
        executeGlobalSearch,
        theme: outerTheme ? outerTheme.theme : theme,
        preference: outerTheme ? outerTheme.preference : theme,
        resolvedTheme: outerTheme ? outerTheme.resolvedTheme : resolvedTheme,
        isDark: outerTheme ? outerTheme.isDark : isDark,
        setTheme,
        toggleTheme,
        setThemeWithSplash,
        isThemeInitialized: outerTheme ? outerTheme.isInitialized : isThemeInitialized,
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
        refreshPapers,
        updatePaperReadingStatus,
        updatePaperReadingProgress,
        recordPaperOpened,
        assignTagToPaper,
        removeTagFromPaper,
        updatePaperMetadata,
        savedSearches,
        refreshSavedSearches,
        createSavedSearch,
        deleteSavedSearch,
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
        clearAllData,
        user,
        authToken,
        isLocked,
        userPreferences,
        continueAsGuest,
        loginUser,
        signupUser,
        logoutUser,
        lockApplication,
        unlockApplication,
        updateUserPreferences,
        changePassword,
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
