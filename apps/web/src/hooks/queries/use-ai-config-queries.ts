import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, trpc } from "@/utils/trpc";
import { queryKeys } from "./query-keys";

export function useAIConfig() {
  return useQuery(trpc.aiConfig.getConfig.queryOptions());
}

export function useDetectOllama() {
  return useQuery(trpc.aiConfig.detectOllama.queryOptions());
}

export function useListModels({
  provider,
  apiKey,
  baseUrl,
  enabled = true,
}: {
  provider: "openai" | "openrouter" | "ollama";
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;
}) {
  return useQuery({
    ...trpc.aiConfig.listModels.queryOptions({
      provider,
      apiKey: apiKey || undefined,
      baseUrl,
    }),
    enabled,
  });
}

export function useUsageStats({ days }: { days: number }) {
  return useQuery(trpc.aiConfig.getUsageStats.queryOptions({ days }));
}

export function useSetAIConfig(options?: {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}) {
  return useMutation(
    trpc.aiConfig.setConfig.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.aiConfig.all });
        options?.onSuccess?.();
      },
      onError: (error) => options?.onError?.(error),
    }),
  );
}
