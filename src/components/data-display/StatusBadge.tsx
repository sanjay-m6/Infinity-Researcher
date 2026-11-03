import React from "react";
import {
  CheckCircle,
  Clock,
  Download,
  AlertTriangle,
  Pause,
  Bookmark,
  Sparkles,
  Unlock,
  Lock,
  Search,
} from "lucide-react";
import { Badge, BadgeProps } from "../ui/Badge";
import { cn } from "../../lib/utils";

export type ResearchStatus =
  | "discovered"
  | "saved"
  | "downloading"
  | "downloaded"
  | "processing"
  | "completed"
  | "failed"
  | "paused"
  | "open_access"
  | "restricted"
  | "exact_match"
  | "verified";

export interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  status: ResearchStatus;
  showIcon?: boolean;
  label?: string;
  children?: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showIcon = true,
  label,
  className = "",
  children,
  ...props
}) => {
  const config = {
    discovered: {
      variant: "default" as const,
      icon: Search,
      defaultLabel: "Discovered",
    },
    saved: {
      variant: "saved" as const,
      icon: Bookmark,
      defaultLabel: "Saved",
    },
    downloading: {
      variant: "running" as const,
      icon: Download,
      defaultLabel: "Downloading",
    },
    downloaded: {
      variant: "success" as const,
      icon: CheckCircle,
      defaultLabel: "Downloaded",
    },
    processing: {
      variant: "info" as const,
      icon: Clock,
      defaultLabel: "Processing",
    },
    completed: {
      variant: "success" as const,
      icon: CheckCircle,
      defaultLabel: "Completed",
    },
    failed: {
      variant: "destructive" as const,
      icon: AlertTriangle,
      defaultLabel: "Failed",
    },
    paused: {
      variant: "warning" as const,
      icon: Pause,
      defaultLabel: "Paused",
    },
    open_access: {
      variant: "open-access" as const,
      icon: Unlock,
      defaultLabel: "Open Access",
    },
    restricted: {
      variant: "restricted" as const,
      icon: Lock,
      defaultLabel: "Restricted",
    },
    exact_match: {
      variant: "success" as const,
      icon: Sparkles,
      defaultLabel: "Exact Match",
    },
    verified: {
      variant: "success" as const,
      icon: CheckCircle,
      defaultLabel: "Verified DOI",
    },
  }[status] || {
    variant: "default" as const,
    icon: Clock,
    defaultLabel: status,
  };

  const Icon = config.icon;
  const displayLabel = label || children || config.defaultLabel;

  return (
    <Badge
      variant={config.variant}
      className={cn("gap-1 font-medium", className)}
      {...props}
    >
      {showIcon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{displayLabel}</span>
    </Badge>
  );
};

export default StatusBadge;
