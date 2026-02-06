import { db } from "@trend-x/db";
import { account, changeDetectionRun, config, detectedChange } from "@trend-x/db/schema";
import { eq } from "drizzle-orm";
import { backOff } from "exponential-backoff";

interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

/**
 * Load Telegram configuration from the config table.
 * Returns null if credentials are missing or empty.
 */
export async function getTelegramConfig(): Promise<TelegramConfig | null> {
  // Fetch all configs and filter in memory (simpler than complex WHERE)
  const allConfigs = await db.select({ key: config.key, value: config.value }).from(config);

  const configMap = new Map(allConfigs.map((r) => [r.key, r.value]));

  const botToken = configMap.get("telegram_bot_token");
  const chatId = configMap.get("telegram_chat_id");
  const enabledStr = configMap.get("telegram_enabled");

  // Return null if credentials are missing or empty
  if (!botToken || botToken.trim() === "" || !chatId || chatId.trim() === "") {
    return null;
  }

  // Default to disabled (opt-in model) if key doesn't exist
  const enabled = enabledStr === "true";

  return {
    botToken: botToken.trim(),
    chatId: chatId.trim(),
    enabled,
  };
}

/**
 * Escapes HTML characters for Telegram HTML parse mode.
 * Critical: unescaped user content will cause "can't parse entities" errors.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Format a Telegram message for one account's detected changes.
 */
export function formatAccountChanges(
  accountHandle: string,
  changes: Array<{ type: string; dimension: string; explanation: string }>,
  dashboardUrl: string,
): string {
  // Emoji map for change types
  const emojiMap: Record<string, string> = {
    topic_new: "💡",
    topic_drop: "🔻",
    sentiment_shift: "🎭",
    activity_spike: "📈",
    activity_drop: "📉",
    silence: "🔇",
  };

  // Header: bold account name with @ prefix if not already present
  const handle = accountHandle.startsWith("@") ? accountHandle : `@${accountHandle}`;
  let message = `<b>${escapeHtml(handle)}</b>\n\n`;

  // Format each change with emoji + dimension + explanation
  for (const change of changes) {
    const emoji = emojiMap[change.type] || "•";
    message += `${emoji} <b>${escapeHtml(change.dimension)}</b>\n`;
    message += `<i>${escapeHtml(change.explanation)}</i>\n\n`;
  }

  // Footer: dashboard link with web preview disabled
  message += `<a href="${escapeHtml(dashboardUrl)}">View details in dashboard</a>`;

  return message;
}

/**
 * Truncate message if it exceeds safe limit (3900 chars).
 */
export function truncateMessage(text: string, dashboardUrl: string): string {
  const MAX_LENGTH = 3900;

  if (text.length <= MAX_LENGTH) {
    return text;
  }

  // Find last newline before the limit
  const truncateAt = text.lastIndexOf("\n", MAX_LENGTH);
  const cutPoint = truncateAt > 0 ? truncateAt : MAX_LENGTH;

  const truncated = text.substring(0, cutPoint);
  return `${truncated}\n\n... (message truncated)\n<a href="${escapeHtml(dashboardUrl)}">View full details</a>`;
}

/**
 * Send a single Telegram message using the Bot API with retry logic.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  await backOff(
    async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as {
          ok: boolean;
          description?: string;
        };
        const description = errorData.description || "Unknown error";

        // Throw error for retry logic to handle
        const error = new Error(
          `Telegram API error (${response.status}): ${description}`,
        ) as Error & { status: number };
        error.status = response.status;
        throw error;
      }

      return response.json();
    },
    {
      numOfAttempts: 3,
      startingDelay: 1000,
      timeMultiple: 2,
      maxDelay: 60000,
      jitter: "full",
      retry: (error: any) => {
        // Retry on rate limits (429) and server errors (5xx)
        if (error.status === 429) return true;
        if (error.status >= 500 && error.status < 600) return true;

        // Don't retry on client errors (400, 401, 403)
        if (error.status === 400) return false; // Bad request (formatting error)
        if (error.status === 401 || error.status === 403) return false; // Auth failure

        // Default: retry
        return true;
      },
    },
  );
}

/**
 * Send notifications for all changes detected in a given run.
 * Main entry point called after detection.
 */
export async function sendNotificationsForRun(
  runId: string,
  dashboardBaseUrl: string,
): Promise<{ sent: number; skipped: number; errors: number }> {
  const stats = { sent: 0, skipped: 0, errors: 0 };

  try {
    // Load Telegram config
    const telegramConfig = await getTelegramConfig();

    // Silent skip if not configured or not enabled
    if (!telegramConfig || !telegramConfig.enabled) {
      stats.skipped = 1;
      return stats;
    }

    // Query detected changes for this run, joined with account
    const changes = await db
      .select({
        accountId: changeDetectionRun.accountId,
        accountHandle: account.handle,
        changeType: detectedChange.type,
        changeDimension: detectedChange.dimension,
        changeExplanation: detectedChange.explanation,
      })
      .from(detectedChange)
      .innerJoin(changeDetectionRun, eq(detectedChange.runId, changeDetectionRun.id))
      .innerJoin(account, eq(changeDetectionRun.accountId, account.id))
      .where(eq(detectedChange.runId, runId));

    if (changes.length === 0) {
      stats.skipped = 1;
      return stats;
    }

    // Group changes by accountId
    const accountGroups = new Map<
      string,
      {
        handle: string;
        changes: Array<{ type: string; dimension: string; explanation: string }>;
      }
    >();

    for (const change of changes) {
      if (!accountGroups.has(change.accountId)) {
        accountGroups.set(change.accountId, {
          handle: change.accountHandle,
          changes: [],
        });
      }
      accountGroups.get(change.accountId)!.changes.push({
        type: change.changeType,
        dimension: change.changeDimension,
        explanation: change.changeExplanation,
      });
    }

    // Send one message per account
    for (const [accountId, group] of accountGroups.entries()) {
      try {
        const dashboardUrl = `${dashboardBaseUrl}/account/${accountId}`;
        let message = formatAccountChanges(group.handle, group.changes, dashboardUrl);
        message = truncateMessage(message, dashboardUrl);

        await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, message);

        stats.sent++;
      } catch (error) {
        console.error(`Failed to send Telegram notification for account ${accountId}:`, error);
        stats.errors++;
      }
    }

    return stats;
  } catch (error) {
    console.error("Error in sendNotificationsForRun:", error);
    stats.errors++;
    return stats;
  }
}
