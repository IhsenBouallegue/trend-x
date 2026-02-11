"use client";

import { useEffect, useMemo } from "react";
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

// Dark theme colors matching the app's green primary palette
const COLORS = {
  selfNode: "#4ade80",
  monitoredNode: "#2dd4bf",
  defaultNode: "#475569",
  mutualEdge: "rgba(74, 222, 128, 0.4)",
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

function Legend() {
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
      <div className="mt-0.5 border-t border-border pt-1.5 flex items-center gap-2">
        <span
          className="inline-block h-0.5 w-3 shrink-0 rounded-full"
          style={{ background: COLORS.selfNode, opacity: 0.6 }}
        />
        Mutual follow
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-px w-3 shrink-0 rounded-full"
          style={{ background: COLORS.defaultNode }}
        />
        One-way follow
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

    graph.addDirectedEdge(link.source, link.target, {
      color: link.isMutual ? COLORS.mutualEdge : COLORS.defaultEdge,
      size: link.isMutual ? 1.5 : 0.5,
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

function TimelineFilter({ currentTime }: { currentTime?: number }) {
  const setSettings = useSetSettings();

  useEffect(() => {
    if (currentTime === undefined) return;

    setSettings({
      nodeReducer: (_node, data) => {
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
        const visible = isVisibleAtTime(
          attrs.firstSeenAt as number | undefined,
          attrs.deactivatedAt as number | null | undefined,
          currentTime,
        );
        return { ...data, type: "arrow" as const, hidden: !visible };
      },
    });
  }, [currentTime, setSettings]);

  return null;
}

export default function SigmaGraph({ data, accountId, currentTime }: SigmaGraphProps) {
  const graph = useMemo(() => buildGraph(data, accountId), [data, accountId]);

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
        <TimelineFilter currentTime={currentTime} />
      </SigmaContainer>
      <Legend />
    </div>
  );
}
