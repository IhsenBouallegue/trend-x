"use client";

import { useEffect, useMemo, useState } from "react";
import Graph from "graphology";
import { SigmaContainer, useSigma, useSetSettings } from "@react-sigma/core";
import { useWorkerLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import "@react-sigma/core/lib/style.css";

interface GraphNode {
  id: string;
  name: string;
  val: number;
  color?: string;
  isMonitored: boolean;
  firstSeenAt?: number;
  deactivatedAt?: number | null;
}

interface GraphLink {
  source: string;
  target: string;
  isMutual: boolean;
  direction?: "following" | "follower" | "mutual";
  firstSeenAt?: number;
  deactivatedAt?: number | null;
}

interface SigmaGraphProps {
  data: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  accountId?: string;
  currentTime?: number;
}

type EdgeDirection = "following" | "follower" | "mutual";

// Dark theme colors matching the app's green primary palette
const COLORS = {
  selfNode: "#4ade80",
  monitoredNode: "#2dd4bf",
  defaultNode: "#475569",
  mutualEdge: "rgba(74, 222, 128, 0.4)",
  followingEdge: "rgba(96, 165, 250, 0.5)",   // blue — account follows them
  followerEdge: "rgba(251, 146, 60, 0.5)",     // orange — they follow account
  defaultEdge: "rgba(51, 65, 85, 0.35)",
  label: "#a1a1aa",
};

const SIZES = {
  selfNode: 20,
  monitoredNode: 12,
  defaultNode: 5,
};

function ForceAtlas2Layout() {
  const sigma = useSigma();
  const { start, stop } = useWorkerLayoutForceAtlas2({
    settings: {
      gravity: 1,
      scalingRatio: 80,
      slowDown: 3,
      barnesHutOptimize: true,
      adjustSizes: true,
      strongGravityMode: true,
      linLogMode: true,
    },
  });

  useEffect(() => {
    start();
    const timer = setTimeout(() => {
      stop();
      // Re-center camera to fit all nodes after layout settles
      sigma.getCamera().animatedReset({ duration: 300 });
    }, 4000);
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [start, stop, sigma]);

  return null;
}

function Legend({
  hiddenDirections,
  onToggle,
}: {
  hiddenDirections: Set<EdgeDirection>;
  onToggle: (dir: EdgeDirection) => void;
}) {
  const edgeItems: { dir: EdgeDirection; color: string; label: string }[] = [
    { dir: "mutual", color: COLORS.mutualEdge, label: "Mutual follow" },
    { dir: "following", color: COLORS.followingEdge, label: "Following" },
    { dir: "follower", color: COLORS.followerEdge, label: "Followed by" },
  ];

  return (
    <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-none border border-border bg-card/90 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-full"
          style={{ background: COLORS.selfNode }}
        />
        Selected account
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: COLORS.monitoredNode }}
        />
        Observed account
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: COLORS.defaultNode }}
        />
        Notable connection
      </div>
      <div className="mt-0.5 border-t border-border pt-1.5 flex flex-col gap-1.5">
        {edgeItems.map(({ dir, color, label }) => {
          const hidden = hiddenDirections.has(dir);
          return (
            <button
              key={dir}
              type="button"
              onClick={() => onToggle(dir)}
              className="flex items-center gap-2 transition-opacity hover:text-foreground"
              style={{ opacity: hidden ? 0.35 : 1 }}
            >
              <span
                className="inline-block h-0.5 w-3 shrink-0 rounded-full transition-opacity"
                style={{ background: color }}
              />
              <span className={hidden ? "line-through" : ""}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildGraph(data: SigmaGraphProps["data"], accountId?: string): Graph {
  const graph = new Graph({ type: "directed", multi: false });

  for (const node of data.nodes) {
    const isSelf = accountId != null && node.id === accountId;

    let color: string;
    let size: number;

    if (node.color) {
      // Use explicit color from data (e.g. cross-account graph)
      color = node.color;
      size = node.val ?? SIZES.defaultNode;
    } else if (isSelf) {
      color = COLORS.selfNode;
      size = SIZES.selfNode;
    } else if (node.isMonitored) {
      color = COLORS.monitoredNode;
      size = SIZES.monitoredNode;
    } else {
      color = COLORS.defaultNode;
      size = SIZES.defaultNode;
    }

    graph.addNode(node.id, {
      label: node.name,
      size,
      color,
      x: (Math.random() - 0.5) * 500,
      y: (Math.random() - 0.5) * 500,
      firstSeenAt: node.firstSeenAt,
      deactivatedAt: node.deactivatedAt,
    });
  }

  for (const link of data.links) {
    if (!graph.hasNode(link.source) || !graph.hasNode(link.target)) continue;
    if (graph.hasDirectedEdge(link.source, link.target)) continue;

    const dir: EdgeDirection =
      link.isMutual || link.direction === "mutual"
        ? "mutual"
        : link.direction === "follower"
          ? "follower"
          : "following";

    let edgeColor: string;
    let edgeSize: number;
    if (dir === "mutual") {
      edgeColor = COLORS.mutualEdge;
      edgeSize = 1.5;
    } else if (dir === "follower") {
      edgeColor = COLORS.followerEdge;
      edgeSize = 0.8;
    } else if (dir === "following") {
      edgeColor = COLORS.followingEdge;
      edgeSize = 0.8;
    } else {
      edgeColor = COLORS.defaultEdge;
      edgeSize = 0.5;
    }

    graph.addDirectedEdge(link.source, link.target, {
      color: edgeColor,
      size: edgeSize,
      direction: dir,
      firstSeenAt: link.firstSeenAt,
      deactivatedAt: link.deactivatedAt,
    });
  }

  return graph;
}

function isVisibleAtTime(
  firstSeenAt: number | undefined,
  deactivatedAt: number | null | undefined,
  currentTime: number,
): boolean {
  // No temporal data = always visible
  if (firstSeenAt === undefined) return true;
  // Monitored nodes (firstSeenAt === 0) are always visible
  if (firstSeenAt === 0) return true;
  return firstSeenAt <= currentTime && (deactivatedAt == null || deactivatedAt > currentTime);
}

/** Combined filter: handles both timeline visibility and direction toggle. */
function GraphFilters({
  currentTime,
  hiddenDirections,
}: {
  currentTime?: number;
  hiddenDirections: Set<EdgeDirection>;
}) {
  const setSettings = useSetSettings();

  useEffect(() => {
    setSettings({
      nodeReducer: (_node, data) => {
        if (currentTime === undefined) return data;
        const attrs = data as Record<string, unknown>;
        const visible = isVisibleAtTime(
          attrs.firstSeenAt as number | undefined,
          attrs.deactivatedAt as number | null | undefined,
          currentTime,
        );
        return { ...data, hidden: !visible };
      },
      edgeReducer: (_edge, data) => {
        const attrs = data as Record<string, unknown>;

        // Direction filter
        const dir = attrs.direction as EdgeDirection | undefined;
        if (dir && hiddenDirections.has(dir)) {
          return { ...data, type: "arrow" as const, hidden: true };
        }

        // Timeline filter
        if (currentTime !== undefined) {
          const visible = isVisibleAtTime(
            attrs.firstSeenAt as number | undefined,
            attrs.deactivatedAt as number | null | undefined,
            currentTime,
          );
          if (!visible) {
            return { ...data, type: "arrow" as const, hidden: true };
          }
        }

        return { ...data, type: "arrow" as const, hidden: false };
      },
    });
  }, [currentTime, hiddenDirections, setSettings]);

  return null;
}

export default function SigmaGraph({ data, accountId, currentTime }: SigmaGraphProps) {
  const graph = useMemo(() => buildGraph(data, accountId), [data, accountId]);
  const [hiddenDirections, setHiddenDirections] = useState<Set<EdgeDirection>>(new Set());

  function handleToggle(dir: EdgeDirection) {
    setHiddenDirections((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
      } else {
        next.add(dir);
      }
      return next;
    });
  }

  return (
    <div className="relative rounded-none overflow-hidden border border-border">
      <SigmaContainer
        graph={graph}
        style={{ height: "400px", width: "100%", background: "transparent" }}
        settings={{
          renderEdgeLabels: false,
          defaultEdgeType: "arrow",
          edgeReducer: (_edge, data) => ({
            ...data,
            type: "arrow",
          }),
          labelColor: { color: COLORS.label },
          labelSize: 11,
          labelFont: "var(--font-geist-mono), monospace",
          labelRenderedSizeThreshold: 8,
          defaultNodeColor: COLORS.defaultNode,
          defaultEdgeColor: COLORS.defaultEdge,
          stagePadding: 40,
          zoomToSizeRatioFunction: (cameraRatio) => cameraRatio,
        }}
      >
        <ForceAtlas2Layout />
        <GraphFilters currentTime={currentTime} hiddenDirections={hiddenDirections} />
      </SigmaContainer>
      <Legend hiddenDirections={hiddenDirections} onToggle={handleToggle} />
    </div>
  );
}
