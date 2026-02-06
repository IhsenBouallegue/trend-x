"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Tweet } from "react-tweet";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/contexts/account-context";
import { useTweetActivity, useTweetsByDate } from "@/hooks/queries";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COLORS = {
  empty: "var(--color-muted)",
  levels: [
    "oklch(0.768 0.204 130.85 / 0.3)",
    "oklch(0.768 0.204 130.85 / 0.5)",
    "oklch(0.768 0.204 130.85 / 0.7)",
    "oklch(0.768 0.204 130.85 / 0.9)",
  ],
};

type Cell = { date: string; count: number; day: number } | null;

function buildGrid(
  startDate: Date,
  endDate: Date,
  countMap: Map<string, number>,
): { cells: Cell[]; numWeeks: number } {
  const cursor = new Date(startDate);
  // Align to Sunday
  cursor.setDate(cursor.getDate() - cursor.getDay());

  const cells: Cell[] = [];

  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().split("T")[0]!;
    cells.push({
      date: dateStr,
      count: countMap.get(dateStr) || 0,
      day: cursor.getDay(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Pad last week to 7 days
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return { cells, numWeeks: cells.length / 7 };
}

function getLevel(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function getMonthLabels(cells: Cell[], numWeeks: number): { label: string; col: number }[] {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const labels: { label: string; col: number }[] = [];
  let lastMonth = -1;

  for (let col = 0; col < numWeeks; col++) {
    const cell = cells[col * 7]; // first day (Sunday) of each week
    if (!cell) continue;
    const month = new Date(`${cell.date}T00:00:00Z`).getUTCMonth();
    if (month !== lastMonth) {
      labels.push({ label: months[month]!, col });
      lastMonth = month;
    }
  }
  return labels;
}

function TweetSheet({
  open,
  onOpenChange,
  date,
  count,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  count: number;
}) {
  const { selectedAccountId } = useAccount();

  const { data: tweets, isLoading } = useTweetsByDate(selectedAccountId, date, open);

  const formatted = date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="space-y-6">
          <div>
            <SheetTitle>{formatted}</SheetTitle>
            <SheetDescription>
              {count} tweet{count !== 1 ? "s" : ""} on this day
            </SheetDescription>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : tweets && tweets.length > 0 ? (
            <div className="space-y-3">
              {tweets.map((tw) => (
                <Suspense key={tw.id} fallback={<div className="h-32 animate-pulse bg-muted" />}>
                  <Tweet id={tw.id} />
                </Suspense>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No tweets found for this day.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function TweetHeatmap() {
  const { selectedAccountId } = useAccount();
  const gridRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    date: string;
    count: number;
  } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [sheetCount, setSheetCount] = useState(0);

  const { data: activity, isLoading } = useTweetActivity(selectedAccountId);

  const now = useMemo(() => new Date(), []);
  const oneYearAgo = useMemo(() => {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, [now]);

  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    if (activity) {
      for (const d of activity) {
        map.set(d.date, d.count);
      }
    }
    return map;
  }, [activity]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const c of countMap.values()) {
      if (c > max) max = c;
    }
    return max;
  }, [countMap]);

  const { cells, numWeeks } = useMemo(
    () => buildGrid(oneYearAgo, now, countMap),
    [oneYearAgo, now, countMap],
  );

  const monthLabels = useMemo(() => getMonthLabels(cells, numWeeks), [cells, numWeeks]);

  const handleCellHover = (e: React.MouseEvent, cell: NonNullable<Cell>) => {
    const container = gridRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const cellRect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: cellRect.left - containerRect.left + cellRect.width / 2,
      y: cellRect.top - containerRect.top,
      date: cell.date,
      count: cell.count,
    });
  };

  const handleCellClick = (date: string, count: number) => {
    if (count === 0) return;
    setSheetDate(date);
    setSheetCount(count);
    setSheetOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-[140px] w-full" />
      </div>
    );
  }

  if (!activity || activity.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="font-semibold text-xl">Tweet Activity</h2>
        <EmptyState message="No tweet data available" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="font-semibold text-xl">Tweet Activity</h2>

      <div ref={gridRef} className="relative w-full">
        {/* Month labels row — positioned above the grid, aligned to columns */}
        <div className="relative mb-1 h-4" style={{ marginLeft: 36 }}>
          {monthLabels.map((m) => (
            <span
              key={`${m.label}-${m.col}`}
              className="absolute text-muted-foreground text-xs"
              style={{ left: `${(m.col / numWeeks) * 100}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Heatmap grid area */}
        <div className="flex gap-[2px]">
          {/* Day labels — same 7-row grid so heights align */}
          <div
            className="grid shrink-0"
            style={{
              gridTemplateRows: "repeat(7, 1fr)",
              width: 34,
              gap: 2,
            }}
          >
            {DAY_LABELS.map((label) => (
              <span
                key={label}
                className="flex items-center text-muted-foreground text-xs leading-none"
              >
                {label}
              </span>
            ))}
          </div>

          {/* Cell grid — column-major, 7 rows, auto columns fill width */}
          <div
            className="grid flex-1"
            style={{
              gridTemplateRows: "repeat(7, 1fr)",
              gridAutoFlow: "column",
              gridAutoColumns: "1fr",
              gap: 2,
            }}
          >
            {cells.map((cell, i) => {
              if (!cell) {
                return <div key={i} />;
              }

              const level = getLevel(cell.count, maxCount);

              return (
                <div
                  key={i}
                  className={cn(
                    "aspect-square transition-opacity",
                    cell.count > 0 && "cursor-pointer hover:opacity-80",
                  )}
                  style={{
                    background: level === 0 ? COLORS.empty : COLORS.levels[level - 1],
                  }}
                  onMouseEnter={(e) => handleCellHover(e, cell)}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => handleCellClick(cell.date, cell.count)}
                />
              );
            })}
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full border bg-popover px-2.5 py-1.5 text-popover-foreground text-xs shadow-md"
            style={{ left: tooltip.x, top: tooltip.y - 6 }}
          >
            <p className="font-medium">
              {tooltip.count} tweet{tooltip.count !== 1 ? "s" : ""}
            </p>
            <p className="text-muted-foreground">
              {new Date(`${tooltip.date}T00:00:00Z`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-muted-foreground text-sm">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="h-3 w-3" style={{ background: COLORS.empty }} />
          {COLORS.levels.map((color) => (
            <div key={color} className="h-3 w-3" style={{ background: color }} />
          ))}
        </div>
        <span>More</span>
      </div>

      <TweetSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        date={sheetDate}
        count={sheetCount}
      />
    </div>
  );
}
