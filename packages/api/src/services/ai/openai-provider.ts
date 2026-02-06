import OpenAI from "openai";
import { categorizeModel } from "./model-filter";
import type { AIModel, AIProvider, ChatResponse, EmbeddingResponse } from "./types";

export class OpenAIProvider implements AIProvider {
  name = "openai" as const;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async listModels(): Promise<AIModel[]> {
    const response = await this.client.models.list();
    return response.data.map((model) => ({
      id: model.id,
      name: model.id,
      category: categorizeModel(model.id),
      provider: this.name,
    }));
  }

  async chat(
    model: string,
    messages: Array<{ role: "system" | "user"; content: string }>,
  ): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model,
      messages,
    });

    const content = response.choices[0]?.message?.content || "";
    const usage = response.usage;

    return {
      content,
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
    };
  }

  async embed(model: string, inputs: string[]): Promise<EmbeddingResponse> {
    if (inputs.length === 0) {
      return { embeddings: [], promptTokens: 0, totalTokens: 0 };
    }

    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];
    let totalPromptTokens = 0;
    let totalTotalTokens = 0;

    for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
      const batch = inputs.slice(i, i + BATCH_SIZE);
      const response = await this.client.embeddings.create({
        model,
        input: batch,
      });

      for (const item of response.data) {
        allEmbeddings.push(item.embedding);
      }

      totalPromptTokens += response.usage?.prompt_tokens || 0;
      totalTotalTokens += response.usage?.total_tokens || 0;
    }

    return {
      embeddings: allEmbeddings,
      promptTokens: totalPromptTokens,
      totalTokens: totalTotalTokens,
    };
  }
}
