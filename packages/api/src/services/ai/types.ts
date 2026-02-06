export type ProviderName = "openai" | "openrouter" | "ollama";
export type ModelCategory = "chat" | "embedding" | "unknown";
export type OperationType = "embedding" | "labeling" | "sentiment" | "explanation" | "personality";

export interface AIModel {
  id: string; // model identifier (e.g. "gpt-4o-mini")
  name: string; // display name
  category: ModelCategory;
  provider: ProviderName;
  pricing?: {
    prompt: string; // cost per token for input (e.g. "0.00003")
    completion: string; // cost per token for output
  };
}

export interface ChatResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  promptTokens: number;
  totalTokens: number;
}

export interface AIProvider {
  name: ProviderName;
  listModels(): Promise<AIModel[]>;
  chat(
    model: string,
    messages: Array<{ role: "system" | "user"; content: string }>,
  ): Promise<ChatResponse>;
  embed(model: string, inputs: string[]): Promise<EmbeddingResponse>;
}
