import {
  ThemePreference,
  ResolvedTheme,
  ThemeSettings,
  PresetThemeId,
  BackgroundPreset,
  InterfaceDensity,
  MotionPreference,
  ParticleIntensity,
  CustomTheme,
} from "../types/theme";
import { isTauriEnvironment } from "./tauri-bridge";
import { getAppSetting, setAppSetting } from "./desktop-api";
import {
  DEFAULT_THEME_SETTINGS,
  PRESET_THEMES,
  generateThemeCssVariables,
  isValidHex,
} from "./theme-presets";

export const THEME_STORAGE_KEY = "rps_theme";
export const THEME_DB_KEY = "theme_mode";

export const THEME_SETTINGS_STORAGE_KEY = "rps_appearance_settings";
export const THEME_SETTINGS_DB_KEY = "appearance_settings";

/**
 * Safely reads the initial theme preference from localStorage.
 * Guaranteed not to throw if storage is inaccessible.
 */
export function getStoredThemePreference(): ThemePreference {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
      }
    }
  } catch {
    // Storage access unavailable or restricted
  }
  return "dark"; // Default scholarly fallback
}

/**
 * Safely reads full appearance settings from localStorage with validation and fallback.
 */
export function getStoredThemeSettings(): ThemeSettings {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(THEME_SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const mode: ThemePreference =
            parsed.mode === "light" || parsed.mode === "dark" || parsed.mode === "system"
              ? parsed.mode
              : getStoredThemePreference();

          const preset: PresetThemeId =
            parsed.preset in PRESET_THEMES ? parsed.preset : DEFAULT_THEME_SETTINGS.preset;

          const customAccent: string | null =
            typeof parsed.customAccent === "string" && isValidHex(parsed.customAccent)
              ? parsed.customAccent
              : null;

          const accentHistory: string[] = Array.isArray(parsed.accentHistory)
            ? parsed.accentHistory.filter((c: unknown) => typeof c === "string" && isValidHex(c)).slice(0, 8)
            : DEFAULT_THEME_SETTINGS.accentHistory;

          const backgroundPreset: BackgroundPreset =
            parsed.backgroundPreset === "neutral" ||
            parsed.backgroundPreset === "cool" ||
            parsed.backgroundPreset === "warm" ||
            parsed.backgroundPreset === "high_contrast"
              ? parsed.backgroundPreset
              : "default";

          const density: InterfaceDensity =
            parsed.density === "compact" || parsed.density === "spacious"
              ? parsed.density
              : "comfortable";

          const motion: MotionPreference =
            parsed.motion === "reduced" || parsed.motion === "standard"
              ? parsed.motion
              : "system";

          const particleIntensity: ParticleIntensity =
            parsed.particleIntensity === "off" ||
            parsed.particleIntensity === "subtle" ||
            parsed.particleIntensity === "high"
              ? parsed.particleIntensity
              : "normal";

          const customThemes: CustomTheme[] = Array.isArray(parsed.customThemes)
            ? parsed.customThemes.filter(
                (ct: any) =>
                  ct &&
                  typeof ct.id === "string" &&
                  typeof ct.name === "string" &&
                  isValidHex(ct.accentColor)
              )
            : [];

          return {
            mode,
            preset,
            customAccent,
            accentHistory,
            backgroundPreset,
            density,
            motion,
            particleIntensity,
            activeCustomThemeId: typeof parsed.activeCustomThemeId === "string" ? parsed.activeCustomThemeId : null,
            customThemes,
          };
        }
      }
    }
  } catch {
    // Graceful fallback to default
  }

  // Fallback respecting the legacy theme mode key if present
  const legacyMode = getStoredThemePreference();
  return {
    ...DEFAULT_THEME_SETTINGS,
    mode: legacyMode,
  };
}

/**
 * Detects the current operating system color scheme preference.
 */
export function getSystemResolvedTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    try {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return isDark ? "dark" : "light";
    } catch {
      // Fallback if matchMedia fails
    }
  }
  return "dark";
}

/**
 * Resolves a user's theme preference ("light" | "dark" | "system")
 * to the concrete visual mode ("light" | "dark").
 */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return getSystemResolvedTheme();
  }
  return preference;
}

/**
 * Applies the resolved theme to the root DOM document.
 * Backward-compatible single-arg call for existing callers.
 */
export function applyThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
    root.setAttribute("data-theme", "dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
    root.setAttribute("data-theme", "light");
    root.style.colorScheme = "light";
  }
}

/**
 * Applies full theme settings (preset colors, custom accent, background tone, density, motion)
 * directly to document.documentElement without reloads or flickering.
 */
export function applyThemeSettingsToDocument(
  settings: ThemeSettings,
  resolved: ResolvedTheme
): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // 1. Core light/dark classes & attributes
  if (resolved === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
    root.setAttribute("data-theme", "dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
    root.setAttribute("data-theme", "light");
    root.style.colorScheme = "light";
  }

  // 2. Data attributes for CSS targeting & testing
  root.setAttribute("data-theme-preset", settings.preset);
  root.setAttribute("data-bg-preset", settings.backgroundPreset);
  root.setAttribute("data-density", settings.density);
  root.setAttribute("data-motion", settings.motion);
  root.setAttribute("data-particles", settings.particleIntensity);

  // 3. Inject dynamic CSS variables directly into style
  const cssVars = generateThemeCssVariables(settings, resolved);
  for (const [key, value] of Object.entries(cssVars)) {
    root.style.setProperty(key, value);
  }
}

/**
 * Persists theme preference to both localStorage and SQLite app_settings table.
 */
export async function persistThemePreference(preference: ThemePreference): Promise<void> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch (err) {
    console.warn("Failed to persist theme preference to localStorage:", err);
  }

  if (isTauriEnvironment()) {
    try {
      await setAppSetting(THEME_DB_KEY, preference);
    } catch (err) {
      console.warn("Failed to persist theme preference to SQLite database:", err);
    }
  }
}

/**
 * Persists comprehensive appearance settings to localStorage and SQLite.
 */
export async function persistThemeSettings(settings: ThemeSettings): Promise<void> {
  // Sync legacy mode key for backward compatibility
  await persistThemePreference(settings.mode);

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(THEME_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch (err) {
    console.warn("Failed to persist theme settings to localStorage:", err);
  }

  if (isTauriEnvironment()) {
    try {
      await setAppSetting(THEME_SETTINGS_DB_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn("Failed to persist theme settings to SQLite database:", err);
    }
  }
}

/**
 * Loads the saved theme setting from the SQLite database.
 */
export async function loadDbThemePreference(): Promise<ThemePreference | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const val = await getAppSetting(THEME_DB_KEY);
    if (val === "light" || val === "dark" || val === "system") {
      return val;
    }
  } catch (err) {
    console.warn("Failed to load theme setting from SQLite database:", err);
  }
  return null;
}

/**
 * Loads saved comprehensive theme settings from SQLite database.
 */
export async function loadDbThemeSettings(): Promise<Partial<ThemeSettings> | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const val = await getAppSetting(THEME_SETTINGS_DB_KEY);
    if (val) {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to load theme settings from SQLite database:", err);
  }
  return null;
}
