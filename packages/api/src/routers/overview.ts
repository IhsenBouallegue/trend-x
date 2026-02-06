import { db } from "@trend-x/db";
import { account, notification } from "@trend-x/db/schema";
import { count, eq, gte, sql } from "drizzle-orm";

import { publicProcedure, router } from "../index";

export const overviewRouter = router({
  /**
   * Get aggregate metrics across all monitored accounts.
   * Returns total accounts, total notifications, and total unread.
   */
  getMetrics: publicProcedure.query(async () => {
    // Get total accounts
    const accountsResult = await db.select({ count: count() }).from(account);
    const totalAccounts = accountsResult[0]?.count ?? 0;

    // If no accounts, return all zeros
    if (totalAccounts === 0) {
      return {
        totalAccounts: 0,
        totalNotifications: 0,
        totalUnread: 0,
      };
    }

    // Get total notifications
    const notificationsResult = await db.select({ count: count() }).from(notification);
    const totalNotifications = notificationsResult[0]?.count ?? 0;

    // Get total unread
    const unreadResult = await db
      .select({ count: count() })
      .from(notification)
      .where(eq(notification.isRead, 0));
    const totalUnread = unreadResult[0]?.count ?? 0;

    return {
      totalAccounts,
      totalNotifications,
      totalUnread,
    };
  }),

  /**
   * Get the 20 most recent notifications across all accounts.
   * Returns notification details with account handle for cross-account activity feed.
   */
  getRecentActivity: publicProcedure.query(async () => {
    const results = await db
      .select({
        id: notification.id,
        title: notification.title,
        changeType: notification.changeType,
        createdAt: notification.createdAt,
        isRead: notification.isRead,
        accountHandle: account.handle,
      })
      .from(notification)
      .innerJoin(account, eq(notification.accountId, account.id))
      .orderBy(sql`${notification.createdAt} DESC`)
      .limit(20);

    return results;
  }),

  /**
   * Get daily notification counts for the last 30 days.
   * Returns continuous date series with zero-count days filled in for chart rendering.
   */
  getNotificationTrend: publicProcedure.query(async () => {
    // Calculate 30 days ago timestamp
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;

    // Get all notifications from last 30 days
    const results = await db
      .select({
        createdAt: notification.createdAt,
      })
      .from(notification)
      .where(gte(notification.createdAt, thirtyDaysAgo));

    // Group by date in JS (since SQLite date functions are limited with unix timestamps)
    const dateCounts = new Map<string, number>();

    for (const row of results) {
      // Convert unix timestamp to YYYY-MM-DD
      const date = new Date(row.createdAt * 1000).toISOString().split("T")[0]!;
      dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1);
    }

    // Fill in missing dates with zero counts for continuous chart data
    const trendData: { date: string; count: number }[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0]!;
      trendData.push({
        date: dateStr,
        count: dateCounts.get(dateStr) ?? 0,
      });
    }

    return trendData;
  }),
});
