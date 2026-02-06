import { db } from "@trend-x/db";
import { config } from "@trend-x/db/schema";
import { eq } from "drizzle-orm";
import { OllamaProvider } from "./ollama-provider";
import { OpenAIProvider } from "./openai-provider";
import { OpenRouterProvider } from "./openrouter-provider";
import type { AIProvider, ProviderName } from "./types";

let cachedProvider: AIProvider | null = null;
let cachedProviderName: ProviderName | null = null;

/**
 * Reset the cached provider instance.
 * Call this when provider configuration changes.
 */
export function resetProviderCache(): void {
  cachedProvider = null;
  cachedProviderName = null;
}

/**
 * Get the active AI provider instance based on config.
 * Returns cached instance if provider hasn't changed.
 */
export async function getProvider(): Promise<AIProvider> {
  // Read active provider from config table
  const [providerRow] = await db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, "ai_provider"));
  const providerName = (providerRow?.value || "openai") as ProviderName;

  // Return cached instance if provider hasn't changed
  if (cachedProvider && cachedProviderName === providerName) {
    return cachedProvider;
  }

  // Create new provider instance based on config
  switch (providerName) {
    case "openai": {
      const [apiKeyRow] = await db
        .select({ value: config.value })
        .from(config)
        .where(eq(config.key, "openai_api_key"));
      cachedProvider = new OpenAIProvider(apiKeyRow?.value || "");
      break;
    }
    case "openrouter": {
      const [apiKeyRow] = await db
        .select({ value: config.value })
        .from(config)
        .where(eq(config.key, "openrouter_api_key"));
      cachedProvider = new OpenRouterProvider(apiKeyRow?.value || "");
      break;
    }
    case "ollama": {
      const [urlRow] = await db
        .select({ value: config.value })
        .from(config)
        .where(eq(config.key, "ollama_base_url"));
      cachedProvider = new OllamaProvider(urlRow?.value || "http://localhost:11434");
      break;
    }
    default:
      throw new Error(`Unknown AI provider: ${providerName}`);
  }

  cachedProviderName = providerName;
  return cachedProvider;
}
