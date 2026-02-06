import type { ModelCategory } from "./types";

const KNOWN_EMBEDDING_MODELS = [
  "text-embedding-3-small",
  "text-embedding-3-large",
  "text-embedding-ada-002",
];

const CHAT_PATTERNS = ["gpt-", "claude-", "llama", "mistral", "gemma", "qwen", "phi", "deepseek"];

/**
 * Categorize a model as chat, embedding, or unknown based on its ID and optional provider metadata.
 * Uses provider metadata first, then falls back to name-based heuristics.
 */
export function categorizeModel(modelId: string, providerMeta?: { type?: string }): ModelCategory {
  const lowerModelId = modelId.toLowerCase();

  // 1. If provider returns type metadata, use it first
  if (providerMeta?.type) {
    const lowerType = providerMeta.type.toLowerCase();
    if (lowerType.includes("embedding") || lowerType === "embedding") {
      return "embedding";
    }
    if (lowerType.includes("chat") || lowerType === "chat" || lowerType.includes("completion")) {
      return "chat";
    }
  }

  // 2. Check known embedding models
  if (KNOWN_EMBEDDING_MODELS.includes(modelId)) {
    return "embedding";
  }

  // 3. Check for embedding keywords in name
  if (lowerModelId.includes("embed") || lowerModelId.includes("text-embedding")) {
    return "embedding";
  }

  // 4. Check for known chat patterns
  for (const pattern of CHAT_PATTERNS) {
    if (lowerModelId.includes(pattern)) {
      return "chat";
    }
  }

  // 5. Default to chat (most models are chat models)
  return "chat";
}
