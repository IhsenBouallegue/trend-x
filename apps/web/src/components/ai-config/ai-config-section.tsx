"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAIConfig, useDetectOllama, useSetAIConfig } from "@/hooks/queries";
import { ModelSelector } from "./model-selector";
import { ProviderSelector } from "./provider-selector";
import { UsageChart } from "./usage-chart";

export function AIConfigSection() {
  const { data: config, isLoading: configLoading } = useAIConfig();

  const { data: ollamaStatus } = useDetectOllama();

  const [provider, setProvider] = useState<"openai" | "openrouter" | "ollama">("openai");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [modelsByProvider, setModelsByProvider] = useState<
    Record<string, { chat: string; embedding: string }>
  >({
    openai: { chat: "", embedding: "" },
    openrouter: { chat: "", embedding: "" },
    ollama: { chat: "", embedding: "" },
  });
  const chatModel = modelsByProvider[provider]?.chat || "";
  const embeddingModel = modelsByProvider[provider]?.embedding || "";

  // Load config into state when available
  // API keys are masked by the backend (e.g. "sk-...zUoA") — never load them into input state.
  // Instead, keep inputs empty and use the masked value as a placeholder.
  useEffect(() => {
    if (config) {
      setProvider(config.provider);
      setOllamaBaseUrl(config.ollamaBaseUrl || "http://localhost:11434");
      const saved = config.modelsByProvider;
      setModelsByProvider({
        openai: {
          chat: saved?.openai?.chat || (config.provider === "openai" ? config.chatModel : ""),
          embedding:
            saved?.openai?.embedding || (config.provider === "openai" ? config.embeddingModel : ""),
        },
        openrouter: {
          chat:
            saved?.openrouter?.chat || (config.provider === "openrouter" ? config.chatModel : ""),
          embedding:
            saved?.openrouter?.embedding ||
            (config.provider === "openrouter" ? config.embeddingModel : ""),
        },
        ollama: {
          chat: saved?.ollama?.chat || (config.provider === "ollama" ? config.chatModel : ""),
          embedding:
            saved?.ollama?.embedding || (config.provider === "ollama" ? config.embeddingModel : ""),
        },
      });
    }
  }, [config]);

  const setConfigMutation = useSetAIConfig({
    onSuccess: () => {
      toast.success("AI configuration saved");
    },
    onError: (error) => {
      toast.error(`Failed to save configuration: ${error.message}`);
    },
  });

  const handleProviderChange = (newProvider: "openai" | "openrouter" | "ollama") => {
    setProvider(newProvider);
  };

  const handleChatModelChange = (model: string) => {
    setModelsByProvider((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], chat: model },
    }));
  };

  const handleEmbeddingModelChange = (model: string) => {
    setModelsByProvider((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], embedding: model },
    }));
  };

  const handleSave = () => {
    if (!chatModel || !embeddingModel) {
      toast.error("Please select both chat and embedding models");
      return;
    }

    setConfigMutation.mutate({
      provider,
      chatModel,
      embeddingModel,
      openaiApiKey: provider === "openai" && openaiApiKey ? openaiApiKey : undefined,
      openrouterApiKey:
        provider === "openrouter" && openrouterApiKey ? openrouterApiKey : undefined,
      ollamaBaseUrl: provider === "ollama" ? ollamaBaseUrl : undefined,
    });
  };

  if (configLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted" />
            <div className="h-20 bg-muted" />
            <div className="h-32 bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProviderSelector
          provider={provider}
          onProviderChange={handleProviderChange}
          openaiApiKey={openaiApiKey}
          onOpenaiApiKeyChange={setOpenaiApiKey}
          openaiApiKeyPlaceholder={config?.openaiApiKey || "sk-..."}
          openrouterApiKey={openrouterApiKey}
          onOpenrouterApiKeyChange={setOpenrouterApiKey}
          openrouterApiKeyPlaceholder={config?.openrouterApiKey || "sk-or-..."}
          ollamaBaseUrl={ollamaBaseUrl}
          onOllamaBaseUrlChange={setOllamaBaseUrl}
          ollamaDetected={ollamaStatus?.available || false}
        />

        <Separator />

        <ModelSelector
          provider={provider}
          apiKey={
            provider === "openai" && openaiApiKey
              ? openaiApiKey
              : provider === "openrouter" && openrouterApiKey
                ? openrouterApiKey
                : undefined
          }
          hasStoredApiKey={
            (provider === "openai" && !!config?.openaiApiKey) ||
            (provider === "openrouter" && !!config?.openrouterApiKey)
          }
          baseUrl={provider === "ollama" ? ollamaBaseUrl : undefined}
          chatModel={chatModel}
          embeddingModel={embeddingModel}
          onChatModelChange={handleChatModelChange}
          onEmbeddingModelChange={handleEmbeddingModelChange}
        />

        <Button
          onClick={handleSave}
          disabled={!chatModel || !embeddingModel || setConfigMutation.isPending}
          className="w-full"
        >
          {setConfigMutation.isPending ? "Saving..." : "Save Configuration"}
        </Button>

        <Separator />

        <UsageChart />
      </CardContent>
    </Card>
  );
}
