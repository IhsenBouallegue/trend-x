/**
 * Job executor - core execution engine that picks jobs and runs them via registry.
 * Reads from DB, builds JobContext, runs job definition executor, writes results back to DB.
 */

import { db } from "@trend-x/db";
import { pipelineRun, pipelineStep } from "@trend-x/db/schema";
import { and, eq } from "drizzle-orm";
import { getJobDefinition } from "./registry";
import type { JobContext } from "./types";

/**
 * Execute a job by ID.
 * Core execution flow:
 * 1. Read pipeline_run row
 * 2. Look up job definition via registry
 * 3. Parse and validate input
 * 4. Mark job as running
 * 5. Build JobContext with DB-writing methods
 * 6. Call definition executor
 * 7. Mark job as completed/failed based on result
 *
 * @param jobId - The pipeline_run.id to execute
 */
export async function executeJob(jobId: string): Promise<void> {
  // 1. Read pipeline_run row
  const [run] = await db.select().from(pipelineRun).where(eq(pipelineRun.id, jobId));
  if (!run) {
    throw new Error(`Job ${jobId} not found`);
  }

  // 2. Look up definition via registry
  const definition = getJobDefinition(run.pipelineType);
  if (!definition) {
    throw new Error(`Unknown job type: ${run.pipelineType}`);
  }

  // 3. Parse input - backward compatibility with existing pipeline_run rows
  let input: unknown;
  if (run.input) {
    try {
      const parsed = JSON.parse(run.input);
      input = definition.inputSchema.parse(parsed);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await db
        .update(pipelineRun)
        .set({
          status: "failed",
          errorMessage: `Input validation failed: ${errorMsg}`,
          completedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(pipelineRun.id, jobId));
      throw error;
    }
  } else {
    // Backward compatibility: construct input from accountId for existing rows
    input = definition.inputSchema.parse({ accountId: run.accountId });
  }

  // 4. Update status to running
  await db
    .update(pipelineRun)
    .set({ status: "running" })
    .where(eq(pipelineRun.id, jobId));

  // 5. Build JobContext - all methods write to DB
  const context: JobContext<string> = {
    jobId,
    accountId: run.accountId,

    setStage: async (stage: string, message: string) => {
      const now = Math.floor(Date.now() / 1000);
      // Update pipeline_run.currentStage and heartbeat for fast polling
      await db
        .update(pipelineRun)
        .set({ currentStage: stage, lastHeartbeatAt: now })
        .where(eq(pipelineRun.id, jobId));
      // Update pipeline_step status to running
      await db
        .update(pipelineStep)
        .set({
          status: "running",
          startedAt: now,
        })
        .where(and(eq(pipelineStep.runId, jobId), eq(pipelineStep.stepName, stage)));
    },

    completeStage: async (stage: string, summary?: Record<string, unknown>) => {
      const now = Math.floor(Date.now() / 1000);
      // Read startedAt to compute duration
      const [step] = await db
        .select()
        .from(pipelineStep)
        .where(and(eq(pipelineStep.runId, jobId), eq(pipelineStep.stepName, stage)));

      const durationMs = step?.startedAt ? (now - step.startedAt) * 1000 : null;

      await db
        .update(pipelineStep)
        .set({
          status: "completed",
          completedAt: now,
          durationMs,
          resultSummary: summary ? JSON.stringify(summary) : null,
          progressDetail: null, // Clear progress detail on completion
        })
        .where(and(eq(pipelineStep.runId, jobId), eq(pipelineStep.stepName, stage)));

      // Update heartbeat
      await db
        .update(pipelineRun)
        .set({ lastHeartbeatAt: now })
        .where(eq(pipelineRun.id, jobId));
    },

    skipStage: async (stage: string, reason: string) => {
      const now = Math.floor(Date.now() / 1000);
      await db
        .update(pipelineStep)
        .set({
          status: "skipped",
          completedAt: now,
          errorMessage: reason,
        })
        .where(and(eq(pipelineStep.runId, jobId), eq(pipelineStep.stepName, stage)));
    },

    failStage: async (stage: string, error: string) => {
      const now = Math.floor(Date.now() / 1000);
      await db
        .update(pipelineStep)
        .set({
          status: "failed",
          completedAt: now,
          errorMessage: error,
        })
        .where(and(eq(pipelineStep.runId, jobId), eq(pipelineStep.stepName, stage)));
    },

    updateProgress: async (stage: string, detail: string) => {
      const now = Math.floor(Date.now() / 1000);
      // Update progress detail on the step
      await db
        .update(pipelineStep)
        .set({ progressDetail: detail })
        .where(and(eq(pipelineStep.runId, jobId), eq(pipelineStep.stepName, stage)));
      // Update heartbeat on the run
      await db
        .update(pipelineRun)
        .set({ lastHeartbeatAt: now })
        .where(eq(pipelineRun.id, jobId));
    },

    checkCancellation: async () => {
      const [j] = await db.select().from(pipelineRun).where(eq(pipelineRun.id, jobId));
      if (j?.cancelledAt) {
        // Mark job as cancelled
        await db
          .update(pipelineRun)
          .set({
            status: "cancelled",
            completedAt: Math.floor(Date.now() / 1000),
          })
          .where(eq(pipelineRun.id, jobId));
        return true;
      }
      return false;
    },
  };

  // 6. Call definition executor in try/catch
  try {
    await definition.executor(input, context);

    // 7a. On success: mark as completed
    await db
      .update(pipelineRun)
      .set({
        status: "completed",
        completedAt: Math.floor(Date.now() / 1000),
        currentStage: null,
      })
      .where(eq(pipelineRun.id, jobId));
  } catch (error) {
    // 7b. On error: mark as failed
    const errorMsg = error instanceof Error ? error.message : String(error);
    const [currentRun] = await db.select().from(pipelineRun).where(eq(pipelineRun.id, jobId));
    await db
      .update(pipelineRun)
      .set({
        status: "failed",
        errorMessage: errorMsg,
        errorStep: currentRun?.currentStage || null,
        completedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(pipelineRun.id, jobId));
    throw error;
  }
}

/**
 * Create a new job record with validated input and check concurrency limits.
 *
 * @param type - Job type identifier (must be registered via defineJob)
 * @param accountId - Account ID for the job
 * @param input - Job input (will be validated against definition.inputSchema)
 * @returns The new job ID
 */
export async function createJobRecord(
  type: string,
  accountId: string,
  input: Record<string, unknown>
): Promise<string> {
  // 1. Get job definition
  const definition = getJobDefinition(type);
  if (!definition) {
    throw new Error(`Unknown job type: ${type}`);
  }

  // 2. Validate input against schema
  const validatedInput = definition.inputSchema.parse(input);

  // 3. Check per-type concurrency
  const runningCount = await db
    .select({ count: pipelineRun.id })
    .from(pipelineRun)
    .where(and(eq(pipelineRun.pipelineType, type), eq(pipelineRun.status, "running")));

  if (runningCount.length >= definition.maxConcurrent) {
    throw new Error(`Maximum concurrent ${type} jobs reached (${definition.maxConcurrent})`);
  }

  // 4. Insert pipeline_run row
  const jobId = crypto.randomUUID();
  await db.insert(pipelineRun).values({
    id: jobId,
    accountId,
    pipelineType: type,
    status: "queued",
    input: JSON.stringify(validatedInput),
  });

  // 5. Insert pipeline_step rows for each stage
  for (let i = 0; i < definition.stages.length; i++) {
    await db.insert(pipelineStep).values({
      runId: jobId,
      stepName: definition.stages[i] as string,
      stepOrder: i + 1,
      status: "pending",
    });
  }

  return jobId;
}
