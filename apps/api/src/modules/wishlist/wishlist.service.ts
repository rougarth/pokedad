import type { PrismaClient, WishlistAlertBehavior, WishlistPriority } from "@prisma/client";
import { AuditService } from "../../services/audit.service.js";
import { getStoreSafetyItem } from "../store-safety/store-safety-matrix.js";

export interface WishlistInput {
  name: string;
  setName?: string | null;
  categoryId?: string | null;
  storeKey?: string | null;
  priority: WishlistPriority;
  alertBehavior: WishlistAlertBehavior;
  desiredQuantity?: number | null;
  maxPriceCents?: number | null;
  allowedMarkupCents?: number | null;
  keywords: string[];
  isActive?: boolean;
  notes?: string | null;
}

export interface WishlistMatchInput {
  productName: string;
  setName?: string | null;
  categoryId?: string | null;
  categoryLabel?: string | null;
  storeKey?: string | null;
  sku?: string | null;
}

export interface WishlistItemDto {
  id: string;
  name: string;
  setName: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  categoryKind: string | null;
  storeKey: string | null;
  priority: WishlistPriority;
  alertBehavior: WishlistAlertBehavior;
  desiredQuantity: number | null;
  maxPriceCents: number | null;
  allowedMarkupCents: number | null;
  keywords: string[];
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistMatchResult {
  priority: WishlistPriority;
  alertBehavior: WishlistAlertBehavior;
  matchedItemId: string | null;
  matchedItemName: string | null;
  matchedSetName: string | null;
  desiredQuantity: number | null;
  maxPriceCents: number | null;
  allowedMarkupCents: number | null;
  ignored: boolean;
  dashboardOnly: boolean;
  shouldAlert: boolean;
  matchReasons: string[];
  matches: Array<WishlistItemDto & { matchReasons: string[]; score: number }>;
}

const priorityRank: Record<WishlistPriority, number> = {
  IGNORE: 60,
  URGENT: 50,
  HIGH: 40,
  NORMAL: 30,
  LOW: 20
};

function normalize(value?: string | null): string {
  return (value ?? "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function splitKeywords(value: string[]): string[] {
  return value.map((keyword) => normalize(keyword)).filter(Boolean);
}

export class WishlistService {
  private readonly audit: AuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
  }

  async list(ownerId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { ownerId },
      include: { category: true },
      orderBy: [{ isActive: "desc" }, { priority: "desc" }, { updatedAt: "desc" }]
    });
    return items.map((item) => this.mapItem(item));
  }

  async detail(ownerId: string, id: string) {
    const item = await this.prisma.wishlistItem.findFirst({ where: { id, ownerId }, include: { category: true } });
    return item ? this.mapItem(item) : null;
  }

  async create(ownerId: string, input: WishlistInput) {
    const item = await this.prisma.wishlistItem.create({
      data: {
        ownerId,
        name: input.name.trim(),
        setName: input.setName?.trim() || null,
        categoryId: input.categoryId || null,
        storeKey: input.storeKey?.trim() || null,
        priority: input.priority,
        alertBehavior: input.alertBehavior,
        desiredQuantity: input.desiredQuantity ?? null,
        maxPriceCents: input.maxPriceCents ?? null,
        allowedMarkupCents: input.allowedMarkupCents ?? null,
        keywords: splitKeywords(input.keywords),
        isActive: input.isActive ?? true,
        notes: input.notes?.trim() || null
      },
      include: { category: true }
    });
    await this.audit.log({ action: "WISHLIST_ITEM_CREATED", summary: "Wishlist item created.", actorUserId: ownerId, metadata: { wishlistItemId: item.id, priority: item.priority, alertBehavior: item.alertBehavior } });
    await this.logResearchOnlyStoreSelection(ownerId, item.storeKey, item.id);
    return this.mapItem(item);
  }

  async update(ownerId: string, id: string, patch: Partial<WishlistInput>) {
    const item = await this.prisma.wishlistItem.update({
      where: { id, ownerId },
      data: {
        name: patch.name?.trim(),
        setName: patch.setName === undefined ? undefined : patch.setName?.trim() || null,
        categoryId: patch.categoryId === undefined ? undefined : patch.categoryId || null,
        storeKey: patch.storeKey === undefined ? undefined : patch.storeKey?.trim() || null,
        priority: patch.priority,
        alertBehavior: patch.alertBehavior,
        desiredQuantity: patch.desiredQuantity === undefined ? undefined : patch.desiredQuantity ?? null,
        maxPriceCents: patch.maxPriceCents === undefined ? undefined : patch.maxPriceCents ?? null,
        allowedMarkupCents: patch.allowedMarkupCents === undefined ? undefined : patch.allowedMarkupCents ?? null,
        keywords: patch.keywords === undefined ? undefined : splitKeywords(patch.keywords),
        isActive: patch.isActive,
        notes: patch.notes === undefined ? undefined : patch.notes?.trim() || null
      },
      include: { category: true }
    }).catch(() => null);
    if (!item) return null;
    await this.audit.log({ action: "WISHLIST_ITEM_UPDATED", summary: "Wishlist item updated.", actorUserId: ownerId, metadata: { wishlistItemId: item.id, priority: item.priority, alertBehavior: item.alertBehavior } });
    await this.logResearchOnlyStoreSelection(ownerId, item.storeKey, item.id);
    return this.mapItem(item);
  }

  async delete(ownerId: string, id: string) {
    const item = await this.prisma.wishlistItem.delete({ where: { id, ownerId } }).catch(() => null);
    if (!item) return false;
    await this.audit.log({ action: "WISHLIST_ITEM_DELETED", summary: "Wishlist item deleted.", actorUserId: ownerId, metadata: { wishlistItemId: id } });
    return true;
  }

  async setEnabled(ownerId: string, id: string, enabled: boolean) {
    const item = await this.prisma.wishlistItem.update({ where: { id, ownerId }, data: { isActive: enabled }, include: { category: true } }).catch(() => null);
    if (!item) return null;
    await this.audit.log({
      action: enabled ? "WISHLIST_ITEM_ENABLED" : "WISHLIST_ITEM_DISABLED",
      summary: enabled ? "Wishlist item enabled." : "Wishlist item disabled.",
      actorUserId: ownerId,
      metadata: { wishlistItemId: id }
    });
    return this.mapItem(item);
  }

  async preview(ownerId: string, input: WishlistMatchInput) {
    const result = await this.matchProduct(ownerId, input);
    await this.audit.log({
      action: "WISHLIST_MATCH_PREVIEW_RUN",
      summary: "Wishlist match preview run.",
      actorUserId: ownerId,
      metadata: {
        productName: input.productName,
        storeKey: input.storeKey,
        categoryId: input.categoryId,
        resultPriority: result.priority,
        alertBehavior: result.alertBehavior,
        matchCount: result.matches.length
      }
    });
    return result;
  }

  async matchProduct(ownerId: string, input: WishlistMatchInput): Promise<WishlistMatchResult> {
    const items = await this.prisma.wishlistItem.findMany({ where: { ownerId, isActive: true }, include: { category: true } });
    const productText = normalize([input.productName, input.setName, input.categoryLabel, input.sku].filter(Boolean).join(" "));
    const matches = items.map((item): (WishlistItemDto & { matchReasons: string[]; score: number }) | null => {
      const reasons: string[] = [];
      let score = 0;
      if (item.storeKey && input.storeKey && normalize(item.storeKey) === normalize(input.storeKey)) {
        score += 2;
        reasons.push(`store:${item.storeKey}`);
      } else if (item.storeKey && input.storeKey && normalize(item.storeKey) !== normalize(input.storeKey)) {
        return null;
      }
      if (item.categoryId && input.categoryId && item.categoryId === input.categoryId) {
        score += 3;
        reasons.push(`category:${item.category?.label ?? item.categoryId}`);
      }
      if (item.setName && productText.includes(normalize(item.setName))) {
        score += 4;
        reasons.push(`set:${item.setName}`);
      }
      for (const keyword of splitKeywords(item.keywords)) {
        if (productText.includes(keyword)) {
          score += 2;
          reasons.push(`keyword:${keyword}`);
        }
      }
      const itemName = normalize(item.name);
      if (itemName && productText.includes(itemName)) {
        score += 2;
        reasons.push(`name:${item.name}`);
      }
      if (score === 0) return null;
      return { ...this.mapItem(item), matchReasons: [...new Set(reasons)], score };
    }).filter((item): item is WishlistItemDto & { matchReasons: string[]; score: number } => item != null)
      .sort((a, b) => (priorityRank[b.priority] + b.score) - (priorityRank[a.priority] + a.score));

    const best = matches[0] ?? null;
    const priority = best?.priority ?? "NORMAL";
    const alertBehavior = best?.alertBehavior ?? "ALERT_IMMEDIATELY";
    const ignored = priority === "IGNORE" || alertBehavior === "DO_NOT_ALERT";
    const dashboardOnly = alertBehavior === "DASHBOARD_ONLY" || alertBehavior === "REVIEW_FIRST";
    return {
      priority,
      alertBehavior,
      matchedItemId: best?.id ?? null,
      matchedItemName: best?.name ?? null,
      matchedSetName: best?.setName ?? null,
      desiredQuantity: best?.desiredQuantity ?? null,
      maxPriceCents: best?.maxPriceCents ?? null,
      allowedMarkupCents: best?.allowedMarkupCents ?? null,
      ignored,
      dashboardOnly,
      shouldAlert: !ignored && !dashboardOnly,
      matchReasons: best?.matchReasons ?? [],
      matches
    };
  }

  mapItem(item: {
    id: string;
    name: string;
    setName: string | null;
    categoryId: string | null;
    category?: { label: string; kind: string } | null;
    storeKey: string | null;
    priority: WishlistPriority;
    alertBehavior: WishlistAlertBehavior;
    desiredQuantity: number | null;
    maxPriceCents: number | null;
    allowedMarkupCents: number | null;
    keywords: string[];
    isActive: boolean;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      name: item.name,
      setName: item.setName,
      categoryId: item.categoryId,
      categoryLabel: item.category?.label ?? null,
      categoryKind: item.category?.kind ?? null,
      storeKey: item.storeKey,
      priority: item.priority,
      alertBehavior: item.alertBehavior,
      desiredQuantity: item.desiredQuantity,
      maxPriceCents: item.maxPriceCents,
      allowedMarkupCents: item.allowedMarkupCents,
      keywords: item.keywords,
      isActive: item.isActive,
      notes: item.notes,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    };
  }

  private async logResearchOnlyStoreSelection(ownerId: string, storeKey: string | null, wishlistItemId: string) {
    if (!storeKey) return;
    const safety = getStoreSafetyItem(storeKey);
    if (!safety || safety.recommendedMode === "OFFICIAL_API_CANDIDATE") return;
    await this.audit.log({
      action: "RESEARCH_ONLY_STORE_SELECTED_IN_WISHLIST",
      summary: "Research-only store selected in wishlist for manual reference.",
      actorUserId: ownerId,
      metadata: {
        wishlistItemId,
        storeKey,
        recommendedMode: safety.recommendedMode,
        riskLevel: safety.riskLevel,
        liveScannerEnabled: false
      }
    });
  }
}
