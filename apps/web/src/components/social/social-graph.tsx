"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useSocialGraph } from "@/hooks/queries/use-social-queries";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface SocialGraphProps {
  accountId?: string;
}

export function SocialGraph({ accountId }: SocialGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const { data, isLoading } = useSocialGraph(accountId);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth);

    return () => observer.disconnect();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Social Graph</CardTitle>
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
          <CardTitle>Social Graph</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState message="No social connections found between monitored accounts. Run social snapshots first." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Graph</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="w-full">
          <ForceGraph2D
            graphData={data}
            nodeLabel="name"
            nodeColor={(node: Record<string, unknown>) =>
              node.isMonitored
                ? "hsl(217, 91%, 60%)"
                : "hsl(215, 16%, 47%)"
            }
            nodeVal="val"
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            linkColor={(link: Record<string, unknown>) =>
              link.isMutual
                ? "hsl(217, 91%, 60%)"
                : "hsl(220, 13%, 69%)"
            }
            width={containerWidth}
            height={400}
            onNodeClick={(node: Record<string, unknown>) => {
              console.log("Clicked node:", node);
            }}
            backgroundColor="transparent"
          />
        </div>
      </CardContent>
    </Card>
  );
}
