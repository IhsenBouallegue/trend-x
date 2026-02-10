"use client";

import { Users, UserPlus, Clock, BarChart3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useSocialStats } from "@/hooks/queries/use-social-queries";

interface SocialStatsProps {
  accountId: string;
}

export function SocialStats({ accountId }: SocialStatsProps) {
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
    },
    {
      label: "Followers",
      value: data.followerCount,
      icon: Users,
    },
    {
      label: "Mutual",
      value: data.mutualCount,
      icon: UserPlus,
    },
    {
      label: "Last Fetched",
      value: data.lastFetchedAt
        ? formatDistanceToNow(new Date(data.lastFetchedAt * 1000), {
            addSuffix: true,
          })
        : "Never",
      icon: Clock,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <stat.icon className="h-3.5 w-3.5" />
              <span className="text-xs">{stat.label}</span>
            </div>
            <p className="text-xl font-semibold tabular-nums">
              {typeof stat.value === "number"
                ? stat.value.toLocaleString()
                : stat.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
