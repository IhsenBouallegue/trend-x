import OpenAI from "openai";
import { categorizeModel } from "./model-filter";
import type { AIModel, AIProvider, ChatResponse, EmbeddingResponse } from "./types";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: { prompt: string; completion: string };
}

export class OpenRouterProvider implements AIProvider {
  name = "openrouter" as const;
  private client: OpenAI;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://trend-x.app",
        "X-Title": "Trend-X",
      },
    });
  }

  async listModels(): Promise<AIModel[]> {
    // Fetch chat models and embedding models in parallel
    const [chatResponse, embeddingResponse] = await Promise.all([
      this.client.models.list(),
      this.fetchEmbeddingModels(),
    ]);

    const chatModels: AIModel[] = chatResponse.data.map((model) => {
      const orModel = model as unknown as OpenRouterModel;
      return {
        id: model.id,
        name: orModel.name || model.id,
        category: categorizeModel(model.id),
        provider: this.name,
        pricing: orModel.pricing
          ? { prompt: orModel.pricing.prompt, completion: orModel.pricing.completion }
          : undefined,
      };
    });

    const embeddingModels: AIModel[] = embeddingResponse.map((model) => ({
      id: model.id,
      name: model.name || model.id,
      category: "embedding" as const,
      provider: this.name,
      pricing: model.pricing
        ? { prompt: model.pricing.prompt, completion: model.pricing.completion }
        : undefined,
    }));

    return [...chatModels, ...embeddingModels];
  }

  private async fetchEmbeddingModels(): Promise<OpenRouterModel[]> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/embeddings/models", {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { data: OpenRouterModel[] };
      return data.data || [];
    } catch {
      return [];
    }
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
