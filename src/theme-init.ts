/**
 * Early Theme Initialization Script
 * Runs synchronously before React renders to prevent visual theme flashing.
 */
import {
  getStoredThemeSettings,
  resolveTheme,
  applyThemeSettingsToDocument,
} from "./lib/theme-persistence";

try {
  const settings = getStoredThemeSettings();
  const resolved = resolveTheme(settings.mode);
  applyThemeSettingsToDocument(settings, resolved);
} catch {
  // Graceful fallback: defaults to dark mode
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }
}
