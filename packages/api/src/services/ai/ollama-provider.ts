import { categorizeModel } from "./model-filter";
import type { AIModel, AIProvider, ChatResponse, EmbeddingResponse } from "./types";

interface OllamaModel {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaListResponse {
  models: OllamaModel[];
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbedResponse {
  model: string;
  embeddings: number[][];
  prompt_eval_count?: number;
}

export class OllamaProvider implements AIProvider {
  name = "ollama" as const;
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:11434") {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  async listModels(): Promise<AIModel[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama listModels failed: ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaListResponse;
    return data.models.map((model) => ({
      id: model.name,
      name: model.name,
      category: categorizeModel(model.name),
      provider: this.name,
    }));
  }

  async chat(
    model: string,
    messages: Array<{ role: "system" | "user"; content: string }>,
  ): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat failed: ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const content = data.message?.content || "";
    const promptTokens = data.prompt_eval_count || 0;
    const completionTokens = data.eval_count || 0;

    return {
      content,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  async embed(model: string, inputs: string[]): Promise<EmbeddingResponse> {
    if (inputs.length === 0) {
      return { embeddings: [], promptTokens: 0, totalTokens: 0 };
    }

    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: inputs, // Ollama uses 'input' (not 'inputs')
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embed failed: ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    const promptTokens = data.prompt_eval_count || 0;

    return {
      embeddings: data.embeddings,
      promptTokens,
      totalTokens: promptTokens, // Ollama doesn't return completion tokens for embeddings
    };
  }
}
