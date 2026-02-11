"use client";

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

// Sigma components must be loaded client-side (WebGL/DOM required)
const SigmaGraph = dynamic(() => import("./sigma-graph"), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full" />,
});

interface SocialGraphProps {
  accountId?: string;
}

export function SocialGraph({ accountId }: SocialGraphProps) {
  const { data, isLoading } = useSocialGraph(accountId);

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
        <SigmaGraph data={data} accountId={accountId} />
      </CardContent>
    </Card>
  );
}
