import { db } from "@trend-x/db";
import {
  detectedChange,
  notification,
} from "@trend-x/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";

export const notificationRouter = router({
  /**
   * Get all notifications for an account, sorted by recency.
   * Profile-based notifications have nullable changeId/detectionRunId.
   * Legacy fingerprint-based notifications are returned without change details.
   */
  getByAccount: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      // Fetch all notifications for the account
      const allNotifications = await db
        .select()
        .from(notification)
        .where(eq(notification.accountId, input.accountId))
        .orderBy(desc(notification.createdAt));

      // For notifications with a changeId, fetch the change details
      const result = [];
      for (const n of allNotifications) {
        let change = null;
        if (n.changeId) {
          const [c] = await db
            .select()
            .from(detectedChange)
            .where(eq(detectedChange.id, n.changeId));
          if (c) {
            change = {
              ...c,
              evidence: c.evidence ? JSON.parse(c.evidence) : { tweetIds: [] },
            };
          }
        }

        result.push({
          ...n,
          change,
        });
      }

      return result;
    }),

  /**
   * Get the count of unread notifications for an account.
   */
  getUnreadCount: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      const result = await db
        .select()
        .from(notification)
        .where(and(eq(notification.accountId, input.accountId), eq(notification.isRead, 0)));

      return result.length;
    }),

  /**
   * Mark a single notification as read.
   */
  markAsRead: publicProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .update(notification)
        .set({
          isRead: 1,
          readAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(notification.id, input.notificationId));

      return { success: true };
    }),

  /**
   * Mark all unread notifications as read for an account.
   */
  markAllAsRead: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .update(notification)
        .set({
          isRead: 1,
          readAt: Math.floor(Date.now() / 1000),
        })
        .where(and(eq(notification.accountId, input.accountId), eq(notification.isRead, 0)));

      return { success: true };
    }),
});
