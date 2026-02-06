"use client";

import { useEffect } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useListModels } from "@/hooks/queries";

const RECOMMENDED_MODELS: Record<string, { chat: string; embedding: string }> = {
  openai: { chat: "gpt-4o-mini", embedding: "text-embedding-3-small" },
  openrouter: { chat: "openai/gpt-4o-mini", embedding: "openai/text-embedding-3-small" },
  ollama: { chat: "qwen3:4b", embedding: "nomic-embed-text" },
};

interface ModelSelectorProps {
  provider: "openai" | "openrouter" | "ollama";
  apiKey?: string;
  baseUrl?: string;
  chatModel: string;
  embeddingModel: string;
  onChatModelChange: (model: string) => void;
  onEmbeddingModelChange: (model: string) => void;
  hasStoredApiKey?: boolean;
}

interface ModelOption {
  id: string;
  name: string;
  pricing?: { prompt: string; completion: string };
}

export function PriceBadge({ pricing }: { pricing?: { prompt: string; completion: string } }) {
  if (!pricing) return null;
  const promptCost = Number.parseFloat(pricing.prompt);
  const isFree = promptCost === 0;
  if (isFree) {
    return (
      <span className="shrink-0 bg-green-500/15 px-1.5 py-0.5 font-medium text-green-600 text-xs dark:text-green-400">
        Free
      </span>
    );
  }
  const perMillion = promptCost * 1_000_000;
  const formatted = perMillion < 0.01 ? "<$0.01" : `$${perMillion.toFixed(2)}`;
  return (
    <span className="shrink-0 bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
      {formatted}/M
    </span>
  );
}

export function RecommendedBadge() {
  return (
    <span className="shrink-0 bg-primary/15 px-1.5 py-0.5 font-medium text-primary text-xs">
      Recommended
    </span>
  );
}

function isRecommended(modelId: string, recommendedId?: string): boolean {
  if (!recommendedId) return false;
  return modelId === recommendedId || modelId.startsWith(recommendedId + ":");
}

export function ModelCombobox({
  models,
  value,
  onValueChange,
  recommendedId,
  placeholder = "Search models...",
}: {
  models: ModelOption[];
  value: string;
  onValueChange: (value: string) => void;
  recommendedId?: string;
  placeholder?: string;
}) {
  const selectedModel = models.find((m) => m.id === value) ?? null;
  const selectedIsRecommended = !!value && isRecommended(value, recommendedId);

  return (
    <Combobox
      items={models}
      itemToStringLabel={(model) => (model as ModelOption).name}
      itemToStringValue={(model) => (model as ModelOption).id}
      isItemEqualToValue={(a, b) => (a as ModelOption).id === (b as ModelOption).id}
      value={selectedModel}
      onValueChange={(val) => {
        if (val != null) onValueChange((val as ModelOption).id);
      }}
    >
      <ComboboxInput placeholder={placeholder}>
        {selectedIsRecommended && (
          <span className="flex shrink-0 items-center gap-1.5">
            <RecommendedBadge />
            {selectedModel?.pricing && <PriceBadge pricing={selectedModel.pricing} />}
          </span>
        )}
      </ComboboxInput>
      <ComboboxContent className="!min-w-(--anchor-width)">
        <ComboboxList>
          {(model) => {
            const m = model as ModelOption;
            return (
              <ComboboxItem key={m.id} value={model}>
                <span className="flex w-full items-center gap-1.5">
                  <span className="truncate">{m.name}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    {isRecommended(m.id, recommendedId) && <RecommendedBadge />}
                    <PriceBadge pricing={m.pricing} />
                  </span>
                </span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
        <ComboboxEmpty>No models found</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}

export function ModelSelector({
  provider,
  apiKey,
  baseUrl,
  chatModel,
  embeddingModel,
  onChatModelChange,
  onEmbeddingModelChange,
  hasStoredApiKey = false,
}: ModelSelectorProps) {
  // Enable model loading if we have a client-side key OR a stored key on the server
  const enabled = !!provider && (provider === "ollama" || !!apiKey || hasStoredApiKey);

  const {
    data: models,
    isLoading,
    error,
  } = useListModels({
    provider,
    apiKey: apiKey || undefined,
    baseUrl,
    enabled,
  });

  // Auto-select recommended models when models load and nothing is selected
  useEffect(() => {
    if (!models || models.length === 0) return;
    const recommended = RECOMMENDED_MODELS[provider];
    if (!recommended) return;

    if (!chatModel) {
      const match =
        models.find((m) => m.category === "chat" && m.id === recommended.chat) ||
        models.find((m) => m.category === "chat" && m.id.startsWith(recommended.chat + ":"));
      if (match) onChatModelChange(match.id);
    }
    if (!embeddingModel) {
      const match =
        models.find((m) => m.category === "embedding" && m.id === recommended.embedding) ||
        models.find(
          (m) => m.category === "embedding" && m.id.startsWith(recommended.embedding + ":"),
        );
      if (match) onEmbeddingModelChange(match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  const recommended = RECOMMENDED_MODELS[provider];
  const chatModels = models?.filter((m) => m.category === "chat") || [];
  const embeddingModels = models?.filter((m) => m.category === "embedding") || [];

  if (!enabled) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">Enter API key to load available models</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Field>
          <FieldLabel>Chat Model</FieldLabel>
          <Skeleton className="h-8 w-full" />
        </Field>
        <Field>
          <FieldLabel>Embedding Model</FieldLabel>
          <Skeleton className="h-8 w-full" />
        </Field>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm">Failed to load models: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel>Chat Model</FieldLabel>
        <FieldDescription>
          Model used for topic labeling, sentiment, and explanations
        </FieldDescription>
        {chatModels.length === 0 ? (
          <p className="text-muted-foreground text-sm">No chat models found</p>
        ) : (
          <ModelCombobox
            models={chatModels}
            value={chatModel}
            onValueChange={onChatModelChange}
            recommendedId={recommended?.chat}
            placeholder="Search chat models..."
          />
        )}
      </Field>

      <Field>
        <FieldLabel>Embedding Model</FieldLabel>
        <FieldDescription>
          Model used for semantic analysis and topic classification
        </FieldDescription>
        {embeddingModels.length === 0 ? (
          <p className="text-muted-foreground text-sm">No embedding models found</p>
        ) : (
          <ModelCombobox
            models={embeddingModels}
            value={embeddingModel}
            onValueChange={onEmbeddingModelChange}
            recommendedId={recommended?.embedding}
            placeholder="Search embedding models..."
          />
        )}
      </Field>
    </div>
  );
}
