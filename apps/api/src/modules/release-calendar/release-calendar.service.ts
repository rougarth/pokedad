import type { AlertPriority, PrismaClient, ReleaseCalendarStatus, ReleaseReminderOffset } from "@prisma/client";
import { AuditService } from "../../services/audit.service.js";
import { AlertDeliveryService } from "../alerts/alert-delivery.service.js";
import { ManualStoreLinkService } from "../manual-store-links/manual-store-link.service.js";

export interface ReleaseCalendarInput {
  title: string;
  setName?: string | null;
  productName?: string | null;
  categoryId?: string | null;
  releaseDate: Date;
  timezone?: string | null;
  priority: AlertPriority;
  status: ReleaseCalendarStatus;
  wishlistItemId?: string | null;
  notes?: string | null;
  isActive?: boolean;
  discordReminder?: boolean;
  reminderOffsets: ReleaseReminderOffset[];
  manualStoreLinkIds?: string[];
}

const offsetLabels: Record<ReleaseReminderOffset, string> = {
  SEVEN_DAYS: "7 days before",
  THREE_DAYS: "3 days before",
  ONE_DAY: "1 day before",
  TWELVE_HOURS: "12 hours before",
  ONE_HOUR: "1 hour before",
  AT_RELEASE: "At release time"
};

function offsetMs(offset: ReleaseReminderOffset): number {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  return offset === "SEVEN_DAYS" ? 7 * day
    : offset === "THREE_DAYS" ? 3 * day
      : offset === "ONE_DAY" ? day
        : offset === "TWELVE_HOURS" ? 12 * hour
          : offset === "ONE_HOUR" ? hour
            : 0;
}

function nextReminder(releaseDate: Date, offsets: ReleaseReminderOffset[]): string | null {
  const now = Date.now();
  const candidates = offsets
    .map((offset) => new Date(releaseDate.getTime() - offsetMs(offset)))
    .filter((date) => date.getTime() >= now)
    .sort((a, b) => a.getTime() - b.getTime());
  return candidates[0]?.toISOString() ?? null;
}

function formatDate(value: Date, timezone?: string | null): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone || "America/New_York"
  }).format(value);
}

export class ReleaseCalendarService {
  private readonly audit: AuditService;
  private readonly delivery: AlertDeliveryService;
  private readonly manualLinks: ManualStoreLinkService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
    this.delivery = new AlertDeliveryService(prisma);
    this.manualLinks = new ManualStoreLinkService(prisma);
  }

  async list(ownerId: string, filter?: { upcoming?: boolean }) {
    const now = new Date();
    const items = await this.prisma.releaseCalendarItem.findMany({
      where: { ownerId, ...(filter?.upcoming ? { isActive: true, releaseDate: { gte: now }, status: { in: ["PLANNED", "UPCOMING", "WATCHING"] } } : {}) },
      include: this.include(),
      orderBy: [{ releaseDate: "asc" }, { priority: "desc" }]
    });
    return items.map((item) => this.mapItem(item));
  }

  async detail(ownerId: string, id: string) {
    const item = await this.prisma.releaseCalendarItem.findFirst({ where: { id, ownerId }, include: this.include() });
    return item ? this.mapItem(item) : null;
  }

  async create(ownerId: string, input: ReleaseCalendarInput) {
    const item = await this.prisma.releaseCalendarItem.create({
      data: {
        ownerId,
        title: input.title.trim(),
        setName: input.setName?.trim() || null,
        productName: input.productName?.trim() || null,
        categoryId: input.categoryId || null,
        releaseDate: input.releaseDate,
        timezone: input.timezone?.trim() || "America/New_York",
        priority: input.priority,
        status: input.status,
        wishlistItemId: input.wishlistItemId || null,
        notes: input.notes?.trim() || null,
        isActive: input.isActive ?? true,
        discordReminder: input.discordReminder ?? true,
        reminderOffsets: input.reminderOffsets,
        manualLinks: { create: (input.manualStoreLinkIds ?? []).map((manualStoreLinkId) => ({ manualStoreLinkId })) }
      },
      include: this.include()
    });
    await this.audit.log({ action: "RELEASE_CALENDAR_ITEM_CREATED", summary: "Release calendar item created.", actorUserId: ownerId, metadata: { releaseCalendarItemId: item.id, priority: item.priority, status: item.status, manualOnly: true } });
    return this.mapItem(item);
  }

  async update(ownerId: string, id: string, patch: Partial<ReleaseCalendarInput>) {
    const existing = await this.prisma.releaseCalendarItem.findFirst({ where: { id, ownerId } });
    if (!existing) return null;
    const item = await this.prisma.$transaction(async (tx) => {
      if (patch.manualStoreLinkIds) {
        await tx.releaseCalendarManualStoreLink.deleteMany({ where: { releaseCalendarItemId: id } });
        if (patch.manualStoreLinkIds.length) {
          await tx.releaseCalendarManualStoreLink.createMany({
            data: patch.manualStoreLinkIds.map((manualStoreLinkId) => ({ releaseCalendarItemId: id, manualStoreLinkId })),
            skipDuplicates: true
          });
        }
      }
      return tx.releaseCalendarItem.update({
        where: { id },
        data: {
          title: patch.title?.trim(),
          setName: patch.setName === undefined ? undefined : patch.setName?.trim() || null,
          productName: patch.productName === undefined ? undefined : patch.productName?.trim() || null,
          categoryId: patch.categoryId === undefined ? undefined : patch.categoryId || null,
          releaseDate: patch.releaseDate,
          timezone: patch.timezone === undefined ? undefined : patch.timezone?.trim() || "America/New_York",
          priority: patch.priority,
          status: patch.status,
          wishlistItemId: patch.wishlistItemId === undefined ? undefined : patch.wishlistItemId || null,
          notes: patch.notes === undefined ? undefined : patch.notes?.trim() || null,
          isActive: patch.isActive,
          discordReminder: patch.discordReminder,
          reminderOffsets: patch.reminderOffsets
        },
        include: this.include()
      });
    });
    await this.audit.log({ action: "RELEASE_CALENDAR_ITEM_UPDATED", summary: "Release calendar item updated.", actorUserId: ownerId, metadata: { releaseCalendarItemId: id, priority: item.priority, status: item.status } });
    return this.mapItem(item);
  }

  async delete(ownerId: string, id: string) {
    const existing = await this.prisma.releaseCalendarItem.findFirst({ where: { id, ownerId } });
    if (!existing) return false;
    await this.prisma.releaseCalendarItem.delete({ where: { id } });
    await this.audit.log({ action: "RELEASE_CALENDAR_ITEM_DELETED", summary: "Release calendar item deleted.", actorUserId: ownerId, metadata: { releaseCalendarItemId: id } });
    return true;
  }

  async setEnabled(ownerId: string, id: string, enabled: boolean) {
    const existing = await this.prisma.releaseCalendarItem.findFirst({ where: { id, ownerId } });
    if (!existing) return null;
    const item = await this.prisma.releaseCalendarItem.update({ where: { id }, data: { isActive: enabled }, include: this.include() });
    await this.audit.log({ action: enabled ? "RELEASE_CALENDAR_ITEM_ENABLED" : "RELEASE_CALENDAR_ITEM_DISABLED", summary: enabled ? "Release calendar item enabled." : "Release calendar item disabled.", actorUserId: ownerId, metadata: { releaseCalendarItemId: id } });
    return this.mapItem(item);
  }

  async markStatus(ownerId: string, id: string, status: Extract<ReleaseCalendarStatus, "RELEASED" | "BOUGHT" | "SKIPPED">) {
    const existing = await this.prisma.releaseCalendarItem.findFirst({ where: { id, ownerId } });
    if (!existing) return null;
    const item = await this.prisma.releaseCalendarItem.update({ where: { id }, data: { status }, include: this.include() });
    const action = status === "RELEASED" ? "RELEASE_CALENDAR_MARKED_RELEASED" : status === "BOUGHT" ? "RELEASE_CALENDAR_MARKED_BOUGHT" : "RELEASE_CALENDAR_MARKED_SKIPPED";
    await this.audit.log({ action, summary: `Release calendar item marked ${status.toLowerCase()}.`, actorUserId: ownerId, metadata: { releaseCalendarItemId: id, status } });
    return this.mapItem(item);
  }

  async openRelatedLink(ownerId: string, releaseId: string, linkId: string) {
    const relation = await this.prisma.releaseCalendarManualStoreLink.findFirst({
      where: { releaseCalendarItemId: releaseId, manualStoreLinkId: linkId, releaseCalendarItem: { ownerId } }
    });
    if (!relation) return null;
    const link = await this.manualLinks.opened(ownerId, linkId);
    await this.audit.log({ action: "RELEASE_RELATED_MANUAL_LINK_OPENED", summary: "Related manual link opened from release calendar.", actorUserId: ownerId, metadata: { releaseCalendarItemId: releaseId, manualStoreLinkId: linkId, backendFetchedRetailerUrl: false } });
    return link;
  }

  async sendTestReminder(ownerId: string, id: string) {
    const item = await this.prisma.releaseCalendarItem.findFirst({ where: { id, ownerId }, include: this.include() });
    if (!item) return null;
    const message = this.buildReminderMessage(item, true);
    const event = await this.prisma.alertEvent.create({
      data: {
        ownerId,
        type: "RELEASE_REMINDER",
        templateType: "TEST_RELEASE_REMINDER",
        title: "TEST RELEASE REMINDER - PokeDad Radar",
        priority: item.priority,
        status: "PENDING",
        message
      }
    });
    const result = await this.delivery.deliverEvent(ownerId, event.id);
    const delivered = result.deliveries.some((delivery) => delivery.status === "SENT");
    await this.audit.log({
      action: delivered ? "RELEASE_REMINDER_TEST_SENT" : "RELEASE_REMINDER_DELIVERY_FAILED",
      summary: delivered ? "Test release reminder delivered." : "Test release reminder failed safely.",
      actorUserId: ownerId,
      metadata: { releaseCalendarItemId: id, alertEventId: event.id, delivered, deliveryCount: result.deliveries.length }
    });
    if (delivered) {
      await this.audit.log({ action: "RELEASE_REMINDER_DELIVERED", summary: "Release reminder delivered.", actorUserId: ownerId, metadata: { releaseCalendarItemId: id, alertEventId: event.id } });
    }
    return { alertEventId: event.id, delivered, deliveries: result.deliveries };
  }

  private buildReminderMessage(item: ReleaseItemWithIncludes, test: boolean) {
    const links = item.manualLinks.map((relation) => `- ${relation.manualStoreLink.storeDisplayName}: ${relation.manualStoreLink.title}`).slice(0, 8);
    return [
      test ? "TEST RELEASE REMINDER - PokeDad Radar" : "PokeDad Radar Release Reminder",
      "",
      `${item.setName ?? "Pokemon TCG"} - ${item.productName ?? item.title}`,
      `Release: ${formatDate(item.releaseDate, item.timezone)}`,
      `Priority: ${item.priority}`,
      item.wishlistItem ? `Wishlist: ${item.wishlistItem.name}` : null,
      "",
      "Manual links ready:",
      links.length ? links.join("\n") : "- No manual links attached yet",
      "",
      "Reminder only - no retailer request was made."
    ].filter((line): line is string => line != null).join("\n");
  }

  private include() {
    return {
      category: true,
      wishlistItem: true,
      manualLinks: { include: { manualStoreLink: { include: { wishlistItem: true, category: true } } }, orderBy: { createdAt: "asc" as const } }
    };
  }

  private mapItem(item: ReleaseItemWithIncludes) {
    return {
      id: item.id,
      title: item.title,
      setName: item.setName,
      productName: item.productName,
      categoryId: item.categoryId,
      categoryLabel: item.category?.label ?? null,
      releaseDate: item.releaseDate.toISOString(),
      timezone: item.timezone,
      priority: item.priority,
      status: item.status,
      wishlistItemId: item.wishlistItemId,
      wishlistItemName: item.wishlistItem?.name ?? null,
      notes: item.notes,
      isActive: item.isActive,
      discordReminder: item.discordReminder,
      reminderOffsets: item.reminderOffsets,
      reminderOffsetLabels: item.reminderOffsets.map((offset) => offsetLabels[offset]),
      nextReminderAt: nextReminder(item.releaseDate, item.reminderOffsets),
      manualStoreLinks: item.manualLinks.map((relation) => this.manualLinks.mapLink(relation.manualStoreLink)),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    };
  }
}

type ReleaseItemWithIncludes = {
  id: string;
  ownerId: string;
  title: string;
  setName: string | null;
  productName: string | null;
  categoryId: string | null;
  releaseDate: Date;
  timezone: string | null;
  priority: AlertPriority;
  status: ReleaseCalendarStatus;
  wishlistItemId: string | null;
  notes: string | null;
  isActive: boolean;
  discordReminder: boolean;
  reminderOffsets: ReleaseReminderOffset[];
  createdAt: Date;
  updatedAt: Date;
  category?: { label: string } | null;
  wishlistItem?: { name: string } | null;
  manualLinks: Array<{ manualStoreLink: Parameters<ManualStoreLinkService["mapLink"]>[0] }>;
};
