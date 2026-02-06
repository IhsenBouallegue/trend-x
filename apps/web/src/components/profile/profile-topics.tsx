"use client";

import { Pie, PieChart } from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface ProfileTopic {
  id: string;
  label: string;
  proportion: number;
  tweetCount: number;
}

interface ProfileTopicsProps {
  topics: ProfileTopic[];
}

export function ProfileTopics({ topics }: ProfileTopicsProps) {
  if (topics.length === 0) {
    return (
      <EmptyState message="No topics detected yet" />
    );
  }

  // Limit to top 6 for chart clarity, aggregate rest as "Other"
  const sorted = [...topics].sort((a, b) => b.proportion - a.proportion);
  const topTopics = sorted.slice(0, 6);
  const rest = sorted.slice(6);
  const otherProportion = rest.reduce((sum, t) => sum + t.proportion, 0);
  const otherCount = rest.reduce((sum, t) => sum + t.tweetCount, 0);

  const chartData = topTopics.map((topic, index) => ({
    topic: `topic${index + 1}`,
    name: topic.label,
    value: Math.round(topic.proportion * 1000) / 10,
    tweetCount: topic.tweetCount,
    fill: `var(--color-topic${index + 1})`,
  }));

  if (otherProportion > 0) {
    chartData.push({
      topic: "other",
      name: "Other",
      value: Math.round(otherProportion * 1000) / 10,
      tweetCount: otherCount,
      fill: "var(--color-other)",
    });
  }

  const chartConfig: ChartConfig = {
    value: { label: "Share" },
  };
  topTopics.forEach((topic, index) => {
    chartConfig[`topic${index + 1}`] = {
      label: topic.label,
      color: `var(--chart-${index + 1})`,
    };
  });
  if (otherProportion > 0) {
    chartConfig.other = {
      label: "Other",
      color: "var(--muted-foreground)",
    };
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[220px] md:w-2/5 shrink-0">
        <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={40}
            outerRadius={70}
          />
        </PieChart>
      </ChartContainer>

      <div className="flex-1 min-w-0 space-y-1.5">
        {sorted.map((topic) => (
          <div
            key={topic.id}
            className="flex items-center justify-between text-xs"
          >
            <span className="shrink-0 text-foreground">{topic.label}</span>
            <span className="flex-1 mx-2 border-b-2 border-dotted border-muted-foreground/30 min-w-4" />
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-muted-foreground tabular-nums">
                {topic.tweetCount} tweets
              </span>
              <span className="w-12 text-right font-medium tabular-nums">
                {(topic.proportion * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
