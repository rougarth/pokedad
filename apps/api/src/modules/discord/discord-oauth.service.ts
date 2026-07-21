import { randomBytes, timingSafeEqual } from "node:crypto";
import type { AlertChannel, Prisma, PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";
import { SecretsService, type EncryptedValue } from "../../security/secrets.service.js";
import { AuditService } from "../../services/audit.service.js";
import { AlertDeliveryService } from "../alerts/alert-delivery.service.js";

const METADATA_KEY = "discordOAuthConnection";
const STATE_TTL_MS = 10 * 60 * 1000;

interface DiscordMetadata {
  alertChannelId: string;
  guildId: string | null;
  channelId: string;
  webhookName: string | null;
  connectedAt: string;
}

export interface DiscordStatus {
  configured: boolean;
  connected: boolean;
  guildId: string | null;
  guildName: string | null;
  channelId: string | null;
  channelName: string | null;
  webhookName: string | null;
  maskedConfig: string;
  lastTestStatus: string | null;
  lastTestAt: string | null;
  lastError: string | null;
}

function oauthConfigured(): boolean {
  return Boolean(env.DISCORD_CLIENT_ID.trim() && env.DISCORD_CLIENT_SECRET.trim() && env.DISCORD_REDIRECT_URI.trim());
}

function safeName(name?: string | null): string {
  const cleaned = name?.replace(/[\r\n\t]/g, " ").trim().slice(0, 60);
  return cleaned || "Connected Discord channel";
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeDiscordWebhookUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const allowedHost = ["discord.com", "canary.discord.com", "ptb.discord.com", "discordapp.com"].includes(url.hostname);
    return url.protocol === "https:" && allowedHost && /^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(url.pathname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function encryptedValue(secret: { keyVersion: string; ivBase64: string; authTagBase64: string; cipherTextBase64: string }): EncryptedValue {
  return {
    keyVersion: secret.keyVersion,
    ivBase64: secret.ivBase64,
    authTagBase64: secret.authTagBase64,
    cipherTextBase64: secret.cipherTextBase64
  };
}

export class DiscordOAuthService {
  private readonly audit: AuditService;
  private readonly alerts: AlertDeliveryService;
  private readonly secrets = new SecretsService();

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
    this.alerts = new AlertDeliveryService(prisma);
  }

  isConfigured(): boolean {
    return oauthConfigured();
  }

  async createAuthorization(ownerId: string): Promise<{ authorizationUrl: string; cookieValue: string }> {
    if (!oauthConfigured()) {
      await this.audit.log({ action: "DISCORD_OAUTH_CONFIG_MISSING", summary: "Discord OAuth connection requested before local OAuth configuration was complete.", actorUserId: ownerId });
      throw new Error("Discord OAuth is not configured. Add DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DISCORD_REDIRECT_URI.");
    }
    const state = randomBytes(32).toString("base64url");
    const cookieValue = Buffer.from(JSON.stringify({ state, ownerId, expiresAt: Date.now() + STATE_TTL_MS }), "utf8").toString("base64url");
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
    url.searchParams.set("scope", "webhook.incoming");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", env.DISCORD_REDIRECT_URI);
    url.searchParams.set("prompt", "consent");
    await this.audit.log({ action: "DISCORD_OAUTH_STARTED", summary: "Discord OAuth webhook connection started.", actorUserId: ownerId, metadata: { scope: "webhook.incoming", expiresInSeconds: STATE_TTL_MS / 1000 } });
    return { authorizationUrl: url.toString(), cookieValue };
  }

  validateState(cookieValue: string | undefined, returnedState: string | undefined, ownerId: string): boolean {
    if (!cookieValue || !returnedState) return false;
    try {
      const parsed = JSON.parse(Buffer.from(cookieValue, "base64url").toString("utf8")) as { state?: string; ownerId?: string; expiresAt?: number };
      if (!parsed.state || parsed.ownerId !== ownerId || typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()) return false;
      const expected = Buffer.from(parsed.state);
      const actual = Buffer.from(returnedState);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  async connect(ownerId: string, code: string): Promise<DiscordStatus> {
    if (!oauthConfigured()) throw new Error("Discord OAuth is not configured.");
    try {
      const response = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${env.DISCORD_CLIENT_ID}:${env.DISCORD_CLIENT_SECRET}`, "utf8").toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: env.DISCORD_REDIRECT_URI })
      });
      if (!response.ok) throw new Error(`Discord OAuth token exchange failed (HTTP ${response.status}).`);
      const payload = await response.json() as Record<string, unknown>;
      const webhook = payload.webhook && typeof payload.webhook === "object" && !Array.isArray(payload.webhook) ? payload.webhook as Record<string, unknown> : null;
      if (!webhook) throw new Error("Discord OAuth response did not include an incoming webhook.");
      const webhookId = optionalString(webhook.id);
      const webhookToken = optionalString(webhook.token);
      const channelId = optionalString(webhook.channel_id);
      const returnedUrl = safeDiscordWebhookUrl(webhook.url);
      const webhookUrl = returnedUrl ?? (webhookId && webhookToken ? `https://discord.com/api/webhooks/${encodeURIComponent(webhookId)}/${encodeURIComponent(webhookToken)}` : null);
      if (!webhookId || !channelId || !webhookUrl) throw new Error("Discord OAuth returned incomplete webhook configuration.");
      const current = await this.getMetadata(ownerId);
      let channel = current ? await this.alerts.getChannel(ownerId, current.alertChannelId) : null;
      if (channel?.provider === "DISCORD") {
        channel = await this.alerts.updateChannel(ownerId, channel.id, { name: `Discord: ${safeName(optionalString(webhook.name))}`, enabled: true, config: { webhookUrl } });
      } else {
        channel = await this.alerts.createChannel(ownerId, { provider: "DISCORD", name: `Discord: ${safeName(optionalString(webhook.name))}`, enabled: true, config: { webhookUrl } });
      }
      if (!channel) throw new Error("Discord alert channel could not be saved.");
      const metadata: DiscordMetadata = {
        alertChannelId: channel.id,
        guildId: optionalString(webhook.guild_id),
        channelId,
        webhookName: optionalString(webhook.name),
        connectedAt: new Date().toISOString()
      };
      await this.prisma.appSetting.upsert({
        where: { ownerId_key: { ownerId, key: METADATA_KEY } },
        create: { ownerId, key: METADATA_KEY, value: metadata as unknown as Prisma.InputJsonValue },
        update: { value: metadata as unknown as Prisma.InputJsonValue }
      });
      await this.audit.log({ action: "DISCORD_OAUTH_WEBHOOK_STORED_ENCRYPTED", summary: "Discord OAuth webhook stored through encrypted alert configuration.", actorUserId: ownerId, metadata: { alertChannelId: channel.id, guildId: metadata.guildId, channelId: metadata.channelId } });
      await this.audit.log({ action: "DISCORD_OAUTH_CALLBACK_SUCCEEDED", summary: "Discord OAuth webhook connection completed.", actorUserId: ownerId, metadata: { alertChannelId: channel.id, guildId: metadata.guildId, channelId: metadata.channelId } });
      return this.getStatus(ownerId);
    } catch (error) {
      await this.audit.log({ action: "DISCORD_OAUTH_CALLBACK_FAILED", summary: "Discord OAuth callback failed safely.", actorUserId: ownerId, metadata: { error: this.sanitizeError(error) } });
      throw new Error(this.sanitizeError(error));
    }
  }

  async getStatus(ownerId: string): Promise<DiscordStatus> {
    const metadata = await this.getMetadata(ownerId);
    const channel = metadata ? await this.alerts.getChannel(ownerId, metadata.alertChannelId) : null;
    return {
      configured: oauthConfigured(),
      connected: Boolean(metadata && channel?.configured),
      guildId: metadata?.guildId ?? null,
      guildName: null,
      channelId: metadata?.channelId ?? null,
      channelName: null,
      webhookName: metadata?.webhookName ?? null,
      maskedConfig: channel?.maskedConfig ?? "Not configured",
      lastTestStatus: channel?.lastTestStatus ?? null,
      lastTestAt: channel?.lastTestAt ?? null,
      lastError: channel?.lastError ?? null
    };
  }

  async test(ownerId: string) {
    const metadata = await this.getMetadata(ownerId);
    if (!metadata) throw new Error("Discord is not connected.");
    try {
      const result = await this.alerts.testChannel(ownerId, metadata.alertChannelId);
      const status = result.deliveries[0]?.status ?? "FAILED";
      await this.audit.log({ action: status === "SENT" ? "DISCORD_OAUTH_TEST_SENT" : "DISCORD_OAUTH_TEST_FAILED", summary: status === "SENT" ? "Discord OAuth channel test sent." : "Discord OAuth channel test failed safely.", actorUserId: ownerId, metadata: { alertChannelId: metadata.alertChannelId, status } });
      return result;
    } catch (error) {
      await this.audit.log({ action: "DISCORD_OAUTH_TEST_FAILED", summary: "Discord OAuth channel test failed safely.", actorUserId: ownerId, metadata: { alertChannelId: metadata.alertChannelId, error: this.sanitizeError(error) } });
      throw new Error(this.sanitizeError(error));
    }
  }

  async disconnect(ownerId: string): Promise<void> {
    const metadata = await this.getMetadata(ownerId);
    if (!metadata) return;
    const channel = await this.prisma.alertChannel.findFirst({ where: { id: metadata.alertChannelId, ownerId }, include: { encryptedSecret: true } });
    if (channel?.encryptedSecret) await this.deleteRemoteWebhook(channel).catch(() => undefined);
    if (channel) await this.alerts.deleteChannel(ownerId, channel.id);
    await this.prisma.appSetting.delete({ where: { ownerId_key: { ownerId, key: METADATA_KEY } } }).catch(() => undefined);
    await this.audit.log({ action: "DISCORD_OAUTH_DISCONNECTED", summary: "Discord OAuth alert channel disconnected and its encrypted secret removed.", actorUserId: ownerId, metadata: { alertChannelId: metadata.alertChannelId, remoteWebhookDeleteAttempted: Boolean(channel?.encryptedSecret) } });
  }

  async logInvalidState(ownerId: string): Promise<void> {
    await this.audit.log({ action: "DISCORD_OAUTH_INVALID_STATE", summary: "Discord OAuth callback rejected because state was missing, invalid, or expired.", actorUserId: ownerId });
  }

  async logCallbackDenied(ownerId: string): Promise<void> {
    await this.audit.log({ action: "DISCORD_OAUTH_CALLBACK_FAILED", summary: "Discord OAuth authorization was denied or did not return a code.", actorUserId: ownerId });
  }

  private async getMetadata(ownerId: string): Promise<DiscordMetadata | null> {
    const setting = await this.prisma.appSetting.findUnique({ where: { ownerId_key: { ownerId, key: METADATA_KEY } } });
    if (!setting?.value || typeof setting.value !== "object" || Array.isArray(setting.value)) return null;
    const value = setting.value as Record<string, unknown>;
    if (typeof value.alertChannelId !== "string" || typeof value.channelId !== "string") return null;
    return {
      alertChannelId: value.alertChannelId,
      guildId: typeof value.guildId === "string" ? value.guildId : null,
      channelId: value.channelId,
      webhookName: typeof value.webhookName === "string" ? value.webhookName : null,
      connectedAt: typeof value.connectedAt === "string" ? value.connectedAt : ""
    };
  }

  private async deleteRemoteWebhook(channel: AlertChannel & { encryptedSecret: { keyVersion: string; ivBase64: string; authTagBase64: string; cipherTextBase64: string } | null }): Promise<void> {
    if (!channel.encryptedSecret) return;
    const config = JSON.parse(this.secrets.decrypt(encryptedValue(channel.encryptedSecret))) as { webhookUrl?: string };
    if (!config.webhookUrl?.startsWith("https://discord.com/api/webhooks/")) return;
    const response = await fetch(config.webhookUrl, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new Error("Discord remote webhook could not be removed.");
  }

  private sanitizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : "Discord OAuth request failed.";
    return message.replace(/https?:\/\/\S+/gi, "[REDACTED_URL]").replace(/[A-Za-z0-9_-]{30,}/g, "[REDACTED]").slice(0, 240);
  }
}
