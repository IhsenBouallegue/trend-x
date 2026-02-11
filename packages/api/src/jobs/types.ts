/**
 * Job framework types for type-safe job definitions and execution context.
 */

import type { z } from "zod";

/**
 * Job status union - matches pipeline_run.status column
 */
export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

/**
 * Step status union - matches pipeline_step.status column
 */
export type StepStatus = "pending" | "running" | "completed" | "skipped" | "failed";

/**
 * Job definition interface with type-safe generics.
 *
 * @template TInput - Validated input type for the job
 * @template TStage - String literal union of stage names
 */
export interface JobDefinition<TInput, TStage extends string> {
  /** Job type identifier (e.g., "profile_update", "ingest") */
  type: string;

  /** Ordered array of stage names for this job type */
  stages: readonly TStage[];

  /** The actual work - implements the job logic */
  executor: (input: TInput, context: JobContext<TStage>) => Promise<void>;

  /** Zod schema for runtime input validation */
  inputSchema: z.ZodSchema<TInput>;

  /** Maximum concurrent jobs of this type (default 1) */
  maxConcurrent: number;
}

/**
 * Job execution context - provides DB-writing methods to job executors.
 * All methods write directly to the database for single-source-of-truth state management.
 *
 * @template TStage - String literal union of stage names
 */
export interface JobContext<TStage extends string> {
  /** The pipeline_run.id for this job */
  jobId: string;

  /** Account ID from job input */
  accountId: string;

  /**
   * Mark a stage as running in DB.
   * Updates pipeline_step status to "running" and sets startedAt.
   * Updates pipeline_run.currentStage for fast polling.
   */
  setStage: (stage: TStage, message: string) => Promise<void>;

  /**
   * Mark a stage as completed in DB.
   * Updates pipeline_step status to "completed", sets completedAt and durationMs.
   * Optionally stores summary data.
   */
  completeStage: (stage: TStage, summary?: Record<string, unknown>) => Promise<void>;

  /**
   * Mark a stage as skipped in DB.
   * Used when a stage is not applicable (e.g., detection on baseline fingerprint).
   */
  skipStage: (stage: TStage, reason: string) => Promise<void>;

  /**
   * Mark a stage as failed in DB.
   * Used for non-blocking stage failures (e.g., notification failure shouldn't fail the job).
   */
  failStage: (stage: TStage, error: string) => Promise<void>;

  /**
   * Update live progress detail text for a running stage.
   * Writes progressDetail to pipeline_step and lastHeartbeatAt to pipeline_run.
   */
  updateProgress: (stage: TStage, detail: string) => Promise<void>;

  /**
   * Check if job was cancelled via pipeline_run.cancelledAt column.
   * If cancelled, updates job status to "cancelled" and returns true.
   * Call this between stages for cooperative cancellation.
   */
  checkCancellation: () => Promise<boolean>;
}
