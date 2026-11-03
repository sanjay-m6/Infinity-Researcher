import {
  Compass,
  Search,
  BookOpen,
  Library,
  Bookmark,
  Layers,
  Sparkles,
  DownloadCloud,
  Download,
  RefreshCw,
  FolderOpen,
  Settings,
  ShieldCheck,
  Shield,
  Clock,
  Cpu,
  Bot,
  Filter,
  Globe,
  FileText,
  TableProperties,
  PenTool,
  ScanEye,
  FileSearch,
  BarChart2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  LogOut,
  Minus,
  Square,
  Copy,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Send,
  Plus,
  Trash2,
  LucideProps,
} from "lucide-react";
import React from "react";

/**
 * Semantic Icon Registry mapping Infinity Researcher domain concepts
 * to standardized, high-performance Lucide stroke symbols.
 */
export const IconRegistry = {
  // Navigation & Shell
  navigation: {
    discover: Compass,
    workspace: Layers,
    library: Library,
    assistant: Sparkles,
    matrix: TableProperties,
    downloads: DownloadCloud,
    collections: FolderOpen,
    sources: Globe,
    activity: Clock,
    settings: Settings,
    privacy: Shield,
    collapseSidebar: PanelLeftClose,
    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    chevronDown: ChevronDown,
    chevronUp: ChevronUp,
  },

  // Research Discovery & Filtering
  discovery: {
    search: Search,
    filter: Filter,
    source: Globe,
    openAccess: Unlock,
    externalLink: ExternalLink,
    addPaper: Plus,
  },

  // Library & Reading
  library: {
    paper: FileText,
    book: BookOpen,
    collection: FolderOpen,
    bookmark: Bookmark,
    delete: Trash2,
  },

  // PDF Viewer & Canvas Controls
  pdfViewer: {
    zoomIn: ZoomIn,
    zoomOut: ZoomOut,
    rotate: RotateCw,
    fitScreen: Maximize2,
    minimize: Minimize2,
    prevPage: ChevronUp,
    nextPage: ChevronDown,
    download: Download,
  },

  // Tasks, Downloads & Sync
  tasks: {
    download: DownloadCloud,
    refresh: RefreshCw,
    loading: Loader2,
    success: CheckCircle2,
    warning: AlertTriangle,
    pending: Clock,
  },

  // AI Research Assistant & Writing Tools
  aiTools: {
    sparkles: Sparkles,
    bot: Bot,
    cpu: Cpu,
    send: Send,
    pen: PenTool,
    detector: ScanEye,
    paraphrase: FileSearch,
    analytics: BarChart2,
    copy: Copy,
  },

  // Authentication & System Protection
  security: {
    lock: Lock,
    unlock: Unlock,
    shield: ShieldCheck,
    eye: Eye,
    eyeOff: EyeOff,
    logout: LogOut,
  },

  // Window Controls (TitleBar)
  window: {
    minimize: Minus,
    maximize: Square,
    restore: Copy,
    close: X,
  },
} as const;

export type IconDomain = keyof typeof IconRegistry;

/**
 * Helper to retrieve a semantic icon safely from the registry.
 */
export function getRegisteredIcon<
  D extends IconDomain,
  K extends keyof (typeof IconRegistry)[D],
>(domain: D, key: K): React.ComponentType<LucideProps> {
  return IconRegistry[domain][key] as unknown as React.ComponentType<LucideProps>;
}
