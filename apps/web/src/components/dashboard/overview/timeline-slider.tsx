"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimelineSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  visibleCount?: number;
}

const DAY = 86400;
const PLAY_INTERVAL_MS = 100;
const DAYS_PER_TICK = 1;

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TimelineSlider({
  min,
  max,
  value,
  onChange,
  visibleCount,
}: TimelineSliderProps) {
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const valueRef = useRef(value);
  valueRef.current = value;
  const maxRef = useRef(max);
  maxRef.current = max;

  const stop = useCallback(() => {
    setPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    // If at the end, restart from beginning
    if (valueRef.current >= maxRef.current) onChange(min);

    setPlaying(true);
    intervalRef.current = setInterval(() => {
      const next = valueRef.current + DAYS_PER_TICK * DAY;
      if (next >= maxRef.current) {
        onChange(maxRef.current);
        stop();
      } else {
        onChange(next);
      }
    }, PLAY_INTERVAL_MS);
  }, [min, onChange, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={playing ? stop : play}
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <span className="text-muted-foreground text-xs shrink-0 w-[85px]">
        {formatDate(min)}
      </span>

      <input
        type="range"
        min={min}
        max={max}
        step={DAY}
        value={value}
        onChange={(e) => {
          if (playing) stop();
          onChange(Number(e.target.value));
        }}
        className="flex-1 h-1.5 accent-primary cursor-pointer"
      />

      <span className="text-muted-foreground text-xs shrink-0 w-[85px] text-right">
        {formatDate(max)}
      </span>

      <span className="text-xs font-medium shrink-0 min-w-[80px] text-right">
        {formatDate(value)}
        {visibleCount !== undefined && (
          <span className="text-muted-foreground ml-1">
            ({visibleCount})
          </span>
        )}
      </span>
    </div>
  );
}
