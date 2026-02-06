"use client";

import { formatDistanceToNow } from "date-fns";

interface ProfileSummaryProps {
  topicCount: number;
  totalTweetsProcessed: number;
  tweetsPerDay: number | null;
  lastUpdatedAt: number | null;
  nextScheduledAt?: number | null;
}

interface StatItem {
  label: string;
  value: string;
}

export function ProfileSummary({
  topicCount,
  totalTweetsProcessed,
  tweetsPerDay,
  lastUpdatedAt,
  nextScheduledAt,
}: ProfileSummaryProps) {
  let lastUpdatedValue = "Never";
  if (lastUpdatedAt) {
    const ago = formatDistanceToNow(new Date(lastUpdatedAt * 1000), { addSuffix: true });
    if (nextScheduledAt) {
      const next = formatDistanceToNow(new Date(nextScheduledAt * 1000), { addSuffix: true });
      lastUpdatedValue = `${ago} (next ${next})`;
    } else {
      lastUpdatedValue = ago;
    }
  }

  const stats: StatItem[] = [
    {
      label: "Topics",
      value: topicCount.toString(),
    },
    {
      label: "Tweets Processed",
      value: totalTweetsProcessed.toLocaleString(),
    },
    {
      label: "Tweets / Day",
      value: tweetsPerDay !== null ? tweetsPerDay.toFixed(1) : "--",
    },
    {
      label: "Last Updated",
      value: lastUpdatedValue,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="space-y-1">
          <p className="text-muted-foreground text-[11px]">{stat.label}</p>
          <p className="font-medium text-lg tabular-nums leading-none">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
