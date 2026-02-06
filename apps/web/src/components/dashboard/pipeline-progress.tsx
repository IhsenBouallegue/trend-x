"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useJobPolling } from "@/hooks/use-job-polling";
import { useTelegramStatus } from "@/hooks/queries";
import { queryKeys } from "@/hooks/queries/query-keys";
import { PipelineStepper } from "./pipeline-stepper";
import type { PipelineState, PipelineStage, StepRecord } from "./pipeline-stepper";

export function PipelineProgress() {
  const { job, jobId } = useJobPolling();
  const { data: telegramStatus } = useTelegramStatus();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasInvalidatedRef = useRef<string | null>(null);

  // Invalidate related queries when job completes
  useEffect(() => {
    if (job?.status === "completed" && jobId && hasInvalidatedRef.current !== jobId) {
      hasInvalidatedRef.current = jobId;
      queryClient.invalidateQueries({ queryKey: queryKeys.tweet.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.overview.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notification.all });
    }
  }, [job?.status, jobId, queryClient]);

  // Auto-clear jobId from URL after terminal state + delay
  useEffect(() => {
    if (job?.status === "completed") {
      const timer = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("jobId");
        const newSearch = params.toString();
        router.replace(newSearch ? `?${newSearch}` : "/");
      }, 63000); // 60s visible + 3s buffer
      return () => clearTimeout(timer);
    }
  }, [job?.status, router, searchParams]);

  if (!jobId || !job) return null;

  // Transform job data to match PipelineStepper props
  const pipelineState = mapJobToPipelineState(job);
  const allSteps = mapJobStepsToStepRecords(job.steps);

  // Hide "notifying" step when Telegram notifications aren't enabled
  const steps = telegramStatus?.enabled
    ? allSteps
    : allSteps.filter((s) => s.stage !== "notifying");

  return <PipelineStepper steps={steps} pipelineState={pipelineState} />;
}

/**
 * Map job data from DB to PipelineState format
 */
function mapJobToPipelineState(job: {
  status: string;
  currentStage: string | null;
  errorStep: string | null;
  errorMessage: string | null;
  resultSummary: string | null;
}): PipelineState {
  if (job.status === "running") {
    return {
      status: "running",
      stage: (job.currentStage || "fetching") as PipelineStage,
      message: "Running...",
    };
  }

  if (job.status === "completed") {
    let summary: Record<string, unknown> = {};
    if (job.resultSummary) {
      try {
        summary = JSON.parse(job.resultSummary);
      } catch {
        // Ignore parse errors
      }
    }
    return { status: "completed", summary };
  }

  if (job.status === "failed") {
    return {
      status: "failed",
      stage: (job.errorStep || job.currentStage || "fetching") as PipelineStage,
      error: job.errorMessage || "Unknown error",
    };
  }

  if (job.status === "queued") {
    return {
      status: "running",
      stage: "fetching",
      message: "Queued...",
    };
  }

  if (job.status === "cancelled") {
    return {
      status: "failed",
      stage: (job.currentStage || "fetching") as PipelineStage,
      error: "Cancelled by user",
    };
  }

  // Default to idle
  return { status: "idle" };
}

/**
 * Map job steps from DB to StepRecord format
 */
function mapJobStepsToStepRecords(
  steps: Array<{
    stepName: string;
    status: string;
    startedAt: number | null;
    completedAt: number | null;
    resultSummary: string | null;
    errorMessage: string | null;
  }>
): StepRecord[] {
  return steps.map((step) => {
    let summary: Record<string, unknown> | undefined;
    if (step.resultSummary) {
      try {
        summary = JSON.parse(step.resultSummary);
      } catch {
        // Ignore parse errors
      }
    }

    return {
      stage: step.stepName as PipelineStage,
      status: step.status as StepRecord["status"],
      startedAt: step.startedAt ?? undefined,
      completedAt: step.completedAt ?? undefined,
      summary,
      error: step.errorMessage ?? undefined,
    };
  });
}
