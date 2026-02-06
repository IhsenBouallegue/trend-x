"use client";

import { formatDistanceToNow } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Brain,
  FolderSearch,
  GitMerge,
  Layers,
  RefreshCw,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type ActivityActionType =
  | "tweets_classified"
  | "topics_bootstrapped"
  | "profile_updated"
  | "new_topic_detected"
  | "personality_evaluated"
  | "drift_buffer_processed";

interface ActivityLogEntry {
  id: string;
  accountId: string;
  actionType: ActivityActionType;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

interface ActivityLogProps {
  entries: ActivityLogEntry[];
  maxHeight?: string;
}

const ACTION_CONFIG: Record<
  ActivityActionType,
  { icon: LucideIcon; color: string; label: string }
> = {
  tweets_classified: {
    icon: Tags,
    color: "text-blue-500",
    label: "Classified",
  },
  topics_bootstrapped: {
    icon: Layers,
    color: "text-emerald-500",
    label: "Bootstrapped",
  },
  profile_updated: {
    icon: RefreshCw,
    color: "text-green-500",
    label: "Updated",
  },
  new_topic_detected: {
    icon: FolderSearch,
    color: "text-amber-500",
    label: "New Topic",
  },
  personality_evaluated: {
    icon: Brain,
    color: "text-purple-500",
    label: "Personality",
  },
  drift_buffer_processed: {
    icon: GitMerge,
    color: "text-cyan-500",
    label: "Drift Buffer",
  },
};

export function ActivityLog({ entries, maxHeight = "400px" }: ActivityLogProps) {
  if (entries.length === 0) {
    return (
      <EmptyState message="No activity recorded yet" />
    );
  }

  return (
    <ScrollArea style={{ maxHeight }}>
      <div className="space-y-1">
        {entries.map((entry) => {
          const config = ACTION_CONFIG[entry.actionType] ?? ACTION_CONFIG.profile_updated;
          const Icon = config.icon;
          const timeAgo = formatDistanceToNow(new Date(entry.createdAt * 1000), {
            addSuffix: true,
          });

          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 px-1 py-2 text-xs"
            >
              <div className={`mt-0.5 shrink-0 ${config.color}`}>
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground leading-relaxed">{entry.message}</p>
                <p className="mt-0.5 text-muted-foreground text-[11px]">{timeAgo}</p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
