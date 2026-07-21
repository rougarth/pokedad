import type { AlertProviderClient, AlertProviderMessage, AlertSecretConfig, DiscordConfig } from "../types.js";

function isDiscordConfig(config: AlertSecretConfig): config is DiscordConfig {
  return "webhookUrl" in config;
}

export class DiscordProvider implements AlertProviderClient {
  readonly type = "DISCORD_WEBHOOK" as const;

  async send(config: AlertSecretConfig, message: AlertProviderMessage): Promise<void> {
    if (!isDiscordConfig(config)) {
      throw new Error("Discord channel configuration is incomplete.");
    }

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: message.discordEmbed ? undefined : message.text,
        embeds: message.discordEmbed ? [message.discordEmbed] : undefined,
        allowed_mentions: { parse: [] }
      })
    });

    if (!response.ok) {
      throw new Error(`Discord rejected the alert (HTTP ${response.status}). Check the webhook URL.`);
    }
  }
}
