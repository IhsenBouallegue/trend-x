"use client";

import { ChevronLeft, Download, Loader2, User, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ModelSelector } from "@/components/ai-config/model-selector";
import { ProviderSelector } from "@/components/ai-config/provider-selector";
import { CookieInstructions } from "@/components/credential-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import {
  useAccountList,
  useAIConfig,
  useConfigAll,
  useCreateAccount,
  useDeleteAccount,
  useDetectOllama,
  useFetchChatId,
  useSetAIConfig,
  useSetBulkConfig,
  useTestTwitterCredentials,
} from "@/hooks/queries";
import { queryKeys } from "@/hooks/queries";
import { useStepper } from "@/hooks/use-stepper";
import { cn } from "@/lib/utils";
import { queryClient } from "@/utils/trpc";

const STEP_IMAGES = [
  "https://images.unsplash.com/photo-1690138871282-b84c8bb4244d?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1617791160536-598cf32026fb?q=80&w=1528&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1636743094110-5e153f93ad7e?q=80&w=1770&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1764438042316-66f64ba4a7dd?q=80&w=654&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
];

const STEP_LABELS = ["X / Twitter", "AI Provider", "Telegram", "Accounts"];
const STEP_DESCRIPTIONS = [
  "Connect your Twitter/X account",
  "Configure your AI provider",
  "Set up notifications",
  "Add your first account",
];

// ─── Image with crossfade ──────────────────────────────────────────────
function StepImage({
  step,
  className,
  imgClassName,
}: {
  step: number;
  className?: string;
  imgClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [step]);

  return (
    <div className={cn("overflow-hidden", className)}>
      <img
        key={step}
        src={STEP_IMAGES[step - 1]}
        alt={STEP_LABELS[step - 1]}
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-all duration-700 ease-out",
          loaded ? "scale-100 opacity-100" : "scale-105 opacity-0",
          imgClassName,
        )}
      />
    </div>
  );
}

// ─── Animated step wrapper ─────────────────────────────────────────────
function AnimatedStep({
  step,
  direction,
  children,
}: {
  step: number;
  direction: "forward" | "backward";
  children: React.ReactNode;
}) {
  return (
    <div
      key={step}
      className={cn(
        "fade-in animate-in duration-300",
        direction === "forward" ? "slide-in-from-right-4" : "slide-in-from-left-4",
      )}
    >
      {children}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────
export function SetupWizard() {
  const router = useRouter();
  const stepper = useStepper({ totalSteps: 4 });
  const [handlesInput, setHandlesInput] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [authToken, setAuthToken] = useState("");
  const [ct0, setCt0] = useState("");
  const [verifiedUser, setVerifiedUser] = useState<{ name: string; username: string } | null>(null);
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
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // Fetch existing config to prefill fields from interrupted setup
  const { data: existingConfig } = useConfigAll();
  const { data: aiConfig } = useAIConfig();

  useEffect(() => {
    if (!existingConfig || prefilled) return;
    const cfg = new Map(existingConfig.map((r) => [r.key, r.value]));

    const savedAuth = cfg.get("twitter_auth_token");
    const savedCt0 = cfg.get("twitter_ct0");
    if (savedAuth) setAuthToken(savedAuth);
    if (savedCt0) setCt0(savedCt0);

    const savedBotToken = cfg.get("telegram_bot_token");
    const savedChatId = cfg.get("telegram_chat_id");
    if (savedBotToken) setTelegramBotToken(savedBotToken);
    if (savedChatId) setTelegramChatId(savedChatId);

    setPrefilled(true);
  }, [existingConfig, prefilled]);

  // Prefill AI config from the dedicated endpoint (keys are masked — never load into inputs)
  const [aiPrefilled, setAiPrefilled] = useState(false);
  useEffect(() => {
    if (!aiConfig || aiPrefilled) return;
    setProvider(aiConfig.provider);
    setOllamaBaseUrl(aiConfig.ollamaBaseUrl || "http://localhost:11434");
    const saved = aiConfig.modelsByProvider;
    setModelsByProvider({
      openai: {
        chat: saved?.openai?.chat || (aiConfig.provider === "openai" ? aiConfig.chatModel : ""),
        embedding:
          saved?.openai?.embedding ||
          (aiConfig.provider === "openai" ? aiConfig.embeddingModel : ""),
      },
      openrouter: {
        chat:
          saved?.openrouter?.chat ||
          (aiConfig.provider === "openrouter" ? aiConfig.chatModel : ""),
        embedding:
          saved?.openrouter?.embedding ||
          (aiConfig.provider === "openrouter" ? aiConfig.embeddingModel : ""),
      },
      ollama: {
        chat: saved?.ollama?.chat || (aiConfig.provider === "ollama" ? aiConfig.chatModel : ""),
        embedding:
          saved?.ollama?.embedding ||
          (aiConfig.provider === "ollama" ? aiConfig.embeddingModel : ""),
      },
    });
    setAiPrefilled(true);
  }, [aiConfig, aiPrefilled]);

  const { data: ollamaStatus } = useDetectOllama();
  const { data: existingAccounts } = useAccountList();

  const hasStoredApiKey =
    (provider === "openai" && !!aiConfig?.openaiApiKey) ||
    (provider === "openrouter" && !!aiConfig?.openrouterApiKey);

  const parseHandles = (input: string): string[] => {
    return input
      .split(",")
      .map((h) => h.trim().replace(/^@/, ""))
      .filter((h) => h.length > 0);
  };

  const validateStep4 = (): boolean => {
    const errors: Record<string, string> = {};
    const handles = parseHandles(handlesInput);
    const existingHandles = new Set((existingAccounts ?? []).map((a) => a.handle.toLowerCase()));

    if (handles.length === 0 && existingHandles.size === 0) {
      errors.handle = "Add at least one Twitter handle";
    }

    for (const h of handles) {
      if (!/^[a-zA-Z0-9_]+$/.test(h)) {
        errors.handle = `Invalid handle: @${h} (letters, numbers, underscores only)`;
        break;
      }
      if (existingHandles.has(h.toLowerCase())) {
        errors.handle = `@${h} is already added`;
        break;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const testCredentialsMutation = useTestTwitterCredentials({
    onSuccess: (data) => {
      if (data.success) {
        setVerifiedUser({ name: data.name!, username: data.username! });
      } else {
        toast.error(`Credentials invalid: ${data.error}`);
        setVerifiedUser(null);
      }
    },
    onError: (error) => {
      toast.error(`Verification failed: ${error.message}`);
      setVerifiedUser(null);
    },
  });

  const saveCredentialsMutation = useSetBulkConfig({
    onSuccess: () => {
      testCredentialsMutation.mutate();
    },
    onError: (error) => {
      toast.error(`Failed to save credentials: ${error.message}`);
    },
  });

  const handleSaveAndVerify = () => {
    if (!authToken.trim() || !ct0.trim()) {
      toast.error("Both Twitter cookies are required");
      return;
    }
    setVerifiedUser(null);
    saveCredentialsMutation.mutate({
      entries: [
        { key: "twitter_auth_token", value: authToken },
        { key: "twitter_ct0", value: ct0 },
      ],
    });
  };

  const isVerifying = saveCredentialsMutation.isPending || testCredentialsMutation.isPending;

  const setConfigMutation = useSetAIConfig({
    onSuccess: () => {
      stepper.completeStep(2);
      stepper.goForward();
    },
    onError: (error) => toast.error(`Failed to save AI configuration: ${error.message}`),
  });

  const createAccountMutation = useCreateAccount({
    onError: (error) => toast.error(`Failed to add account: ${error.message}`),
  });

  const deleteAccountMutation = useDeleteAccount({
    onError: (error) => toast.error(`Failed to remove account: ${error.message}`),
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

  const handleAIConfigContinue = () => {
    if (!chatModel || !embeddingModel) {
      toast.error("Please select both chat and embedding models");
      return;
    }
    setConfigMutation.mutate({
      provider,
      chatModel,
      embeddingModel,
      openaiApiKey: provider === "openai" && openaiApiKey ? openaiApiKey : undefined,
      openrouterApiKey: provider === "openrouter" && openrouterApiKey ? openrouterApiKey : undefined,
      ollamaBaseUrl: provider === "ollama" ? ollamaBaseUrl : undefined,
    });
  };

  const saveTelegramMutation = useSetBulkConfig({
    onSuccess: () => {
      stepper.completeStep(3);
      stepper.goForward();
    },
    onError: (error) => {
      toast.error(`Failed to save Telegram settings: ${error.message}`);
    },
  });

  const fetchChatIdMutation = useFetchChatId({
    onSuccess: (data) => {
      setTelegramChatId(data.chatId);
      toast.success(`Chat ID fetched: ${data.chatId}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleTelegramContinue = () => {
    const hasToken = telegramBotToken.trim();
    const hasChatId = telegramChatId.trim();

    if (hasToken || hasChatId) {
      saveTelegramMutation.mutate({
        entries: [
          { key: "telegram_bot_token", value: telegramBotToken },
          { key: "telegram_chat_id", value: telegramChatId },
        ],
      });
    } else {
      stepper.goForward();
    }
  };

  const [isCreatingAccounts, setIsCreatingAccounts] = useState(false);

  const handleAddHandles = async () => {
    const handles = parseHandles(handlesInput);
    if (handles.length === 0) return;

    const existingHandles = new Set((existingAccounts ?? []).map((a) => a.handle.toLowerCase()));
    const newHandles = handles.filter((h) => !existingHandles.has(h.toLowerCase()));

    for (const h of newHandles) {
      await createAccountMutation.mutateAsync({ handle: h });
    }

    setHandlesInput("");
  };

  const handleCompleteSetup = async () => {
    if (!validateStep4()) return;

    setIsCreatingAccounts(true);
    try {
      const handles = parseHandles(handlesInput);
      if (handles.length > 0) {
        const existingHandles = new Set(
          (existingAccounts ?? []).map((a) => a.handle.toLowerCase()),
        );
        const newHandles = handles.filter((h) => !existingHandles.has(h.toLowerCase()));

        for (const h of newHandles) {
          await createAccountMutation.mutateAsync({ handle: h });
        }
      }

      toast.success("Setup complete!");
      queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
      router.push("/");
    } finally {
      setIsCreatingAccounts(false);
    }
  };

  const step = stepper.currentStep;

  // ─── Step form content (fields) and actions (buttons) ──────────────
  let formContent: React.ReactNode = null;
  let formActions: React.ReactNode = null;

  if (step === 1) {
    formContent = (
      <div className="space-y-4">
        <CookieInstructions />

        <Field>
          <FieldLabel htmlFor="setup-auth-token">auth_token cookie</FieldLabel>
          <PasswordInput
            id="setup-auth-token"
            value={authToken}
            onChange={(e) => {
              setAuthToken(e.target.value);
              if (verifiedUser) setVerifiedUser(null);
            }}
            placeholder="From twitter.com cookies"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="setup-ct0">ct0 cookie</FieldLabel>
          <PasswordInput
            id="setup-ct0"
            value={ct0}
            onChange={(e) => {
              setCt0(e.target.value);
              if (verifiedUser) setVerifiedUser(null);
            }}
            placeholder="From twitter.com cookies"
          />
        </Field>

        <Button
          type="button"
          variant="outline"
          onClick={handleSaveAndVerify}
          disabled={!authToken.trim() || !ct0.trim() || isVerifying}
          className="w-full"
        >
          {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isVerifying ? "Verifying..." : "Save & Verify"}
        </Button>

        {verifiedUser && (
          <div className="flex items-center gap-3 border border-border bg-muted/50 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-muted">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">{verifiedUser.name}</p>
              <p className="text-muted-foreground text-xs">@{verifiedUser.username}</p>
            </div>
          </div>
        )}
      </div>
    );

    formActions = (
      <Button
        onClick={() => {
          stepper.completeStep(1);
          stepper.goForward();
        }}
        disabled={!verifiedUser}
        className="w-full"
      >
        Continue
      </Button>
    );
  } else if (step === 2) {
    formContent = (
      <div className="space-y-4">
        <ProviderSelector
          provider={provider}
          onProviderChange={handleProviderChange}
          openaiApiKey={openaiApiKey}
          onOpenaiApiKeyChange={setOpenaiApiKey}
          openaiApiKeyPlaceholder={aiConfig?.openaiApiKey || "sk-..."}
          openrouterApiKey={openrouterApiKey}
          onOpenrouterApiKeyChange={setOpenrouterApiKey}
          openrouterApiKeyPlaceholder={aiConfig?.openrouterApiKey || "sk-or-..."}
          ollamaBaseUrl={ollamaBaseUrl}
          onOllamaBaseUrlChange={setOllamaBaseUrl}
          ollamaDetected={ollamaStatus?.available || false}
        />

        <ModelSelector
          provider={provider}
          apiKey={
            provider === "openai" && openaiApiKey
              ? openaiApiKey
              : provider === "openrouter" && openrouterApiKey
                ? openrouterApiKey
                : undefined
          }
          hasStoredApiKey={hasStoredApiKey}
          baseUrl={provider === "ollama" ? ollamaBaseUrl : undefined}
          chatModel={chatModel}
          embeddingModel={embeddingModel}
          onChatModelChange={handleChatModelChange}
          onEmbeddingModelChange={handleEmbeddingModelChange}
        />
      </div>
    );

    formActions = (
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={stepper.goBack}
          disabled={setConfigMutation.isPending}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleAIConfigContinue}
          disabled={!chatModel || !embeddingModel || setConfigMutation.isPending}
          className="flex-1"
        >
          {setConfigMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </div>
    );
  } else if (step === 3) {
    formContent = (
      <div className="space-y-4">
        <FieldDescription className="text-muted-foreground">
          Optional — configure to receive notifications via Telegram
        </FieldDescription>

        <details className="text-muted-foreground text-sm">
          <summary className="mb-2 cursor-pointer hover:text-foreground">
            How to set up Telegram notifications
          </summary>
          <div className="ml-1 space-y-3 border-muted border-l-2 pl-2">
            <div>
              <p className="font-medium text-foreground">1. Create a bot</p>
              <ol className="mt-1 list-inside list-decimal space-y-1">
                <li>
                  Open Telegram and search for <span className="font-mono">@BotFather</span>
                </li>
                <li>
                  Send <span className="font-mono">/newbot</span> and follow the prompts
                </li>
                <li>Copy the token it gives you and paste it below</li>
              </ol>
            </div>
            <div>
              <p className="font-medium text-foreground">2. Connect your chat</p>
              <ol className="mt-1 list-inside list-decimal space-y-1">
                <li>Search for your new bot in Telegram and send it any message</li>
                <li>
                  Click <span className="font-medium">Fetch Chat ID</span> below
                </li>
              </ol>
            </div>
          </div>
        </details>

        <Field>
          <FieldLabel htmlFor="setup-telegram-bot-token">Bot Token</FieldLabel>
          <PasswordInput
            id="setup-telegram-bot-token"
            value={telegramBotToken}
            onChange={(e) => setTelegramBotToken(e.target.value)}
            placeholder="From @BotFather (e.g. 123456:ABC-xyz)"
          />
        </Field>

        <Field>
          <FieldLabel>Chat ID</FieldLabel>
          {telegramChatId ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{telegramChatId}</span>
              <button
                type="button"
                onClick={() => setTelegramChatId("")}
                className="text-muted-foreground text-xs hover:text-foreground"
              >
                clear
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchChatIdMutation.mutate()}
              disabled={fetchChatIdMutation.isPending || !telegramBotToken.trim()}
              className="w-full"
            >
              {fetchChatIdMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Fetch Chat ID
            </Button>
          )}
        </Field>
      </div>
    );

    formActions = (
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={stepper.goBack}
          disabled={saveTelegramMutation.isPending}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleTelegramContinue}
          disabled={saveTelegramMutation.isPending}
          className="flex-1"
        >
          {saveTelegramMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </div>
    );
  } else if (step === 4) {
    const accounts = existingAccounts ?? [];

    formContent = (
      <div className="space-y-4">
        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <Badge key={a.id} variant="secondary" className="gap-1 pr-1">
                @{a.handle}
                <button
                  type="button"
                  onClick={() => deleteAccountMutation.mutate({ id: a.id })}
                  disabled={deleteAccountMutation.isPending}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="twitter-handles">Twitter Handles</FieldLabel>
          <FieldDescription>Comma-separated, e.g. elonmusk, naval, sama</FieldDescription>
          <div className="flex gap-2">
            <Input
              id="twitter-handles"
              type="text"
              value={handlesInput}
              onChange={(e) => {
                setHandlesInput(e.target.value);
                clearFieldError("handle");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddHandles();
                }
              }}
              placeholder="@username, @another, ..."
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddHandles}
              disabled={createAccountMutation.isPending || !handlesInput.trim()}
            >
              {createAccountMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add"
              )}
            </Button>
          </div>
          {fieldErrors.handle && <p className="text-destructive text-sm">{fieldErrors.handle}</p>}
        </Field>
      </div>
    );

    formActions = (
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={stepper.goBack}
          disabled={isCreatingAccounts}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleCompleteSetup} disabled={isCreatingAccounts} className="flex-1">
          {isCreatingAccounts && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Complete Setup
        </Button>
      </div>
    );
  }

  // ─── Layout ────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="flex min-h-[min(85vh,700px)] w-full max-w-5xl border border-border bg-card">
        {/* Left: Image panel */}
        <div className="relative hidden w-[45%] border-border border-r md:block">
          <StepImage step={step} className="absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <div key={step} className="fade-in slide-in-from-bottom-2 animate-in duration-500">
              <span className="text-white/50 text-xs uppercase tracking-widest">
                {String(step).padStart(2, "0")} / 04
              </span>
              <h2 className="mt-1 font-bold text-white text-xl">{STEP_LABELS[step - 1]}</h2>
              <p className="mt-0.5 text-sm text-white/50">{STEP_DESCRIPTIONS[step - 1]}</p>
            </div>
            {/* Progress segments */}
            <div className="mt-4 flex gap-1">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-0.5 flex-1 transition-all duration-500",
                    s < step ? "bg-primary" : s === step ? "bg-white" : "bg-white/15",
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Form panel */}
        <div className="flex flex-1 flex-col">
          {/* Mobile image */}
          <div className="relative h-36 border-border border-b md:hidden">
            <StepImage step={step} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card" />
          </div>

          <div className="flex flex-1 flex-col p-6 md:p-10">
            <div className="mb-6">
              <span className="text-muted-foreground text-xs">step {step} of 4</span>
              <h1 className="mt-1 font-bold text-xl tracking-tight">{STEP_LABELS[step - 1]}</h1>
              <p className="mt-0.5 text-muted-foreground text-sm">{STEP_DESCRIPTIONS[step - 1]}</p>
            </div>
            <AnimatedStep step={step} direction={stepper.direction}>
              {formContent}
            </AnimatedStep>
            <div className="mt-auto pt-6">{formActions}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
