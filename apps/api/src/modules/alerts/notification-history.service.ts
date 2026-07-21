import type { AlertEventStatus, AlertPriority, Prisma, PrismaClient } from "@prisma/client";
import { AuditService } from "../../services/audit.service.js";
import { AlertTemplateService } from "./alert-template.service.js";

export interface NotificationFilters {
  status?: "SENT" | "FAILED" | "SUPPRESSED" | "PENDING";
  provider?: "DISCORD" | "TELEGRAM";
  priority?: "HIGH_URGENT";
  period?: "TODAY" | "LAST_7_DAYS";
}

const include = {
  stockCheckResult: { include: { store: true, retailerProduct: true, purchaseDecision: true } },
  deliveries: { include: { alertChannel: true }, orderBy: { createdAt: "asc" as const } }
};

function providerName(value: string): string {
  return value === "DISCORD_WEBHOOK" ? "DISCORD" : value;
}

function eventStatus(event: { status: AlertEventStatus; deliveries: Array<{ status: string }> }): string {
  if (event.deliveries.some((item) => item.status === "SENT")) return "SENT";
  if (event.deliveries.some((item) => item.status === "FAILED")) return "FAILED";
  if (event.deliveries.some((item) => item.status === "CONFIGURATION_NEEDED")) return "CONFIGURATION_NEEDED";
  if (event.deliveries.some((item) => item.status === "CHANNEL_DISABLED")) return "CHANNEL_DISABLED";
  return event.status;
}

function isMockDemo(event: { title: string; message: string; templateType?: string | null; stockCheckResult?: { rawMetadata?: unknown } | null }): boolean {
  const metadata = event.stockCheckResult?.rawMetadata;
  const raw = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
  return event.templateType === "TEST_ALERT"
    || /mock|demo|test/i.test(event.title)
    || /mock|demo|test/i.test(event.message)
    || raw.mock === true
    || raw.demo === true
    || raw.source === "BEST_BUY_MOCK_DEMO";
}

function wishlistMetadata(stock?: { rawMetadata?: unknown } | null) {
  const metadata = stock?.rawMetadata && typeof stock.rawMetadata === "object" && !Array.isArray(stock.rawMetadata) ? stock.rawMetadata as Record<string, unknown> : {};
  return {
    wishlistPriority: typeof metadata.wishlistPriority === "string" ? metadata.wishlistPriority : null,
    wishlistItemName: typeof metadata.wishlistItemName === "string" ? metadata.wishlistItemName : null,
    wishlistSetName: typeof metadata.wishlistSetName === "string" ? metadata.wishlistSetName : null,
    wishlistAlertBehavior: typeof metadata.wishlistAlertBehavior === "string" ? metadata.wishlistAlertBehavior : null,
    wishlistMatchReasons: Array.isArray(metadata.wishlistMatchReasons) ? metadata.wishlistMatchReasons.filter((item): item is string => typeof item === "string") : []
  };
}

export class NotificationHistoryService {
  private readonly audit: AuditService;
  private readonly templates: AlertTemplateService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
    this.templates = new AlertTemplateService(prisma);
  }

  async list(ownerId: string, filters: NotificationFilters) {
    const where: Prisma.AlertEventWhereInput = {
      OR: [
        { ownerId },
        { alertChannel: { ownerId } },
        { stockCheckResult: { store: { ownerId } } }
      ]
    };
    if (filters.status) where.status = filters.status;
    if (filters.priority === "HIGH_URGENT") where.priority = { in: ["HIGH", "URGENT"] };
    if (filters.provider) where.deliveries = { some: { provider: filters.provider === "DISCORD" ? "DISCORD_WEBHOOK" : "TELEGRAM" } };
    if (filters.period) {
      const since = new Date();
      if (filters.period === "TODAY") since.setHours(0, 0, 0, 0);
      else since.setDate(since.getDate() - 7);
      where.createdAt = { gte: since };
    }

    const events = await this.prisma.alertEvent.findMany({ where, include, orderBy: { createdAt: "desc" }, take: 200 });
    await this.audit.log({ action: "NOTIFICATION_HISTORY_VIEWED", summary: "Notification history viewed.", actorUserId: ownerId, metadata: { filters, resultCount: events.length } });
    return events.map((event) => {
      const wishlist = wishlistMetadata(event.stockCheckResult);
      return {
        id: event.id,
        stockCheckResultId: event.stockCheckResultId,
        title: event.title,
        alertType: event.templateType ?? event.type,
        priority: event.priority,
        productName: event.stockCheckResult?.retailerProduct.name ?? null,
        storeName: event.stockCheckResult?.store.name ?? null,
        priceCents: event.stockCheckResult?.priceCents ?? null,
        status: eventStatus(event),
        channelsAttempted: event.deliveries.map((item) => ({ id: item.alertChannelId, name: item.alertChannel.label, provider: providerName(item.provider) })),
        sentAt: event.sentAt?.toISOString() ?? null,
        createdAt: event.createdAt.toISOString(),
        errorSummary: event.deliveries.find((item) => item.errorSummary)?.errorSummary ?? event.error,
        productUrl: event.stockCheckResult?.retailerProduct.productUrl ?? null,
        isMockDemo: isMockDemo(event),
        ...wishlist,
        purchaseDecision: event.stockCheckResult?.purchaseDecision ? {
          id: event.stockCheckResult.purchaseDecision.id,
          status: event.stockCheckResult.purchaseDecision.status,
          skipReason: event.stockCheckResult.purchaseDecision.skipReason,
          note: event.stockCheckResult.purchaseDecision.note,
          quantity: event.stockCheckResult.purchaseDecision.quantity,
          finalPriceCents: event.stockCheckResult.purchaseDecision.finalPriceCents,
          snoozedUntil: event.stockCheckResult.purchaseDecision.snoozedUntil?.toISOString() ?? null
        } : null
      };
    });
  }

  async detail(ownerId: string, id: string) {
    const event = await this.prisma.alertEvent.findFirst({
      where: { id, OR: [{ ownerId }, { alertChannel: { ownerId } }, { stockCheckResult: { store: { ownerId } } }] },
      include
    });
    if (!event) return null;
    const stock = event.stockCheckResult;
    const templateType = event.templateType ?? this.templates.inferTemplateType({ eventType: event.type, priceStatus: stock?.priceStatus, message: event.message });
    const preview = this.templates.render({
      templateType,
      productName: stock?.retailerProduct.name,
      storeName: stock?.store.name,
      priceCents: stock?.priceCents,
      msrpCents: stock?.msrpCents,
      acceptedMaxPriceCents: stock?.acceptedMaxPriceCents,
      stockStatus: stock?.stockStatus,
      priceStatus: stock?.priceStatus,
      productUrl: stock?.retailerProduct.productUrl,
      imageUrl: stock?.retailerProduct.imageUrl,
      fallbackMessage: event.message,
      test: templateType === "TEST_ALERT" || event.title.startsWith("TEST ALERT") || event.title.startsWith("TEST / MOCK")
    }, await this.templates.getSettings(ownerId));
    const recentAudits = await this.prisma.auditLog.findMany({ where: { actorUserId: ownerId }, orderBy: { createdAt: "desc" }, take: 500 });
    const audits = recentAudits.filter((item) => JSON.stringify(item.metadata ?? {}).includes(id)).map((item) => ({ id: item.id, action: item.action, summary: item.summary, createdAt: item.createdAt.toISOString() }));
    await this.audit.log({ action: "ALERT_DELIVERY_DETAIL_VIEWED", summary: "Alert delivery detail viewed.", actorUserId: ownerId, metadata: { alertEventId: id } });
    const wishlist = wishlistMetadata(stock);
    return {
      id: event.id,
      stockCheckResultId: event.stockCheckResultId,
      title: event.title,
      alertType: templateType,
      priority: event.priority,
      status: eventStatus(event),
      messagePreview: preview.text,
      product: stock ? {
        name: stock.retailerProduct.name,
        storeName: stock.store.name,
        priceCents: stock.priceCents,
        msrpCents: stock.msrpCents,
        acceptedMaxPriceCents: stock.acceptedMaxPriceCents,
        priceStatus: stock.priceStatus,
        stockStatus: stock.stockStatus,
        productUrl: stock.retailerProduct.productUrl,
        imageUrl: stock.retailerProduct.imageUrl
      } : null,
      deliveries: event.deliveries.map((item) => ({
        id: item.id,
        channelName: item.alertChannel.label,
        provider: providerName(item.provider),
        status: item.status,
        sentAt: item.sentAt?.toISOString() ?? null,
        errorSummary: item.errorSummary,
        retryCount: item.retryCount
      })),
      audits,
      createdAt: event.createdAt.toISOString(),
      sentAt: event.sentAt?.toISOString() ?? null,
      productUrl: stock?.retailerProduct.productUrl ?? null,
      isMockDemo: isMockDemo(event),
      ...wishlist,
      purchaseDecision: stock?.purchaseDecision ? {
        id: stock.purchaseDecision.id,
        status: stock.purchaseDecision.status,
        skipReason: stock.purchaseDecision.skipReason,
        note: stock.purchaseDecision.note,
        quantity: stock.purchaseDecision.quantity,
        finalPriceCents: stock.purchaseDecision.finalPriceCents,
        snoozedUntil: stock.purchaseDecision.snoozedUntil?.toISOString() ?? null
      } : null
    };
  }
}
