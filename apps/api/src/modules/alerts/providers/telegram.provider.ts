import type { AlertProviderClient, AlertProviderMessage, AlertSecretConfig, TelegramConfig } from "../types.js";

function isTelegramConfig(config: AlertSecretConfig): config is TelegramConfig {
  return "botToken" in config && "chatId" in config;
}

export class TelegramProvider implements AlertProviderClient {
  readonly type = "TELEGRAM" as const;

  async send(config: AlertSecretConfig, message: AlertProviderMessage): Promise<void> {
    if (!isTelegramConfig(config)) {
      throw new Error("Telegram channel configuration is incomplete.");
    }

    const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(config.botToken)}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: config.chatId, text: message.text, disable_web_page_preview: false })
    });

    if (!response.ok) {
      throw new Error(`Telegram rejected the alert (HTTP ${response.status}). Check the bot token and chat ID.`);
    }
  }
}
