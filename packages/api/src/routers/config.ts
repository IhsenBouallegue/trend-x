import { TwitterClient } from "@steipete/bird";
import { db } from "@trend-x/db";
import { config } from "@trend-x/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";

// Base required credentials (always needed)
const BASE_REQUIRED_CREDENTIALS = ["twitter_auth_token", "twitter_ct0"] as const;

// AI-related required credentials (always needed)
const AI_BASE_CREDENTIALS = ["ai_chat_model", "ai_embedding_model"] as const;

export const configRouter = router({
  get: publicProcedure
    .input(
      z.object({
        key: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const [result] = await db
        .select({ key: config.key, value: config.value })
        .from(config)
        .where(eq(config.key, input.key));

      return result ?? null;
    }),

  getAll: publicProcedure.query(async () => {
    const results = await db.select({ key: config.key, value: config.value }).from(config);

    return results;
  }),

  set: publicProcedure
    .input(
      z.object({
        key: z.string().min(1),
        value: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const now = Math.floor(Date.now() / 1000);

      const [result] = await db
        .insert(config)
        .values({
          key: input.key,
          value: input.value,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: config.key,
          set: {
            value: input.value,
            updatedAt: now,
          },
        })
        .returning();

      return result;
    }),

  setBulk: publicProcedure
    .input(
      z.object({
        entries: z.array(
          z.object({
            key: z.string().min(1),
            value: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const now = Math.floor(Date.now() / 1000);

      // Process each entry as an upsert
      for (const entry of input.entries) {
        await db
          .insert(config)
          .values({
            key: entry.key,
            value: entry.value,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: config.key,
            set: {
              value: entry.value,
              updatedAt: now,
            },
          });
      }

      return { success: true, count: input.entries.length };
    }),

  testTwitterCredentials: publicProcedure.mutation(async () => {
    const [authTokenRow] = await db
      .select({ value: config.value })
      .from(config)
      .where(eq(config.key, "twitter_auth_token"));

    const [ct0Row] = await db
      .select({ value: config.value })
      .from(config)
      .where(eq(config.key, "twitter_ct0"));

    const authToken = authTokenRow?.value;
    const ct0 = ct0Row?.value;

    if (!authToken || !ct0) {
      return { success: false as const, error: "Twitter credentials not configured" };
    }

    const client = new TwitterClient({ cookies: { authToken, ct0 } });
    const account = await client.getCurrentUser();

    if (!account.success || !account.user) {
      return { success: false as const, error: account.error ?? "Failed to authenticate" };
    }

    return {
      success: true as const,
      name: account.user.name,
      username: account.user.username,
    };
  }),

  isConfigured: publicProcedure.query(async () => {
    const results = await db.select({ key: config.key, value: config.value }).from(config);

    const configMap = new Map(results.map((r) => [r.key, r.value]));

    const missing: string[] = [];

    // Check base credentials (always required)
    for (const key of BASE_REQUIRED_CREDENTIALS) {
      const value = configMap.get(key);
      if (!value || value.trim() === "") {
        missing.push(key);
      }
    }

    // Check AI base credentials (always required)
    for (const key of AI_BASE_CREDENTIALS) {
      const value = configMap.get(key);
      if (!value || value.trim() === "") {
        missing.push(key);
      }
    }

    // Check provider-specific credentials
    const activeProvider = configMap.get("ai_provider") || "openai";
    let providerCredentialKey: string | null = null;

    if (activeProvider === "openai") {
      providerCredentialKey = "openai_api_key";
    } else if (activeProvider === "openrouter") {
      providerCredentialKey = "openrouter_api_key";
    }
    // ollama has no API key requirement

    if (providerCredentialKey) {
      const value = configMap.get(providerCredentialKey);
      if (!value || value.trim() === "") {
        missing.push(providerCredentialKey);
      }
    }

    return {
      configured: missing.length === 0,
      missing,
    };
  }),
});
