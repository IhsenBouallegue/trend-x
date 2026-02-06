"use client";

import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScheduleList, useUpdateSchedule } from "@/hooks/queries";

/**
 * Preset cron frequencies with human-readable labels
 */
const CRON_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 2 hours", value: "0 */2 * * *" },
  { label: "Every 4 hours", value: "0 */4 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Every 24 hours", value: "0 0 * * *" },
  { label: "Custom", value: "custom" },
] as const;

/**
 * Get human-readable label for cron expression
 */
function getCronLabel(cronExpression: string): string {
  const preset = CRON_PRESETS.find((p) => p.value === cronExpression);
  return preset?.label || "Custom";
}

/**
 * Format relative time from Unix timestamp
 */
function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return "Never";
  try {
    return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
  } catch {
    return "Never";
  }
}

/**
 * Format duration in seconds to human-readable
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function ScheduleSection() {
  const { data: schedules, isLoading } = useScheduleList();
  const [customCronInputs, setCustomCronInputs] = useState<Record<string, string>>({});

  const updateMutation = useUpdateSchedule({
    onSuccess: () => {
      toast.success("Schedule updated");
    },
    onError: (error) => {
      toast.error(`Failed to update schedule: ${error.message}`);
    },
  });

  const handleToggle = (scheduleId: string, currentEnabled: boolean) => {
    updateMutation.mutate({
      id: scheduleId,
      enabled: !currentEnabled,
    });
  };

  const handleFrequencyChange = (scheduleId: string, value: string | null) => {
    if (!value || value === "custom") {
      // Show custom input - don't update yet
      return;
    }

    updateMutation.mutate({
      id: scheduleId,
      cronExpression: value,
    });
  };

  const handleCustomCronChange = (scheduleId: string, value: string) => {
    setCustomCronInputs((prev) => ({ ...prev, [scheduleId]: value }));
  };

  const handleCustomCronSubmit = (scheduleId: string) => {
    const customCron = customCronInputs[scheduleId];
    if (!customCron) return;

    updateMutation.mutate({
      id: scheduleId,
      cronExpression: customCron,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted" />
            <div className="h-20 bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!schedules || schedules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Jobs</CardTitle>
          <CardDescription>No scheduled jobs configured</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Jobs</CardTitle>
        <CardDescription>
          Manage recurring jobs like tweet fetching and profile analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedules.map((schedule) => {
          const isCustom = !CRON_PRESETS.some((p) => p.value === schedule.cronExpression);
          const currentPreset = isCustom ? "custom" : schedule.cronExpression;
          const showCustomInput = customCronInputs[schedule.id] !== undefined || isCustom;

          return (
            <div
              key={schedule.id}
              className="flex items-start gap-4 rounded-none border border-border p-4"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={schedule.enabled}
                  onCheckedChange={() => handleToggle(schedule.id, schedule.enabled)}
                  aria-label={`Toggle ${schedule.label || schedule.jobType}`}
                />
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">{schedule.label || schedule.jobType}</h4>
                    <p className="text-muted-foreground text-xs">
                      Type: <code className="text-xs">{schedule.jobType}</code>
                    </p>
                  </div>

                  <Select
                    value={currentPreset}
                    onValueChange={(value) => handleFrequencyChange(schedule.id, value)}
                    disabled={!schedule.enabled}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue>{getCronLabel(schedule.cronExpression)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CRON_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
                  {schedule.lastRunAt && (
                    <span>Last run: {formatRelativeTime(schedule.lastRunAt)}</span>
                  )}
                  {schedule.stats && schedule.stats.totalRuns > 0 && (
                    <>
                      <span>
                        Runs: {schedule.stats.totalRuns}
                        {schedule.stats.failedCount > 0 && (
                          <span className="text-destructive">
                            {" "}
                            ({schedule.stats.failedCount} failed)
                          </span>
                        )}
                      </span>
                      <span>Avg: {formatDuration(schedule.stats.avgDurationSec)}</span>
                    </>
                  )}
                </div>

                {showCustomInput && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customCronInputs[schedule.id] || schedule.cronExpression}
                      onChange={(e) => handleCustomCronChange(schedule.id, e.target.value)}
                      placeholder="0 */6 * * *"
                      className="flex h-7 rounded-none border border-input bg-transparent px-2.5 py-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                      disabled={!schedule.enabled}
                    />
                    <button
                      onClick={() => handleCustomCronSubmit(schedule.id)}
                      disabled={!schedule.enabled || updateMutation.isPending}
                      className="rounded-none border border-input bg-background px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
