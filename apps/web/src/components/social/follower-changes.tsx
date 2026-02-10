"use client";

import { UserPlus, UserMinus, BadgeCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useRecentChanges } from "@/hooks/queries/use-social-queries";

interface FollowerChangesProps {
  accountId: string;
}

export function FollowerChanges({ accountId }: FollowerChangesProps) {
  const { data, isLoading } = useRecentChanges(accountId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Changes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Changes</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState message="No recent changes detected. Run a social snapshot to track connections." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Changes</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {data.map((change) => {
              const isAdded = change.changeType === "added";
              const timeAgo = formatDistanceToNow(
                new Date(change.changeTimestamp * 1000),
                { addSuffix: true },
              );

              return (
                <div
                  key={`${change.userId}-${change.direction}-${change.changeType}`}
                  className="flex items-center gap-3 py-1.5"
                >
                  {isAdded ? (
                    <UserPlus className="h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <UserMinus className="h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">
                        @{change.username}
                      </span>
                      {change.isBlueVerified === 1 && (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      )}
                    </div>
                    {change.displayName && (
                      <p className="text-xs text-muted-foreground truncate">
                        {change.displayName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {change.followerCount !== null && change.followerCount > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {change.followerCount.toLocaleString()} followers
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
