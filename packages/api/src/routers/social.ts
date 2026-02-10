import { z } from "zod";

import { publicProcedure, router } from "../index";
import { db } from "@trend-x/db";
import {
  account,
  socialConnection,
  socialSnapshot,
} from "@trend-x/db/schema";
import { and, desc, eq, gt, or, sql } from "drizzle-orm";

export const socialRouter = router({
  /**
   * Get recent social snapshots for an account.
   */
  getSnapshotHistory: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        limit: z.number().optional().default(30),
      }),
    )
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: socialSnapshot.id,
          type: socialSnapshot.type,
          followingCount: socialSnapshot.followingCount,
          followerCount: socialSnapshot.followerCount,
          mutualCount: socialSnapshot.mutualCount,
          followingAdded: socialSnapshot.followingAdded,
          followingRemoved: socialSnapshot.followingRemoved,
          followersAdded: socialSnapshot.followersAdded,
          followersRemoved: socialSnapshot.followersRemoved,
          fetchedAt: socialSnapshot.fetchedAt,
        })
        .from(socialSnapshot)
        .where(eq(socialSnapshot.accountId, input.accountId))
        .orderBy(desc(socialSnapshot.fetchedAt))
        .limit(input.limit);

      return rows;
    }),

  /**
   * Get follower/following count time-series for charting.
   */
  getFollowerChart: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        days: z.number().optional().default(30),
      }),
    )
    .query(async ({ input }) => {
      const cutoff = Math.floor(Date.now() / 1000) - input.days * 86400;

      const rows = await db
        .select({
          fetchedAt: socialSnapshot.fetchedAt,
          followerCount: socialSnapshot.followerCount,
          followingCount: socialSnapshot.followingCount,
          mutualCount: socialSnapshot.mutualCount,
        })
        .from(socialSnapshot)
        .where(
          and(
            eq(socialSnapshot.accountId, input.accountId),
            gt(socialSnapshot.fetchedAt, cutoff),
          ),
        )
        .orderBy(socialSnapshot.fetchedAt);

      return rows;
    }),

  /**
   * Get active connections with filtering.
   */
  getConnections: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        direction: z
          .enum(["following", "follower", "mutual"])
          .optional(),
        limit: z.number().optional().default(50),
        notableOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      const conditions = [
        eq(socialConnection.accountId, input.accountId),
        eq(socialConnection.isActive, 1),
      ];

      if (input.direction) {
        conditions.push(eq(socialConnection.direction, input.direction));
      }

      if (input.notableOnly) {
        conditions.push(
          or(
            eq(socialConnection.isBlueVerified, 1),
            gt(socialConnection.followerCount, 10000),
          )!,
        );
      }

      const rows = await db
        .select()
        .from(socialConnection)
        .where(and(...conditions))
        .orderBy(desc(socialConnection.followerCount))
        .limit(input.limit);

      return rows;
    }),

  /**
   * Get recently added/lost connections.
   */
  getRecentChanges: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        limit: z.number().optional().default(20),
      }),
    )
    .query(async ({ input }) => {
      const halfLimit = Math.ceil(input.limit / 2);

      // Recently added: active connections sorted by firstSeenAt desc
      const recentlyAdded = await db
        .select()
        .from(socialConnection)
        .where(
          and(
            eq(socialConnection.accountId, input.accountId),
            eq(socialConnection.isActive, 1),
          ),
        )
        .orderBy(desc(socialConnection.firstSeenAt))
        .limit(halfLimit);

      // Recently lost: inactive connections sorted by deactivatedAt desc
      const recentlyRemoved = await db
        .select()
        .from(socialConnection)
        .where(
          and(
            eq(socialConnection.accountId, input.accountId),
            eq(socialConnection.isActive, 0),
          ),
        )
        .orderBy(desc(socialConnection.deactivatedAt))
        .limit(halfLimit);

      // Combine with changeType field and sort by timestamp desc
      const combined = [
        ...recentlyAdded.map((r) => ({
          ...r,
          changeType: "added" as const,
          changeTimestamp: r.firstSeenAt,
        })),
        ...recentlyRemoved.map((r) => ({
          ...r,
          changeType: "removed" as const,
          changeTimestamp: r.deactivatedAt ?? r.lastSeenAt,
        })),
      ].sort((a, b) => b.changeTimestamp - a.changeTimestamp);

      return combined;
    }),

  /**
   * Get social graph data for force-directed visualization.
   */
  getGraphData: publicProcedure
    .input(
      z.object({
        accountId: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      // Get all monitored accounts
      const monitoredAccounts = await db.select().from(account);

      type GraphNode = {
        id: string;
        name: string;
        val: number;
        color: string;
        isMonitored: boolean;
      };
      type GraphLink = {
        source: string;
        target: string;
        isMutual: boolean;
      };

      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];
      const nodeIds = new Set<string>();

      // Build a map of monitored account handles to IDs
      const monitoredHandleMap = new Map<string, string>();
      for (const acct of monitoredAccounts) {
        const handle = acct.handle.startsWith("@")
          ? acct.handle.slice(1).toLowerCase()
          : acct.handle.toLowerCase();
        monitoredHandleMap.set(handle, acct.id);
      }

      // Add monitored accounts as nodes
      for (const acct of monitoredAccounts) {
        const handle = acct.handle.startsWith("@")
          ? acct.handle.slice(1)
          : acct.handle;

        nodes.push({
          id: acct.id,
          name: handle,
          val: 10, // Larger size for monitored accounts
          color: "#3b82f6", // blue
          isMonitored: true,
        });
        nodeIds.add(acct.id);
      }

      // For each monitored account, get active connections
      const accountFilter = input.accountId
        ? monitoredAccounts.filter((a) => a.id === input.accountId)
        : monitoredAccounts;

      for (const acct of accountFilter) {
        const connections = await db
          .select()
          .from(socialConnection)
          .where(
            and(
              eq(socialConnection.accountId, acct.id),
              eq(socialConnection.isActive, 1),
            ),
          );

        for (const conn of connections) {
          // Check if this connection is also a monitored account
          const monitoredId = monitoredHandleMap.get(
            conn.username.toLowerCase(),
          );

          if (monitoredId) {
            // Link between monitored accounts
            const isMutual = conn.direction === "mutual";
            const linkKey = [acct.id, monitoredId].sort().join("-");
            const existingLink = links.find(
              (l) =>
                [l.source, l.target].sort().join("-") === linkKey,
            );

            if (!existingLink) {
              links.push({
                source: acct.id,
                target: monitoredId,
                isMutual,
              });
            } else if (isMutual) {
              existingLink.isMutual = true;
            }
          } else {
            // Notable non-monitored connection (shared or verified/high-follower)
            const isNotable =
              conn.isBlueVerified === 1 ||
              (conn.followerCount !== null && conn.followerCount > 10000);

            if (isNotable && !nodeIds.has(conn.userId)) {
              nodes.push({
                id: conn.userId,
                name: conn.username,
                val: 3, // Smaller size for non-monitored
                color: "#94a3b8", // slate
                isMonitored: false,
              });
              nodeIds.add(conn.userId);
            }

            if (isNotable) {
              links.push({
                source: acct.id,
                target: conn.userId,
                isMutual: conn.direction === "mutual",
              });
            }
          }
        }
      }

      return { nodes, links };
    }),

  /**
   * Get summary stats for an account's social connections.
   */
  getStats: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      // Count active connections by direction
      const connections = await db
        .select({
          direction: socialConnection.direction,
        })
        .from(socialConnection)
        .where(
          and(
            eq(socialConnection.accountId, input.accountId),
            eq(socialConnection.isActive, 1),
          ),
        );

      let followingCount = 0;
      let followerCount = 0;
      let mutualCount = 0;

      for (const conn of connections) {
        switch (conn.direction) {
          case "following":
            followingCount++;
            break;
          case "follower":
            followerCount++;
            break;
          case "mutual":
            mutualCount++;
            break;
        }
      }

      // Get latest snapshot
      const [latestSnapshot] = await db
        .select({
          fetchedAt: socialSnapshot.fetchedAt,
        })
        .from(socialSnapshot)
        .where(eq(socialSnapshot.accountId, input.accountId))
        .orderBy(desc(socialSnapshot.fetchedAt))
        .limit(1);

      // Count total snapshots
      const [snapshotCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(socialSnapshot)
        .where(eq(socialSnapshot.accountId, input.accountId));

      return {
        followingCount,
        followerCount,
        mutualCount,
        lastFetchedAt: latestSnapshot?.fetchedAt ?? null,
        totalSnapshots: snapshotCount?.count ?? 0,
      };
    }),
});
