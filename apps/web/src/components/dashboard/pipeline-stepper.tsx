/**
 * Segmented pipeline progress bar showing real-time stage progress.
 * Auto-collapses after 5 seconds on completion, stays visible on failure.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, SkipForward, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Pipeline stages
export type PipelineStage =
  | "fetching"
  | "embedding"
  | "clustering"
  | "labeling"
  | "detecting"
  | "notifying";

// Discriminated union for type-safe state
export type PipelineState =
  | { status: "idle" }
  | { status: "running"; stage: PipelineStage; message: string }
  | { status: "completed"; summary: Record<string, unknown> }
  | { status: "failed"; stage: PipelineStage; error: string };

// Step record for tracking all stages
export interface StepRecord {
  stage: PipelineStage;
  status: "pending" | "running" | "completed" | "skipped" | "failed";
  startedAt?: number;
  completedAt?: number;
  summary?: Record<string, unknown>;
  error?: string;
  progressDetail?: string;
}

interface PipelineStepperProps {
  steps: StepRecord[];
  pipelineState: PipelineState | null;
  jobType?: string;
  isStale?: boolean;
  onForceKill?: () => void;
  onDismissed?: () => void;
  onCollapse?: () => void;
}

// Display names for stages
const stageLabels: Record<string, string> = {
  fetching: "Fetch",
  embedding: "Embed",
  clustering: "Cluster",
  labeling: "Label",
  detecting: "Detect",
  notifying: "Notify",
  // Social snapshot stages
  processing: "Process",
  completing: "Complete",
  fetch_followers: "Followers",
  fetch_following: "Following",
  diff_connections: "Diff",
  store_snapshot: "Store",
};

// Human-readable job type labels
const jobTypeLabels: Record<string, string> = {
  profile_update: "Profile Update",
  social_snapshot: "Social Snapshot",
  ingest: "Ingest",
};

const DISMISS_DURATION_MS = 60_000;

function ElapsedTime({ startedAt }: { startedAt?: number }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const seconds = Math.floor(Date.now() / 1000) - startedAt;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setElapsed(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  if (!startedAt || !elapsed) return null;
  return <span className="text-[10px] text-muted-foreground ml-1">({elapsed})</span>;
}

export function PipelineStepper({ steps, pipelineState, jobType, isStale, onForceKill, onDismissed, onCollapse }: PipelineStepperProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [dismissProgress, setDismissProgress] = useState(100);
  const dismissStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Start dismiss countdown on completion
  useEffect(() => {
    if (pipelineState?.status === "completed") {
      setDismissing(true);
      setDismissProgress(100);
      dismissStartRef.current = Date.now();

      const tick = () => {
        if (!dismissStartRef.current) return;
        const elapsed = Date.now() - dismissStartRef.current;
        const remaining = Math.max(0, 100 - (elapsed / DISMISS_DURATION_MS) * 100);
        setDismissProgress(remaining);
        if (remaining > 0) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          onDismissed ? onDismissed() : setIsCollapsed(true);
        }
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    // If pipeline is running again, reset states
    if (pipelineState?.status === "running") {
      setIsCollapsed(false);
      setDismissing(false);
      setDismissProgress(100);
      dismissStartRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    // Failed pipelines should NOT auto-collapse
    if (pipelineState?.status === "failed") {
      setIsCollapsed(false);
      setDismissing(false);
    }
  }, [pipelineState?.status]);

  if (!pipelineState || pipelineState.status === "idle") {
    return null;
  }

  const statusLabel =
    pipelineState.status === "running"
      ? "PIPELINE RUNNING"
      : pipelineState.status === "completed"
        ? "PIPELINE COMPLETE"
        : pipelineState.status === "failed"
          ? "PIPELINE FAILED"
          : "PIPELINE";

  // Collapsed state: single line with summary
  if (isCollapsed) {
    return (
      <div className="relative overflow-hidden border bg-card p-4 ring-1 ring-foreground/10">
        {dismissing && dismissProgress > 0 && (
          <div
            className="absolute top-0 left-0 h-0.5 bg-primary transition-none"
            style={{ width: `${dismissProgress}%` }}
          />
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-foreground" />
            <span className="text-sm text-foreground">
              {getDescriptionText(pipelineState, steps)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(false)}
            className="h-6 px-2 text-xs"
          >
            <ChevronDown className="mr-1 h-3 w-3" />
            Expand
          </Button>
        </div>
      </div>
    );
  }

  // Full segmented progress bar
  return (
    <div className="relative overflow-hidden border bg-card p-4 ring-1 ring-foreground/10">
      {dismissing && dismissProgress > 0 && (
        <div
          className="absolute top-0 left-0 h-0.5 bg-primary transition-none"
          style={{ width: `${dismissProgress}%` }}
        />
      )}
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <div
            className={cn(
              "h-2 w-2",
              pipelineState.status === "running" && "animate-pulse bg-primary",
              pipelineState.status === "completed" && "bg-foreground",
              pipelineState.status === "failed" && "bg-destructive",
            )}
          />
          <span className="text-xs font-medium uppercase tracking-wide text-foreground">
            {statusLabel}
          </span>
          {jobType && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5">
              {jobTypeLabels[jobType] || jobType}
            </span>
          )}
        </div>
        {(pipelineState.status === "completed" || pipelineState.status === "failed") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(true)}
            className="h-6 px-2 text-xs"
          >
            <ChevronUp className="mr-1 h-3 w-3" />
            Collapse
          </Button>
        )}
      </div>

      {/* Segmented progress bar */}
      <div className="mt-3 flex gap-px">
        {steps.map((step) => (
          <div key={step.stage} className="flex-1">
            <div
              className={cn(
                "h-2 transition-colors duration-500",
                step.status === "pending" && "bg-muted",
                step.status === "running" && "animate-pulse bg-primary",
                step.status === "completed" && "bg-foreground",
                step.status === "failed" && "bg-destructive",
                step.status === "skipped" && "bg-muted opacity-50",
              )}
            />
          </div>
        ))}
      </div>

      {/* Labels + details below segments */}
      <div className="mt-1 flex gap-px">
        {steps.map((step) => (
          <div key={step.stage} className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {step.status === "skipped" && (
                <SkipForward className="size-2.5 text-muted-foreground/50 shrink-0" />
              )}
              <span
                className={cn(
                  "text-[10px] truncate",
                  step.status === "pending" && "text-muted-foreground",
                  step.status === "running" && "text-primary",
                  step.status === "completed" && "text-foreground",
                  step.status === "failed" && "text-destructive",
                  step.status === "skipped" && "text-muted-foreground/50 line-through",
                )}
              >
                {stageLabels[step.stage] || step.stage}
              </span>
              {step.status === "running" && (
                <ElapsedTime startedAt={step.startedAt} />
              )}
            </div>
            {step.status === "running" && step.progressDetail && (
              <p className="text-[10px] text-primary/70 truncate">
                {step.progressDetail}
              </p>
            )}
            {step.status === "completed" && step.summary && (
              <p className="text-[10px] text-muted-foreground truncate">
                {formatStepSummary(step.stage, step.summary)}
              </p>
            )}
            {step.status === "skipped" && (
              <p className="text-[10px] text-muted-foreground/40 truncate">
                skipped
              </p>
            )}
            {step.status === "failed" && step.error && (
              <p className="text-[10px] text-destructive/70 truncate">
                {step.error}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Running message */}
      {pipelineState.status === "running" && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
            {pipelineState.message}
          </p>
        </div>
      )}
      {pipelineState.status === "failed" && (
        <div className="mt-3">
          <p className="text-xs text-destructive">
            {getDescriptionText(pipelineState, steps)}
          </p>
        </div>
      )}

      {/* Stale warning with force-kill button */}
      {isStale && pipelineState.status === "running" && (
        <div className="mt-2 flex items-center justify-between bg-destructive/10 border border-destructive/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs text-destructive">Pipeline appears stuck (no heartbeat for 5+ minutes)</span>
          </div>
          {onForceKill && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onForceKill}
              className="h-6 px-2 text-xs"
            >
              <XCircle className="mr-1 h-3 w-3" />
              Force Kill
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Get descriptive text based on pipeline state
 */
function getDescriptionText(state: PipelineState, steps: StepRecord[]): string {
  if (state.status === "running") {
    return state.message;
  }

  if (state.status === "completed") {
    const parts: string[] = ["Analysis complete"];

    // Build summary from individual step summaries
    const tweetCount = findSummaryValue(steps, "tweetCount");
    const topicCount = findSummaryValue(steps, "topicCount");
    const changeCount = findSummaryValue(steps, "changeCount");

    if (tweetCount) parts.push(`${tweetCount} tweets`);
    if (topicCount) parts.push(`${topicCount} topics`);
    if (changeCount !== undefined && changeCount !== null) {
      parts.push(`${changeCount} ${changeCount === 1 ? "change" : "changes"} detected`);
    }

    return parts.join(" \u2022 ");
  }

  if (state.status === "failed") {
    return `Failed at ${stageLabels[state.stage] || state.stage}: ${state.error}`;
  }

  return "";
}

/**
 * Find a value in step summaries
 */
function findSummaryValue(steps: StepRecord[], key: string): unknown {
  for (const step of steps) {
    if (step.summary && key in step.summary) {
      return step.summary[key];
    }
  }
  return undefined;
}

/**
 * Format a step's summary into a human-readable detail string
 */
function formatStepSummary(stage: string, summary: Record<string, unknown>): string {
  switch (stage) {
    case "fetching": {
      const count = summary.tweetCount as number;
      return `${count} tweet${count === 1 ? "" : "s"}`;
    }
    case "embedding": {
      const count = summary.embeddingCount as number;
      return `${count} embedded`;
    }
    case "classifying": {
      const parts: string[] = [];
      if (summary.matched) parts.push(`${summary.matched} matched`);
      if (summary.drifted) parts.push(`${summary.drifted} drifted`);
      if (summary.newTopics) parts.push(`${summary.newTopics} new`);
      return parts.join(", ") || "done";
    }
    case "updating": {
      const parts: string[] = [];
      if (summary.tweetsPerDay != null) parts.push(`${Number(summary.tweetsPerDay).toFixed(1)}/day`);
      if (summary.personalityEvaluated) parts.push("personality updated");
      return parts.join(", ") || "done";
    }
    case "detecting": {
      if (summary.isBaseline) return "baseline set";
      const count = summary.changesDetected as number;
      return count > 0
        ? `${count} change${count === 1 ? "" : "s"}`
        : "no changes";
    }
    case "notifying": {
      const count = summary.notificationCount as number;
      return `${count} sent`;
    }
    case "fetch_followers": {
      const count = summary.count as number;
      return count != null ? `${count} followers` : "done";
    }
    case "fetch_following": {
      const count = summary.count as number;
      return count != null ? `${count} following` : "done";
    }
    case "diff_connections": {
      const parts: string[] = [];
      if (summary.added) parts.push(`+${summary.added}`);
      if (summary.removed) parts.push(`-${summary.removed}`);
      return parts.length > 0 ? parts.join(", ") : "no changes";
    }
    case "store_snapshot":
      return "saved";
    default:
      return "done";
  }
}
