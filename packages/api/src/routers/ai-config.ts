import { db } from "@trend-x/db";
import { config, tokenUsage } from "@trend-x/db/schema";
import { TRPCError } from "@trpc/server";
import { eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../index";
import { OllamaProvider } from "../services/ai/ollama-provider";
import { OpenAIProvider } from "../services/ai/openai-provider";
import { OpenRouterProvider } from "../services/ai/openrouter-provider";
import { getProvider, resetProviderCache } from "../services/ai/provider-factory";

/**
 * Helper function to mask API key showing only last 4 characters.
 */
function maskApiKey(apiKey: string | null | undefined): string {
  if (!apiKey || apiKey.length === 0) return "";
  if (apiKey.length <= 4) return "****";
  return `sk-...${apiKey.slice(-4)}`;
}

export const aiConfigRouter = router({
  /**
   * Get current AI configuration (all settings including masked API keys).
   */
  getConfig: publicProcedure.query(async () => {
    // Read all relevant config values
    const keys = [
      "ai_provider",
      "ai_chat_model",
      "ai_embedding_model",
      "openai_api_key",
      "openrouter_api_key",
      "ollama_base_url",
      "ai_chat_model_openai",
      "ai_embedding_model_openai",
      "ai_chat_model_openrouter",
      "ai_embedding_model_openrouter",
      "ai_chat_model_ollama",
      "ai_embedding_model_ollama",
    ];

    const results = await db
      .select({ key: config.key, value: config.value })
      .from(config)
      .where(
        sql`${config.key} IN (${sql.join(
          keys.map((k) => sql`${k}`),
          sql`, `,
        )})`,
      );

    const configMap = new Map(results.map((r) => [r.key, r.value]));

    return {
      provider: (configMap.get("ai_provider") || "openai") as "openai" | "openrouter" | "ollama",
      chatModel: configMap.get("ai_chat_model") || "gpt-4o-mini",
      embeddingModel: configMap.get("ai_embedding_model") || "text-embedding-3-small",
      openaiApiKey: maskApiKey(configMap.get("openai_api_key")),
      openrouterApiKey: maskApiKey(configMap.get("openrouter_api_key")),
      ollamaBaseUrl: configMap.get("ollama_base_url") || "http://localhost:11434",
      modelsByProvider: {
        openai: {
          chat: configMap.get("ai_chat_model_openai") || "",
          embedding: configMap.get("ai_embedding_model_openai") || "",
        },
        openrouter: {
          chat: configMap.get("ai_chat_model_openrouter") || "",
          embedding: configMap.get("ai_embedding_model_openrouter") || "",
        },
        ollama: {
          chat: configMap.get("ai_chat_model_ollama") || "",
          embedding: configMap.get("ai_embedding_model_ollama") || "",
        },
      },
    };
  }),

  /**
   * Update AI configuration settings.
   */
  setConfig: publicProcedure
    .input(
      z.object({
        provider: z.enum(["openai", "openrouter", "ollama"]),
        chatModel: z.string().min(1),
        embeddingModel: z.string().min(1),
        openaiApiKey: z.string().optional(),
        openrouterApiKey: z.string().optional(),
        ollamaBaseUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const now = Math.floor(Date.now() / 1000);

      // Build list of config entries to upsert
      const entries: Array<{ key: string; value: string }> = [
        { key: "ai_provider", value: input.provider },
        { key: "ai_chat_model", value: input.chatModel },
        { key: "ai_embedding_model", value: input.embeddingModel },
        { key: `ai_chat_model_${input.provider}`, value: input.chatModel },
        { key: `ai_embedding_model_${input.provider}`, value: input.embeddingModel },
      ];

      // Only save API keys if provided, non-empty, and not a masked value
      const isMasked = (v: string) => /^sk-\.\.\./.test(v) || v === "****";
      if (input.openaiApiKey && input.openaiApiKey.trim() !== "" && !isMasked(input.openaiApiKey)) {
        entries.push({ key: "openai_api_key", value: input.openaiApiKey });
      }
      if (
        input.openrouterApiKey &&
        input.openrouterApiKey.trim() !== "" &&
        !isMasked(input.openrouterApiKey)
      ) {
        entries.push({ key: "openrouter_api_key", value: input.openrouterApiKey });
      }
      if (input.ollamaBaseUrl && input.ollamaBaseUrl.trim() !== "") {
        entries.push({ key: "ollama_base_url", value: input.ollamaBaseUrl });
      }

      // Upsert all config entries
      for (const entry of entries) {
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

      // Invalidate cached provider since config changed
      resetProviderCache();

      return { success: true };
    }),

  /**
   * List available models from a provider (for preview before saving).
   */
  listModels: publicProcedure
    .input(
      z.object({
        provider: z.enum(["openai", "openrouter", "ollama"]),
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        // If no API key provided, fall back to stored key from config
        let resolvedApiKey = input.apiKey;
        if (!resolvedApiKey && (input.provider === "openai" || input.provider === "openrouter")) {
          const configKey =
            input.provider === "openai" ? "openai_api_key" : "openrouter_api_key";
          const [stored] = await db
            .select({ value: config.value })
            .from(config)
            .where(eq(config.key, configKey));
          resolvedApiKey = stored?.value || "";
        }

        // Create temporary provider instance with given credentials
        let tempProvider;
        switch (input.provider) {
          case "openai":
            tempProvider = new OpenAIProvider(resolvedApiKey || "");
            break;
          case "openrouter":
            tempProvider = new OpenRouterProvider(resolvedApiKey || "");
            break;
          case "ollama":
            tempProvider = new OllamaProvider(input.baseUrl || "http://localhost:11434");
            break;
        }

        // Call listModels on the temporary provider
        const models = await tempProvider.listModels();
        return models;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? `Failed to connect to ${input.provider}: ${error.message}`
              : `Failed to connect to ${input.provider}`,
        });
      }
    }),

  /**
   * Get token usage statistics grouped by date and operation.
   */
  getUsageStats: publicProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(30),
      }),
    )
    .query(async ({ input }) => {
      const cutoffTimestamp = Math.floor(Date.now() / 1000) - input.days * 24 * 60 * 60;

      // Query token usage grouped by date and operation
      const results = await db
        .select({
          date: sql<string>`date(${tokenUsage.createdAt}, 'unixepoch')`.as("date"),
          operation: tokenUsage.operation,
          tokens: sql<number>`SUM(${tokenUsage.totalTokens})`.as("tokens"),
        })
        .from(tokenUsage)
        .where(gte(tokenUsage.createdAt, cutoffTimestamp))
        .groupBy(sql`date`, tokenUsage.operation)
        .orderBy(sql`date ASC`);

      // Transform to per-day format with operation breakdown
      const dailyMap = new Map<
        string,
        {
          date: string;
          embedding: number;
          labeling: number;
          sentiment: number;
          explanation: number;
        }
      >();

      for (const row of results) {
        if (!dailyMap.has(row.date)) {
          dailyMap.set(row.date, {
            date: row.date,
            embedding: 0,
            labeling: 0,
            sentiment: 0,
            explanation: 0,
          });
        }
        const dayData = dailyMap.get(row.date)!;
        switch (row.operation) {
          case "embedding":
            dayData.embedding = row.tokens;
            break;
          case "labeling":
            dayData.labeling = row.tokens;
            break;
          case "sentiment":
            dayData.sentiment = row.tokens;
            break;
          case "explanation":
            dayData.explanation = row.tokens;
            break;
        }
      }

      return Array.from(dailyMap.values());
    }),

  /**
   * Detect if Ollama is available on localhost.
   */
  detectOllama: publicProcedure.query(async () => {
    const url = "http://localhost:11434/api/tags";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return {
        available: response.ok,
        url: "http://localhost:11434",
      };
    } catch {
      return {
        available: false,
        url: "http://localhost:11434",
      };
    }
  }),
});
