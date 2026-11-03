import React from "react";
import { AppearanceSettingsView } from "../../features/settings/components/AppearanceSettingsView";
import { cn } from "../../lib/utils";

export interface ThemeSettingsControlProps {
  className?: string;
  onThemeChanged?: (theme: string) => void;
}

export const ThemeSettingsControl: React.FC<ThemeSettingsControlProps> = ({
  className = "",
  onThemeChanged,
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      <AppearanceSettingsView onThemeChanged={onThemeChanged} />
    </div>
  );
};

export default ThemeSettingsControl;
