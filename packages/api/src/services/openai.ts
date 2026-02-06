import { db } from "@trend-x/db";
import { config } from "@trend-x/db/schema";
import { eq } from "drizzle-orm";
import { getProvider, resetProviderCache } from "./ai/provider-factory";
import { trackTokenUsage } from "./ai/token-tracker";

/**
 * Helper function to read a configured model from config table.
 */
async function getConfiguredModel(key: string, defaultModel: string): Promise<string> {
  const [result] = await db.select({ value: config.value }).from(config).where(eq(config.key, key));
  return result?.value || defaultModel;
}

// Reset client (call when API key changes) - backward compatibility
export function resetOpenAIClient(): void {
  resetProviderCache();
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

/**
 * Generate embeddings for multiple texts using configured embedding model.
 * Batches requests to stay within rate limits.
 * Returns array in same order as input texts.
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return [];

  const provider = await getProvider();
  const model = await getConfiguredModel("ai_embedding_model", "text-embedding-3-small");

  // Batch processing to stay within rate limits
  const BATCH_SIZE = 100;
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await provider.embed(model, batch);

    // Track token usage
    await trackTokenUsage({
      operation: "embedding",
      provider: provider.name,
      model,
      promptTokens: response.promptTokens,
      completionTokens: 0,
      totalTokens: response.totalTokens,
    });

    for (let j = 0; j < batch.length; j++) {
      results.push({
        text: batch[j]!,
        embedding: response.embeddings[j]!,
      });
    }
  }

  return results;
}

// Re-export getProvider for backward compatibility
export { getProvider };
