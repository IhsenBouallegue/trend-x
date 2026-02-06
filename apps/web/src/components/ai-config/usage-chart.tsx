"use client";

import { format, parseISO } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsageStats } from "@/hooks/queries";

const chartConfig = {
  embedding: {
    label: "Embeddings",
    color: "var(--chart-1)",
  },
  labeling: {
    label: "Labeling",
    color: "var(--chart-2)",
  },
  sentiment: {
    label: "Sentiment",
    color: "var(--chart-3)",
  },
  explanation: {
    label: "Explanations",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

export function UsageChart() {
  const { data: usageData, isLoading } = useUsageStats({ days: 30 });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="font-medium text-sm">Token Usage (Last 30 Days)</h3>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!usageData || usageData.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="font-medium text-sm">Token Usage (Last 30 Days)</h3>
        <EmptyState message="No usage data yet. Token usage will appear here after running analysis." />
      </div>
    );
  }

  // Transform data into chart-ready format
  const chartData = usageData.map((item) => ({
    date: format(parseISO(item.date), "MMM d"),
    embedding: item.embedding,
    labeling: item.labeling,
    sentiment: item.sentiment,
    explanation: item.explanation,
  }));

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">Token Usage (Last 30 Days)</h3>
      <ChartContainer config={chartConfig} className="h-64 w-full">
        <BarChart data={chartData} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => value}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="embedding"
            stackId="tokens"
            fill="var(--color-embedding)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="labeling"
            stackId="tokens"
            fill="var(--color-labeling)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="sentiment"
            stackId="tokens"
            fill="var(--color-sentiment)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="explanation"
            stackId="tokens"
            fill="var(--color-explanation)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
