/**
 * Infinity Researcher — Centralized Theme Type Definitions
 * Phase 3 Architecture & Phase 17+ Modernization
 * Advanced Multi-Colour Theme Switcher & Appearance Customization System
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Backward-compatible alias for existing imports */
export type ThemeMode = ThemePreference;

/**
 * 12 Curated Preset Colour Themes
 */
export type PresetThemeId =
  | "midnight_blue"
  | "ocean_cyan"
  | "emerald_green"
  | "violet_galaxy"
  | "royal_purple"
  | "sunset_orange"
  | "rose_pink"
  | "crimson_red"
  | "golden_amber"
  | "arctic_silver"
  | "monochrome"
  | "forest_green";

/**
 * Surface Background Tone Presets
 */
export type BackgroundPreset = "default" | "neutral" | "cool" | "warm" | "high_contrast";

/**
 * Workspace UI Information Density
 */
export type InterfaceDensity = "compact" | "comfortable" | "spacious";

/**
 * Motion & Animation Preferences
 */
export type MotionPreference = "system" | "reduced" | "standard";

/**
 * Particle Field Animation Intensity
 */
export type ParticleIntensity = "off" | "subtle" | "normal" | "high";

/**
 * User-created custom theme
 */
export interface CustomTheme {
  id: string;
  name: string;
  accentColor: string;
  basePreset: PresetThemeId;
  mode: ThemePreference;
  backgroundPreset: BackgroundPreset;
  createdAt: number;
  updatedAt: number;
}

/**
 * Aggregate theme customization settings
 */
export interface ThemeSettings {
  mode: ThemePreference;
  preset: PresetThemeId;
  customAccent: string | null;
  accentHistory: string[];
  backgroundPreset: BackgroundPreset;
  density: InterfaceDensity;
  motion: MotionPreference;
  particleIntensity: ParticleIntensity;
  activeCustomThemeId: string | null;
  customThemes: CustomTheme[];
}

/**
 * Color definition for presets
 */
export interface PresetThemeDefinition {
  id: PresetThemeId;
  name: string;
  description: string;
  previewColors: [string, string, string, string]; // [primary, secondary/accent, bg, text]
  light: {
    primary: string;
    primaryHover: string;
    primaryForeground: string;
    accent: string;
    accentForeground: string;
    ring: string;
    card: string;
    cardForeground: string;
    background: string;
    foreground: string;
    border: string;
    muted: string;
    mutedForeground: string;
  };
  dark: {
    primary: string;
    primaryHover: string;
    primaryForeground: string;
    accent: string;
    accentForeground: string;
    ring: string;
    card: string;
    cardForeground: string;
    background: string;
    foreground: string;
    border: string;
    muted: string;
    mutedForeground: string;
  };
}

/**
 * Origin position for circular ripple/splash view transitions.
 * Supports direct mouse events, HTML elements, or explicit coordinates.
 */
export type ThemeSplashOrigin =
  | { clientX: number; clientY: number }
  | React.MouseEvent
  | MouseEvent
  | HTMLElement
  | null;

export interface ThemeContextValue {
  /** The user's chosen theme preference: "light", "dark", or "system" */
  theme: ThemePreference;
  /** Explicit alias for theme preference */
  preference: ThemePreference;
  /** The actively rendered visual theme: "light" or "dark" */
  resolvedTheme: ResolvedTheme;
  /** Whether dark mode is currently active */
  isDark: boolean;
  /** Sets the theme preference ("light" | "dark" | "system") with optional splash transition */
  setTheme: (theme: ThemePreference, origin?: ThemeSplashOrigin) => void;
  /** Toggles between light and dark modes with optional splash transition */
  toggleTheme: (origin?: ThemeSplashOrigin) => void;
  /** Explicitly triggers a circular splash transition to the given theme */
  setThemeWithSplash: (
    theme: ThemePreference,
    origin?: ThemeSplashOrigin
  ) => Promise<void>;
  /** Whether the theme system has finished initializing from storage/system */
  isInitialized: boolean;

  /** Full active theme settings */
  settings: ThemeSettings;
  /** Currently previewed theme settings (if in preview mode) */
  previewSettings: ThemeSettings | null;
  /** Whether the user is currently live-previewing uncommitted changes */
  isPreviewing: boolean;

  /** Setters that commit immediately */
  setMode: (mode: ThemePreference, origin?: ThemeSplashOrigin) => void;
  setPreset: (presetId: PresetThemeId) => void;
  setCustomAccent: (hexColor: string | null) => void;
  setBackgroundPreset: (bg: BackgroundPreset) => void;
  setDensity: (density: InterfaceDensity) => void;
  setMotion: (motion: MotionPreference) => void;
  setParticleIntensity: (intensity: ParticleIntensity) => void;

  /** Live preview controls */
  previewTheme: (partial: Partial<ThemeSettings>) => void;
  applyPreview: () => Promise<void>;
  cancelPreview: () => void;
  resetToDefault: () => Promise<void>;

  /** Custom themes management */
  saveCustomTheme: (theme: {
    id?: string;
    name: string;
    accentColor: string;
    basePreset?: PresetThemeId;
    mode?: ThemePreference;
    backgroundPreset?: BackgroundPreset;
  }) => Promise<CustomTheme>;
  deleteCustomTheme: (id: string) => Promise<void>;
  applyCustomTheme: (id: string) => void;
  exportThemesJson: () => string;
  importThemesJson: (json: string) => { success: boolean; count: number; error?: string };
}
