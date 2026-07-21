import type { AlertPriority, PrismaClient, TodayActionStatus, WishlistPriority } from "@prisma/client";
import { AuditService } from "../../services/audit.service.js";
import { ManualStoreLinkService } from "../manual-store-links/manual-store-link.service.js";
import { getStoreSafetyItem } from "../store-safety/store-safety-matrix.js";

export type TodayActionItemType =
  | "RELEASE_TODAY"
  | "RELEASE_SOON"
  | "WISHLIST_PRIORITY"
  | "MANUAL_LINK_CHECK"
  | "MSRP_MAPPING_NEEDED"
  | "PURCHASE_DECISION_NEEDED"
  | "SNOOZE_EXPIRED"
  | "ALERT_REVIEW"
  | "BOUGHT_RECENTLY"
  | "SKIPPED_RECENTLY";

export interface TodayActionItem {
  id: string;
  key: string;
  title: string;
  type: TodayActionItemType;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT" | "IGNORE";
  status: TodayActionStatus;
  source: string;
  productName?: string | null;
  storeName?: string | null;
  storeKey?: string | null;
  setName?: string | null;
  priceCents?: number | null;
  msrpCents?: number | null;
  acceptedMaxPriceCents?: number | null;
  wishlistItemId?: string | null;
  wishlistItemName?: string | null;
  releaseCalendarItemId?: string | null;
  manualStoreLinks: ReturnType<ManualStoreLinkService["mapLink"]>[];
  notificationId?: string | null;
  purchaseDecisionId?: string | null;
  stockCheckResultId?: string | null;
  msrpMappingId?: string | null;
  dueAt?: string | null;
  snoozedUntil?: string | null;
  reasons: string[];
  badges: string[];
  rank: number;
}

const dayMs = 24 * 60 * 60 * 1000;

function iso(value?: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function priorityScore(priority: string): number {
  return priority === "URGENT" ? 400 : priority === "HIGH" ? 300 : priority === "NORMAL" ? 200 : priority === "LOW" ? 100 : 0;
}

export class TodayService {
  private readonly audit: AuditService;
  private readonly manualLinks: ManualStoreLinkService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
    this.manualLinks = new ManualStoreLinkService(prisma);
  }

  async list(ownerId: string) {
    const [states, releases, wishlistItems, manualLinks, mappings, stockChecks, notifications, decisions] = await Promise.all([
      this.prisma.actionItemState.findMany({ where: { userId: ownerId } }),
      this.prisma.releaseCalendarItem.findMany({
        where: { ownerId, isActive: true },
        include: { wishlistItem: true, manualLinks: { include: { manualStoreLink: { include: { wishlistItem: true, category: true } } } } },
        orderBy: { releaseDate: "asc" }
      }),
      this.prisma.wishlistItem.findMany({ where: { ownerId, isActive: true }, include: { category: true, manualStoreLinks: { include: { wishlistItem: true, category: true } }, releaseCalendarItems: true } }),
      this.prisma.manualStoreLink.findMany({ where: { ownerId, isActive: true }, include: { wishlistItem: true, category: true }, orderBy: { lastOpenedAt: "asc" } }),
      this.prisma.productMSRPMapping.findMany({ where: { ownerId, status: { in: ["UNMAPPED", "SUGGESTED", "NEEDS_REVIEW"] } }, orderBy: { updatedAt: "desc" }, take: 50 }),
      this.prisma.stockCheckResult.findMany({ where: { store: { ownerId } }, include: { store: true, retailerProduct: true, purchaseDecision: true }, orderBy: { checkedAt: "desc" }, take: 80 }),
      this.prisma.alertEvent.findMany({ where: { OR: [{ ownerId }, { stockCheckResult: { store: { ownerId } } }, { alertChannel: { ownerId } }] }, include: { deliveries: { include: { alertChannel: true } }, stockCheckResult: { include: { store: true, retailerProduct: true, purchaseDecision: true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
      this.prisma.purchaseDecision.findMany({ where: { ownerId }, include: { stockCheckResult: { include: { store: true, retailerProduct: true } } }, orderBy: { updatedAt: "desc" }, take: 50 })
    ]);
    const stateByKey = new Map(states.map((state) => [state.itemKey, state]));
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekEnd = new Date(todayEnd.getTime() + 6 * dayMs);
    const items: TodayActionItem[] = [];

    for (const release of releases) {
      const isToday = release.releaseDate >= todayStart && release.releaseDate <= todayEnd;
      const isSoon = release.releaseDate > todayEnd && release.releaseDate <= weekEnd;
      if (!isToday && !isSoon && !["URGENT", "HIGH"].includes(release.priority)) continue;
      const key = `${isToday ? "release-today" : "release-soon"}:${release.id}`;
      items.push(this.applyState({
        id: key,
        key,
        title: release.title,
        type: isToday ? "RELEASE_TODAY" : "RELEASE_SOON",
        priority: release.priority,
        status: "OPEN",
        source: "Release Calendar",
        productName: release.productName,
        setName: release.setName,
        wishlistItemId: release.wishlistItemId,
        wishlistItemName: release.wishlistItem?.name ?? null,
        releaseCalendarItemId: release.id,
        manualStoreLinks: release.manualLinks.map((relation) => this.manualLinks.mapLink(relation.manualStoreLink)),
        dueAt: release.releaseDate.toISOString(),
        reasons: [isToday ? "Release is today." : "Release is within the next 7 days.", `${release.priority} priority.`],
        badges: [isToday ? "RELEASE TODAY" : "RELEASE SOON", release.priority, "MANUAL ONLY"],
        rank: (isToday ? 10000 : 7000) + priorityScore(release.priority)
      }, stateByKey));
    }

    for (const wishlist of wishlistItems) {
      if (wishlist.priority === "IGNORE") continue;
      if (!["URGENT", "HIGH"].includes(wishlist.priority)) continue;
      const key = `wishlist:${wishlist.id}`;
      items.push(this.applyState({
        id: key,
        key,
        title: wishlist.name,
        type: "WISHLIST_PRIORITY",
        priority: wishlist.priority,
        status: "OPEN",
        source: "Wishlist",
        productName: wishlist.name,
        setName: wishlist.setName,
        wishlistItemId: wishlist.id,
        wishlistItemName: wishlist.name,
        manualStoreLinks: wishlist.manualStoreLinks.map((link) => this.manualLinks.mapLink(link)),
        reasons: [`${wishlist.priority} wishlist priority.`, `Alert behavior: ${wishlist.alertBehavior}.`],
        badges: [wishlist.priority, wishlist.alertBehavior],
        rank: 6500 + priorityScore(wishlist.priority)
      }, stateByKey));
    }

    for (const link of manualLinks.slice(0, 30)) {
      if (link.priority === "IGNORE") continue;
      const safety = getStoreSafetyItem(link.storeKey);
      const stale = !link.lastOpenedAt || link.lastOpenedAt.getTime() < now.getTime() - dayMs;
      const urgent = ["URGENT", "HIGH"].includes(link.priority);
      if (!stale && !urgent) continue;
      const key = `manual-link:${link.id}`;
      items.push(this.applyState({
        id: key,
        key,
        title: link.title,
        type: "MANUAL_LINK_CHECK",
        priority: link.priority,
        status: "OPEN",
        source: "Manual Store Links",
        storeName: link.storeDisplayName,
        storeKey: link.storeKey,
        setName: link.setName,
        wishlistItemId: link.wishlistItemId,
        wishlistItemName: link.wishlistItem?.name ?? null,
        manualStoreLinks: [this.manualLinks.mapLink(link)],
        dueAt: iso(link.lastOpenedAt),
        reasons: [stale ? "Not opened in the last day." : "High-priority manual reference.", `Safety: ${safety?.recommendedMode ?? "MANUAL_OPEN_ONLY"} / ${safety?.riskLevel ?? "UNKNOWN"}.`],
        badges: [link.priority, "MANUAL ONLY", safety?.riskLevel ?? "UNKNOWN"],
        rank: (stale ? 4500 : 3500) + priorityScore(link.priority)
      }, stateByKey));
    }

    for (const mapping of mappings) {
      const key = `msrp-mapping:${mapping.id}`;
      items.push(this.applyState({
        id: key,
        key,
        title: mapping.productName,
        type: "MSRP_MAPPING_NEEDED",
        priority: mapping.status === "NEEDS_REVIEW" ? "HIGH" : "NORMAL",
        status: "OPEN",
        source: "MSRP Mapping",
        productName: mapping.productName,
        storeKey: mapping.storeKey,
        priceCents: mapping.currentPriceCents,
        msrpMappingId: mapping.id,
        manualStoreLinks: [],
        reasons: [`Mapping status: ${mapping.status}.`, `Confidence: ${mapping.confidence}.`],
        badges: ["NEEDS MAPPING", mapping.status],
        rank: mapping.status === "NEEDS_REVIEW" ? 6000 : 4200
      }, stateByKey));
    }

    for (const check of stockChecks) {
      const metadata = check.rawMetadata && typeof check.rawMetadata === "object" && !Array.isArray(check.rawMetadata) ? check.rawMetadata as Record<string, unknown> : {};
      const decisionStatus = check.purchaseDecision?.status ?? (check.bought ? "BOUGHT" : check.ignored ? "SKIPPED" : "NEW");
      const isMock = metadata.mock === true || metadata.demo === true || String(metadata.source ?? "").includes("MOCK");
      if (isMock) continue;
      const priority = (typeof metadata.wishlistPriority === "string" ? metadata.wishlistPriority : check.accepted ? "HIGH" : "NORMAL") as TodayActionItem["priority"];
      if (decisionStatus === "NEW" || decisionStatus === "OPENED" || check.accepted) {
        const key = `decision:${check.id}`;
        items.push(this.applyState({
          id: key,
          key,
          title: check.retailerProduct.name,
          type: "PURCHASE_DECISION_NEEDED",
          priority,
          status: "OPEN",
          source: "Live Finds",
          productName: check.retailerProduct.name,
          storeName: check.store.name,
          storeKey: check.store.slug,
          priceCents: check.priceCents,
          msrpCents: check.msrpCents,
          acceptedMaxPriceCents: check.acceptedMaxPriceCents,
          wishlistItemName: typeof metadata.wishlistItemName === "string" ? metadata.wishlistItemName : null,
          stockCheckResultId: check.id,
          purchaseDecisionId: check.purchaseDecision?.id ?? null,
          manualStoreLinks: [],
          dueAt: check.checkedAt.toISOString(),
          reasons: [check.accepted ? "Accepted price needs a manual decision." : "Product needs review.", "Open Product only."],
          badges: [priority, "OPEN PRODUCT", check.priceStatus],
          rank: (check.accepted ? 8500 : 5000) + priorityScore(priority)
        }, stateByKey));
      }
    }

    for (const decision of decisions) {
      if (decision.status === "SNOOZED" && decision.snoozedUntil && decision.snoozedUntil <= new Date(todayEnd.getTime() + dayMs)) {
        const key = `snooze:${decision.id}`;
        items.push(this.applyState({
          id: key,
          key,
          title: decision.stockCheckResult.retailerProduct.name,
          type: "SNOOZE_EXPIRED",
          priority: "HIGH",
          status: "OPEN",
          source: "Purchase Decisions",
          productName: decision.stockCheckResult.retailerProduct.name,
          storeName: decision.stockCheckResult.store.name,
          storeKey: decision.stockCheckResult.store.slug,
          priceCents: decision.stockCheckResult.priceCents,
          stockCheckResultId: decision.stockCheckResultId,
          purchaseDecisionId: decision.id,
          dueAt: decision.snoozedUntil.toISOString(),
          manualStoreLinks: [],
          reasons: ["Snoozed item returns soon."],
          badges: ["SNOOZED", "RETURNING SOON"],
          rank: 5500
        }, stateByKey));
      }
      if (["BOUGHT", "SKIPPED", "TOO_EXPENSIVE", "SOLD_OUT", "NOT_INTERESTED"].includes(decision.status)) {
        const key = `completed:${decision.id}`;
        items.push(this.applyState({
          id: key,
          key,
          title: decision.stockCheckResult.retailerProduct.name,
          type: decision.status === "BOUGHT" ? "BOUGHT_RECENTLY" : "SKIPPED_RECENTLY",
          priority: "LOW",
          status: "DONE",
          source: "Purchase Decisions",
          productName: decision.stockCheckResult.retailerProduct.name,
          storeName: decision.stockCheckResult.store.name,
          storeKey: decision.stockCheckResult.store.slug,
          priceCents: decision.stockCheckResult.priceCents,
          stockCheckResultId: decision.stockCheckResultId,
          purchaseDecisionId: decision.id,
          dueAt: decision.updatedAt.toISOString(),
          manualStoreLinks: [],
          reasons: [`Decision status: ${decision.status}.`],
          badges: [decision.status],
          rank: 500
        }, stateByKey));
      }
    }

    for (const event of notifications.slice(0, 12)) {
      const key = `alert:${event.id}`;
      const status = event.deliveries.some((delivery) => delivery.status === "SENT") ? "SENT" : event.status;
      items.push(this.applyState({
        id: key,
        key,
        title: event.title,
        type: "ALERT_REVIEW",
        priority: event.priority,
        status: "OPEN",
        source: "Notification History",
        productName: event.stockCheckResult?.retailerProduct.name ?? null,
        storeName: event.stockCheckResult?.store.name ?? null,
        storeKey: event.stockCheckResult?.store.slug ?? null,
        priceCents: event.stockCheckResult?.priceCents ?? null,
        notificationId: event.id,
        stockCheckResultId: event.stockCheckResultId,
        purchaseDecisionId: event.stockCheckResult?.purchaseDecision?.id ?? null,
        manualStoreLinks: [],
        dueAt: event.createdAt.toISOString(),
        reasons: [`Alert status: ${status}.`, `Type: ${event.templateType ?? event.type}.`],
        badges: [event.priority, status, event.templateType ?? event.type],
        rank: 3000 + priorityScore(event.priority)
      }, stateByKey));
    }

    const visible = items
      .filter((item) => item.priority !== "IGNORE")
      .filter((item) => !(item.status === "DISMISSED" || item.status === "DONE"))
      .filter((item) => !(item.status === "SNOOZED" && item.snoozedUntil && new Date(item.snoozedUntil) > now))
      .sort((a, b) => b.rank - a.rank || (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
    const completed = items.filter((item) => item.status === "DONE" || item.type === "BOUGHT_RECENTLY" || item.type === "SKIPPED_RECENTLY").sort((a, b) => b.rank - a.rank);
    await this.audit.log({ action: "TODAY_ACTION_LIST_VIEWED", summary: "Today's Action List viewed.", actorUserId: ownerId, metadata: { visibleCount: visible.length, completedCount: completed.length } });
    return { items: visible, completed, summary: this.buildSummary(visible, completed) };
  }

  async summary(ownerId: string) {
    const list = await this.list(ownerId);
    return list.summary;
  }

  async setState(ownerId: string, itemKey: string, status: TodayActionStatus, snoozedUntil?: Date | null) {
    const state = await this.prisma.actionItemState.upsert({
      where: { userId_itemKey: { userId: ownerId, itemKey } },
      create: { userId: ownerId, itemKey, status, snoozedUntil, dismissedAt: status === "DISMISSED" ? new Date() : null, doneAt: status === "DONE" ? new Date() : null },
      update: { status, snoozedUntil, dismissedAt: status === "DISMISSED" ? new Date() : null, doneAt: status === "DONE" ? new Date() : null }
    });
    const action = status === "DISMISSED" ? "TODAY_ACTION_ITEM_DISMISSED" : status === "SNOOZED" ? "TODAY_ACTION_ITEM_SNOOZED" : "TODAY_ACTION_ITEM_MARKED_DONE";
    await this.audit.log({ action, summary: `Today action item marked ${status.toLowerCase()}.`, actorUserId: ownerId, metadata: { itemKey, status, snoozedUntil: iso(snoozedUntil) } });
    return state;
  }

  private applyState(item: TodayActionItem, states: Map<string, { status: TodayActionStatus; snoozedUntil: Date | null }>): TodayActionItem {
    const state = states.get(item.key);
    return state ? { ...item, status: state.status, snoozedUntil: iso(state.snoozedUntil) } : item;
  }

  private buildSummary(items: TodayActionItem[], completed: TodayActionItem[]) {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const weekEnd = new Date(todayEnd.getTime() + 6 * dayMs);
    return {
      urgentItems: items.filter((item) => item.priority === "URGENT").length,
      releasesToday: items.filter((item) => item.type === "RELEASE_TODAY").length,
      upcomingReleasesThisWeek: items.filter((item) => item.type === "RELEASE_SOON" && item.dueAt && new Date(item.dueAt) <= weekEnd).length,
      manualLinksToCheck: items.filter((item) => item.type === "MANUAL_LINK_CHECK").length,
      needsMapping: items.filter((item) => item.type === "MSRP_MAPPING_NEEDED").length,
      decisionsNeeded: items.filter((item) => item.type === "PURCHASE_DECISION_NEEDED").length,
      boughtThisWeek: completed.filter((item) => item.type === "BOUGHT_RECENTLY" && item.dueAt && new Date(item.dueAt) >= new Date(todayStart.getTime() - 6 * dayMs)).length,
      skippedThisWeek: completed.filter((item) => item.type === "SKIPPED_RECENTLY" && item.dueAt && new Date(item.dueAt) >= new Date(todayStart.getTime() - 6 * dayMs)).length
    };
  }
}
