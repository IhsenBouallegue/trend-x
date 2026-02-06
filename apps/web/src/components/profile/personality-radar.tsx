"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";

interface PersonalityScores {
  formal: number;
  technical: number;
  provocative: number;
  thoughtLeader: number;
  commentator: number;
  curator: number;
  promoter: number;
}

interface PersonalityRadarProps {
  scores: PersonalityScores;
  summary: string;
  values: string[];
}

const DIMENSION_LABELS: Record<keyof PersonalityScores, string> = {
  formal: "Formal",
  technical: "Technical",
  provocative: "Provocative",
  thoughtLeader: "Thought Leader",
  commentator: "Commentator",
  curator: "Curator",
  promoter: "Promoter",
};

const chartConfig = {
  score: {
    label: "Score",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function PersonalityRadar({ scores, summary, values }: PersonalityRadarProps) {
  const chartData = (Object.keys(DIMENSION_LABELS) as Array<keyof PersonalityScores>).map(
    (key) => ({
      dimension: DIMENSION_LABELS[key],
      score: scores[key],
    }),
  );

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[320px] flex-1 min-w-0">
        <RadarChart data={chartData} outerRadius="75%">
          <ChartTooltip content={<ChartTooltipContent />} />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "var(--foreground)", fontSize: 12 }}
          />
          <PolarGrid stroke="var(--border)" />
          <Radar
            name="Score"
            dataKey="score"
            fill="var(--color-score)"
            fillOpacity={0.25}
            stroke="var(--color-score)"
            strokeWidth={2}
          />
        </RadarChart>
      </ChartContainer>

      <div className="flex flex-col justify-center gap-3 md:w-2/5 shrink-0">
        {summary && (
          <p className="text-muted-foreground text-sm leading-relaxed">{summary}</p>
        )}

        {values.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {values.map((value) => (
              <Badge key={value} variant="secondary" className="max-w-[200px] truncate">
                {value}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
