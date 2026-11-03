import {
  PresetThemeId,
  PresetThemeDefinition,
  ResolvedTheme,
  ThemeSettings,
} from "../types/theme";

/**
 * 12 Curated Preset Colour Themes with coherent light and dark palettes.
 */
export const PRESET_THEMES: Record<PresetThemeId, PresetThemeDefinition> = {
  midnight_blue: {
    id: "midnight_blue",
    name: "Midnight Blue",
    description: "Deep scholarly navy canvas with high-focus blue accents.",
    previewColors: ["#3b82f6", "#1d4ed8", "#070b12", "#f8fafc"],
    light: {
      primary: "#2563eb",
      primaryHover: "#1d4ed8",
      primaryForeground: "#ffffff",
      accent: "#dbeafe",
      accentForeground: "#1e40af",
      ring: "#2563eb",
      card: "#ffffff",
      cardForeground: "#0f172a",
      background: "#f8fafc",
      foreground: "#0f172a",
      border: "#e2e8f0",
      muted: "#f1f5f9",
      mutedForeground: "#64748b",
    },
    dark: {
      primary: "#3b82f6",
      primaryHover: "#2563eb",
      primaryForeground: "#ffffff",
      accent: "#1e3a8a",
      accentForeground: "#dbeafe",
      ring: "#3b82f6",
      card: "#0d1527",
      cardForeground: "#f8fafc",
      background: "#070b14",
      foreground: "#f8fafc",
      border: "rgba(59, 130, 246, 0.16)",
      muted: "#111c33",
      mutedForeground: "#94a3b8",
    },
  },

  ocean_cyan: {
    id: "ocean_cyan",
    name: "Ocean Cyan",
    description: "Cool marine surfaces with vibrant cyan and turquoise highlights.",
    previewColors: ["#06b6d4", "#0891b2", "#08131e", "#f0fdfa"],
    light: {
      primary: "#0891b2",
      primaryHover: "#0e7490",
      primaryForeground: "#ffffff",
      accent: "#cffafe",
      accentForeground: "#155e75",
      ring: "#0891b2",
      card: "#ffffff",
      cardForeground: "#082f49",
      background: "#f0fdfa",
      foreground: "#082f49",
      border: "#ccfbf1",
      muted: "#e0f2fe",
      mutedForeground: "#475569",
    },
    dark: {
      primary: "#06b6d4",
      primaryHover: "#0891b2",
      primaryForeground: "#082f49",
      accent: "#164e63",
      accentForeground: "#cffafe",
      ring: "#06b6d4",
      card: "#0b1b2b",
      cardForeground: "#f0fdfa",
      background: "#050f18",
      foreground: "#f0fdfa",
      border: "rgba(6, 182, 212, 0.18)",
      muted: "#0f273d",
      mutedForeground: "#94a3b8",
    },
  },

  emerald_green: {
    id: "emerald_green",
    name: "Emerald Green",
    description: "Crisp botanical green accents with clean neutral surfaces.",
    previewColors: ["#10b981", "#059669", "#06130e", "#f0fdf4"],
    light: {
      primary: "#059669",
      primaryHover: "#047857",
      primaryForeground: "#ffffff",
      accent: "#d1fae5",
      accentForeground: "#065f46",
      ring: "#059669",
      card: "#ffffff",
      cardForeground: "#064e3b",
      background: "#f8fafc",
      foreground: "#0f172a",
      border: "#e2e8f0",
      muted: "#ecfdf5",
      mutedForeground: "#64748b",
    },
    dark: {
      primary: "#10b981",
      primaryHover: "#059669",
      primaryForeground: "#ffffff",
      accent: "#064e3b",
      accentForeground: "#a7f3d0",
      ring: "#10b981",
      card: "#0d1f17",
      cardForeground: "#f0fdf4",
      background: "#06130d",
      foreground: "#f0fdf4",
      border: "rgba(16, 185, 129, 0.18)",
      muted: "#132c21",
      mutedForeground: "#94a3b8",
    },
  },

  violet_galaxy: {
    id: "violet_galaxy",
    name: "Violet Galaxy",
    description: "Deep cosmic violet and nebula purple accents for night-owl focus.",
    previewColors: ["#8b5cf6", "#7c3aed", "#0d091a", "#faf5ff"],
    light: {
      primary: "#7c3aed",
      primaryHover: "#6d28d9",
      primaryForeground: "#ffffff",
      accent: "#ede9fe",
      accentForeground: "#5b21b6",
      ring: "#7c3aed",
      card: "#ffffff",
      cardForeground: "#2e1065",
      background: "#fbfbfe",
      foreground: "#1e1b4b",
      border: "#e9d5ff",
      muted: "#f3e8ff",
      mutedForeground: "#6b7280",
    },
    dark: {
      primary: "#a78bfa",
      primaryHover: "#8b5cf6",
      primaryForeground: "#1e1b4b",
      accent: "#4c1d95",
      accentForeground: "#ede9fe",
      ring: "#a78bfa",
      card: "#161129",
      cardForeground: "#faf5ff",
      background: "#0b0817",
      foreground: "#faf5ff",
      border: "rgba(167, 139, 250, 0.18)",
      muted: "#20183b",
      mutedForeground: "#a1a1aa",
    },
  },

  royal_purple: {
    id: "royal_purple",
    name: "Royal Purple",
    description: "Rich imperial purple accents with balanced reading contrast.",
    previewColors: ["#9333ea", "#7e22ce", "#12081d", "#fdf4ff"],
    light: {
      primary: "#9333ea",
      primaryHover: "#7e22ce",
      primaryForeground: "#ffffff",
      accent: "#f3e8ff",
      accentForeground: "#6b21a8",
      ring: "#9333ea",
      card: "#ffffff",
      cardForeground: "#3b0764",
      background: "#faf5ff",
      foreground: "#3b0764",
      border: "#f0abfc",
      muted: "#fae8ff",
      mutedForeground: "#701a75",
    },
    dark: {
      primary: "#c084fc",
      primaryHover: "#a855f7",
      primaryForeground: "#3b0764",
      accent: "#581c87",
      accentForeground: "#f3e8ff",
      ring: "#c084fc",
      card: "#1a0c29",
      cardForeground: "#fdf4ff",
      background: "#0f051a",
      foreground: "#fdf4ff",
      border: "rgba(192, 132, 252, 0.2)",
      muted: "#26123d",
      mutedForeground: "#cbd5e1",
    },
  },

  sunset_orange: {
    id: "sunset_orange",
    name: "Sunset Orange",
    description: "Warm sunset tangerine accents with cozy warm-neutral surfaces.",
    previewColors: ["#f97316", "#ea580c", "#140c06", "#fff7ed"],
    light: {
      primary: "#ea580c",
      primaryHover: "#c2410c",
      primaryForeground: "#ffffff",
      accent: "#ffedd5",
      accentForeground: "#9a3412",
      ring: "#ea580c",
      card: "#ffffff",
      cardForeground: "#431407",
      background: "#fffaf5",
      foreground: "#431407",
      border: "#fed7aa",
      muted: "#ffedd5",
      mutedForeground: "#78716c",
    },
    dark: {
      primary: "#fb923c",
      primaryHover: "#f97316",
      primaryForeground: "#431407",
      accent: "#7c2d12",
      accentForeground: "#ffedd5",
      ring: "#fb923c",
      card: "#1c120a",
      cardForeground: "#fff7ed",
      background: "#120a05",
      foreground: "#fff7ed",
      border: "rgba(251, 146, 60, 0.2)",
      muted: "#2a1a0f",
      mutedForeground: "#a8a29e",
    },
  },

  rose_pink: {
    id: "rose_pink",
    name: "Rose Pink",
    description: "Gentle rose and blush pink tones with soft academic backgrounds.",
    previewColors: ["#f43f5e", "#e11d48", "#17080e", "#fff1f2"],
    light: {
      primary: "#e11d48",
      primaryHover: "#be123c",
      primaryForeground: "#ffffff",
      accent: "#ffe4e6",
      accentForeground: "#9f1239",
      ring: "#e11d48",
      card: "#ffffff",
      cardForeground: "#4c0519",
      background: "#fff5f6",
      foreground: "#4c0519",
      border: "#fecdd3",
      muted: "#ffe4e6",
      mutedForeground: "#71717a",
    },
    dark: {
      primary: "#fb7185",
      primaryHover: "#f43f5e",
      primaryForeground: "#4c0519",
      accent: "#881337",
      accentForeground: "#ffe4e6",
      ring: "#fb7185",
      card: "#200e16",
      cardForeground: "#fff1f2",
      background: "#13070d",
      foreground: "#fff1f2",
      border: "rgba(251, 113, 133, 0.2)",
      muted: "#2e1420",
      mutedForeground: "#a1a1aa",
    },
  },

  crimson_red: {
    id: "crimson_red",
    name: "Crimson Red",
    description: "Bold academic crimson red accents with clean slate surfaces.",
    previewColors: ["#ef4444", "#dc2626", "#160707", "#fef2f2"],
    light: {
      primary: "#dc2626",
      primaryHover: "#b91c1c",
      primaryForeground: "#ffffff",
      accent: "#fee2e2",
      accentForeground: "#991b1b",
      ring: "#dc2626",
      card: "#ffffff",
      cardForeground: "#450a0a",
      background: "#fafafa",
      foreground: "#18181b",
      border: "#fecaca",
      muted: "#fee2e2",
      mutedForeground: "#71717a",
    },
    dark: {
      primary: "#f87171",
      primaryHover: "#ef4444",
      primaryForeground: "#450a0a",
      accent: "#7f1d1d",
      accentForeground: "#fee2e2",
      ring: "#f87171",
      card: "#1e0b0b",
      cardForeground: "#fef2f2",
      background: "#130505",
      foreground: "#fef2f2",
      border: "rgba(248, 113, 113, 0.2)",
      muted: "#2b1010",
      mutedForeground: "#a1a1aa",
    },
  },

  golden_amber: {
    id: "golden_amber",
    name: "Golden Amber",
    description: "Warm amber gold and honey highlights for enhanced readability.",
    previewColors: ["#f59e0b", "#d97706", "#140f05", "#fffbeb"],
    light: {
      primary: "#d97706",
      primaryHover: "#b45309",
      primaryForeground: "#ffffff",
      accent: "#fef3c7",
      accentForeground: "#92400e",
      ring: "#d97706",
      card: "#ffffff",
      cardForeground: "#451a03",
      background: "#fffdf5",
      foreground: "#292524",
      border: "#fde68a",
      muted: "#fef3c7",
      mutedForeground: "#78716c",
    },
    dark: {
      primary: "#fbbf24",
      primaryHover: "#f59e0b",
      primaryForeground: "#451a03",
      accent: "#78350f",
      accentForeground: "#fef3c7",
      ring: "#fbbf24",
      card: "#1c1508",
      cardForeground: "#fffbeb",
      background: "#110c04",
      foreground: "#fffbeb",
      border: "rgba(251, 191, 36, 0.2)",
      muted: "#29200d",
      mutedForeground: "#a8a29e",
    },
  },

  arctic_silver: {
    id: "arctic_silver",
    name: "Arctic Silver",
    description: "Cool glacial grey surfaces with ice-blue and platinum accents.",
    previewColors: ["#94a3b8", "#64748b", "#0b0f15", "#f1f5f9"],
    light: {
      primary: "#475569",
      primaryHover: "#334155",
      primaryForeground: "#ffffff",
      accent: "#e2e8f0",
      accentForeground: "#1e293b",
      ring: "#475569",
      card: "#ffffff",
      cardForeground: "#0f172a",
      background: "#f1f5f9",
      foreground: "#0f172a",
      border: "#cbd5e1",
      muted: "#e2e8f0",
      mutedForeground: "#64748b",
    },
    dark: {
      primary: "#94a3b8",
      primaryHover: "#cbd5e1",
      primaryForeground: "#0f172a",
      accent: "#334155",
      accentForeground: "#f8fafc",
      ring: "#94a3b8",
      card: "#141923",
      cardForeground: "#f8fafc",
      background: "#0c1017",
      foreground: "#f8fafc",
      border: "rgba(148, 163, 184, 0.18)",
      muted: "#1d2535",
      mutedForeground: "#94a3b8",
    },
  },

  monochrome: {
    id: "monochrome",
    name: "Monochrome",
    description: "Timeless black, pure white, and neutral greys with zero distraction.",
    previewColors: ["#71717a", "#52525b", "#09090b", "#fafafa"],
    light: {
      primary: "#18181b",
      primaryHover: "#27272a",
      primaryForeground: "#ffffff",
      accent: "#e4e4e7",
      accentForeground: "#18181b",
      ring: "#18181b",
      card: "#ffffff",
      cardForeground: "#18181b",
      background: "#ffffff",
      foreground: "#09090b",
      border: "#e4e4e7",
      muted: "#f4f4f5",
      mutedForeground: "#71717a",
    },
    dark: {
      primary: "#fafafa",
      primaryHover: "#e4e4e7",
      primaryForeground: "#09090b",
      accent: "#27272a",
      accentForeground: "#fafafa",
      ring: "#fafafa",
      card: "#121212",
      cardForeground: "#fafafa",
      background: "#09090b",
      foreground: "#fafafa",
      border: "rgba(255, 255, 255, 0.12)",
      muted: "#1c1c1f",
      mutedForeground: "#a1a1aa",
    },
  },

  forest_green: {
    id: "forest_green",
    name: "Forest Green",
    description: "Deep pine and moss green accents with earthy, grounded surfaces.",
    previewColors: ["#15803d", "#166534", "#07120a", "#f0fdf4"],
    light: {
      primary: "#166534",
      primaryHover: "#14532d",
      primaryForeground: "#ffffff",
      accent: "#dcfce7",
      accentForeground: "#14532d",
      ring: "#166534",
      card: "#ffffff",
      cardForeground: "#052e16",
      background: "#f7fcf8",
      foreground: "#052e16",
      border: "#bbf7d0",
      muted: "#dcfce7",
      mutedForeground: "#4b5563",
    },
    dark: {
      primary: "#4ade80",
      primaryHover: "#22c55e",
      primaryForeground: "#052e16",
      accent: "#14532d",
      accentForeground: "#dcfce7",
      ring: "#4ade80",
      card: "#0d1a10",
      cardForeground: "#f0fdf4",
      background: "#061008",
      foreground: "#f0fdf4",
      border: "rgba(74, 222, 128, 0.2)",
      muted: "#132517",
      mutedForeground: "#9ca3af",
    },
  },
};

/**
 * List of all preset definitions for rendering the gallery
 */
export const PRESET_THEME_LIST: PresetThemeDefinition[] = Object.values(PRESET_THEMES);

/**
 * Default Theme Settings
 */
export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  mode: "dark",
  preset: "midnight_blue",
  customAccent: null,
  accentHistory: ["#3b82f6", "#06b6d4", "#10b981", "#8b5cf6", "#f97316"],
  backgroundPreset: "default",
  density: "comfortable",
  motion: "system",
  particleIntensity: "normal",
  activeCustomThemeId: null,
  customThemes: [],
};

// ============================================================================
// Color & Contrast Math Utilities (WCAG 2.1 AA / AAA)
// ============================================================================

/**
 * Parse hex color to RGB tuple [0-255, 0-255, 0-255]
 */
export function hexToRgb(hex: string): [number, number, number] {
  let cleaned = hex.trim().replace(/^#/, "");
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (cleaned.length !== 6) {
    return [0, 0, 0];
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return [isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b];
}

/**
 * Validates a 3 or 6 hex code
 */
export function isValidHex(hex: string): boolean {
  return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex.trim());
}

/**
 * Normalize hex to #RRGGBB format
 */
export function normalizeHex(hex: string): string {
  let cleaned = hex.trim().replace(/^#/, "");
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return `#${cleaned.toUpperCase()}`;
}

/**
 * Computes standard WCAG 2.1 relative luminance
 */
export function getRelativeLuminance(rgb: [number, number, number]): number {
  const [rs, gs, bs] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Computes contrast ratio between two hex colors (1:1 to 21:1)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hexToRgb(hex1));
  const lum2 = getRelativeLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export type WcagLevel = "AAA" | "AA" | "FAIL";

export interface ContrastAnalysis {
  ratio: number;
  level: WcagLevel;
  textColor: string;
}

/**
 * Analyzes contrast of an accent color against light or dark background
 */
export function analyzeContrast(accentHex: string, isDark: boolean): ContrastAnalysis {
  const bg = isDark ? "#070b14" : "#ffffff";
  const ratioAgainstBg = getContrastRatio(accentHex, bg);

  // Determine accessible text to place ON TOP of this accent
  const whiteContrast = getContrastRatio(accentHex, "#ffffff");
  const darkContrast = getContrastRatio(accentHex, "#0f172a");
  const textColor = whiteContrast >= darkContrast ? "#ffffff" : "#0f172a";

  let level: WcagLevel = "FAIL";
  if (ratioAgainstBg >= 7) {
    level = "AAA";
  } else if (ratioAgainstBg >= 4.5) {
    level = "AA";
  }

  return {
    ratio: Math.round(ratioAgainstBg * 10) / 10,
    level,
    textColor,
  };
}

/**
 * Lightens or darkens a hex color by a given amount (-1 to 1)
 */
export function adjustHexBrightness(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex);
  const adjust = (val: number) => {
    const res = percent > 0 ? val + (255 - val) * percent : val + val * percent;
    return Math.min(255, Math.max(0, Math.round(res)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${adjust(r)}${adjust(g)}${adjust(b)}`;
}

// ============================================================================
// CSS Variable Map Generation
// ============================================================================

export function generateThemeCssVariables(
  settings: ThemeSettings,
  resolvedTheme: ResolvedTheme
): Record<string, string> {
  const presetDef = PRESET_THEMES[settings.preset] || PRESET_THEMES.midnight_blue;
  const palette = resolvedTheme === "dark" ? presetDef.dark : presetDef.light;

  const vars: Record<string, string> = {
    "--primary": palette.primary,
    "--primary-hover": palette.primaryHover,
    "--primary-foreground": palette.primaryForeground,
    "--accent": palette.accent,
    "--accent-foreground": palette.accentForeground,
    "--ring": palette.ring,
    "--card": palette.card,
    "--card-foreground": palette.cardForeground,
    "--background": palette.background,
    "--foreground": palette.foreground,
    "--border": palette.border,
    "--muted": palette.muted,
    "--muted-foreground": palette.mutedForeground,
  };

  // 1. Custom Accent Override
  if (settings.customAccent && isValidHex(settings.customAccent)) {
    const norm = normalizeHex(settings.customAccent);
    const contrast = analyzeContrast(norm, resolvedTheme === "dark");
    vars["--primary"] = norm;
    vars["--primary-hover"] =
      resolvedTheme === "dark"
        ? adjustHexBrightness(norm, 0.15)
        : adjustHexBrightness(norm, -0.15);
    vars["--primary-foreground"] = contrast.textColor;
    vars["--ring"] = norm;
    vars["--accent"] =
      resolvedTheme === "dark"
        ? adjustHexBrightness(norm, -0.6)
        : adjustHexBrightness(norm, 0.85);
    vars["--accent-foreground"] =
      resolvedTheme === "dark" ? norm : adjustHexBrightness(norm, -0.4);
  }

  // 2. Background Preset Tweaks
  if (settings.backgroundPreset === "neutral") {
    if (resolvedTheme === "dark") {
      vars["--background"] = "#09090b";
      vars["--card"] = "#141417";
      vars["--muted"] = "#1c1c21";
    } else {
      vars["--background"] = "#fafafa";
      vars["--card"] = "#ffffff";
      vars["--muted"] = "#f4f4f5";
    }
  } else if (settings.backgroundPreset === "cool") {
    if (resolvedTheme === "dark") {
      vars["--background"] = "#050b14";
      vars["--card"] = "#0b1526";
      vars["--muted"] = "#112038";
    } else {
      vars["--background"] = "#f0f6ff";
      vars["--card"] = "#ffffff";
      vars["--muted"] = "#e0ecfc";
    }
  } else if (settings.backgroundPreset === "warm") {
    if (resolvedTheme === "dark") {
      vars["--background"] = "#120e0a";
      vars["--card"] = "#1c1611";
      vars["--muted"] = "#28201a";
    } else {
      vars["--background"] = "#faf8f5";
      vars["--card"] = "#ffffff";
      vars["--muted"] = "#f3eee7";
    }
  } else if (settings.backgroundPreset === "high_contrast") {
    if (resolvedTheme === "dark") {
      vars["--background"] = "#000000";
      vars["--card"] = "#0a0a0a";
      vars["--foreground"] = "#ffffff";
      vars["--border"] = "rgba(255, 255, 255, 0.35)";
      vars["--muted"] = "#1a1a1a";
      vars["--muted-foreground"] = "#d4d4d8";
    } else {
      vars["--background"] = "#ffffff";
      vars["--card"] = "#ffffff";
      vars["--foreground"] = "#000000";
      vars["--border"] = "#000000";
      vars["--muted"] = "#e5e5e5";
      vars["--muted-foreground"] = "#262626";
    }
  }

  // 3. Density Tokens
  if (settings.density === "compact") {
    vars["--density-scale"] = "0.9";
    vars["--density-padding-y"] = "0.375rem";
    vars["--density-padding-x"] = "0.625rem";
    vars["--density-gap"] = "0.375rem";
  } else if (settings.density === "spacious") {
    vars["--density-scale"] = "1.1";
    vars["--density-padding-y"] = "0.75rem";
    vars["--density-padding-x"] = "1.25rem";
    vars["--density-gap"] = "0.875rem";
  } else {
    // comfortable
    vars["--density-scale"] = "1.0";
    vars["--density-padding-y"] = "0.5rem";
    vars["--density-padding-x"] = "1.0rem";
    vars["--density-gap"] = "0.625rem";
  }

  // Backward-compatibility variable aliases
  vars["--bg-app"] = vars["--background"];
  vars["--surface"] = vars["--card"];
  vars["--surface-hover"] = vars["--muted"];
  vars["--surface-active"] = vars["--accent"];
  vars["--surface-subtle"] = vars["--muted"];
  vars["--text-main"] = vars["--foreground"];
  vars["--text-muted"] = vars["--muted-foreground"];
  vars["--primary-fg"] = vars["--primary-foreground"];

  return vars;
}
