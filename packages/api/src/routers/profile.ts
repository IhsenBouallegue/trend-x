import { z } from "zod";

import { publicProcedure, router } from "../index";
import {
  getRecentActivityByAccount,
  getRecentActivityGlobal,
} from "../services/profile-activity";
import {
  getOrCreateProfile,
  getProfileByAccountId,
} from "../services/profile";

export const profileRouter = router({
  /**
   * Get profile for an account, returns null if none exists.
   */
  getProfile: publicProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      return getProfileByAccountId(input.accountId);
    }),

  /**
   * Get or create profile for an account. Creates empty profile if none exists.
   */
  getOrCreateProfile: publicProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      return getOrCreateProfile(input.accountId);
    }),

  /**
   * Get recent activity log for a specific account.
   */
  getActivity: publicProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        limit: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ input }) => {
      return getRecentActivityByAccount(input.accountId, input.limit);
    }),

  /**
   * Get recent activity across all accounts (global feed).
   */
  getGlobalActivity: publicProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return getRecentActivityGlobal(input?.limit);
    }),

  /**
   * Get lightweight metrics summary for an account profile.
   */
  getMetrics: publicProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      const profile = await getProfileByAccountId(input.accountId);
      if (!profile) {
        return {
          topicCount: 0,
          totalTweetsProcessed: 0,
          hasPersonality: false,
          lastUpdatedAt: null,
        };
      }
      return {
        topicCount: profile.topics.length,
        totalTweetsProcessed: profile.totalTweetsProcessed,
        hasPersonality: profile.personality !== null,
        lastUpdatedAt: profile.lastUpdatedAt,
      };
    }),
});
