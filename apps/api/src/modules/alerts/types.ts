import type { AlertChannelType, AlertDeliveryStatus } from "@prisma/client";

export type AlertProvider = "TELEGRAM" | "DISCORD" | "EMAIL" | "BROWSER";

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface DiscordConfig {
  webhookUrl: string;
}

export type AlertSecretConfig = TelegramConfig | DiscordConfig;

export interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  url?: string;
  thumbnail?: { url: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
}

export interface AlertProviderMessage {
  text: string;
  discordEmbed?: DiscordEmbed;
}

export interface AlertChannelView {
  id: string;
  provider: AlertProvider;
  name: string;
  enabled: boolean;
  configured: boolean;
  maskedConfig: string;
  lastTestStatus: AlertDeliveryStatus | null;
  lastTestAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertMessageInput {
  heading: string;
  productName?: string;
  storeName?: string;
  priceCents?: number | null;
  msrpCents?: number | null;
  acceptedMaxPriceCents?: number | null;
  stockStatus?: string;
  priceStatus?: string;
  productUrl?: string;
  fallbackMessage: string;
}

export interface AlertProviderClient {
  type: AlertChannelType;
  send(config: AlertSecretConfig, message: AlertProviderMessage): Promise<void>;
}

export class AlertDeliveryError extends Error {
  constructor(public readonly status: AlertDeliveryStatus, message: string) {
    super(message);
  }
}
