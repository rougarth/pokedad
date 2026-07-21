import { randomUUID } from "node:crypto";
import type { AlertChannel, AlertChannelType, AlertDeliveryStatus, PrismaClient } from "@prisma/client";
import { SecretsService, type EncryptedValue } from "../../security/secrets.service.js";
import { AuditService } from "../../services/audit.service.js";
import { AlertTemplateService } from "./alert-template.service.js";
import { DiscordProvider } from "./providers/discord.provider.js";
import { TelegramProvider } from "./providers/telegram.provider.js";
import type { AlertChannelView, AlertProvider, AlertProviderClient, AlertProviderMessage, AlertSecretConfig } from "./types.js";

const providers = new Map<AlertChannelType, AlertProviderClient>([
  ["TELEGRAM", new TelegramProvider()],
  ["DISCORD_WEBHOOK", new DiscordProvider()]
]);

function channelType(provider: AlertProvider): AlertChannelType {
  if (provider === "TELEGRAM") return "TELEGRAM";
  if (provider === "DISCORD") return "DISCORD_WEBHOOK";
  if (provider === "EMAIL") return "EMAIL";
  return "BROWSER";
}

function publicProvider(type: AlertChannelType): AlertProvider {
  return type === "DISCORD_WEBHOOK" ? "DISCORD" : type === "TELEGRAM" ? "TELEGRAM" : type === "EMAIL" ? "EMAIL" : "BROWSER";
}

function mask(type: AlertChannelType, configured: boolean): string {
  if (!configured) return "Not configured";
  return type === "TELEGRAM"
    ? "Bot token ****** configured; chat ID ****** configured"
    : type === "DISCORD_WEBHOOK"
      ? "Webhook ****** configured"
      : "Secret ****** configured";
}

function safeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Alert delivery failed.";
  return raw
    .replace(/https?:\/\/\S+/gi, "[REDACTED_URL]")
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[REDACTED]")
    .slice(0, 300);
}

function encryptedData(value: EncryptedValue) {
  return {
    keyVersion: value.keyVersion,
    ivBase64: value.ivBase64,
    authTagBase64: value.authTagBase64,
    cipherTextBase64: value.cipherTextBase64
  };
}

export class AlertDeliveryService {
  private readonly secrets = new SecretsService();
  private readonly audit: AuditService;
  private readonly templates: AlertTemplateService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
    this.templates = new AlertTemplateService(prisma);
  }

  async listChannels(ownerId: string): Promise<AlertChannelView[]> {
    const channels = await this.prisma.alertChannel.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" } });
    return channels.map((channel) => this.toView(channel));
  }

  async getChannel(ownerId: string, id: string): Promise<AlertChannelView | null> {
    const channel = await this.prisma.alertChannel.findFirst({ where: { id, ownerId } });
    return channel ? this.toView(channel) : null;
  }

  async createChannel(ownerId: string, input: { provider: AlertProvider; name: string; enabled: boolean; config: AlertSecretConfig }): Promise<AlertChannelView> {
    const type = channelType(input.provider);
    if (!providers.has(type)) throw new Error("Only Telegram and Discord delivery are supported in Phase 7.");
    const encrypted = this.secrets.encrypt(JSON.stringify(input.config));
    const secretName = `alert_channel_${randomUUID()}`;
    const channel = await this.prisma.$transaction(async (tx) => {
      const secret = await tx.encryptedSecret.create({ data: { ownerId, name: secretName, ...encryptedData(encrypted) } });
      return tx.alertChannel.create({
        data: {
          ownerId,
          type,
          label: input.name,
          enabled: input.enabled,
          encryptedSecretId: secret.id,
          destinationHint: mask(type, true)
        }
      });
    });
    await this.audit.log({ action: "ALERT_CHANNEL_CREATED", summary: `Alert channel ${input.name} created.`, actorUserId: ownerId, metadata: { channelId: channel.id, provider: input.provider, enabled: input.enabled } });
    await this.audit.log({ action: "ALERT_SECRET_STORED_ENCRYPTED", summary: `Encrypted alert configuration stored for ${input.name}.`, actorUserId: ownerId, metadata: { channelId: channel.id, provider: input.provider } });
    return this.toView(channel);
  }

  async updateChannel(ownerId: string, id: string, input: { name?: string; enabled?: boolean; config?: AlertSecretConfig }): Promise<AlertChannelView | null> {
    const current = await this.prisma.alertChannel.findFirst({ where: { id, ownerId } });
    if (!current) return null;
    if (input.config) {
      const encrypted = this.secrets.encrypt(JSON.stringify(input.config));
      if (current.encryptedSecretId) {
        await this.prisma.encryptedSecret.update({ where: { id: current.encryptedSecretId }, data: encryptedData(encrypted) });
      } else {
        const secret = await this.prisma.encryptedSecret.create({ data: { ownerId, name: `alert_channel_${randomUUID()}`, ...encryptedData(encrypted) } });
        await this.prisma.alertChannel.update({ where: { id }, data: { encryptedSecretId: secret.id } });
      }
      await this.audit.log({ action: "ALERT_SECRET_STORED_ENCRYPTED", summary: `Encrypted alert configuration updated for ${input.name ?? current.label}.`, actorUserId: ownerId, metadata: { channelId: id, provider: publicProvider(current.type) } });
    }
    const channel = await this.prisma.alertChannel.update({
      where: { id },
      data: {
        label: input.name,
        enabled: input.enabled,
        destinationHint: input.config ? mask(current.type, true) : undefined,
        lastError: input.config ? null : undefined
      }
    });
    const action = input.enabled === undefined ? "ALERT_CHANNEL_UPDATED" : input.enabled ? "ALERT_CHANNEL_ENABLED" : "ALERT_CHANNEL_DISABLED";
    await this.audit.log({ action, summary: `Alert channel ${channel.label} updated.`, actorUserId: ownerId, metadata: { channelId: id, provider: publicProvider(channel.type), enabled: channel.enabled, secretUpdated: Boolean(input.config) } });
    return this.toView(channel);
  }

  async deleteChannel(ownerId: string, id: string): Promise<boolean> {
    const channel = await this.prisma.alertChannel.findFirst({ where: { id, ownerId } });
    if (!channel) return false;
    await this.prisma.$transaction(async (tx) => {
      await tx.alertChannel.delete({ where: { id } });
      if (channel.encryptedSecretId) await tx.encryptedSecret.delete({ where: { id: channel.encryptedSecretId } }).catch(() => undefined);
    });
    await this.audit.log({ action: "ALERT_CHANNEL_DELETED", summary: `Alert channel ${channel.label} deleted.`, actorUserId: ownerId, metadata: { channelId: id, provider: publicProvider(channel.type) } });
    return true;
  }

  async testChannel(ownerId: string, channelId: string) {
    const event = await this.prisma.alertEvent.create({
      data: {
        ownerId,
        alertChannelId: channelId,
        type: "ACCEPTABLE_PRICE_FOUND",
        templateType: "TEST_ALERT",
        title: "TEST ALERT - PokeDad Radar",
        priority: "NORMAL",
        status: "PENDING",
        message: "This is a private PokeDad Radar test alert. Delivery is read-only and does not perform cart or checkout actions."
      }
    });
    const result = await this.deliverEvent(ownerId, event.id, channelId);
    const outcome = result.deliveries[0];
    const now = new Date();
    await this.prisma.alertChannel.update({ where: { id: channelId }, data: { lastTestAt: now, lastTestStatus: outcome?.status ?? "FAILED", lastError: outcome?.errorSummary ?? null } });
    await this.audit.log({
      action: outcome?.status === "SENT" ? "ALERT_TEST_SENT" : "ALERT_CHANNEL_TEST_FAILED",
      summary: outcome?.status === "SENT" ? "Alert channel test sent." : "Alert channel test failed safely.",
      actorUserId: ownerId,
      metadata: { channelId, status: outcome?.status ?? "FAILED", errorSummary: outcome?.errorSummary }
    });
    return result;
  }

  async deliverEvent(ownerId: string, alertEventId: string, onlyChannelId?: string) {
    const event = await this.prisma.alertEvent.findUnique({
      where: { id: alertEventId },
      include: { alertChannel: true, stockCheckResult: { include: { store: true, retailerProduct: true } } }
    });
    if (!event) throw new Error("Alert event not found.");
    const ownsEvent = event.ownerId === ownerId || event.alertChannel?.ownerId === ownerId || event.stockCheckResult?.store.ownerId === ownerId;
    if (!ownsEvent && !onlyChannelId) throw new Error("Alert event not found.");

    const channels = onlyChannelId
      ? await this.prisma.alertChannel.findMany({ where: { id: onlyChannelId, ownerId } })
      : await this.prisma.alertChannel.findMany({ where: { ownerId, enabled: true, type: { in: ["TELEGRAM", "DISCORD_WEBHOOK"] } } });
    if (channels.length === 0) {
      await this.audit.log({ action: "ALERT_DELIVERY_SUPPRESSED", summary: "Alert delivery suppressed because no enabled configured channels were available.", actorUserId: ownerId, metadata: { alertEventId, status: "CONFIGURATION_NEEDED" } });
      return { alertEventId, deliveries: [] };
    }

    const templateType = event.templateType ?? this.templates.inferTemplateType({
      eventType: event.type,
      priceStatus: event.stockCheckResult?.priceStatus,
      message: event.message
    });
    const message = this.templates.render({
      templateType,
      productName: event.stockCheckResult?.retailerProduct.name,
      storeName: event.stockCheckResult?.store.name,
      priceCents: event.stockCheckResult?.priceCents,
      msrpCents: event.stockCheckResult?.msrpCents,
      acceptedMaxPriceCents: event.stockCheckResult?.acceptedMaxPriceCents,
      stockStatus: event.stockCheckResult?.stockStatus,
      priceStatus: event.stockCheckResult?.priceStatus,
      productUrl: event.stockCheckResult?.retailerProduct.productUrl,
      imageUrl: event.stockCheckResult?.retailerProduct.imageUrl,
      fallbackMessage: event.message,
      test: event.templateType === "TEST_ALERT" || event.templateType === "TEST_RELEASE_REMINDER" || event.title.startsWith("TEST ALERT") || event.title.startsWith("TEST / MOCK") || event.title.startsWith("TEST RELEASE")
    }, await this.templates.getSettings(ownerId));

    await this.prisma.alertEvent.update({
      where: { id: event.id },
      data: { templateType, title: message.title, priority: message.priority }
    });

    const deliveries = [];
    for (const channel of channels) deliveries.push(await this.deliverToChannel(ownerId, event.id, channel, message));
    const sent = deliveries.some((delivery) => delivery.status === "SENT");
    const failed = deliveries.some((delivery) => delivery.status === "FAILED" || delivery.status === "CONFIGURATION_NEEDED");
    await this.prisma.alertEvent.update({ where: { id: event.id }, data: { status: sent ? "SENT" : failed ? "FAILED" : "SUPPRESSED", sentAt: sent ? new Date() : null, error: failed ? "One or more alert deliveries failed. See sanitized delivery status." : null } });
    if (event.stockCheckResultId) await this.prisma.stockCheckResult.update({ where: { id: event.stockCheckResultId }, data: { alertStatus: sent ? "SENT" : failed ? "FAILED" : "SUPPRESSED" } });
    return { alertEventId, deliveries };
  }

  private async deliverToChannel(ownerId: string, alertEventId: string, channel: AlertChannel, message: AlertProviderMessage) {
    let status: AlertDeliveryStatus = "PENDING";
    let errorSummary: string | null = null;
    if (!channel.enabled) {
      status = "CHANNEL_DISABLED";
      errorSummary = "Channel is disabled.";
    } else if (!channel.encryptedSecretId || !providers.has(channel.type)) {
      status = "CONFIGURATION_NEEDED";
      errorSummary = "Channel configuration is missing or unsupported.";
    } else {
      try {
        const secret = await this.prisma.encryptedSecret.findFirst({ where: { id: channel.encryptedSecretId, ownerId } });
        if (!secret) throw new Error("Encrypted channel configuration was not found.");
        const config = JSON.parse(this.secrets.decrypt(secret)) as AlertSecretConfig;
        await providers.get(channel.type)!.send(config, message);
        status = "SENT";
      } catch (error) {
        status = "FAILED";
        errorSummary = safeError(error);
      }
    }
    const delivery = await this.prisma.alertDelivery.create({ data: { alertEventId, alertChannelId: channel.id, provider: channel.type, status, errorSummary, sentAt: status === "SENT" ? new Date() : null } });
    await this.audit.log({
      action: status === "SENT" ? "ALERT_EVENT_DELIVERED" : status === "FAILED" ? "ALERT_DELIVERY_FAILED" : "ALERT_DELIVERY_SUPPRESSED",
      summary: status === "SENT" ? `Alert delivered to ${channel.label}.` : `Alert delivery to ${channel.label} did not send.`,
      actorUserId: ownerId,
      metadata: { alertEventId, deliveryId: delivery.id, channelId: channel.id, provider: publicProvider(channel.type), status, errorSummary }
    });
    return delivery;
  }

  private toView(channel: AlertChannel): AlertChannelView {
    return {
      id: channel.id,
      provider: publicProvider(channel.type),
      name: channel.label,
      enabled: channel.enabled,
      configured: Boolean(channel.encryptedSecretId),
      maskedConfig: mask(channel.type, Boolean(channel.encryptedSecretId)),
      lastTestStatus: channel.lastTestStatus,
      lastTestAt: channel.lastTestAt?.toISOString() ?? null,
      lastError: channel.lastError,
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString()
    };
  }
}
