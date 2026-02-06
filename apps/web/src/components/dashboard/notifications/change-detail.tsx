"use client";

import { ArrowRight } from "lucide-react";

interface ChangeDetailProps {
  changeType: string;
  dimension: string;
  beforeValue: string | null;
  afterValue: string;
  explanation: string;
}

function formatValue(value: string | null, changeType: string): string {
  if (value === null) return "None";

  try {
    const parsed = JSON.parse(value);

    // Handle numeric values
    if (typeof parsed === "number") {
      // Topic proportions and sentiment are percentages
      if (changeType.includes("topic") || changeType.includes("sentiment")) {
        return `${(parsed * 100).toFixed(1)}%`;
      }
      // Activity metrics - show as-is with label
      if (changeType.includes("activity")) {
        return `${parsed.toFixed(1)} tweets/day`;
      }
      return parsed.toFixed(2);
    }

    // Handle string values
    return String(parsed);
  } catch {
    // If not valid JSON, return as-is
    return value;
  }
}

export function ChangeDetail({
  changeType,
  dimension,
  beforeValue,
  afterValue,
  explanation,
}: ChangeDetailProps) {
  const formattedBefore = formatValue(beforeValue, changeType);
  const formattedAfter = formatValue(afterValue, changeType);

  return (
    <div className="space-y-3">
      <div className="space-y-2 border bg-muted/50 p-4">
        <div className="font-medium text-sm">{dimension}</div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground line-through">{formattedBefore}</span>
          <ArrowRight className="size-4 text-muted-foreground" />
          <span className="font-semibold text-primary">{formattedAfter}</span>
        </div>

        <p className="text-muted-foreground text-sm leading-relaxed">{explanation}</p>
      </div>
    </div>
  );
}
