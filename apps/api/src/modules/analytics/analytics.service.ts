import type { Prisma, PrismaClient } from "@prisma/client";
import { AuditService } from "../../services/audit.service.js";
import { getStoreSafetyItem } from "../store-safety/store-safety-matrix.js";

export interface AnalyticsFilters {
  period?: "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "ALL_TIME";
  storeKey?: string;
  setName?: string;
  categoryId?: string;
  priority?: string;
  status?: string;
  mockMode?: "MOCK_ONLY" | "REAL_ONLY" | "ALL";
}

const includePurchase = {
  stockCheckResult: {
    include: {
      store: true,
      retailerProduct: { include: { category: true } },
      alertEvents: { include: { deliveries: true }, orderBy: { createdAt: "desc" as const } }
    }
  }
};

function sinceFor(period: AnalyticsFilters["period"]): Date | null {
  const now = new Date();
  if (period === "TODAY") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "LAST_7_DAYS") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "LAST_30_DAYS") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (period === "THIS_MONTH") return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isMockDemo(value: unknown): boolean {
  const meta = metadata(value);
  const source = String(meta.source ?? "");
  return meta.mock === true || meta.demo === true || /mock|demo/i.test(source);
}

function cents(value?: number | null): number {
  return value ?? 0;
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>, fallbackHeaders: string[] = ["empty"]): string {
  const headers = rows[0] ? Object.keys(rows[0]) : fallbackHeaders;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

export class AnalyticsService {
  private readonly audit: AuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
  }

  async all(ownerId: string, filters: AnalyticsFilters) {
    const [summary, spending, purchaseHistory, wishlistProgress, releaseCoverage, manualLinkActivity, alerts, msrpMapping] = await Promise.all([
      this.summary(ownerId, filters),
      this.spending(ownerId, filters),
      this.purchaseHistory(ownerId, filters),
      this.wishlistProgress(ownerId, filters),
      this.releaseCoverage(ownerId, filters),
      this.manualLinkActivity(ownerId, filters),
      this.alerts(ownerId, filters),
      this.msrpMapping(ownerId, filters)
    ]);
    await this.audit.log({ action: "ANALYTICS_DASHBOARD_VIEWED", summary: "Analytics dashboard viewed.", actorUserId: ownerId, metadata: { filters } });
    return { summary, spending, purchaseHistory, wishlistProgress, releaseCoverage, manualLinkActivity, alerts, msrpMapping };
  }

  async summary(ownerId: string, filters: AnalyticsFilters) {
    const [decisions, wishlistItems, releases, links, events, mappings] = await Promise.all([
      this.filteredDecisions(ownerId, filters),
      this.prisma.wishlistItem.findMany({ where: { ownerId } }),
      this.prisma.releaseCalendarItem.findMany({ where: { ownerId } }),
      this.prisma.manualStoreLink.findMany({ where: { ownerId } }),
      this.prisma.alertEvent.findMany({ where: this.alertWhere(ownerId, filters), include: { deliveries: true, stockCheckResult: true } }),
      this.prisma.productMSRPMapping.findMany({ where: { ownerId } })
    ]);
    const bought = decisions.filter((item) => item.status === "BOUGHT");
    const skippedStatuses = ["SKIPPED", "SOLD_OUT", "TOO_EXPENSIVE", "NOT_INTERESTED", "NEEDS_MAPPING"];
    return {
      totalBoughtItems: bought.reduce((sum, item) => sum + (item.quantity ?? 1), 0),
      totalEstimatedSpendCents: bought.reduce((sum, item) => sum + (item.finalPriceCents == null ? 0 : item.finalPriceCents * (item.quantity ?? 1)), 0),
      boughtThisWeek: bought.filter((item) => item.boughtAt && item.boughtAt >= sinceFor("LAST_7_DAYS")!).length,
      boughtThisMonth: bought.filter((item) => item.boughtAt && item.boughtAt >= sinceFor("THIS_MONTH")!).length,
      skippedItems: decisions.filter((item) => skippedStatuses.includes(item.status)).length,
      snoozedItems: decisions.filter((item) => item.status === "SNOOZED").length,
      activeWishlistItems: wishlistItems.filter((item) => item.isActive).length,
      urgentWishlistItems: wishlistItems.filter((item) => item.isActive && item.priority === "URGENT").length,
      upcomingReleases: releases.filter((item) => item.isActive && item.releaseDate >= new Date()).length,
      manualLinksOpened: links.reduce((sum, link) => sum + link.openCount, 0),
      alertsSent: events.filter((event) => event.status === "SENT" || event.deliveries.some((delivery) => delivery.status === "SENT")).length,
      alertsSuppressed: events.filter((event) => event.status === "SUPPRESSED" || event.deliveries.some((delivery) => delivery.status === "SUPPRESSED")).length,
      needsMsrpMapping: mappings.filter((mapping) => ["UNMAPPED", "SUGGESTED", "NEEDS_REVIEW"].includes(mapping.status)).length,
      mockDemoRecords: events.filter((event) => isMockDemo(event.stockCheckResult?.rawMetadata) || /mock|demo|test/i.test(`${event.title} ${event.message}`)).length
    };
  }

  async spending(ownerId: string, filters: AnalyticsFilters) {
    const decisions = await this.filteredDecisions(ownerId, filters);
    const bought = decisions.filter((item) => item.status === "BOUGHT");
    const withPrice = bought.filter((item) => item.finalPriceCents != null);
    const lineTotal = (item: typeof bought[number]) => (item.finalPriceCents ?? 0) * (item.quantity ?? 1);
    const totalSpendCents = withPrice.reduce((sum, item) => sum + lineTotal(item), 0);
    const spendRows = withPrice.map((item) => ({
      store: item.stockCheckResult.store.name,
      setName: String(metadata(item.stockCheckResult.rawMetadata).wishlistSetName ?? "Unknown"),
      category: item.stockCheckResult.retailerProduct.category?.label ?? "Unknown",
      amountCents: lineTotal(item)
    }));
    return {
      totalSpendCents,
      spendThisWeekCents: withPrice.filter((item) => item.boughtAt && item.boughtAt >= sinceFor("LAST_7_DAYS")!).reduce((sum, item) => sum + lineTotal(item), 0),
      spendThisMonthCents: withPrice.filter((item) => item.boughtAt && item.boughtAt >= sinceFor("THIS_MONTH")!).reduce((sum, item) => sum + lineTotal(item), 0),
      spendByStore: this.groupMoney(spendRows, "store"),
      spendBySet: this.groupMoney(spendRows, "setName"),
      spendByCategory: this.groupMoney(spendRows, "category"),
      averageItemPriceCents: withPrice.length ? Math.round(totalSpendCents / withPrice.reduce((sum, item) => sum + (item.quantity ?? 1), 0)) : null,
      highestPurchase: withPrice.sort((a, b) => lineTotal(b) - lineTotal(a))[0] ? this.purchaseRow(withPrice.sort((a, b) => lineTotal(b) - lineTotal(a))[0]) : null,
      boughtVsSkippedRatio: `${bought.length}:${decisions.filter((item) => ["SKIPPED", "SOLD_OUT", "TOO_EXPENSIVE", "NOT_INTERESTED", "NEEDS_MAPPING"].includes(item.status)).length}`,
      missingFinalPrice: bought.filter((item) => item.finalPriceCents == null).map((item) => this.purchaseRow(item))
    };
  }

  async purchaseHistory(ownerId: string, filters: AnalyticsFilters) {
    const decisions = await this.filteredDecisions(ownerId, filters);
    const rows = decisions.map((item) => this.purchaseRow(item));
    return {
      boughtRecently: rows.filter((item) => item.status === "BOUGHT").slice(0, 50),
      skippedRecently: rows.filter((item) => item.status === "SKIPPED").slice(0, 50),
      tooExpensive: rows.filter((item) => item.status === "TOO_EXPENSIVE"),
      soldOut: rows.filter((item) => item.status === "SOLD_OUT"),
      notInterested: rows.filter((item) => item.status === "NOT_INTERESTED"),
      alreadyBought: rows.filter((item) => item.skipReason === "ALREADY_BOUGHT"),
      needsReview: rows.filter((item) => item.status === "NEEDS_MAPPING" || item.skipReason === "NEEDS_REVIEW")
    };
  }

  async wishlistProgress(ownerId: string, filters: AnalyticsFilters) {
    const [wishlist, decisions, manualLinks, releases, events] = await Promise.all([
      this.prisma.wishlistItem.findMany({ where: { ownerId }, include: { category: true } }),
      this.filteredDecisions(ownerId, filters),
      this.prisma.manualStoreLink.findMany({ where: { ownerId } }),
      this.prisma.releaseCalendarItem.findMany({ where: { ownerId } }),
      this.prisma.alertEvent.findMany({ where: { OR: [{ ownerId }, { stockCheckResult: { store: { ownerId } } }] }, include: { stockCheckResult: true }, orderBy: { createdAt: "desc" } })
    ]);
    return wishlist.map((item) => {
      const boughtQuantity = decisions
        .filter((decision) => decision.status === "BOUGHT")
        .filter((decision) => String(metadata(decision.stockCheckResult.rawMetadata).wishlistItemId ?? "") === item.id || decision.stockCheckResult.retailerProduct.name.toLowerCase().includes(item.name.toLowerCase()))
        .reduce((sum, decision) => sum + (decision.quantity ?? 1), 0);
      const relatedLinks = manualLinks.filter((link) => link.wishlistItemId === item.id);
      const relatedReleases = releases.filter((release) => release.wishlistItemId === item.id);
      const relatedAlerts = events.filter((event) => String(metadata(event.stockCheckResult?.rawMetadata).wishlistItemId ?? "") === item.id);
      return {
        id: item.id,
        name: item.name,
        setName: item.setName,
        categoryLabel: item.category?.label ?? null,
        desiredQuantity: item.desiredQuantity,
        boughtQuantity,
        remainingQuantity: item.desiredQuantity == null ? null : Math.max(item.desiredQuantity - boughtQuantity, 0),
        progressPercent: item.desiredQuantity ? Math.min(100, Math.round((boughtQuantity / item.desiredQuantity) * 100)) : null,
        priority: item.priority,
        alertBehavior: item.alertBehavior,
        isActive: item.isActive,
        relatedReleaseCount: relatedReleases.length,
        relatedManualLinkCount: relatedLinks.length,
        lastAlertAt: relatedAlerts[0]?.createdAt.toISOString() ?? null,
        lastManualLinkOpenAt: relatedLinks.map((link) => link.lastOpenedAt).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0]?.toISOString() ?? null,
        notes: item.notes
      };
    });
  }

  async releaseCoverage(ownerId: string, filters: AnalyticsFilters) {
    const releases = await this.prisma.releaseCalendarItem.findMany({
      where: { ownerId },
      include: { wishlistItem: true, manualLinks: { include: { manualStoreLink: true } } },
      orderBy: { releaseDate: "asc" }
    });
    const events = await this.prisma.alertEvent.findMany({ where: { ownerId, type: "RELEASE_REMINDER" }, orderBy: { createdAt: "desc" } });
    return releases
      .filter((release) => this.matchesPeriod(release.releaseDate, filters.period))
      .map((release) => ({
        id: release.id,
        title: release.title,
        setName: release.setName,
        productName: release.productName,
        releaseDate: release.releaseDate.toISOString(),
        priority: release.priority,
        status: release.status,
        hasWishlistItem: Boolean(release.wishlistItemId),
        wishlistItemName: release.wishlistItem?.name ?? null,
        manualStoreLinkCount: release.manualLinks.length,
        discordReminder: release.discordReminder,
        reminderOffsets: release.reminderOffsets,
        lastReminderSentAt: events.find((event) => event.message.includes(release.title))?.sentAt?.toISOString() ?? null,
        coverageWarnings: [
          !release.wishlistItemId ? "NO_WISHLIST_ITEM" : null,
          release.manualLinks.length === 0 ? "NO_MANUAL_LINKS" : null,
          !release.discordReminder ? "NO_REMINDER" : null,
          release.priority === "URGENT" && release.manualLinks.length === 0 ? "URGENT_NO_LINKS" : null
        ].filter(Boolean)
      }));
  }

  async manualLinkActivity(ownerId: string, filters: AnalyticsFilters) {
    const links = await this.prisma.manualStoreLink.findMany({ where: { ownerId }, include: { wishlistItem: true, category: true, releaseLinks: true }, orderBy: [{ openCount: "desc" }, { updatedAt: "desc" }] });
    const rows = links.map((link) => {
      const safety = getStoreSafetyItem(link.storeKey);
      return {
        id: link.id,
        storeKey: link.storeKey,
        storeDisplayName: link.storeDisplayName,
        title: link.title,
        linkType: link.linkType,
        priority: link.priority,
        safetyMode: safety?.recommendedMode ?? "MANUAL_OPEN_ONLY",
        riskLevel: safety?.riskLevel ?? "UNKNOWN",
        wishlistItemName: link.wishlistItem?.name ?? null,
        categoryLabel: link.category?.label ?? null,
        releaseAttachmentCount: link.releaseLinks.length,
        openCount: link.openCount,
        lastOpenedAt: link.lastOpenedAt?.toISOString() ?? null,
        isActive: link.isActive,
        isMockDemo: false
      };
    });
    return {
      mostOpened: rows.slice(0, 20),
      recentlyOpened: [...rows].filter((row) => row.lastOpenedAt).sort((a, b) => String(b.lastOpenedAt).localeCompare(String(a.lastOpenedAt))).slice(0, 20),
      neverOpened: rows.filter((row) => row.openCount === 0),
      byStore: this.countBy(rows, "storeDisplayName"),
      bySafetyMode: this.countBy(rows, "safetyMode"),
      byRiskLevel: this.countBy(rows, "riskLevel"),
      attachedToWishlist: rows.filter((row) => row.wishlistItemName).length,
      attachedToReleaseCalendar: rows.filter((row) => row.releaseAttachmentCount > 0).length
    };
  }

  async alerts(ownerId: string, filters: AnalyticsFilters) {
    const events = await this.prisma.alertEvent.findMany({
      where: this.alertWhere(ownerId, filters),
      include: { deliveries: { include: { alertChannel: true } }, stockCheckResult: { include: { store: true, retailerProduct: true, purchaseDecision: true } } },
      orderBy: { createdAt: "desc" },
      take: 300
    });
    const rows = events.map((event) => ({
      id: event.id,
      title: event.title,
      alertType: event.templateType ?? event.type,
      priority: event.priority,
      status: event.status,
      deliveryStatus: event.deliveries.find((delivery) => delivery.status === "SENT")?.status ?? event.deliveries[0]?.status ?? event.status,
      discordDelivered: event.deliveries.some((delivery) => delivery.provider === "DISCORD_WEBHOOK" && delivery.status === "SENT"),
      productName: event.stockCheckResult?.retailerProduct.name ?? null,
      storeName: event.stockCheckResult?.store.name ?? null,
      purchaseDecisionStatus: event.stockCheckResult?.purchaseDecision?.status ?? null,
      createdAt: event.createdAt.toISOString(),
      sentAt: event.sentAt?.toISOString() ?? null,
      isMockDemo: isMockDemo(event.stockCheckResult?.rawMetadata) || /mock|demo|test/i.test(`${event.title} ${event.message}`)
    }));
    return {
      alertsCreated: rows.length,
      alertsSent: rows.filter((row) => row.status === "SENT" || row.deliveryStatus === "SENT").length,
      alertsFailed: rows.filter((row) => row.status === "FAILED" || row.deliveryStatus === "FAILED").length,
      alertsSuppressed: rows.filter((row) => row.status === "SUPPRESSED" || row.deliveryStatus === "SUPPRESSED").length,
      discordDeliveriesSent: rows.filter((row) => row.discordDelivered).length,
      mockDemoTestAlerts: rows.filter((row) => row.isMockDemo).length,
      acceptedPriceAlerts: rows.filter((row) => ["ACCEPTED_PRICE_FOUND", "MSRP_MATCH_FOUND", "PRICE_DROPPED_ACCEPTED"].includes(String(row.alertType))).length,
      releaseReminderAlerts: rows.filter((row) => String(row.alertType).includes("RELEASE_REMINDER")).length,
      unknownMsrpAlerts: rows.filter((row) => row.alertType === "UNKNOWN_MSRP_MAPPING").length,
      scanConfigAlerts: rows.filter((row) => ["SCAN_FAILED", "CONFIGURATION_NEEDED"].includes(String(row.alertType))).length,
      rows
    };
  }

  async msrpMapping(ownerId: string, filters: AnalyticsFilters) {
    const mappings = await this.prisma.productMSRPMapping.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" } });
    return {
      mappedProducts: mappings.filter((item) => item.status === "MAPPED").length,
      unmappedProducts: mappings.filter((item) => item.status === "UNMAPPED").length,
      needsReview: mappings.filter((item) => item.status === "NEEDS_REVIEW").length,
      ignored: mappings.filter((item) => item.status === "IGNORED").length,
      suggestionsAccepted: mappings.filter((item) => item.status === "MAPPED" && item.suggestedCategoryId === item.mappedCategoryId).length,
      manualMappings: mappings.filter((item) => item.confidence === "MANUAL").length,
      unknownByStore: this.countBy(mappings.filter((item) => item.status !== "MAPPED"), "storeKey"),
      rows: mappings.map((item) => ({
        id: item.id,
        productName: item.productName,
        storeKey: item.storeKey,
        currentPriceCents: item.currentPriceCents,
        status: item.status,
        confidence: item.confidence,
        msrpCents: item.msrpCents,
        acceptedMaxPriceCents: item.acceptedMaxPriceCents,
        updatedAt: item.updatedAt.toISOString()
      }))
    };
  }

  async exportPurchases(ownerId: string, kind: "bought" | "skipped") {
    const history = await this.purchaseHistory(ownerId, { period: "ALL_TIME" });
    const rows = kind === "bought"
      ? history.boughtRecently
      : [...history.skippedRecently, ...history.tooExpensive, ...history.soldOut, ...history.notInterested, ...history.needsReview];
    await this.audit.log({ action: "ANALYTICS_EXPORT_DOWNLOADED", summary: `Analytics ${kind} CSV exported.`, actorUserId: ownerId, metadata: { kind, rowCount: rows.length } });
    const exportRows = rows.map((row) => ({
      productName: row.productName,
      storeName: row.storeName,
      status: row.status,
      priceCents: row.priceCents,
      finalPriceCents: row.finalPriceCents,
      quantity: row.quantity,
      wishlistPriority: row.wishlistPriority,
      setName: row.setName,
      decisionDate: row.decisionDate,
      isMockDemo: row.isMockDemo,
      note: row.note
    }));
    return toCsv(exportRows, ["productName", "storeName", "status", "priceCents", "finalPriceCents", "quantity", "wishlistPriority", "setName", "decisionDate", "isMockDemo", "note"]);
  }

  private async filteredDecisions(ownerId: string, filters: AnalyticsFilters) {
    const since = sinceFor(filters.period);
    const decisions = await this.prisma.purchaseDecision.findMany({
      where: {
        ownerId,
        ...(since ? { updatedAt: { gte: since } } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
        stockCheckResult: {
          ...(filters.storeKey ? { store: { slug: filters.storeKey } } : {}),
          ...(filters.categoryId ? { retailerProduct: { categoryId: filters.categoryId } } : {})
        }
      },
      include: includePurchase,
      orderBy: { updatedAt: "desc" },
      take: 500
    });
    return decisions.filter((decision) => {
      const meta = metadata(decision.stockCheckResult.rawMetadata);
      if (filters.setName && String(meta.wishlistSetName ?? "").toLowerCase() !== filters.setName.toLowerCase()) return false;
      if (filters.priority && String(meta.wishlistPriority ?? "") !== filters.priority) return false;
      if (filters.mockMode === "MOCK_ONLY" && !isMockDemo(decision.stockCheckResult.rawMetadata)) return false;
      if (filters.mockMode === "REAL_ONLY" && isMockDemo(decision.stockCheckResult.rawMetadata)) return false;
      return true;
    });
  }

  private purchaseRow(item: Awaited<ReturnType<AnalyticsService["filteredDecisions"]>>[number]) {
    const meta = metadata(item.stockCheckResult.rawMetadata);
    return {
      id: item.id,
      stockCheckResultId: item.stockCheckResultId,
      productName: item.stockCheckResult.retailerProduct.name,
      storeName: item.stockCheckResult.store.name,
      priceCents: item.stockCheckResult.priceCents,
      finalPriceCents: item.finalPriceCents,
      quantity: item.quantity ?? 1,
      status: item.status,
      skipReason: item.skipReason,
      wishlistPriority: typeof meta.wishlistPriority === "string" ? meta.wishlistPriority : null,
      wishlistItemName: typeof meta.wishlistItemName === "string" ? meta.wishlistItemName : null,
      setName: typeof meta.wishlistSetName === "string" ? meta.wishlistSetName : null,
      categoryLabel: item.stockCheckResult.retailerProduct.category?.label ?? null,
      decisionDate: (item.boughtAt ?? item.skippedAt ?? item.updatedAt).toISOString(),
      note: item.note,
      relatedAlertId: item.stockCheckResult.alertEvents[0]?.id ?? null,
      isMockDemo: isMockDemo(item.stockCheckResult.rawMetadata),
      missingFinalPrice: item.status === "BOUGHT" && item.finalPriceCents == null
    };
  }

  private alertWhere(ownerId: string, filters: AnalyticsFilters): Prisma.AlertEventWhereInput {
    const since = sinceFor(filters.period);
    return {
      OR: [{ ownerId }, { alertChannel: { ownerId } }, { stockCheckResult: { store: { ownerId } } }],
      ...(since ? { createdAt: { gte: since } } : {})
    };
  }

  private matchesPeriod(value: Date, period: AnalyticsFilters["period"]) {
    const since = sinceFor(period);
    return !since || value >= since;
  }

  private groupMoney(rows: Array<Record<string, unknown>>, key: string) {
    const groups = new Map<string, number>();
    for (const row of rows) groups.set(String(row[key] ?? "Unknown"), (groups.get(String(row[key] ?? "Unknown")) ?? 0) + cents(row.amountCents as number | null));
    return [...groups.entries()].map(([label, amountCents]) => ({ label, amountCents })).sort((a, b) => b.amountCents - a.amountCents);
  }

  private countBy(rows: Array<Record<string, unknown>>, key: string) {
    const groups = new Map<string, number>();
    for (const row of rows) groups.set(String(row[key] ?? "Unknown"), (groups.get(String(row[key] ?? "Unknown")) ?? 0) + 1);
    return [...groups.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }
}
