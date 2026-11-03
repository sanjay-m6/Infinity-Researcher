import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  getSplashCoordinates,
  executeThemeSplash,
} from "../lib/theme-transition";
import { ThemeProvider } from "../components/theme/ThemeProvider";
import { ThemeSelector } from "../components/theme/ThemeSelector";
import { BottomBar } from "../components/layout/BottomBar";
import { AppProvider } from "../context/AppContext";

describe("Theme Splash Transition & Circular Reveal System", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";

    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Coordinate Extraction & Origin Resolution", () => {
    it("extracts exact coordinates from a mouse event", () => {
      const event = { clientX: 250, clientY: 180 };
      const coords = getSplashCoordinates(event as any);
      expect(coords).toEqual({ x: 250, y: 180 });
    });

    it("extracts center coordinates from an HTMLElement bounding rect", () => {
      const element = document.createElement("button");
      vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
        left: 100,
        top: 50,
        width: 80,
        height: 40,
        right: 180,
        bottom: 90,
        x: 100,
        y: 50,
        toJSON: () => {},
      });

      const coords = getSplashCoordinates(element);
      expect(coords).toEqual({ x: 140, y: 70 });
    });

    it("falls back to viewport center when origin is null or undefined", () => {
      Object.defineProperty(window, "innerWidth", { writable: true, value: 1200 });
      Object.defineProperty(window, "innerHeight", { writable: true, value: 800 });

      const coords = getSplashCoordinates(undefined);
      expect(coords).toEqual({ x: 600, y: 400 });
    });

    it("falls back to viewport center when clientX and clientY are both 0 without currentTarget", () => {
      Object.defineProperty(window, "innerWidth", { writable: true, value: 1000 });
      Object.defineProperty(window, "innerHeight", { writable: true, value: 600 });

      const coords = getSplashCoordinates({ clientX: 0, clientY: 0 });
      expect(coords).toEqual({ x: 500, y: 300 });
    });
  });

  describe("2. View Transition Circular Splash Execution", () => {
    it("executes startViewTransition and animates pseudoElement when supported", async () => {
      const mockAnimate = vi.fn().mockReturnValue({ finished: Promise.resolve() });
      document.documentElement.animate = mockAnimate;

      const mockReady = Promise.resolve();
      const mockStartViewTransition = vi.fn().mockImplementation((cb: () => void) => {
        cb();
        return {
          ready: mockReady,
          finished: Promise.resolve(),
        };
      });

      (document as any).startViewTransition = mockStartViewTransition;

      const onThemeChange = vi.fn();
      await executeThemeSplash("light", {
        origin: { clientX: 300, clientY: 200 },
        onThemeChange,
      });

      expect(mockStartViewTransition).toHaveBeenCalled();
      expect(onThemeChange).toHaveBeenCalledWith("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);

      // Verify that documentElement.animate was called with circular clip-path on ::view-transition-new(root)
      expect(mockAnimate).toHaveBeenCalledWith(
        expect.objectContaining({
          clipPath: expect.arrayContaining([
            expect.stringContaining("circle(0px at 300px 200px)"),
          ]),
        }),
        expect.objectContaining({
          pseudoElement: "::view-transition-new(root)",
        })
      );
    });

    it("bypasses view transition and applies theme immediately when prefers-reduced-motion is active", async () => {
      const mockStartViewTransition = vi.fn();
      (document as any).startViewTransition = mockStartViewTransition;

      // Mock reduced motion
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const onThemeChange = vi.fn();
      await executeThemeSplash("dark", {
        origin: { clientX: 100, clientY: 100 },
        onThemeChange,
      });

      expect(mockStartViewTransition).not.toHaveBeenCalled();
      expect(onThemeChange).toHaveBeenCalledWith("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("falls back gracefully when startViewTransition is unsupported", async () => {
      delete (document as any).startViewTransition;

      const onThemeChange = vi.fn();
      await executeThemeSplash("light", {
        origin: { clientX: 150, clientY: 150 },
        onThemeChange,
      });

      expect(onThemeChange).toHaveBeenCalledWith("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });
  });

  describe("3. ThemeSelector Component Splash Integration", () => {
    it("segmented variant passes click event coordinates when switching theme", () => {
      render(
        <ThemeProvider initialTheme="dark">
          <ThemeSelector variant="segmented" />
        </ThemeProvider>
      );

      const lightBtn = screen.getByRole("button", { name: "Light mode" });
      act(() => {
        fireEvent.click(lightBtn, { clientX: 420, clientY: 25 });
      });

      expect(document.documentElement.classList.contains("light")).toBe(true);
      expect(lightBtn).toHaveAttribute("aria-pressed", "true");
    });

    it("cards variant passes click event when switching theme", () => {
      render(
        <ThemeProvider initialTheme="light">
          <ThemeSelector variant="cards" />
        </ThemeProvider>
      );

      const darkRadio = screen.getByRole("radio", { name: /Dark Theme/i });
      act(() => {
        fireEvent.click(darkRadio, { clientX: 550, clientY: 200 });
      });

      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(darkRadio).toHaveAttribute("aria-checked", "true");
    });
  });

  describe("4. BottomBar Quick Switcher Integration", () => {
    it("passes click event from bottom bar theme toggle button", () => {
      render(
        <AppProvider>
          <BottomBar />
        </AppProvider>
      );

      const toggleBtn = screen.getByRole("button", { name: "Toggle theme" });
      act(() => {
        fireEvent.click(toggleBtn, { clientX: 1100, clientY: 780 });
      });

      // AppProvider defaults to dark theme, so clicking toggle switches to light
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });
  });
});

