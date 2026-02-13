"use client";

import { useState, useMemo } from "react";
import { Search, BadgeCheck, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useSocialConnections } from "@/hooks/queries/use-social-queries";

type Direction = "following" | "follower" | "mutual";

interface ConnectionsSheetProps {
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: Direction;
}

const directionLabels: Record<Direction, string> = {
  following: "Following",
  follower: "Followers",
  mutual: "Mutual Connections",
};

const directionDescriptions: Record<Direction, string> = {
  following: "Accounts this user follows",
  follower: "Accounts following this user",
  mutual: "Accounts with mutual follow relationship",
};

export function ConnectionsSheet({
  accountId,
  open,
  onOpenChange,
  direction,
}: ConnectionsSheetProps) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useSocialConnections(
    open ? accountId : null,
    direction,
    undefined,
    10000,
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (c) =>
        c.username.toLowerCase().includes(q) ||
        c.displayName?.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle>{directionLabels[direction]}</SheetTitle>
        <SheetDescription>
          {directionDescriptions[direction]}
          {data && ` \u2014 ${data.length} total`}
        </SheetDescription>

        <div className="relative mt-4">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by username or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              message={
                search
                  ? "No connections match your search."
                  : "No connections found."
              }
            />
          </div>
        ) : (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-xs text-muted-foreground">
                {search
                  ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`
                  : `${filtered.length} connection${filtered.length !== 1 ? "s" : ""}`}
              </span>
              <span className="text-xs text-muted-foreground">
                Sorted by followers
              </span>
            </div>
            <div className="space-y-0.5">
              {filtered.map((conn) => (
                <a
                  key={conn.id}
                  href={`https://x.com/${conn.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 px-2 py-2 transition-colors hover:bg-muted/50"
                >
                  {conn.profileImageUrl ? (
                    <img
                      src={conn.profileImageUrl}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full bg-muted object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {conn.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        @{conn.username}
                      </span>
                      {conn.isBlueVerified === 1 && (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      )}
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    {conn.displayName && (
                      <p className="truncate text-xs text-muted-foreground">
                        {conn.displayName}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {conn.followerCount !== null &&
                      conn.followerCount !== undefined &&
                      conn.followerCount > 0 && (
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {formatFollowerCount(conn.followerCount)}
                        </span>
                      )}
                    {conn.direction === "mutual" && direction !== "mutual" && (
                      <Badge variant="secondary" className="text-[10px]">
                        mutual
                      </Badge>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function formatFollowerCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}
