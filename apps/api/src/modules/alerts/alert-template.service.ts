import type { AlertPriority, AlertTemplateType, Prisma, PrismaClient } from "@prisma/client";
import type { AlertProviderMessage, DiscordEmbed } from "./types.js";

const SETTINGS_KEY = "alertTemplateSettings";

export interface AlertTemplateSettings {
  compactMobileAlerts: boolean;
  includeProductImage: boolean;
  includeMsrpDetails: boolean;
  includeOpenProductLink: boolean;
}

export interface AlertTemplateInput {
  templateType: AlertTemplateType;
  productName?: string | null;
  storeName?: string | null;
  priceCents?: number | null;
  msrpCents?: number | null;
  acceptedMaxPriceCents?: number | null;
  stockStatus?: string | null;
  priceStatus?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
  fallbackMessage?: string | null;
  test?: boolean;
}

export interface RenderedAlert extends AlertProviderMessage {
  title: string;
  priority: AlertPriority;
  templateType: AlertTemplateType;
}

export const defaultAlertTemplateSettings: AlertTemplateSettings = {
  compactMobileAlerts: true,
  includeProductImage: true,
  includeMsrpDetails: true,
  includeOpenProductLink: true
};

function money(cents?: number | null): string {
  return cents == null ? "Unknown" : `$${(cents / 100).toFixed(2)}`;
}

function readableStatus(value?: string | null): string {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";
}

export class AlertTemplateService {
  constructor(private readonly prisma: PrismaClient) {}

  async getSettings(ownerId: string): Promise<AlertTemplateSettings> {
    const setting = await this.prisma.appSetting.findUnique({ where: { ownerId_key: { ownerId, key: SETTINGS_KEY } } });
    const value = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value) ? setting.value as Record<string, unknown> : {};
    return {
      compactMobileAlerts: typeof value.compactMobileAlerts === "boolean" ? value.compactMobileAlerts : true,
      includeProductImage: typeof value.includeProductImage === "boolean" ? value.includeProductImage : true,
      includeMsrpDetails: typeof value.includeMsrpDetails === "boolean" ? value.includeMsrpDetails : true,
      includeOpenProductLink: typeof value.includeOpenProductLink === "boolean" ? value.includeOpenProductLink : true
    };
  }

  async saveSettings(ownerId: string, patch: Partial<AlertTemplateSettings>): Promise<AlertTemplateSettings> {
    const settings = { ...await this.getSettings(ownerId), ...patch };
    await this.prisma.appSetting.upsert({
      where: { ownerId_key: { ownerId, key: SETTINGS_KEY } },
      create: { ownerId, key: SETTINGS_KEY, value: settings as unknown as Prisma.InputJsonValue },
      update: { value: settings as unknown as Prisma.InputJsonValue }
    });
    return settings;
  }

  priorityFor(templateType: AlertTemplateType, priceStatus?: string | null): AlertPriority {
    if (templateType === "MSRP_MATCH_FOUND" || priceStatus === "MSRP_MATCH") return "URGENT";
    if (["ACCEPTED_PRICE_FOUND", "PRICE_DROPPED_ACCEPTED"].includes(templateType) || ["ACCEPTED", "ACCEPTED_MARKUP"].includes(priceStatus ?? "")) return "HIGH";
    if (["UNKNOWN_MSRP_MAPPING", "HUMAN_REVIEW_NEEDED", "TEST_ALERT", "RELEASE_REMINDER", "TEST_RELEASE_REMINDER"].includes(templateType)) return "NORMAL";
    return "LOW";
  }

  inferTemplateType(input: { eventType?: string | null; priceStatus?: string | null; message?: string | null }): AlertTemplateType {
    if (input.priceStatus === "MSRP_MATCH") return "MSRP_MATCH_FOUND";
    if (input.priceStatus === "UNKNOWN_MSRP") return "UNKNOWN_MSRP_MAPPING";
    if (["ACCEPTED", "ACCEPTED_MARKUP"].includes(input.priceStatus ?? "")) return "ACCEPTED_PRICE_FOUND";
    if (input.eventType === "HUMAN_ACTION_NEEDED") return "HUMAN_REVIEW_NEEDED";
    if (input.eventType === "ERROR" && /config|api key|not configured/i.test(input.message ?? "")) return "CONFIGURATION_NEEDED";
    if (input.eventType === "ERROR") return "SCAN_FAILED";
    if (input.eventType === "RELEASE_REMINDER") return /test/i.test(input.message ?? "") ? "TEST_RELEASE_REMINDER" : "RELEASE_REMINDER";
    return "ACCEPTED_PRICE_FOUND";
  }

  render(input: AlertTemplateInput, settings: AlertTemplateSettings): RenderedAlert {
    const priority = this.priorityFor(input.templateType, input.priceStatus);
    const title = this.titleFor(input.templateType, Boolean(input.test));
    const storeProduct = input.productName ? `${input.storeName ?? "Store"} \u2014 ${input.productName}` : null;
    const lines: Array<string | null> = [title, "", storeProduct];
    if (input.productName) {
      lines.push(`\u{1F4B5} Price: ${money(input.priceCents)}`);
      if (settings.includeMsrpDetails) {
        lines.push(`\u{1F3F7} MSRP: ${money(input.msrpCents)}`);
        if (input.acceptedMaxPriceCents != null) lines.push(`\u2705 Max: ${money(input.acceptedMaxPriceCents)}`);
      }
      lines.push(`\u{1F4E6} Status: ${readableStatus(input.stockStatus)}`);
      if (input.priceStatus) lines.push(`\u{1F3AF} Price Status: ${readableStatus(input.priceStatus)}`);
      if (["UNKNOWN_MSRP_MAPPING", "HUMAN_REVIEW_NEEDED"].includes(input.templateType)) lines.push("", "Action needed:", "Map or review this product inside PokeDad Radar.");
      if (settings.includeOpenProductLink && input.productUrl) lines.push("", "Open Product:", input.productUrl);
    } else {
      lines.push(input.fallbackMessage ?? this.fallbackFor(input.templateType));
    }
    const compactLines = settings.compactMobileAlerts ? lines.filter((line, index) => line !== "" || index < 2) : lines;
    const embed: DiscordEmbed = {
      title,
      description: storeProduct ?? input.fallbackMessage ?? this.fallbackFor(input.templateType),
      color: this.colorFor(priority),
      url: settings.includeOpenProductLink ? input.productUrl ?? undefined : undefined,
      thumbnail: settings.includeProductImage && input.imageUrl?.startsWith("http") ? { url: input.imageUrl } : undefined,
      fields: input.productName ? [
        { name: "\u{1F4B5} Price", value: money(input.priceCents), inline: true },
        ...(settings.includeMsrpDetails ? [{ name: "\u{1F3F7} MSRP / Max", value: `${money(input.msrpCents)} / ${money(input.acceptedMaxPriceCents)}`, inline: true }] : []),
        { name: "\u{1F4E6} Availability", value: readableStatus(input.stockStatus), inline: true },
        { name: "\u{1F3AF} Price Status", value: readableStatus(input.priceStatus), inline: true }
      ] : undefined,
      footer: { text: input.test ? "TEST ALERT - PokeDad Radar" : `${priority} priority | PokeDad Radar` }
    };
    return { title, priority, templateType: input.templateType, text: compactLines.filter((line): line is string => line != null).join("\n"), discordEmbed: embed };
  }

  private titleFor(type: AlertTemplateType, test: boolean): string {
    if (test) return "TEST ALERT - PokeDad Radar";
    const titles: Record<AlertTemplateType, string> = {
      ACCEPTED_PRICE_FOUND: "\u{1F6A8} PokeDad Radar",
      MSRP_MATCH_FOUND: "\u{1F6A8} MSRP Match Found",
      PRICE_DROPPED_ACCEPTED: "\u{1F4C9} Price Now Accepted",
      UNKNOWN_MSRP_MAPPING: "\u26A0\uFE0F MSRP Mapping Needed",
      HUMAN_REVIEW_NEEDED: "\u26A0\uFE0F Human Review Needed",
      SCAN_FAILED: "\u2699\uFE0F PokeDad Radar Notice",
      CONFIGURATION_NEEDED: "\u2699\uFE0F Configuration Needed",
      TEST_ALERT: "TEST ALERT - PokeDad Radar",
      RELEASE_REMINDER: "\u{1F4C5} PokeDad Radar Release Reminder",
      TEST_RELEASE_REMINDER: "TEST RELEASE REMINDER - PokeDad Radar"
    };
    return titles[type];
  }

  private fallbackFor(type: AlertTemplateType): string {
    if (type === "CONFIGURATION_NEEDED") return "A scan or alert channel needs configuration.";
    if (type === "SCAN_FAILED") return "A read-only scan failed. Review the sanitized dashboard status.";
    if (type === "RELEASE_REMINDER" || type === "TEST_RELEASE_REMINDER") return "Manual release reminder. No retailer request was made.";
    return "PokeDad Radar notification.";
  }

  private colorFor(priority: AlertPriority): number {
    return priority === "URGENT" ? 0xdc2626 : priority === "HIGH" ? 0xf59e0b : priority === "NORMAL" ? 0x0f8b8d : 0x64748b;
  }
}
