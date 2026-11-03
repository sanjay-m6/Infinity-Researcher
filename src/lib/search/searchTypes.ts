import { LucideIcon } from "lucide-react";
import { NavSection } from "../../types/domain";

export type SearchResultCategory =
  "papers" | "collections" | "tools" | "navigation" | "actions" | "history";

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  category: SearchResultCategory;
  icon: LucideIcon;
  score: number;
  badge?: string;
  badgeVariant?:
    "default" | "primary" | "secondary" | "success" | "warning" | "info" | "outline";
  shortcut?: string;
  meta?: {
    paperId?: string;
    collectionId?: string;
    section?: NavSection;
    doi?: string | null;
    year?: number;
    authors?: string[];
  };
  onSelect: () => void;
}

export interface CommandDefinition {
  id: string;
  title: string;
  category: "navigation" | "tool" | "action";
  description?: string;
  shortcut?: string;
  icon: LucideIcon;
  keywords?: string[];
  section?: NavSection;
  execute?: () => void;
}
