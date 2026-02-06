"use client";

import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProviderSelectorProps {
  provider: "openai" | "openrouter" | "ollama";
  onProviderChange: (provider: "openai" | "openrouter" | "ollama") => void;
  openaiApiKey: string;
  onOpenaiApiKeyChange: (key: string) => void;
  openaiApiKeyPlaceholder?: string;
  openrouterApiKey: string;
  onOpenrouterApiKeyChange: (key: string) => void;
  openrouterApiKeyPlaceholder?: string;
  ollamaBaseUrl: string;
  onOllamaBaseUrlChange: (url: string) => void;
  ollamaDetected: boolean;
}

export function ProviderSelector({
  provider,
  onProviderChange,
  openaiApiKey,
  onOpenaiApiKeyChange,
  openaiApiKeyPlaceholder,
  openrouterApiKey,
  onOpenrouterApiKeyChange,
  openrouterApiKeyPlaceholder,
  ollamaBaseUrl,
  onOllamaBaseUrlChange,
  ollamaDetected,
}: ProviderSelectorProps) {
  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel>AI Provider</FieldLabel>
        <FieldDescription>
          Choose the AI provider for embeddings and language models
        </FieldDescription>
        <Select
          value={provider}
          onValueChange={(value) =>
            value && onProviderChange(value as "openai" | "openrouter" | "ollama")
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="openrouter">OpenRouter</SelectItem>
            <SelectItem value="ollama">Ollama</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {provider === "openai" && (
        <Field>
          <FieldLabel>OpenAI API Key</FieldLabel>
          <FieldDescription>
            Your OpenAI API key for accessing GPT and embedding models
          </FieldDescription>
          <PasswordInput
            placeholder={openaiApiKeyPlaceholder || "sk-..."}
            value={openaiApiKey}
            onChange={(e) => onOpenaiApiKeyChange(e.target.value)}
          />
        </Field>
      )}

      {provider === "openrouter" && (
        <Field>
          <FieldLabel>OpenRouter API Key</FieldLabel>
          <FieldDescription>
            Your OpenRouter API key for accessing various AI models
          </FieldDescription>
          <PasswordInput
            placeholder={openrouterApiKeyPlaceholder || "sk-or-..."}
            value={openrouterApiKey}
            onChange={(e) => onOpenrouterApiKeyChange(e.target.value)}
          />
        </Field>
      )}

      {provider === "ollama" && (
        <>
          <details className="text-muted-foreground text-sm">
            <summary className="mb-2 cursor-pointer hover:text-foreground">
              How to set up Ollama
            </summary>
            <div className="ml-1 space-y-3 border-muted border-l-2 pl-2">
              <div>
                <p className="font-medium text-foreground">1. Install Ollama</p>
                <ol className="mt-1 list-inside list-decimal space-y-1">
                  <li>
                    Download from{" "}
                    <a
                      href="https://ollama.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      ollama.com
                    </a>
                  </li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-foreground">2. Pull models</p>
                <ol className="mt-1 list-inside list-decimal space-y-1">
                  <li>
                    Chat model:{" "}
                    <code className="rounded-none bg-muted px-1.5 py-0.5 font-mono text-xs">
                      ollama pull qwen3:4b
                    </code>
                  </li>
                  <li>
                    Embedding model:{" "}
                    <code className="rounded-none bg-muted px-1.5 py-0.5 font-mono text-xs">
                      ollama pull nomic-embed-text
                    </code>
                  </li>
                </ol>
              </div>
            </div>
          </details>
          <Field>
            <FieldLabel>Ollama Base URL</FieldLabel>
            <FieldDescription className="flex items-center gap-2">
              <span>Local Ollama server endpoint</span>
              {ollamaDetected ? (
                <Badge variant="default" className="bg-green-500 text-white">
                  Detected
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-yellow-500 text-white">
                  Not found
                </Badge>
              )}
            </FieldDescription>
            <Input
              type="text"
              placeholder="http://localhost:11434"
              value={ollamaBaseUrl}
              onChange={(e) => onOllamaBaseUrlChange(e.target.value)}
            />
          </Field>
        </>
      )}
    </div>
  );
}
