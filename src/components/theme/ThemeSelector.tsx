/* eslint-disable react-refresh/only-export-components */
import React, { useRef } from "react";
import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { ThemePreference, ThemeSplashOrigin } from "../../types/theme";
import { cn } from "../../lib/utils";

export interface ThemeOption {
  value: ThemePreference;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Light Theme",
    description: "Crisp scholarly light workstation",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark Theme",
    description: "Deep academic slate dark canvas",
    icon: Moon,
  },
  {
    value: "system",
    label: "System Default",
    description: "Synchronize with OS appearance",
    icon: Laptop,
  },
];

export interface ThemeSelectorProps {
  variant?: "cards" | "segmented" | "compact";
  className?: string;
  onChange?: (preference: ThemePreference) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  variant = "cards",
  className = "",
  onChange,
}) => {
  const { theme, setTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = (val: ThemePreference, origin?: ThemeSplashOrigin) => {
    setTheme(val, origin);
    onChange?.(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (index + 1) % THEME_OPTIONS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (index - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = THEME_OPTIONS.length - 1;
    } else {
      return;
    }

    const nextOption = THEME_OPTIONS[nextIndex];
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="radio"], button[aria-pressed]'
    );
    const targetButton = buttons && buttons[nextIndex] ? buttons[nextIndex] : null;

    handleSelect(nextOption.value, targetButton);

    if (targetButton) {
      targetButton.focus();
    }
  };

  // Compact / Segmented Bar Variant (e.g., Toolbar)
  if (variant === "segmented" || variant === "compact") {
    return (
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label="Theme mode selector"
        className={cn(
          "inline-flex items-center rounded-lg border border-border bg-muted/60 p-0.5",
          className
        )}
      >
        {THEME_OPTIONS.map((opt, idx) => {
          const Icon = opt.icon;
          const isSelected = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={(e) => handleSelect(opt.value, e)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              title={`${opt.label}: ${opt.description}`}
              aria-label={opt.value === "light" ? "Light mode" : opt.value === "dark" ? "Dark mode" : "System theme"}
              className={cn(
                "relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer select-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                isSelected
                  ? "bg-card text-foreground shadow-xs font-semibold scale-[1.02]"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40 active:scale-95"
              )}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5 shrink-0 transition-transform duration-300 ease-out",
                  opt.value === "light" && isSelected && "text-amber-500 rotate-12 scale-110",
                  opt.value === "dark" && isSelected && "text-primary -rotate-12 scale-110",
                  opt.value === "system" && isSelected && "text-muted-foreground scale-105"
                )}
              />
              <span className="capitalize">{opt.value}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Rich 3-Card Variant (e.g., Settings View)
  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Application theme configuration"
      className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3", className)}
    >
      {THEME_OPTIONS.map((opt, idx) => {
        const Icon = opt.icon;
        const isSelected = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={(e) => handleSelect(opt.value, e)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isSelected
                ? "bg-primary/5 border-primary text-foreground font-medium ring-2 ring-primary/20 shadow-xs"
                : "border-border bg-card hover:bg-muted/50 text-foreground active:scale-[0.99]"
            )}
          >
            <div
              className={cn(
                "p-2.5 rounded-lg shrink-0",
                opt.value === "light"
                  ? "bg-amber-500/10 text-amber-500"
                  : opt.value === "dark"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span>{opt.label}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {opt.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeSelector;
