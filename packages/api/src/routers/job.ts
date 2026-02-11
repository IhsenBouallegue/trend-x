/**
 * tRPC router for job operations.
 * Provides endpoints for triggering jobs, polling job status, cancellation, and history.
 */

import { eq, desc, and, or } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../index";
import { db } from "@trend-x/db";
import { pipelineRun, pipelineStep } from "@trend-x/db/schema";
import { createJobRecord, executeJob } from "../jobs/executor";

// Import job definitions for side-effect registration
import "../jobs/index";

export const jobRouter = router({
  /**
   * Trigger a new job (fire-and-forget).
   * Creates job record and starts execution in background.
   * Returns jobId for polling via getDetails.
   */
  trigger: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        jobType: z.enum(["profile_update", "ingest", "social_snapshot"]),
      }),
    )
    .mutation(async ({ input }) => {
      // Create job record (validates input and checks concurrency)
      const jobId = await createJobRecord(input.jobType, input.accountId, {
        accountId: input.accountId,
      });

      // Fire-and-forget execution - do NOT await
      void executeJob(jobId);

      return { jobId };
    }),

  /**
   * Get job details with all steps (main polling endpoint).
   * Returns null if job not found.
   */
  getDetails: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const [run] = await db
        .select()
        .from(pipelineRun)
        .where(eq(pipelineRun.id, input.jobId));

      if (!run) {
        return null;
      }

      const steps = await db
        .select()
        .from(pipelineStep)
        .where(eq(pipelineStep.runId, input.jobId))
        .orderBy(pipelineStep.stepOrder);

      const STALE_THRESHOLD_SEC = 300;
      const nowSec = Math.floor(Date.now() / 1000);

      return {
        ...run,
        steps,
        isStale:
          run.status === "running" && run.lastHeartbeatAt != null
            ? nowSec - run.lastHeartbeatAt > STALE_THRESHOLD_SEC
            : false,
      };
    }),

  /**
   * Force-kill a running job immediately (marks as failed, not cooperative).
   * The executor may continue running until it next calls checkCancellation,
   * but the frontend will see "failed" immediately.
   */
  forceKill: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input }) => {
      const now = Math.floor(Date.now() / 1000);
      // Immediately mark as failed
      await db
        .update(pipelineRun)
        .set({
          status: "failed",
          errorMessage: "Force killed by user",
          completedAt: now,
        })
        .where(eq(pipelineRun.id, input.jobId));
      // Mark any running steps as failed
      await db
        .update(pipelineStep)
        .set({
          status: "failed",
          errorMessage: "Force killed by user",
          completedAt: now,
        })
        .where(and(eq(pipelineStep.runId, input.jobId), eq(pipelineStep.status, "running")));
      return { success: true };
    }),

  /**
   * Cancel a running job (cooperative cancellation via DB column).
   * Executor checks cancelledAt between stages and exits gracefully.
   */
  cancel: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .update(pipelineRun)
        .set({ cancelledAt: Math.floor(Date.now() / 1000) })
        .where(eq(pipelineRun.id, input.jobId));

      return { success: true };
    }),

  /**
   * Get job history for an account with steps.
   * Returns past runs ordered by most recent first.
   */
  getHistory: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        limit: z.number().optional().default(20),
      }),
    )
    .query(async ({ input }) => {
      const runs = await db
        .select()
        .from(pipelineRun)
        .where(eq(pipelineRun.accountId, input.accountId))
        .orderBy(desc(pipelineRun.startedAt))
        .limit(input.limit);

      // For each run, get its steps
      const runsWithSteps = await Promise.all(
        runs.map(async (run) => {
          const steps = await db
            .select()
            .from(pipelineStep)
            .where(eq(pipelineStep.runId, run.id))
            .orderBy(pipelineStep.stepOrder);

          return {
            ...run,
            steps,
          };
        }),
      );

      return runsWithSteps;
    }),

  /**
   * Get currently active run (queued or running) for an account.
   * Returns null if no active run.
   * NOTE: Checks both "queued" and "running" status (jobs start as queued).
   */
  getCurrentRun: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      const [run] = await db
        .select()
        .from(pipelineRun)
        .where(
          and(
            eq(pipelineRun.accountId, input.accountId),
            or(eq(pipelineRun.status, "running"), eq(pipelineRun.status, "queued")),
          ),
        )
        .orderBy(desc(pipelineRun.startedAt))
        .limit(1);

      if (!run) {
        return null;
      }

      const steps = await db
        .select()
        .from(pipelineStep)
        .where(eq(pipelineStep.runId, run.id))
        .orderBy(pipelineStep.stepOrder);

      return {
        ...run,
        steps,
      };
    }),

  /**
   * Get all active runs (queued or running) for an account.
   * Returns array of runs with their steps, ordered by startedAt desc.
   */
  getActiveRuns: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      const runs = await db
        .select()
        .from(pipelineRun)
        .where(
          and(
            eq(pipelineRun.accountId, input.accountId),
            or(eq(pipelineRun.status, "running"), eq(pipelineRun.status, "queued")),
          ),
        )
        .orderBy(desc(pipelineRun.startedAt));

      const STALE_THRESHOLD_SEC = 300; // 5 minutes
      const nowSec = Math.floor(Date.now() / 1000);

      const runsWithSteps = await Promise.all(
        runs.map(async (run) => {
          const steps = await db
            .select()
            .from(pipelineStep)
            .where(eq(pipelineStep.runId, run.id))
            .orderBy(pipelineStep.stepOrder);

          return {
            ...run,
            steps,
            isStale:
              run.status === "running" && run.lastHeartbeatAt != null
                ? nowSec - run.lastHeartbeatAt > STALE_THRESHOLD_SEC
                : false,
          };
        }),
      );

      return runsWithSteps;
    }),
});
