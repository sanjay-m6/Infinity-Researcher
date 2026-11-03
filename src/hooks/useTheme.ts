import { useContext } from "react";
import { ThemeContext } from "../components/theme/ThemeProvider";
import { AppContext } from "../context/AppContext";
import {
  ThemePreference,
  ResolvedTheme,
  ThemeContextValue,
  ThemeSplashOrigin,
} from "../types/theme";
import { DEFAULT_THEME_SETTINGS } from "../lib/theme-presets";

export type UseThemeReturn = ThemeContextValue;

/**
 * Hook providing centralized, application-wide theme access and control.
 * Supports both standalone ThemeProvider context and top-level AppContext.
 */
export function useTheme(): ThemeContextValue {
  const themeCtx = useContext(ThemeContext);
  const appCtx = useContext(AppContext);

  if (themeCtx) {
    return themeCtx;
  }

  if (appCtx) {
    const theme = (appCtx.theme || "dark") as ThemePreference;
    const preference = ((appCtx as any).preference ?? theme) as ThemePreference;
    const resolvedTheme = ((appCtx as any).resolvedTheme ??
      (theme === "light" ? "light" : "dark")) as ResolvedTheme;
    const isDark = (appCtx as any).isDark ?? resolvedTheme === "dark";
    const setTheme = appCtx.setTheme;
    const toggleTheme =
      (appCtx as any).toggleTheme ??
      ((origin?: ThemeSplashOrigin) => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark", origin);
      });
    const setThemeWithSplash =
      (appCtx as any).setThemeWithSplash ??
      (async (newTheme: ThemePreference, origin?: ThemeSplashOrigin) => {
        setTheme(newTheme, origin);
      });
    const isInitialized = (appCtx as any).isThemeInitialized ?? true;

    return {
      theme,
      preference,
      resolvedTheme,
      isDark,
      setTheme,
      toggleTheme,
      setThemeWithSplash,
      isInitialized,

      settings: {
        ...DEFAULT_THEME_SETTINGS,
        mode: theme,
      },
      previewSettings: null,
      isPreviewing: false,

      setMode: (m, origin) => setTheme(m, origin),
      setPreset: () => {},
      setCustomAccent: () => {},
      setBackgroundPreset: () => {},
      setDensity: () => {},
      setMotion: () => {},
      setParticleIntensity: () => {},

      previewTheme: () => {},
      applyPreview: async () => {},
      cancelPreview: () => {},
      resetToDefault: async () => {},

      saveCustomTheme: async (t) => ({
        id: "default",
        name: t.name,
        accentColor: t.accentColor,
        basePreset: "midnight_blue",
        mode: "dark",
        backgroundPreset: "default",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      deleteCustomTheme: async () => {},
      applyCustomTheme: () => {},
      exportThemesJson: () => "[]",
      importThemesJson: () => ({ success: true, count: 0 }),
    };
  }

  throw new Error("useTheme must be used within a ThemeProvider or AppProvider.");
}

export default useTheme;
