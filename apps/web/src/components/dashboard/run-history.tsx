"use client";

import { Check, X, MinusCircle, Circle, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useRunHistory } from "@/hooks/queries";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

interface RunHistoryProps {
  accountId: string;
}

export function RunHistory({ accountId }: RunHistoryProps) {
  const { data: runs, isLoading } = useRunHistory(accountId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center border p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <EmptyState message="No pipeline runs yet" />
    );
  }

  return (
    <Accordion className="space-y-2">
      {runs.map((run) => {
        const duration = run.completedAt
          ? run.completedAt - run.startedAt
          : null;
        const relativeTime = getRelativeTime(run.startedAt);

        return (
          <AccordionItem key={run.id} value={run.id} className="border">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50">
              <div className="flex w-full items-center gap-3">
                {/* Pipeline type badge */}
                <span
                  className={`px-2 py-0.5 font-mono text-xs ${
                    run.pipelineType === "profile_update"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                      : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200"
                  }`}
                >
                  {run.pipelineType === "profile_update" ? "Profile Update" : "Ingest"}
                </span>

                {/* Status badge */}
                <span
                  className={`px-2 py-0.5 font-mono text-xs ${
                    run.status === "completed"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                      : run.status === "failed"
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
                  }`}
                >
                  {run.status}
                </span>

                {/* Timestamp and duration */}
                <span className="ml-auto text-muted-foreground text-xs">
                  {relativeTime}
                  {duration !== null && ` • ${formatDuration(duration)}`}
                </span>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-4 pb-4">
              {/* Step breakdown */}
              <div className="space-y-2">
                {run.steps.map((step) => {
                  const stepDuration =
                    step.completedAt && step.startedAt
                      ? step.completedAt - step.startedAt
                      : null;

                  // Parse result summary if available
                  let resultData: Record<string, unknown> | null = null;
                  if (step.resultSummary) {
                    try {
                      resultData = JSON.parse(step.resultSummary);
                    } catch {
                      // Ignore parse errors
                    }
                  }

                  return (
                    <div
                      key={step.id}
                      className="flex items-start gap-2 border p-2"
                    >
                      {/* Status icon */}
                      <div className="mt-0.5 shrink-0">
                        {step.status === "completed" && (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                        {step.status === "failed" && (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                        {step.status === "skipped" && (
                          <MinusCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        {step.status === "pending" && (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        {step.status === "running" && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        )}
                      </div>

                      {/* Step details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs">
                            {formatStepName(step.stepName)}
                          </span>
                          <span
                            className={`text-xs ${
                              step.status === "completed"
                                ? "text-green-600"
                                : step.status === "failed"
                                  ? "text-red-600"
                                  : step.status === "skipped"
                                    ? "text-muted-foreground"
                                    : "text-muted-foreground"
                            }`}
                          >
                            {step.status}
                          </span>
                          {stepDuration !== null && (
                            <span className="text-muted-foreground text-xs">
                              • {formatDuration(stepDuration)}
                            </span>
                          )}
                        </div>

                        {/* Result summary */}
                        {resultData && (
                          <div className="mt-1 space-y-0.5">
                            {Object.entries(resultData).map(([key, value]) => (
                              <div key={key} className="text-muted-foreground text-xs">
                                <span className="font-medium">{key}:</span>{" "}
                                {String(value)}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Error message */}
                        {step.errorMessage && (
                          <div className="mt-1 bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200">
                            {step.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Overall error message (if run failed) */}
              {run.status === "failed" && run.errorMessage && (
                <div className="mt-3 border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/50">
                  <p className="font-medium text-red-800 text-xs dark:text-red-200">
                    Pipeline failed at: {run.errorStep}
                  </p>
                  <p className="mt-1 text-red-700 text-xs dark:text-red-300">
                    {run.errorMessage}
                  </p>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

/**
 * Format Unix timestamp (seconds) to relative time
 */
function getRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  // Fallback to date
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

/**
 * Format duration in seconds to human-readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format step name from machine state names to display names
 */
function formatStepName(stepName: string): string {
  const nameMap: Record<string, string> = {
    fetching: "Fetch Tweets",
    embedding: "Generate Embeddings",
    clustering: "Cluster Topics",
    labeling: "Label Topics",
    detecting: "Detect Changes",
    notifying: "Send Notifications",
  };

  return nameMap[stepName] || stepName;
}
