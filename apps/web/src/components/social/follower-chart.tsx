"use client";

import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useFollowerChart } from "@/hooks/queries/use-social-queries";

const chartConfig = {
  followerCount: {
    label: "Followers",
    color: "var(--chart-1)",
  },
  followingCount: {
    label: "Following",
    color: "var(--chart-2)",
  },
  mutualCount: {
    label: "Mutual",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

interface FollowerChartProps {
  accountId: string;
}

export function FollowerChart({ accountId }: FollowerChartProps) {
  const { data, isLoading } = useFollowerChart(accountId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Follower Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Follower Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState message="No data yet. Run a social snapshot to start tracking follower trends." />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((point) => ({
    date: format(new Date(point.fetchedAt * 1000), "MMM d"),
    followerCount: point.followerCount,
    followingCount: point.followingCount,
    mutualCount: point.mutualCount,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Follower Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="followerCount"
              type="monotone"
              fill="var(--color-followerCount)"
              fillOpacity={0.15}
              stroke="var(--color-followerCount)"
              strokeWidth={2}
            />
            <Area
              dataKey="followingCount"
              type="monotone"
              fill="var(--color-followingCount)"
              fillOpacity={0.15}
              stroke="var(--color-followingCount)"
              strokeWidth={2}
            />
            <Area
              dataKey="mutualCount"
              type="monotone"
              fill="var(--color-mutualCount)"
              fillOpacity={0.15}
              stroke="var(--color-mutualCount)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
