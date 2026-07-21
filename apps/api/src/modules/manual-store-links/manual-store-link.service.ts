import type { ManualStoreLinkType, PrismaClient, WishlistPriority } from "@prisma/client";
import { AuditService } from "../../services/audit.service.js";
import { getStoreSafetyItem } from "../store-safety/store-safety-matrix.js";

export interface ManualStoreLinkInput {
  storeKey: string;
  title: string;
  url: string;
  linkType: ManualStoreLinkType;
  priority: WishlistPriority;
  wishlistItemId?: string | null;
  setName?: string | null;
  categoryId?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

function validateManualUrl(value: string): string {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Manual store link URL must start with http or https.");
  }
  return url.toString();
}

function fallbackDisplayName(storeKey: string): string {
  return storeKey.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function warningFor(storeKey: string): string {
  const safety = getStoreSafetyItem(storeKey);
  if (!safety) return "Manual link only. No scanner, scraping, cart, checkout, or automation is active.";
  if (storeKey === "target") return "Target is blocked for automation. This link is manual/open-only. No scanning, scraping, cart, or checkout automation is allowed.";
  if (storeKey === "pokemon-center") return "Pokemon Center is manual/open-only. If queue or human verification appears, handle it manually.";
  if (storeKey === "best-buy") return "Best Buy API approval is pending. Manual links can be saved, but live scans remain paused until API key is configured.";
  if (["costco", "sams-club", "bjs"].includes(storeKey)) return "This store is research pending. Manual link tracking only. No live scan is active.";
  if (safety.recommendedMode !== "OFFICIAL_API_CANDIDATE") return `${safety.displayName} is ${safety.recommendedMode}. Manual link tracking only; no live scan is active.`;
  return "Manual link only. Open Product remains user-controlled.";
}

export class ManualStoreLinkService {
  private readonly audit: AuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
  }

  async list(ownerId: string) {
    const links = await this.prisma.manualStoreLink.findMany({
      where: { ownerId },
      include: { wishlistItem: true, category: true },
      orderBy: [{ isActive: "desc" }, { priority: "desc" }, { updatedAt: "desc" }]
    });
    return links.map((link) => this.mapLink(link));
  }

  async detail(ownerId: string, id: string) {
    const link = await this.prisma.manualStoreLink.findFirst({ where: { id, ownerId }, include: { wishlistItem: true, category: true } });
    return link ? this.mapLink(link) : null;
  }

  async create(ownerId: string, input: ManualStoreLinkInput) {
    const safety = getStoreSafetyItem(input.storeKey);
    const link = await this.prisma.manualStoreLink.create({
      data: {
        ownerId,
        storeKey: input.storeKey,
        storeDisplayName: safety?.displayName ?? fallbackDisplayName(input.storeKey),
        title: input.title.trim(),
        url: validateManualUrl(input.url),
        linkType: input.linkType,
        priority: input.priority,
        wishlistItemId: input.wishlistItemId || null,
        setName: input.setName?.trim() || null,
        categoryId: input.categoryId || null,
        notes: input.notes?.trim() || null,
        isActive: input.isActive ?? true
      },
      include: { wishlistItem: true, category: true }
    });
    await this.audit.log({ action: "MANUAL_STORE_LINK_CREATED", summary: "Manual store link created.", actorUserId: ownerId, metadata: { manualStoreLinkId: link.id, storeKey: link.storeKey, linkType: link.linkType, priority: link.priority } });
    if (link.wishlistItemId) {
      await this.audit.log({ action: "MANUAL_STORE_LINK_ATTACHED_TO_WISHLIST", summary: "Manual store link attached to wishlist item.", actorUserId: ownerId, metadata: { manualStoreLinkId: link.id, wishlistItemId: link.wishlistItemId } });
    }
    return this.mapLink(link);
  }

  async update(ownerId: string, id: string, patch: Partial<ManualStoreLinkInput>) {
    const storeKey = patch.storeKey;
    const safety = storeKey ? getStoreSafetyItem(storeKey) : null;
    const link = await this.prisma.manualStoreLink.update({
      where: { id, ownerId },
      data: {
        storeKey,
        storeDisplayName: storeKey ? safety?.displayName ?? fallbackDisplayName(storeKey) : undefined,
        title: patch.title?.trim(),
        url: patch.url == null ? undefined : validateManualUrl(patch.url),
        linkType: patch.linkType,
        priority: patch.priority,
        wishlistItemId: patch.wishlistItemId === undefined ? undefined : patch.wishlistItemId || null,
        setName: patch.setName === undefined ? undefined : patch.setName?.trim() || null,
        categoryId: patch.categoryId === undefined ? undefined : patch.categoryId || null,
        notes: patch.notes === undefined ? undefined : patch.notes?.trim() || null,
        isActive: patch.isActive
      },
      include: { wishlistItem: true, category: true }
    }).catch(() => null);
    if (!link) return null;
    await this.audit.log({ action: "MANUAL_STORE_LINK_UPDATED", summary: "Manual store link updated.", actorUserId: ownerId, metadata: { manualStoreLinkId: link.id, storeKey: link.storeKey, linkType: link.linkType, priority: link.priority } });
    if (patch.wishlistItemId) {
      await this.audit.log({ action: "MANUAL_STORE_LINK_ATTACHED_TO_WISHLIST", summary: "Manual store link attached to wishlist item.", actorUserId: ownerId, metadata: { manualStoreLinkId: link.id, wishlistItemId: patch.wishlistItemId } });
    }
    return this.mapLink(link);
  }

  async delete(ownerId: string, id: string) {
    const link = await this.prisma.manualStoreLink.delete({ where: { id, ownerId } }).catch(() => null);
    if (!link) return false;
    await this.audit.log({ action: "MANUAL_STORE_LINK_DELETED", summary: "Manual store link deleted.", actorUserId: ownerId, metadata: { manualStoreLinkId: id, storeKey: link.storeKey } });
    return true;
  }

  async setEnabled(ownerId: string, id: string, enabled: boolean) {
    const link = await this.prisma.manualStoreLink.update({ where: { id, ownerId }, data: { isActive: enabled }, include: { wishlistItem: true, category: true } }).catch(() => null);
    if (!link) return null;
    await this.audit.log({ action: enabled ? "MANUAL_STORE_LINK_ENABLED" : "MANUAL_STORE_LINK_DISABLED", summary: enabled ? "Manual store link enabled." : "Manual store link disabled.", actorUserId: ownerId, metadata: { manualStoreLinkId: id, storeKey: link.storeKey } });
    return this.mapLink(link);
  }

  async opened(ownerId: string, id: string) {
    const link = await this.prisma.manualStoreLink.update({
      where: { id, ownerId },
      data: { lastOpenedAt: new Date(), openCount: { increment: 1 } },
      include: { wishlistItem: true, category: true }
    }).catch(() => null);
    if (!link) return null;
    await this.audit.log({ action: "MANUAL_STORE_LINK_OPENED", summary: "Manual store link opened by user.", actorUserId: ownerId, metadata: { manualStoreLinkId: id, storeKey: link.storeKey, manualOnly: true, backendFetchedRetailerUrl: false } });
    return this.mapLink(link);
  }

  mapLink(link: {
    id: string;
    storeKey: string;
    storeDisplayName: string;
    title: string;
    url: string;
    linkType: ManualStoreLinkType;
    priority: WishlistPriority;
    wishlistItemId: string | null;
    wishlistItem?: { name: string } | null;
    setName: string | null;
    categoryId: string | null;
    category?: { label: string } | null;
    notes: string | null;
    isActive: boolean;
    lastOpenedAt: Date | null;
    openCount: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const safety = getStoreSafetyItem(link.storeKey);
    return {
      id: link.id,
      storeKey: link.storeKey,
      storeDisplayName: link.storeDisplayName,
      title: link.title,
      url: link.url,
      linkType: link.linkType,
      priority: link.priority,
      wishlistItemId: link.wishlistItemId,
      wishlistItemName: link.wishlistItem?.name ?? null,
      setName: link.setName,
      categoryId: link.categoryId,
      categoryLabel: link.category?.label ?? null,
      notes: link.notes,
      isActive: link.isActive,
      lastOpenedAt: link.lastOpenedAt?.toISOString() ?? null,
      openCount: link.openCount,
      safetyMode: safety?.recommendedMode ?? "MANUAL_OPEN_ONLY",
      riskLevel: safety?.riskLevel ?? "UNKNOWN",
      warningMessage: warningFor(link.storeKey),
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString()
    };
  }
}
