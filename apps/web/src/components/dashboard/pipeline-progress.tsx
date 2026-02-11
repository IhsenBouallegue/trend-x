"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAccount } from "@/contexts/account-context";
import { useActiveJobs, useTelegramStatus } from "@/hooks/queries";
import { queryKeys } from "@/hooks/queries/query-keys";
import { trpc } from "@/utils/trpc";
import { PipelineStepper } from "./pipeline-stepper";
import type { PipelineState, PipelineStage, StepRecord } from "./pipeline-stepper";

export function PipelineProgress() {
  const { selectedAccountId } = useAccount();
  const { allVisibleJobs, dismissCompleted } = useActiveJobs(selectedAccountId);
  const { data: telegramStatus } = useTelegramStatus();
  const queryClient = useQueryClient();

  const forceKillMutation = useMutation(
    trpc.job.forceKill.mutationOptions({
      onSuccess: () => {
        toast.success("Job force killed");
        queryClient.invalidateQueries({ queryKey: queryKeys.job.all });
      },
      onError: (error: { message: string }) => {
        toast.error(error?.message || "Failed to force kill job");
      },
    }),
  );

  if (allVisibleJobs.length === 0) return null;

  return (
    <div className="space-y-2">
      {allVisibleJobs.map((job) => {
        const pipelineState = mapJobToPipelineState(job);
        const allSteps = mapJobStepsToStepRecords(job.steps);

        // Hide "notifying" step when Telegram notifications aren't enabled
        const steps = telegramStatus?.enabled
          ? allSteps
          : allSteps.filter((s) => s.stage !== "notifying");

        return (
          <PipelineStepper
            key={job.id}
            steps={steps}
            pipelineState={pipelineState}
            jobType={job.pipelineType}
            isStale={job.isStale ?? false}
            onForceKill={() => forceKillMutation.mutate({ jobId: job.id })}
            onDismissed={() => dismissCompleted(job.id)}
          />
        );
      })}
    </div>
  );
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
    progressDetail: string | null;
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
      progressDetail: step.progressDetail ?? undefined,
    };
  });
}
