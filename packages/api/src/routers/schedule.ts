import { avg, count, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@trend-x/db";
import { pipelineRun, scheduledJob } from "@trend-x/db/schema";

import { publicProcedure, router } from "../index";
import { refreshScheduler } from "../services/scheduler";

/**
 * Schedule router - manage cron job schedules
 */
export const scheduleRouter = router({
  /**
   * List all scheduled jobs with run statistics
   */
  list: publicProcedure.query(async () => {
    const schedules = await db
      .select()
      .from(scheduledJob)
      .orderBy(scheduledJob.createdAt);

    // Get run stats per pipeline type
    const stats = await db
      .select({
        pipelineType: pipelineRun.pipelineType,
        totalRuns: count(),
        successCount: count(
          sql`CASE WHEN ${pipelineRun.status} = 'completed' THEN 1 END`,
        ),
        failedCount: count(
          sql`CASE WHEN ${pipelineRun.status} = 'failed' THEN 1 END`,
        ),
        avgDurationSec: avg(
          sql`CASE WHEN ${pipelineRun.completedAt} IS NOT NULL
              THEN ${pipelineRun.completedAt} - ${pipelineRun.startedAt}
              END`,
        ),
      })
      .from(pipelineRun)
      .groupBy(pipelineRun.pipelineType);

    // Map stats by pipeline type
    const statsMap = new Map(stats.map((s) => [s.pipelineType, s]));

    // Merge stats into schedules
    return schedules.map((schedule) => {
      const jobStats = statsMap.get(schedule.jobType);
      return {
        ...schedule,
        stats: jobStats
          ? {
              totalRuns: Number(jobStats.totalRuns),
              successCount: Number(jobStats.successCount),
              failedCount: Number(jobStats.failedCount),
              avgDurationSec: jobStats.avgDurationSec
                ? Math.round(Number(jobStats.avgDurationSec))
                : null,
            }
          : null,
      };
    });
  }),

  /**
   * Update a scheduled job (cron expression and/or enabled state)
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        cronExpression: z.string().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, cronExpression, enabled } = input;

      // Build update object
      const updateData: Record<string, unknown> = {};

      if (cronExpression !== undefined) {
        // Validate cron expression - basic check for 5 fields
        const cronParts = cronExpression.trim().split(/\s+/);
        if (cronParts.length !== 5) {
          throw new Error(
            "Invalid cron expression. Expected 5 fields (minute hour day month weekday)",
          );
        }
        updateData.cronExpression = cronExpression;
      }

      if (enabled !== undefined) {
        updateData.enabled = enabled;
      }

      // Update the scheduled job
      await db.update(scheduledJob).set(updateData).where(eq(scheduledJob.id, id));

      // Refresh the scheduler to pick up new config
      await refreshScheduler();

      // Return updated record
      const [updated] = await db.select().from(scheduledJob).where(eq(scheduledJob.id, id));

      return updated;
    }),
});
