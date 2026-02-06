import { db } from "@trend-x/db";
import { tokenUsage } from "@trend-x/db/schema";
import type { OperationType, ProviderName } from "./types";

export async function trackTokenUsage(params: {
  operation: OperationType;
  provider: ProviderName;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}): Promise<void> {
  await db.insert(tokenUsage).values({
    operation: params.operation,
    provider: params.provider,
    model: params.model,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    totalTokens: params.totalTokens,
  });
}
