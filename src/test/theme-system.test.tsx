import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  resolveTheme,
  getStoredThemePreference,
  getSystemResolvedTheme,
  applyThemeToDocument,
  persistThemePreference,
  THEME_STORAGE_KEY,
} from "../lib/theme-persistence";
import { ThemeProvider, useThemeContext } from "../components/theme/ThemeProvider";
import { ThemeSelector, THEME_OPTIONS } from "../components/theme/ThemeSelector";
import { ThemeSettingsControl } from "../components/theme/ThemeSettingsControl";
import { AppProvider } from "../context/AppContext";
import { useTheme } from "../hooks/useTheme";
import { createPortal } from "react-dom";

describe("Phase 3 — Centralized Theme System Architecture & Persistence", () => {
  let matchMediaListeners: Array<(e: { matches: boolean }) => void> = [];
  let systemDark = false;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    matchMediaListeners = [];
    systemDark = false;

    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-color-scheme: dark") ? systemDark : false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: vi.fn(
          (_type: string, listener: (e: { matches: boolean }) => void) => {
            matchMediaListeners.push(listener);
          }
        ),
        removeEventListener: vi.fn(
          (_type: string, listener: (e: { matches: boolean }) => void) => {
            matchMediaListeners = matchMediaListeners.filter((l) => l !== listener);
          }
        ),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Theme Logic & Pure Persistence Helpers", () => {
    it("resolves Light and Dark preferences deterministically", () => {
      expect(resolveTheme("light")).toBe("light");
      expect(resolveTheme("dark")).toBe("dark");
    });

    it("resolves System preference according to system OS setting", () => {
      systemDark = false;
      expect(getSystemResolvedTheme()).toBe("light");
      expect(resolveTheme("system")).toBe("light");

      systemDark = true;
      expect(getSystemResolvedTheme()).toBe("dark");
      expect(resolveTheme("system")).toBe("dark");
    });

    it("falls back safely to dark on invalid or corrupted localStorage values", () => {
      localStorage.setItem(THEME_STORAGE_KEY, "invalid_theme_value");
      expect(getStoredThemePreference()).toBe("dark");

      localStorage.setItem(THEME_STORAGE_KEY, "light");
      expect(getStoredThemePreference()).toBe("light");

      localStorage.setItem(THEME_STORAGE_KEY, "system");
      expect(getStoredThemePreference()).toBe("system");
    });

    it("applies theme classes, data-theme attribute, and colorScheme to document root", () => {
      applyThemeToDocument("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(document.documentElement.style.colorScheme).toBe("light");

      applyThemeToDocument("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.classList.contains("light")).toBe(false);
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");
    });

    it("persists theme preference to localStorage synchronously without throwing", async () => {
      await persistThemePreference("light");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

      await persistThemePreference("dark");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    });
  });

  describe("2. ThemeProvider & Reactive State Lifecycle", () => {
    const ThemeProbe: React.FC = () => {
      const {
        theme,
        preference,
        resolvedTheme,
        isDark,
        setTheme,
        toggleTheme,
        isInitialized,
      } = useThemeContext();
      return (
        <div>
          <span data-testid="theme">{theme}</span>
          <span data-testid="preference">{preference}</span>
          <span data-testid="resolved">{resolvedTheme}</span>
          <span data-testid="isDark">{String(isDark)}</span>
          <span data-testid="isInitialized">{String(isInitialized)}</span>
          <button type="button" onClick={() => setTheme("light")}>
            Set Light
          </button>
          <button type="button" onClick={() => setTheme("dark")}>
            Set Dark
          </button>
          <button type="button" onClick={() => setTheme("system")}>
            Set System
          </button>
          <button type="button" onClick={toggleTheme}>
            Toggle Theme
          </button>
        </div>
      );
    };

    it("initializes with provided theme and updates document attributes", () => {
      render(
        <ThemeProvider initialTheme="light">
          <ThemeProbe />
        </ThemeProvider>
      );

      expect(screen.getByTestId("theme").textContent).toBe("light");
      expect(screen.getByTestId("resolved").textContent).toBe("light");
      expect(screen.getByTestId("isDark").textContent).toBe("false");
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });

    it("updates resolved theme when user changes preference", () => {
      render(
        <ThemeProvider initialTheme="dark">
          <ThemeProbe />
        </ThemeProvider>
      );

      expect(screen.getByTestId("resolved").textContent).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);

      fireEvent.click(screen.getByText("Set Light"));
      expect(screen.getByTestId("theme").textContent).toBe("light");
      expect(screen.getByTestId("resolved").textContent).toBe("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

      fireEvent.click(screen.getByText("Toggle Theme"));
      expect(screen.getByTestId("resolved").textContent).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("reacts dynamically to OS system preference changes in system mode", () => {
      systemDark = false;
      render(
        <ThemeProvider initialTheme="system">
          <ThemeProbe />
        </ThemeProvider>
      );

      expect(screen.getByTestId("theme").textContent).toBe("system");
      expect(screen.getByTestId("resolved").textContent).toBe("light");

      // Trigger OS dark mode change event
      act(() => {
        matchMediaListeners.forEach((listener) => listener({ matches: true }));
      });

      expect(screen.getByTestId("resolved").textContent).toBe("dark");
      expect(screen.getByTestId("isDark").textContent).toBe("true");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  describe("3. ThemeSelector Component (Cards and Segmented Variants)", () => {
    it("renders cards variant with all 3 options and active state", () => {
      render(
        <ThemeProvider initialTheme="dark">
          <ThemeSelector variant="cards" />
        </ThemeProvider>
      );

      THEME_OPTIONS.forEach((opt) => {
        expect(screen.getByText(opt.label)).toBeInTheDocument();
      });

      const darkRadio = screen.getByRole("radio", { name: /Dark Theme/i });
      expect(darkRadio).toHaveAttribute("aria-checked", "true");

      const lightRadio = screen.getByRole("radio", { name: /Light Theme/i });
      expect(lightRadio).toHaveAttribute("aria-checked", "false");

      fireEvent.click(lightRadio);
      expect(lightRadio).toHaveAttribute("aria-checked", "true");
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });

    it("renders segmented variant with keyboard accessible arrow navigation", () => {
      render(
        <ThemeProvider initialTheme="light">
          <ThemeSelector variant="segmented" />
        </ThemeProvider>
      );

      const lightBtn = screen.getByRole("button", { name: "Light mode" });
      const darkBtn = screen.getByRole("button", { name: "Dark mode" });

      expect(lightBtn).toHaveAttribute("aria-pressed", "true");
      expect(darkBtn).toHaveAttribute("aria-pressed", "false");

      // Arrow navigation
      fireEvent.keyDown(lightBtn, { key: "ArrowRight" });
      expect(darkBtn).toHaveAttribute("aria-pressed", "true");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("ThemeSettingsControl renders header and updates theme smoothly", () => {
      const handleThemeChanged = vi.fn();
      render(
        <ThemeProvider initialTheme="light">
          <ThemeSettingsControl onThemeChanged={handleThemeChanged} />
        </ThemeProvider>
      );

      expect(screen.getByText("Appearance & Visual Theme")).toBeInTheDocument();
      const darkRadio = screen.getByRole("radio", { name: /Dark Theme/i });
      fireEvent.click(darkRadio);
      expect(handleThemeChanged).toHaveBeenCalledWith("dark");
    });
  });

  describe("4. Integration & Portal Theme Inheritance", () => {
    const PortaledModal: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
      if (!isOpen) return null;
      return createPortal(
        <div
          data-testid="portal-root"
          className="modal-container bg-card text-card-foreground"
        >
          <h2>Portaled Academic Dialog</h2>
        </div>,
        document.body
      );
    };

    const FullIntegrationApp: React.FC = () => {
      const [isOpen, setIsOpen] = useState(false);
      const { theme, setTheme, resolvedTheme } = useTheme();

      return (
        <div>
          <button type="button" onClick={() => setIsOpen(true)}>
            Open Modal
          </button>
          <button type="button" onClick={() => setTheme("dark")}>
            Switch Dark
          </button>
          <span data-testid="app-theme">{theme}</span>
          <span data-testid="app-resolved">{resolvedTheme}</span>
          <PortaledModal isOpen={isOpen} />
        </div>
      );
    };

    it("verifies portaled dialogs inherit document theme styling without breaking", () => {
      render(
        <AppProvider>
          <FullIntegrationApp />
        </AppProvider>
      );

      fireEvent.click(screen.getByText("Switch Dark"));
      expect(document.documentElement.classList.contains("dark")).toBe(true);

      fireEvent.click(screen.getByText("Open Modal"));
      const portalRoot = screen.getByTestId("portal-root");
      expect(portalRoot).toBeInTheDocument();
      expect(portalRoot.parentElement).toBe(document.body);
      // document.body is inside document.documentElement which carries .dark class
      expect(document.documentElement.contains(portalRoot)).toBe(true);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  describe("4. Multi-Colour Theme Presets, Preview, Accent & Density Architecture", () => {
    it("provides all 12 curated presets with complete light and dark palettes", async () => {
      const { PRESET_THEMES, PRESET_THEME_LIST } = await import("../lib/theme-presets");
      expect(PRESET_THEME_LIST.length).toBe(12);

      const expectedPresets = [
        "midnight_blue",
        "ocean_cyan",
        "emerald_green",
        "violet_galaxy",
        "royal_purple",
        "sunset_orange",
        "rose_pink",
        "crimson_red",
        "golden_amber",
        "arctic_silver",
        "monochrome",
        "forest_green",
      ];

      for (const presetId of expectedPresets) {
        expect(PRESET_THEMES).toHaveProperty(presetId);
        const p = PRESET_THEMES[presetId as keyof typeof PRESET_THEMES];
        expect(p.name).toBeDefined();
        expect(p.previewColors.length).toBe(4);
        expect(p.light.primary).toBeDefined();
        expect(p.dark.primary).toBeDefined();
        expect(p.light.card).toBeDefined();
        expect(p.dark.card).toBeDefined();
      }
    });

    it("evaluates WCAG 2.1 contrast correctly and determines high-contrast text", async () => {
      const { analyzeContrast, isValidHex } = await import("../lib/theme-presets");
      expect(isValidHex("#3B82F6")).toBe(true);
      expect(isValidHex("3b82f6")).toBe(true);
      expect(isValidHex("#ZZZ")).toBe(false);

      // Contrast against dark background
      const darkAnalysis = analyzeContrast("#FFFFFF", true);
      expect(darkAnalysis.ratio).toBeGreaterThanOrEqual(7);
      expect(darkAnalysis.level).toBe("AAA");
      expect(darkAnalysis.textColor).toBe("#0f172a"); // Black text on white accent
    });

    it("applies theme settings and custom CSS properties to document root", async () => {
      const { applyThemeSettingsToDocument, getStoredThemeSettings } =
        await import("../lib/theme-persistence");
      const settings = getStoredThemeSettings();
      settings.preset = "emerald_green";
      settings.density = "compact";
      settings.backgroundPreset = "neutral";
      settings.motion = "reduced";

      applyThemeSettingsToDocument(settings, "dark");

      expect(document.documentElement.getAttribute("data-theme-preset")).toBe(
        "emerald_green"
      );
      expect(document.documentElement.getAttribute("data-density")).toBe("compact");
      expect(document.documentElement.getAttribute("data-bg-preset")).toBe("neutral");
      expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");
      expect(document.documentElement.style.getPropertyValue("--primary")).toBeDefined();
    });

    it("supports real-time preview, cancellation, and apply cycle in ThemeProvider", async () => {
      const TestPreviewConsumer: React.FC = () => {
        const {
          settings,
          previewSettings,
          isPreviewing,
          previewTheme,
          applyPreview,
          cancelPreview,
        } = useTheme();

        return (
          <div>
            <span data-testid="active-preset">{settings.preset}</span>
            <span data-testid="is-previewing">{String(isPreviewing)}</span>
            <span data-testid="preview-preset">{previewSettings?.preset || "none"}</span>
            <button type="button" onClick={() => previewTheme({ preset: "ocean_cyan" })}>
              Preview Ocean
            </button>
            <button type="button" onClick={() => void applyPreview()}>
              Apply Preview
            </button>
            <button type="button" onClick={cancelPreview}>
              Cancel Preview
            </button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestPreviewConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId("is-previewing").textContent).toBe("false");
      expect(screen.getByTestId("preview-preset").textContent).toBe("none");

      // Enter preview
      act(() => {
        fireEvent.click(screen.getByText("Preview Ocean"));
      });
      expect(screen.getByTestId("is-previewing").textContent).toBe("true");
      expect(screen.getByTestId("preview-preset").textContent).toBe("ocean_cyan");

      // Cancel preview -> reverts to original
      act(() => {
        fireEvent.click(screen.getByText("Cancel Preview"));
      });
      expect(screen.getByTestId("is-previewing").textContent).toBe("false");
      expect(screen.getByTestId("preview-preset").textContent).toBe("none");

      // Enter preview again and Apply
      act(() => {
        fireEvent.click(screen.getByText("Preview Ocean"));
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Apply Preview"));
      });
      expect(screen.getByTestId("is-previewing").textContent).toBe("false");
      expect(screen.getByTestId("active-preset").textContent).toBe("ocean_cyan");
    });

    it("supports custom theme CRUD, export, and import lifecycle", async () => {
      const TestCustomThemeConsumer: React.FC = () => {
        const { settings, saveCustomTheme, importThemesJson } = useTheme();

        return (
          <div>
            <span data-testid="custom-count">{settings.customThemes.length}</span>
            <button
              type="button"
              onClick={() =>
                void saveCustomTheme({
                  name: "Cyber Neon",
                  accentColor: "#06B6D4",
                  basePreset: "ocean_cyan",
                })
              }
            >
              Add Cyber Neon
            </button>
            <button
              type="button"
              onClick={() => {
                const json = JSON.stringify([
                  {
                    name: "Imported Solar",
                    accentColor: "#F59E0B",
                    basePreset: "golden_amber",
                  },
                ]);
                importThemesJson(json);
              }}
            >
              Import Solar
            </button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestCustomThemeConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId("custom-count").textContent).toBe("0");

      await act(async () => {
        fireEvent.click(screen.getByText("Add Cyber Neon"));
      });
      expect(screen.getByTestId("custom-count").textContent).toBe("1");

      await act(async () => {
        fireEvent.click(screen.getByText("Import Solar"));
      });
      expect(screen.getByTestId("custom-count").textContent).toBe("2");
    });
  });
});
