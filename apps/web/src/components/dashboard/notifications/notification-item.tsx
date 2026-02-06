"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
  notification: {
    id: string;
    title: string;
    explanation: string;
    changeType: string;
    isRead: number;
    createdAt: number;
    change: {
      id: string;
      type: string;
      dimension: string;
      beforeValue: string | null;
      afterValue: string;
      explanation: string;
      evidence: {
        tweetIds: string[];
      };
    } | null;
  };
  isActive: boolean;
  onClick: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function getBadgeVariant(changeType: string): "default" | "secondary" | "destructive" | "outline" {
  if (changeType === "topic_new" || changeType === "topic_drop") return "default";
  if (changeType === "sentiment_shift") return "destructive";
  if (changeType === "activity_spike" || changeType === "activity_drop") return "secondary";
  if (changeType === "silence") return "outline";
  return "default";
}

function formatChangeType(changeType: string): string {
  return changeType.replace(/_/g, " ");
}

export function NotificationItem({ notification, isActive, onClick }: NotificationItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 flex-col border p-4 text-left transition-colors",
        "w-[220px]",
        isActive
          ? "border-primary bg-primary/5 text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <Badge variant={getBadgeVariant(notification.changeType)} className="text-[10px]">
          {formatChangeType(notification.changeType)}
        </Badge>
        {notification.isRead === 0 && (
          <span className="bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary">
            New
          </span>
        )}
      </div>

      {/* Timestamp */}
      <span className="mt-1.5 text-muted-foreground text-xs">
        {formatRelativeTime(notification.createdAt)}
      </span>

      {/* Title */}
      <p className="mt-2 line-clamp-2 font-semibold text-foreground text-sm leading-snug">
        {notification.title}
      </p>

      {/* Explanation snippet */}
      <p className="mt-1.5 line-clamp-3 text-muted-foreground text-xs leading-relaxed">
        {notification.explanation}
      </p>

      {/* Metadata */}
      {notification.change && (
        <div className="mt-3 space-y-1 text-xs">
          <div>
            <span className="text-muted-foreground">Dimension</span>
            <p className="font-medium text-foreground">{notification.change.dimension}</p>
          </div>
        </div>
      )}
    </button>
  );
}
