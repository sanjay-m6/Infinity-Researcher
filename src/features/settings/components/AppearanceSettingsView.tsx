import React, { useState } from "react";
import {
  Sun,
  Moon,
  Laptop,
  Palette,
  Sparkles,
  Check,
  RotateCcw,
  Sliders,
  Eye,
  X,
  Plus,
  Trash2,
  Download,
  Upload,
  Gauge,
  Layers,
  Sparkle,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "../../../hooks/useTheme";
import {
  PRESET_THEME_LIST,
  analyzeContrast,
  isValidHex,
  normalizeHex,
} from "../../../lib/theme-presets";
import {
  PresetThemeId,
  BackgroundPreset,
  InterfaceDensity,
  MotionPreference,
  ParticleIntensity,
  ThemePreference,
} from "../../../types/theme";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { cn } from "../../../lib/utils";

type AppearanceSubTab = "themes" | "layout" | "motion" | "custom";

export interface AppearanceSettingsViewProps {
  className?: string;
  onThemeChanged?: (theme: string) => void;
}

export const AppearanceSettingsView: React.FC<AppearanceSettingsViewProps> = ({
  className = "",
  onThemeChanged,
}) => {
  const {
    theme,
    resolvedTheme,
    isDark,
    settings,
    previewSettings,
    isPreviewing,
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
  } = useTheme();

  const [activeTab, setActiveTab] = useState<AppearanceSubTab>("themes");

  // Custom Accent Input State
  const [accentInput, setAccentInput] = useState<string>(
    settings.customAccent || (isDark ? "#3b82f6" : "#2563eb")
  );

  // Custom Theme Creation State
  const [customThemeName, setCustomThemeName] = useState<string>("");
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Import/Export Modal State
  const [importJsonText, setImportJsonText] = useState<string>("");
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [copiedExport, setCopiedExport] = useState<boolean>(false);

  // Active or previewed state
  const currentSettings = previewSettings ?? settings;
  const isCustomAccentValid = isValidHex(accentInput);
  const contrastAnalysis = isCustomAccentValid
    ? analyzeContrast(normalizeHex(accentInput), isDark)
    : null;

  // Handlers
  const handleModeChange = (mode: ThemePreference) => {
    setMode(mode);
    onThemeChanged?.(mode);
  };

  const handlePresetSelect = (presetId: PresetThemeId) => {
    setPreset(presetId);
  };

  const handleCustomAccentApply = () => {
    if (isCustomAccentValid) {
      const norm = normalizeHex(accentInput);
      setCustomAccent(norm);
    }
  };

  const handleSaveCustomTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customThemeName.trim()) return;

    await saveCustomTheme({
      name: customThemeName.trim(),
      accentColor: currentSettings.customAccent || (isDark ? "#3b82f6" : "#2563eb"),
      basePreset: currentSettings.preset,
      mode: currentSettings.mode,
      backgroundPreset: currentSettings.backgroundPreset,
    });

    setCustomThemeName("");
    setShowSaveModal(false);
  };

  const handleExportClipboard = () => {
    const json = exportThemesJson();
    navigator.clipboard.writeText(json).then(() => {
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2000);
    });
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJsonText.trim()) return;

    const res = importThemesJson(importJsonText);
    if (res.success) {
      setImportStatus({ success: true, message: `Successfully imported ${res.count} custom themes!` });
      setImportJsonText("");
      setTimeout(() => {
        setShowImportModal(false);
        setImportStatus(null);
      }, 1500);
    } else {
      setImportStatus({ success: false, message: res.error || "Failed to import themes." });
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* =====================================================================
       * Top Header & Summary Pill
       * ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Appearance & Visual Theme
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Personalize your research environment with 12 handcrafted color palettes, custom accents, interface density, and surface contrast.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void resetToDefault()}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            title="Revert all settings to standard scholarly default"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset Defaults
          </Button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-foreground border border-border">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="capitalize">{resolvedTheme}</span>
            <span className="text-muted-foreground">•</span>
            <span className="capitalize">{currentSettings.preset.replace("_", " ")}</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
       * Real-time Preview Bar (Shows when changes are uncommitted)
       * ===================================================================== */}
      {isPreviewing && (
        <div className="p-3.5 rounded-xl border border-primary/40 bg-primary/10 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-xs text-foreground font-medium">
            <Eye className="w-4 h-4 text-primary" />
            <span>
              <strong>Theme Preview Active:</strong> You are previewing{" "}
              <span className="capitalize font-semibold text-primary">
                {currentSettings.preset.replace("_", " ")}
              </span>
              . Changes will revert if cancelled.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelPreview}
              className="text-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel Preview
            </Button>
            <Button
              size="sm"
              onClick={() => void applyPreview()}
              className="text-xs bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Apply Theme
            </Button>
          </div>
        </div>
      )}

      {/* =====================================================================
       * Sub-Navigation Tabs
       * ===================================================================== */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("themes")}
          className={cn(
            "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "themes"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Palette className="w-3.5 h-3.5" />
          Themes & Accents
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("layout")}
          className={cn(
            "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "layout"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          Layout & Density
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("motion")}
          className={cn(
            "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "motion"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Gauge className="w-3.5 h-3.5" />
          Motion & Effects
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("custom")}
          className={cn(
            "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "custom"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkle className="w-3.5 h-3.5" />
          Custom Themes ({currentSettings.customThemes.length})
        </button>
      </div>

      {/* =====================================================================
       * TAB 1: THEMES & ACCENTS
       * ===================================================================== */}
      {activeTab === "themes" && (
        <div className="space-y-6">
          {/* Section 1: Appearance Mode */}
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Appearance Mode
              </h3>
              <p className="text-xs text-muted-foreground">
                Select your workspace canvas luminance or sync with your operating system.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Theme mode selector"
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {[
                {
                  id: "light" as ThemePreference,
                  label: "Light Theme",
                  desc: "Crisp scholarly light workstation",
                  icon: Sun,
                },
                {
                  id: "dark" as ThemePreference,
                  label: "Dark Theme",
                  desc: "Deep academic midnight slate canvas",
                  icon: Moon,
                },
                {
                  id: "system" as ThemePreference,
                  label: "System Default",
                  desc: "Synchronize with Windows color scheme",
                  icon: Laptop,
                },
              ].map((opt) => {
                const isSelected = theme === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleModeChange(opt.id)}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                        : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                    )}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {opt.label}
                        {isSelected && <Check className="w-3 h-3 text-primary" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: 12 Preset Colour Themes */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Preset Colour Palettes (12 Curated Themes)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Carefully balanced contrast, background surfaces, borders, and accents.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
              {PRESET_THEME_LIST.map((preset) => {
                const isSelected =
                  currentSettings.preset === preset.id && !currentSettings.customAccent;
                const [primaryColor, secondaryColor, bgColor, textColor] = preset.previewColors;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.id)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden",
                      isSelected
                        ? "border-primary bg-card ring-2 ring-primary/80 shadow-xs"
                        : "border-border bg-card hover:border-primary/50 hover:bg-muted/20"
                    )}
                  >
                    {/* Top Row: Palette Name & Badge */}
                    <div className="flex items-center justify-between gap-1.5 mb-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate" title={preset.name}>
                        {preset.name}
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                          <Check className="w-2.5 h-2.5" />
                          <span>Active</span>
                        </span>
                      )}
                    </div>

                    {/* Preview Swatch Bar */}
                    <div className="w-full h-10 rounded-lg overflow-hidden border border-border/80 flex shadow-2xs mb-2.5">
                      <div
                        className="flex-1 flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                        title="Primary Color"
                      >
                        Aa
                      </div>
                      <div
                        className="w-1/4"
                        style={{ backgroundColor: secondaryColor }}
                        title="Secondary Accent"
                      />
                      <div
                        className="w-1/3 flex items-center justify-center text-[9px] font-medium"
                        style={{ backgroundColor: bgColor, color: textColor }}
                        title="Background Surface"
                      >
                        Bg
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Custom Accent Colour */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-primary" />
                  Custom Accent Colour & Contrast Validation
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pick any custom brand or personal accent. Evaluates WCAG 2.1 AA & AAA compliance in real time.
                </p>
              </div>

              {currentSettings.customAccent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCustomAccent(null)}
                  className="text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Revert to Palette Default
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Native Color Picker Box & Input */}
              <div className="flex items-center gap-2 shrink-0">
                <label className="relative w-9 h-9 rounded-lg overflow-hidden border border-border shadow-xs cursor-pointer block shrink-0">
                  <input
                    type="color"
                    value={isCustomAccentValid ? normalizeHex(accentInput) : "#3b82f6"}
                    onChange={(e) => {
                      setAccentInput(e.target.value);
                      previewTheme({ customAccent: e.target.value });
                    }}
                    className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer border-0 p-0"
                    aria-label="Choose custom accent colour"
                  />
                </label>

                {/* Hex Text Input */}
                <div className="relative">
                  <input
                    type="text"
                    value={accentInput}
                    onChange={(e) => {
                      setAccentInput(e.target.value);
                      if (isValidHex(e.target.value)) {
                        previewTheme({ customAccent: normalizeHex(e.target.value) });
                      }
                    }}
                    placeholder="#3B82F6"
                    maxLength={7}
                    className="w-24 font-mono text-xs px-2.5 py-2 rounded-lg bg-muted/60 border border-border text-foreground uppercase tracking-wider focus:outline-hidden focus:ring-1 focus:ring-primary"
                    aria-label="Hex color code"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={handleCustomAccentApply}
                  disabled={!isCustomAccentValid}
                  className="text-xs cursor-pointer h-8 px-3 shrink-0"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Apply Accent
                </Button>
              </div>

              {/* Contrast Analysis Badge */}
              {contrastAnalysis && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs shrink-0 max-w-full">
                  <span className="text-muted-foreground whitespace-nowrap">WCAG Contrast:</span>
                  <span className="font-bold text-foreground font-mono whitespace-nowrap">
                    {contrastAnalysis.ratio}:1
                  </span>
                  {contrastAnalysis.level === "AAA" ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] whitespace-nowrap">
                      <ShieldCheck className="w-3 h-3 mr-1" /> AAA Compliant
                    </Badge>
                  ) : contrastAnalysis.level === "AA" ? (
                    <Badge variant="outline" className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[10px] whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> AA Compliant
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] whitespace-nowrap">
                      <AlertCircle className="w-3 h-3 mr-1" /> Low Contrast
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Recent Color History */}
            {currentSettings.accentHistory.length > 0 && (
              <div className="pt-2 border-t border-border flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Recently used:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {currentSettings.accentHistory.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => {
                        setAccentInput(col);
                        setCustomAccent(col);
                      }}
                      className="w-5 h-5 rounded-full border border-border shadow-xs hover:scale-110 transition-transform cursor-pointer relative"
                      style={{ backgroundColor: col }}
                      title={`Use accent ${col}`}
                    >
                      {currentSettings.customAccent === col && (
                        <Check className="w-3 h-3 text-white absolute inset-0 m-auto drop-shadow-xs" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
       * TAB 2: LAYOUT & DENSITY
       * ===================================================================== */}
      {activeTab === "layout" && (
        <div className="space-y-6">
          {/* Section A: Interface Density */}
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Interface Information Density
              </h3>
              <p className="text-xs text-muted-foreground">
                Adjust table cell height, card padding, and navigation item spacing across all views.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: "compact" as InterfaceDensity,
                  label: "Compact",
                  desc: "Tighter spacing and compact padding. Ideal for laptops and dense research matrices.",
                },
                {
                  id: "comfortable" as InterfaceDensity,
                  label: "Comfortable (Default)",
                  desc: "Standard academic workstation balance with clear visual breathing room.",
                },
                {
                  id: "spacious" as InterfaceDensity,
                  label: "Spacious",
                  desc: "Generous padding and elevated readability for large 4K displays and relaxed reading.",
                },
              ].map((opt) => {
                const isSelected = currentSettings.density === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDensity(opt.id)}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                        : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
                    )}
                  >
                    <div>
                      <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                        {opt.label}
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        {opt.desc}
                      </div>
                    </div>

                    {/* Visual Density Graphic Preview */}
                    <div className="mt-3 p-2 rounded-md bg-muted/60 border border-border/60 flex flex-col gap-1">
                      <div
                        className={cn(
                          "w-3/4 rounded bg-primary/60",
                          opt.id === "compact" ? "h-1.5" : opt.id === "spacious" ? "h-3" : "h-2"
                        )}
                      />
                      <div
                        className={cn(
                          "w-1/2 rounded bg-muted-foreground/30",
                          opt.id === "compact" ? "h-1" : opt.id === "spacious" ? "h-2" : "h-1.5"
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section B: Surface Background Presets */}
          <div className="space-y-3 pt-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Surface Background Tone & Contrast
              </h3>
              <p className="text-xs text-muted-foreground">
                Fine-tune background temperature and contrast without changing your primary accent palette.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                {
                  id: "default" as BackgroundPreset,
                  label: "Palette Default",
                  desc: "Uses the curated surface tone of your selected colour palette.",
                },
                {
                  id: "neutral" as BackgroundPreset,
                  label: "Neutral Slate / Zinc",
                  desc: "Pure neutral greys with zero chromatic hue casting.",
                },
                {
                  id: "cool" as BackgroundPreset,
                  label: "Cool Glacier",
                  desc: "Subtle cold blue tint for technical analytical reading.",
                },
                {
                  id: "warm" as BackgroundPreset,
                  label: "Warm Sand / Stone",
                  desc: "Cozy warm tint designed to reduce blue-light eye strain during night hours.",
                },
                {
                  id: "high_contrast" as BackgroundPreset,
                  label: "High Contrast (OLED)",
                  desc: "Pitch true black (#000000) or pure white with reinforced borders for maximum clarity.",
                },
              ].map((bgOpt) => {
                const isSelected = currentSettings.backgroundPreset === bgOpt.id;
                return (
                  <button
                    key={bgOpt.id}
                    type="button"
                    onClick={() => setBackgroundPreset(bgOpt.id)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                        : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
                    )}
                  >
                    <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                      {bgOpt.label}
                      {isSelected && <Check className="w-3 h-3 text-primary" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {bgOpt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
       * TAB 3: MOTION & EFFECTS
       * ===================================================================== */}
      {activeTab === "motion" && (
        <div className="space-y-6">
          {/* Section A: Motion Preferences */}
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Motion & Transition Behavior
              </h3>
              <p className="text-xs text-muted-foreground">
                Control interface transitions, drawer animations, and circular ripple splashes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: "system" as MotionPreference,
                  label: "System Default",
                  desc: "Follows Windows accessibility 'Show animations in Windows' preference automatically.",
                },
                {
                  id: "standard" as MotionPreference,
                  label: "Standard Motion",
                  desc: "Full fluid spring animations, circular theme splashes, and drawer transitions.",
                },
                {
                  id: "reduced" as MotionPreference,
                  label: "Reduced Motion",
                  desc: "Minimizes motion and disables parallax transitions for sensitive eyesight.",
                },
              ].map((mOpt) => {
                const isSelected = currentSettings.motion === mOpt.id;
                return (
                  <button
                    key={mOpt.id}
                    type="button"
                    onClick={() => setMotion(mOpt.id)}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                        : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
                    )}
                  >
                    <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                      {mOpt.label}
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {mOpt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section B: Ambient Particle Field */}
          <div className="space-y-3 pt-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ambient Background Particle Field
              </h3>
              <p className="text-xs text-muted-foreground">
                Configures the subtle animated node-link particle canvas rendered in the application background.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: "off" as ParticleIntensity, label: "Disabled (Off)" },
                { id: "subtle" as ParticleIntensity, label: "Subtle (Low)" },
                { id: "normal" as ParticleIntensity, label: "Normal (Default)" },
                { id: "high" as ParticleIntensity, label: "High Density" },
              ].map((pOpt) => {
                const isSelected = currentSettings.particleIntensity === pOpt.id;
                return (
                  <button
                    key={pOpt.id}
                    type="button"
                    onClick={() => setParticleIntensity(pOpt.id)}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all cursor-pointer text-xs font-medium",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "border-border bg-card text-foreground hover:bg-muted/40"
                    )}
                  >
                    {pOpt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
       * TAB 4: CUSTOM THEMES
       * ===================================================================== */}
      {activeTab === "custom" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Saved Custom Themes
              </h3>
              <p className="text-xs text-muted-foreground">
                Create, export, and share personalized themes with customized colors and surfaces.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportClipboard}
                className="text-xs cursor-pointer"
                title="Copy all custom themes to clipboard as JSON"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                {copiedExport ? "Copied JSON!" : "Export Themes"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImportModal(true)}
                className="text-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                Import Themes
              </Button>

              <Button
                size="sm"
                onClick={() => setShowSaveModal(true)}
                className="text-xs bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Save Current Look
              </Button>
            </div>
          </div>

          {/* List of Custom Themes */}
          {currentSettings.customThemes.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-2">
              <Sparkles className="w-6 h-6 text-muted-foreground mx-auto" />
              <h4 className="text-xs font-bold text-foreground">No Custom Themes Saved Yet</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Customize your accent colour or background preset, then click &ldquo;Save Current Look&rdquo; to save it as a reusable theme preset.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {currentSettings.customThemes.map((ct) => {
                const isActive = currentSettings.activeCustomThemeId === ct.id;
                return (
                  <div
                    key={ct.id}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3",
                      isActive
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground truncate">
                          {ct.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-border shadow-2xs shrink-0"
                          style={{ backgroundColor: ct.accentColor }}
                        />
                        <span className="font-mono">{ct.accentColor}</span>
                        <span>•</span>
                        <span className="capitalize">{ct.basePreset.replace("_", " ")}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                      <Button
                        variant={isActive ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => applyCustomTheme(ct.id)}
                        className="text-xs cursor-pointer flex-1"
                      >
                        {isActive ? "Currently Active" : "Apply"}
                      </Button>

                      {deleteConfirmId === ct.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              void deleteCustomTheme(ct.id);
                              setDeleteConfirmId(null);
                            }}
                            className="text-xs h-7 px-2 cursor-pointer"
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs h-7 px-1.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(ct.id)}
                          className="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Delete custom theme"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modal: Save Current Look as Custom Theme */}
          {showSaveModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveCustomTheme}
                className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Save as Custom Theme
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowSaveModal(false)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-theme-name" className="text-xs font-semibold text-foreground">
                    Theme Name
                  </label>
                  <input
                    id="custom-theme-name"
                    type="text"
                    required
                    value={customThemeName}
                    onChange={(e) => setCustomThemeName(e.target.value)}
                    placeholder="e.g., Deep Space Cyberpunk"
                    className="w-full text-xs px-3 py-2 rounded-lg bg-muted/60 border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>

                <div className="p-3 rounded-lg bg-muted/40 border border-border/80 text-[11px] text-muted-foreground space-y-1">
                  <div>
                    Accent: <strong className="text-foreground">{currentSettings.customAccent || "Palette default"}</strong>
                  </div>
                  <div>
                    Base Preset: <strong className="text-foreground capitalize">{currentSettings.preset.replace("_", " ")}</strong>
                  </div>
                  <div>
                    Surface: <strong className="text-foreground capitalize">{currentSettings.backgroundPreset}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSaveModal(false)}
                    className="text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="text-xs bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
                  >
                    Save Custom Theme
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Modal: Import Themes JSON */}
          {showImportModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <form
                onSubmit={handleImportSubmit}
                className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" />
                    Import Custom Themes JSON
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportStatus(null);
                    }}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="import-json-area" className="text-xs font-semibold text-foreground">
                    Paste Themes JSON Array
                  </label>
                  <textarea
                    id="import-json-area"
                    rows={6}
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    placeholder="[{ &quot;name&quot;: &quot;My Theme&quot;, &quot;accentColor&quot;: &quot;#06B6D4&quot; }]"
                    className="w-full font-mono text-[11px] p-2.5 rounded-lg bg-muted/60 border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                {importStatus && (
                  <div
                    className={cn(
                      "p-2.5 rounded-lg text-xs font-medium",
                      importStatus.success
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-destructive/10 text-destructive border border-destructive/20"
                    )}
                  >
                    {importStatus.message}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportStatus(null);
                    }}
                    className="text-xs cursor-pointer"
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="text-xs bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
                  >
                    Import Themes
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppearanceSettingsView;
