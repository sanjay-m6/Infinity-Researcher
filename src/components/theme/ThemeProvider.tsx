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
  ThemePreference,
  ResolvedTheme,
  ThemeContextValue,
  ThemeSplashOrigin,
  ThemeSettings,
  PresetThemeId,
  BackgroundPreset,
  InterfaceDensity,
  MotionPreference,
  ParticleIntensity,
  CustomTheme,
} from "../../types/theme";
import {
  getStoredThemeSettings,
  applyThemeSettingsToDocument,
  persistThemeSettings,
  loadDbThemeSettings,
  loadDbThemePreference,
  getSystemResolvedTheme,
} from "../../lib/theme-persistence";
import {
  DEFAULT_THEME_SETTINGS,
  PRESET_THEMES,
  isValidHex,
  normalizeHex,
} from "../../lib/theme-presets";
import { executeThemeSplash } from "../../lib/theme-transition";

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemePreference;
  initialSettings?: Partial<ThemeSettings>;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme,
  initialSettings,
}) => {
  // 1. Initial State from Storage
  const [settings, setSettings] = useState<ThemeSettings>(() => {
    const stored = getStoredThemeSettings();
    if (initialTheme) {
      stored.mode = initialTheme;
    }
    if (initialSettings) {
      return { ...stored, ...initialSettings };
    }
    return stored;
  });

  // 2. Real-time Preview State (null when not previewing)
  const [previewSettings, setPreviewSettings] = useState<ThemeSettings | null>(null);

  // 3. Operating System Light/Dark media listener
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    return getSystemResolvedTheme() === "dark";
  });

  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Active settings is either preview if active, or saved settings
  const activeSettings = previewSettings ?? settings;

  // Compute resolved concrete mode
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (activeSettings.mode === "dark") return "dark";
    if (activeSettings.mode === "light") return "light";
    return systemIsDark ? "dark" : "light";
  }, [activeSettings.mode, systemIsDark]);

  const isDark = resolvedTheme === "dark";

  // Apply to DOM document immediately without remounting
  useEffect(() => {
    applyThemeSettingsToDocument(activeSettings, resolvedTheme);
  }, [activeSettings, resolvedTheme]);

  // Listen to OS scheme changes when in "system" mode
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

  // Hydrate from SQLite database asynchronously on desktop
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [dbSettings, dbPref] = await Promise.all([
          loadDbThemeSettings(),
          loadDbThemePreference(),
        ]);

        if (isMounted) {
          if (dbSettings) {
            setSettings((prev) => ({
              ...prev,
              ...dbSettings,
            }));
          } else if (dbPref && dbPref !== settings.mode) {
            setSettings((prev) => ({
              ...prev,
              mode: dbPref,
            }));
          }
        }
      } catch {
        // Fallback to local
      } finally {
        if (isMounted) setIsInitialized(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []); // Run once on mount

  // Helper to update and persist settings
  const updateSettings = useCallback(
    async (updater: (prev: ThemeSettings) => ThemeSettings) => {
      setSettings((prev) => {
        const next = updater(prev);
        void persistThemeSettings(next);
        return next;
      });
      // Clear preview if active
      setPreviewSettings(null);
    },
    []
  );

  // Set theme preference & persist with optional circular splash transition
  const setTheme = useCallback(
    (newPreference: ThemePreference, origin?: ThemeSplashOrigin) => {
      void executeThemeSplash(newPreference, {
        origin,
        onThemeChange: (t) => {
          void updateSettings((prev) => ({ ...prev, mode: t }));
        },
      });
    },
    [updateSettings]
  );

  const setThemeWithSplash = useCallback(
    async (newPreference: ThemePreference, origin?: ThemeSplashOrigin) => {
      await executeThemeSplash(newPreference, {
        origin,
        onThemeChange: (t) => {
          void updateSettings((prev) => ({ ...prev, mode: t }));
        },
      });
    },
    [updateSettings]
  );

  const toggleTheme = useCallback(
    (origin?: ThemeSplashOrigin) => {
      const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
      setTheme(nextTheme, origin);
    },
    [resolvedTheme, setTheme]
  );

  // Granular immediate setters
  const setMode = useCallback(
    (mode: ThemePreference, origin?: ThemeSplashOrigin) => {
      setTheme(mode, origin);
    },
    [setTheme]
  );

  const setPreset = useCallback(
    (presetId: PresetThemeId) => {
      void updateSettings((prev) => ({
        ...prev,
        preset: presetId,
        customAccent: null, // Reset custom accent when selecting a curated preset
        activeCustomThemeId: null,
      }));
    },
    [updateSettings]
  );

  const setCustomAccent = useCallback(
    (hexColor: string | null) => {
      void updateSettings((prev) => {
        if (!hexColor) {
          return { ...prev, customAccent: null, activeCustomThemeId: null };
        }
        const norm = isValidHex(hexColor) ? normalizeHex(hexColor) : hexColor;
        const newHistory = [norm, ...prev.accentHistory.filter((c) => c !== norm)].slice(
          0,
          8
        );
        return {
          ...prev,
          customAccent: norm,
          accentHistory: newHistory,
          activeCustomThemeId: null,
        };
      });
    },
    [updateSettings]
  );

  const setBackgroundPreset = useCallback(
    (bg: BackgroundPreset) => {
      void updateSettings((prev) => ({ ...prev, backgroundPreset: bg }));
    },
    [updateSettings]
  );

  const setDensity = useCallback(
    (density: InterfaceDensity) => {
      void updateSettings((prev) => ({ ...prev, density }));
    },
    [updateSettings]
  );

  const setMotion = useCallback(
    (motion: MotionPreference) => {
      void updateSettings((prev) => ({ ...prev, motion }));
    },
    [updateSettings]
  );

  const setParticleIntensity = useCallback(
    (intensity: ParticleIntensity) => {
      void updateSettings((prev) => ({ ...prev, particleIntensity: intensity }));
    },
    [updateSettings]
  );

  // Live Preview Controls
  const previewTheme = useCallback(
    (partial: Partial<ThemeSettings>) => {
      setPreviewSettings((current) => ({
        ...(current ?? settings),
        ...partial,
      }));
    },
    [settings]
  );

  const applyPreview = useCallback(async () => {
    if (previewSettings) {
      const toSave = { ...previewSettings };
      setSettings(toSave);
      setPreviewSettings(null);
      await persistThemeSettings(toSave);
    }
  }, [previewSettings]);

  const cancelPreview = useCallback(() => {
    setPreviewSettings(null);
  }, []);

  const resetToDefault = useCallback(async () => {
    setPreviewSettings(null);
    setSettings(DEFAULT_THEME_SETTINGS);
    await persistThemeSettings(DEFAULT_THEME_SETTINGS);
  }, []);

  // Custom Theme Management
  const saveCustomTheme = useCallback(
    async (input: {
      id?: string;
      name: string;
      accentColor: string;
      basePreset?: PresetThemeId;
      mode?: ThemePreference;
      backgroundPreset?: BackgroundPreset;
    }): Promise<CustomTheme> => {
      const id = input.id || `custom-${Date.now()}`;
      const now = Date.now();
      const normColor = isValidHex(input.accentColor)
        ? normalizeHex(input.accentColor)
        : input.accentColor;

      const newTheme: CustomTheme = {
        id,
        name: input.name.trim() || "Custom Theme",
        accentColor: normColor,
        basePreset: input.basePreset || activeSettings.preset,
        mode: input.mode || activeSettings.mode,
        backgroundPreset: input.backgroundPreset || activeSettings.backgroundPreset,
        createdAt: now,
        updatedAt: now,
      };

      await updateSettings((prev) => {
        const exists = prev.customThemes.some((t) => t.id === id);
        const updatedList = exists
          ? prev.customThemes.map((t) =>
              t.id === id ? { ...newTheme, createdAt: t.createdAt } : t
            )
          : [...prev.customThemes, newTheme];

        return {
          ...prev,
          customThemes: updatedList,
          activeCustomThemeId: id,
          customAccent: normColor,
          preset: newTheme.basePreset,
          backgroundPreset: newTheme.backgroundPreset,
          mode: newTheme.mode,
        };
      });

      return newTheme;
    },
    [activeSettings, updateSettings]
  );

  const deleteCustomTheme = useCallback(
    async (id: string) => {
      await updateSettings((prev) => ({
        ...prev,
        customThemes: prev.customThemes.filter((t) => t.id !== id),
        activeCustomThemeId:
          prev.activeCustomThemeId === id ? null : prev.activeCustomThemeId,
      }));
    },
    [updateSettings]
  );

  const applyCustomTheme = useCallback(
    (id: string) => {
      const found = activeSettings.customThemes.find((t) => t.id === id);
      if (!found) return;

      void updateSettings((prev) => ({
        ...prev,
        activeCustomThemeId: id,
        preset: found.basePreset,
        customAccent: found.accentColor,
        backgroundPreset: found.backgroundPreset,
        mode: found.mode,
      }));
    },
    [activeSettings.customThemes, updateSettings]
  );

  const exportThemesJson = useCallback((): string => {
    return JSON.stringify(activeSettings.customThemes, null, 2);
  }, [activeSettings.customThemes]);

  const importThemesJson = useCallback(
    (rawJson: string): { success: boolean; count: number; error?: string } => {
      try {
        const parsed = JSON.parse(rawJson);
        if (!Array.isArray(parsed)) {
          return { success: false, count: 0, error: "JSON must be an array of themes." };
        }

        const validThemes: CustomTheme[] = [];
        for (const item of parsed) {
          if (
            item &&
            typeof item.name === "string" &&
            isValidHex(item.accentColor || "")
          ) {
            validThemes.push({
              id: `custom-imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: item.name.trim(),
              accentColor: normalizeHex(item.accentColor),
              basePreset:
                item.basePreset in PRESET_THEMES ? item.basePreset : "midnight_blue",
              mode:
                item.mode === "light" || item.mode === "dark" || item.mode === "system"
                  ? item.mode
                  : "dark",
              backgroundPreset: item.backgroundPreset || "default",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        }

        if (validThemes.length === 0) {
          return { success: false, count: 0, error: "No valid theme objects found." };
        }

        void updateSettings((prev) => ({
          ...prev,
          customThemes: [...prev.customThemes, ...validThemes],
        }));

        return { success: true, count: validThemes.length };
      } catch (err: any) {
        return {
          success: false,
          count: 0,
          error: err?.message || "Invalid JSON syntax.",
        };
      }
    },
    [updateSettings]
  );

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      theme: activeSettings.mode,
      preference: activeSettings.mode,
      resolvedTheme,
      isDark,
      setTheme,
      toggleTheme,
      setThemeWithSplash,
      isInitialized,

      settings,
      previewSettings,
      isPreviewing: previewSettings !== null,

      setMode,
      setPreset,
      setCustomAccent,
      setBackgroundPreset,
      setDensity,
      setMotion,
      setParticleIntensity,

      previewTheme,
      applyPreview,
      cancelPreview,
      resetToDefault,

      saveCustomTheme,
      deleteCustomTheme,
      applyCustomTheme,
      exportThemesJson,
      importThemesJson,
    }),
    [
      activeSettings.mode,
      resolvedTheme,
      isDark,
      setTheme,
      toggleTheme,
      setThemeWithSplash,
      isInitialized,
      settings,
      previewSettings,
      setMode,
      setPreset,
      setCustomAccent,
      setBackgroundPreset,
      setDensity,
      setMotion,
      setParticleIntensity,
      previewTheme,
      applyPreview,
      cancelPreview,
      resetToDefault,
      saveCustomTheme,
      deleteCustomTheme,
      applyCustomTheme,
      exportThemesJson,
      importThemesJson,
    ]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within a ThemeProvider.");
  }
  return ctx;
}
