"use client";

import { Users, UserPlus, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useSocialStats } from "@/hooks/queries/use-social-queries";

type Direction = "following" | "follower" | "mutual";

interface SocialStatsProps {
  accountId: string;
  onViewConnections?: (direction: Direction) => void;
}

export function SocialStats({ accountId, onViewConnections }: SocialStatsProps) {
  const { data, isLoading } = useSocialStats(accountId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState message="Run a social snapshot to see connection stats." />
    );
  }

  const stats = [
    {
      label: "Following",
      value: data.followingCount,
      icon: Users,
      direction: "following" as Direction,
    },
    {
      label: "Followers",
      value: data.followerCount,
      icon: Users,
      direction: "follower" as Direction,
    },
    {
      label: "Mutual",
      value: data.mutualCount,
      icon: UserPlus,
      direction: "mutual" as Direction,
    },
    {
      label: "Last Fetched",
      value: data.lastFetchedAt
        ? formatDistanceToNow(new Date(data.lastFetchedAt * 1000), {
            addSuffix: true,
          })
        : "Never",
      icon: Clock,
      direction: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => {
        const isClickable = stat.direction && onViewConnections;
        return (
          <Card
            key={stat.label}
            className={
              isClickable
                ? "cursor-pointer transition-colors hover:bg-muted/50"
                : undefined
            }
            onClick={
              isClickable
                ? () => onViewConnections(stat.direction!)
                : undefined
            }
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <stat.icon className="h-3.5 w-3.5" />
                <span className="text-xs">{stat.label}</span>
                {isClickable && (
                  <ExternalLink className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xl font-semibold tabular-nums">
                  {typeof stat.value === "number"
                    ? stat.value.toLocaleString()
                    : stat.value}
                </p>
                {isClickable && (
                  <span className="text-[10px] text-muted-foreground">
                    View all
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
