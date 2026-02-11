"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useCrossAccountGraph } from "@/hooks/queries/use-social-queries";
import { TimelineSlider } from "./timeline-slider";

// Sigma components must be loaded client-side (WebGL/DOM required)
const SigmaGraph = dynamic(
  () => import("@/components/social/sigma-graph"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[400px] w-full" />,
  },
);

const LEGEND_COLORS = {
  monitored: "#4ade80",
  shared: "#f59e0b",
  mutualEdge: "rgba(74, 222, 128, 0.4)",
  oneWayEdge: "rgba(71, 85, 105, 0.35)",
};

export function CrossAccountGraph() {
  const { data, isLoading } = useCrossAccountGraph();
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  // Initialize currentTime when data loads
  const effectiveTime = currentTime ?? data?.timeRange?.max ?? 0;

  const hasTimeline = data?.timeRange != null && data.timeRange.min < data.timeRange.max;

  const visibleCount = useMemo(() => {
    if (!data || !hasTimeline) return data?.stats.totalShared ?? 0;
    return data.nodes.filter((n) => {
      if (n.isMonitored) return false; // don't count monitored nodes
      if (n.firstSeenAt === 0 || n.firstSeenAt === undefined) return true;
      return (
        n.firstSeenAt <= effectiveTime &&
        (n.deactivatedAt == null || n.deactivatedAt > effectiveTime)
      );
    }).length;
  }, [data, hasTimeline, effectiveTime]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cross-Account Social Graph</CardTitle>
          <CardDescription>
            Shared connections between all monitored accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.links.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cross-Account Social Graph</CardTitle>
          <CardDescription>
            Shared connections between all monitored accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState message="No shared connections found between monitored accounts. Run social snapshots on multiple accounts first." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cross-Account Social Graph</CardTitle>
        <CardDescription>
          Shared connections between all monitored accounts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SigmaGraph
          data={data}
          currentTime={hasTimeline ? effectiveTime : undefined}
        />

        {/* Timeline slider */}
        {hasTimeline && (
          <TimelineSlider
            min={data.timeRange.min}
            max={data.timeRange.max}
            value={effectiveTime}
            onChange={setCurrentTime}
            visibleCount={visibleCount}
          />
        )}

        {/* Stats line */}
        <p className="text-muted-foreground text-sm">
          {visibleCount} shared connection
          {visibleCount === 1 ? "" : "s"} across{" "}
          {data.stats.totalMonitored} account
          {data.stats.totalMonitored === 1 ? "" : "s"}
        </p>

        {/* Custom legend */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground text-xs">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ background: LEGEND_COLORS.monitored }}
            />
            Monitored account
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ background: LEGEND_COLORS.shared }}
            />
            Shared connection
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-4 shrink-0 rounded-full"
              style={{ background: LEGEND_COLORS.mutualEdge }}
            />
            Mutual follow
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-px w-4 shrink-0 rounded-full"
              style={{ background: LEGEND_COLORS.oneWayEdge }}
            />
            One-way follow
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
