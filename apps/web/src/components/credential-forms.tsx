"use client";

import { useForm } from "@tanstack/react-form";
import { CheckCircle, Download, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/input";
import {
  useFetchChatId,
  useSendTestMessage,
  useSetBulkConfig,
  useSetTelegramConfig,
  useTelegramStatus,
  useTestTwitterCredentials,
  useToggleTelegramEnabled,
} from "@/hooks/queries";

interface FormProps {
  defaultValues?: Record<string, string>;
  submitText?: string;
  onSuccess?: () => void;
}

export function CookieInstructions() {
  return (
    <details className="text-muted-foreground text-sm">
      <summary className="mb-2 cursor-pointer hover:text-foreground">
        How to get these cookies
      </summary>
      <div className="ml-1 space-y-3 border-muted border-l-2 pl-2">
        <div>
          <p className="font-medium text-foreground">Chrome / Edge</p>
          <ol className="mt-1 list-inside list-decimal space-y-1">
            <li>
              Go to <span className="font-mono">twitter.com</span> (must be logged in)
            </li>
            <li>
              Press <kbd className="bg-muted px-1 py-0.5 text-xs">F12</kbd> to open DevTools
            </li>
            <li>
              Click <span className="font-medium">Application</span> tab
            </li>
            <li>
              In sidebar: <span className="font-medium">Cookies</span> →{" "}
              <span className="font-mono">https://twitter.com</span>
            </li>
            <li>
              Find <span className="font-mono">auth_token</span> and{" "}
              <span className="font-mono">ct0</span>, copy their values
            </li>
          </ol>
        </div>
        <div>
          <p className="font-medium text-foreground">Firefox</p>
          <ol className="mt-1 list-inside list-decimal space-y-1">
            <li>
              Go to <span className="font-mono">twitter.com</span> (must be logged in)
            </li>
            <li>
              Press <kbd className="bg-muted px-1 py-0.5 text-xs">F12</kbd> to open DevTools
            </li>
            <li>
              Click <span className="font-medium">Storage</span> tab
            </li>
            <li>
              In sidebar: <span className="font-medium">Cookies</span> →{" "}
              <span className="font-mono">https://twitter.com</span>
            </li>
            <li>
              Find <span className="font-mono">auth_token</span> and{" "}
              <span className="font-mono">ct0</span>, copy their values
            </li>
          </ol>
        </div>
        <div>
          <p className="font-medium text-foreground">Safari</p>
          <ol className="mt-1 list-inside list-decimal space-y-1">
            <li>Enable Developer menu: Safari → Settings → Advanced → Show Developer menu</li>
            <li>
              Go to <span className="font-mono">twitter.com</span> (must be logged in)
            </li>
            <li>
              Press <kbd className="bg-muted px-1 py-0.5 text-xs">⌘ ⌥ I</kbd> to open DevTools
            </li>
            <li>
              Click <span className="font-medium">Storage</span> tab
            </li>
            <li>
              In sidebar: <span className="font-medium">Cookies</span> →{" "}
              <span className="font-mono">twitter.com</span>
            </li>
            <li>
              Find <span className="font-mono">auth_token</span> and{" "}
              <span className="font-mono">ct0</span>, copy their values
            </li>
          </ol>
        </div>
      </div>
    </details>
  );
}

export function TwitterCredentialsForm({
  defaultValues = {},
  submitText = "Save",
  onSuccess,
}: FormProps) {
  const setBulkMutation = useSetBulkConfig({
    onSuccess: () => {
      toast.success("Twitter credentials saved");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Failed to save credentials: ${error.message}`);
    },
  });

  const testMutation = useTestTwitterCredentials({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Authenticated as ${data.name} (@${data.username})`);
      } else {
        toast.error(`Credentials invalid: ${data.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Test failed: ${error.message}`);
    },
  });

  const form = useForm({
    defaultValues: {
      authToken: defaultValues.twitter_auth_token ?? "",
      ct0: defaultValues.twitter_ct0 ?? "",
    },
    onSubmit: async ({ value }) => {
      if (!value.authToken || !value.ct0) {
        toast.error("Both Twitter cookies are required");
        return;
      }

      await setBulkMutation.mutateAsync({
        entries: [
          { key: "twitter_auth_token", value: value.authToken },
          { key: "twitter_ct0", value: value.ct0 },
        ],
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <CookieInstructions />
      <form.Field name="authToken">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="twitter-auth-token">auth_token cookie</FieldLabel>
            <PasswordInput
              id="twitter-auth-token"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="From twitter.com cookies"
            />
          </Field>
        )}
      </form.Field>

      <form.Field name="ct0">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="twitter-ct0">ct0 cookie</FieldLabel>
            <PasswordInput
              id="twitter-ct0"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="From twitter.com cookies"
            />
          </Field>
        )}
      </form.Field>

      <Button type="submit" disabled={setBulkMutation.isPending} className="w-full">
        {setBulkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitText}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => testMutation.mutate()}
        disabled={testMutation.isPending}
        className="w-full"
      >
        {testMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : testMutation.data?.success ? (
          <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
        ) : testMutation.data && !testMutation.data.success ? (
          <XCircle className="mr-2 h-4 w-4 text-destructive" />
        ) : null}
        Test Credentials
      </Button>
    </form>
  );
}

export function OpenAICredentialsForm({
  defaultValues = {},
  submitText = "Save",
  onSuccess,
}: FormProps) {
  const setBulkMutation = useSetBulkConfig({
    onSuccess: () => {
      toast.success("OpenAI API key saved");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Failed to save API key: ${error.message}`);
    },
  });

  const form = useForm({
    defaultValues: {
      apiKey: defaultValues.openai_api_key ?? "",
    },
    onSubmit: async ({ value }) => {
      if (!value.apiKey) {
        toast.error("OpenAI API key is required");
        return;
      }

      await setBulkMutation.mutateAsync({
        entries: [{ key: "openai_api_key", value: value.apiKey }],
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="apiKey">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="openai-api-key">API Key</FieldLabel>
            <PasswordInput
              id="openai-api-key"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="sk-..."
            />
          </Field>
        )}
      </form.Field>

      <Button type="submit" disabled={setBulkMutation.isPending} className="w-full">
        {setBulkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitText}
      </Button>
    </form>
  );
}

export function TelegramCredentialsForm({
  defaultValues = {},
  submitText = "Save",
  onSuccess,
}: FormProps) {
  const setBulkMutation = useSetTelegramConfig({
    onSuccess: () => {
      toast.success("Telegram settings saved");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Failed to save Telegram settings: ${error.message}`);
    },
  });

  const { data: status, isLoading: statusLoading } = useTelegramStatus();

  const fetchChatIdMutation = useFetchChatId({
    onSuccess: (data) => {
      form.setFieldValue("chatId", data.chatId);
      toast.success(`Chat ID fetched: ${data.chatId}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const testMessageMutation = useSendTestMessage({
    onSuccess: () => {
      toast.success("Test message sent! Check your Telegram.");
    },
    onError: (error) => {
      toast.error(`Failed to send test message: ${error.message}`);
    },
  });

  const toggleEnabledMutation = useToggleTelegramEnabled({
    onSuccess: () => {
      toast.success("Telegram notifications updated");
    },
    onError: (error) => {
      toast.error(`Failed to update Telegram settings: ${error.message}`);
    },
  });

  const form = useForm({
    defaultValues: {
      botToken: defaultValues.telegram_bot_token ?? "",
      chatId: defaultValues.telegram_chat_id ?? "",
    },
    onSubmit: async ({ value }) => {
      await setBulkMutation.mutateAsync({
        entries: [
          { key: "telegram_bot_token", value: value.botToken },
          { key: "telegram_chat_id", value: value.chatId },
        ],
      });
    },
  });

  const handleToggleEnabled = (enabled: boolean) => {
    toggleEnabledMutation.mutate({ enabled });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <div>
        <FieldDescription className="text-muted-foreground">
          Optional - Configure for notifications
        </FieldDescription>
        {!statusLoading && status && (
          <div className="mt-1 text-muted-foreground text-sm">
            {!status.configured && "Not configured - add bot token and chat ID"}
            {status.configured && !status.enabled && "Configured but disabled"}
            {status.configured && status.enabled && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 bg-green-500" />
                Active
              </span>
            )}
          </div>
        )}
      </div>

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
                Send <span className="font-mono">/newbot</span> and follow the prompts to name it
              </li>
              <li>Copy the token it gives you and paste it below, then click Save</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-foreground">2. Connect your chat</p>
            <ol className="mt-1 list-inside list-decimal space-y-1">
              <li>Search for your new bot in Telegram and send it any message</li>
              <li>
                Come back here and click <span className="font-medium">Fetch Chat ID</span> —
                we&apos;ll grab it automatically
              </li>
            </ol>
          </div>
        </div>
      </details>

      <form.Field name="botToken">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="telegram-bot-token">Bot Token</FieldLabel>
            <PasswordInput
              id="telegram-bot-token"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="From @BotFather (e.g. 123456:ABC-xyz)"
            />
          </Field>
        )}
      </form.Field>

      <form.Field name="chatId">
        {(field) => (
          <Field>
            <FieldLabel>Chat ID</FieldLabel>
            {field.state.value ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{field.state.value}</span>
                <button
                  type="button"
                  onClick={() => {
                    field.handleChange("");
                    // Clear from config too so getStatus reflects it
                  }}
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
                disabled={fetchChatIdMutation.isPending}
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
        )}
      </form.Field>

      <Button type="submit" disabled={setBulkMutation.isPending} className="w-full">
        {setBulkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitText}
      </Button>

      {/* Test button and toggle section */}
      {status?.configured && (
        <div className="mt-4 space-y-4 border-muted border-t pt-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <label htmlFor="telegram-enabled" className="font-medium text-sm">
              Enable Telegram notifications
            </label>
            <button
              type="button"
              id="telegram-enabled"
              role="switch"
              aria-checked={status.enabled}
              onClick={() => handleToggleEnabled(!status.enabled)}
              disabled={toggleEnabledMutation.isPending}
              className={`relative inline-flex h-6 w-11 items-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                status.enabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform bg-white transition-transform ${
                  status.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Test Message Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => testMessageMutation.mutate()}
            disabled={testMessageMutation.isPending}
            className="w-full"
          >
            {testMessageMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send Test Message
          </Button>
        </div>
      )}
    </form>
  );
}
