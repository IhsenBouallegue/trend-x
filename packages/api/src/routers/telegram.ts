import { db } from "@trend-x/db";
import { config } from "@trend-x/db/schema";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import { getTelegramConfig, sendTelegramMessage } from "../services/telegram";

export const telegramRouter = router({
  /**
   * Send a test message to verify Telegram setup.
   */
  sendTestMessage: publicProcedure.mutation(async () => {
    // Load Telegram config
    const telegramConfig = await getTelegramConfig();

    if (!telegramConfig) {
      throw new Error("Telegram not configured. Add your bot token and chat ID in Settings.");
    }

    // Send test message
    const testMessage =
      "<b>TrendX Test</b>\n\nYour Telegram notifications are working! You will receive alerts here when behavioral changes are detected in your monitored accounts.";

    try {
      await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, testMessage);

      return {
        success: true,
        message: "Test message sent successfully",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(
        `Failed to send test message: ${errorMessage}. Check your bot token and chat ID.`,
      );
    }
  }),

  /**
   * Toggle Telegram notifications on/off.
   */
  toggleEnabled: publicProcedure
    .input(
      z.object({
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const now = Math.floor(Date.now() / 1000);

      await db
        .insert(config)
        .values({
          key: "telegram_enabled",
          value: input.enabled ? "true" : "false",
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: config.key,
          set: {
            value: input.enabled ? "true" : "false",
            updatedAt: now,
          },
        });

      return { enabled: input.enabled };
    }),

  /**
   * Fetch chat ID by calling getUpdates on the bot.
   * User must send a message to the bot first.
   */
  fetchChatId: publicProcedure.mutation(async () => {
    const allConfigs = await db.select({ key: config.key, value: config.value }).from(config);
    const configMap = new Map(allConfigs.map((r) => [r.key, r.value]));
    const botToken = configMap.get("telegram_bot_token");

    if (!botToken || botToken.trim() === "") {
      throw new Error("Save your bot token first.");
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { description?: string };
      throw new Error(body.description ?? `Telegram API error ${res.status}`);
    }

    const data = (await res.json()) as {
      ok: boolean;
      result: Array<{ message?: { chat?: { id?: number } } }>;
    };

    if (!data.ok || !data.result?.length) {
      throw new Error(
        "No messages found. Send a message to your bot in Telegram first, then try again.",
      );
    }

    // Take the most recent update's chat ID
    const lastUpdate = data.result[data.result.length - 1];
    const chatId = lastUpdate.message?.chat?.id;

    if (!chatId) {
      throw new Error("Could not find a chat ID. Send a text message to your bot and try again.");
    }

    // Auto-save the chat ID to config
    const now = Math.floor(Date.now() / 1000);
    await db
      .insert(config)
      .values({ key: "telegram_chat_id", value: String(chatId), updatedAt: now })
      .onConflictDoUpdate({
        target: config.key,
        set: { value: String(chatId), updatedAt: now },
      });

    return { chatId: String(chatId) };
  }),

  /**
   * Get current Telegram configuration status.
   */
  getStatus: publicProcedure.query(async () => {
    const allConfigs = await db.select({ key: config.key, value: config.value }).from(config);
    const configMap = new Map(allConfigs.map((r) => [r.key, r.value]));

    const botToken = configMap.get("telegram_bot_token");
    const chatId = configMap.get("telegram_chat_id");
    const enabledStr = configMap.get("telegram_enabled");

    const configured = !!botToken && botToken.trim() !== "" && !!chatId && chatId.trim() !== "";
    const enabled = enabledStr === "true";

    return {
      configured,
      enabled,
    };
  }),
});
