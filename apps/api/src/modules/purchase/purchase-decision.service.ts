import type { PrismaClient, PurchaseDecision, PurchaseDecisionStatus, PurchaseSkipReason, StockCheckResult } from "@prisma/client";
import { SkipReason } from "@pokedad-radar/shared";
import { AuditService } from "../../services/audit.service.js";

export interface PurchaseDecisionInput {
  quantity?: number | null;
  finalPriceCents?: number | null;
  note?: string | null;
  skipReason?: PurchaseSkipReason | null;
  snoozedUntil?: Date | null;
}

const include = {
  stockCheckResult: {
    include: {
      store: true,
      retailerProduct: true,
      alertEvents: { include: { deliveries: true }, orderBy: { createdAt: "desc" as const } }
    }
  }
};

type DecisionWithStock = PurchaseDecision & {
  stockCheckResult: StockCheckResult & {
    store: { id: string; name: string; slug: string; cartUrl: string | null; baseUrl: string };
    retailerProduct: { id: string; name: string; productUrl: string; imageUrl: string | null; externalId: string | null };
    alertEvents: Array<{ id: string; status: string; deliveries: Array<{ status: string }> }>;
  };
};

function stockSkipReason(reason?: PurchaseSkipReason | null): SkipReason {
  if (reason === "PRICE_TOO_HIGH") return SkipReason.PRICE_ABOVE_MAX;
  if (reason === "SOLD_OUT") return SkipReason.STORE_DISABLED;
  if (reason === "NEEDS_REVIEW") return SkipReason.HUMAN_CHECK_REQUIRED;
  return SkipReason.NONE;
}

function sanitizeNote(note?: string | null): string | null {
  if (!note) return null;
  return note
    .replace(/password|token|cookie|authorization|cvv|card/gi, "[redacted]")
    .slice(0, 1000);
}

export class PurchaseDecisionService {
  private readonly audit: AuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
  }

  async list(ownerId: string) {
    const decisions = await this.prisma.purchaseDecision.findMany({
      where: { ownerId },
      include,
      orderBy: { updatedAt: "desc" },
      take: 200
    });
    return decisions.map((decision) => this.toView(decision));
  }

  async detail(ownerId: string, id: string) {
    const decision = await this.prisma.purchaseDecision.findFirst({ where: { id, ownerId }, include });
    return decision ? this.toView(decision) : null;
  }

  async forStock(ownerId: string, stockCheckResultId: string) {
    const decision = await this.prisma.purchaseDecision.findFirst({ where: { ownerId, stockCheckResultId }, include });
    return decision ? this.toView(decision) : null;
  }

  async opened(ownerId: string, stockCheckResultId: string) {
    const decision = await this.upsert(ownerId, stockCheckResultId, { status: "OPENED", openedAt: new Date() });
    await this.log(ownerId, "PURCHASE_CHECKLIST_VIEWED", "Manual checkout checklist viewed before opening product.", decision, { stockCheckResultId });
    await this.log(ownerId, "PURCHASE_PRODUCT_OPENED", "Product opened for manual checkout review.", decision, { stockCheckResultId });
    await this.log(ownerId, "PURCHASE_DECISION_CHANGED", "Purchase decision changed to OPENED.", decision, { status: "OPENED" });
    return decision;
  }

  async bought(ownerId: string, stockCheckResultId: string, input: PurchaseDecisionInput) {
    const note = sanitizeNote(input.note);
    const decision = await this.upsert(ownerId, stockCheckResultId, {
      status: "BOUGHT",
      quantity: input.quantity ?? undefined,
      finalPriceCents: input.finalPriceCents ?? undefined,
      note: note ?? undefined,
      boughtAt: new Date()
    });
    await this.prisma.stockCheckResult.update({ where: { id: stockCheckResultId }, data: { bought: true, ignored: false } });
    await this.log(ownerId, "PURCHASE_MARKED_BOUGHT", "Product marked bought manually.", decision, { quantity: input.quantity ?? null, finalPriceCents: input.finalPriceCents ?? null });
    await this.log(ownerId, "PURCHASE_DECISION_CHANGED", "Purchase decision changed to BOUGHT.", decision, { status: "BOUGHT" });
    return decision;
  }

  async skipped(ownerId: string, stockCheckResultId: string, input: PurchaseDecisionInput) {
    const skipReason = input.skipReason ?? "OTHER";
    const status: PurchaseDecisionStatus = skipReason === "PRICE_TOO_HIGH"
      ? "TOO_EXPENSIVE"
      : skipReason === "SOLD_OUT"
        ? "SOLD_OUT"
        : skipReason === "NOT_INTERESTED"
          ? "NOT_INTERESTED"
          : skipReason === "NEEDS_REVIEW"
            ? "NEEDS_MAPPING"
            : "SKIPPED";
    const decision = await this.upsert(ownerId, stockCheckResultId, {
      status,
      skipReason,
      note: sanitizeNote(input.note) ?? undefined,
      skippedAt: new Date()
    });
    await this.prisma.stockCheckResult.update({
      where: { id: stockCheckResultId },
      data: { ignored: true, skipReason: stockSkipReason(skipReason) }
    });
    await this.log(ownerId, "PURCHASE_MARKED_SKIPPED", "Product marked skipped manually.", decision, { skipReason });
    await this.log(ownerId, "PURCHASE_DECISION_CHANGED", `Purchase decision changed to ${status}.`, decision, { status, skipReason });
    return decision;
  }

  async snooze(ownerId: string, stockCheckResultId: string, snoozedUntil: Date, note?: string | null) {
    const decision = await this.upsert(ownerId, stockCheckResultId, {
      status: "SNOOZED",
      snoozedUntil,
      note: sanitizeNote(note) ?? undefined
    });
    await this.prisma.stockCheckResult.update({ where: { id: stockCheckResultId }, data: { snoozedUntil } });
    await this.log(ownerId, "PURCHASE_SNOOZED", "Product snoozed manually.", decision, { snoozedUntil: snoozedUntil.toISOString() });
    await this.log(ownerId, "PURCHASE_DECISION_CHANGED", "Purchase decision changed to SNOOZED.", decision, { status: "SNOOZED" });
    return decision;
  }

  async unsnooze(ownerId: string, stockCheckResultId: string) {
    const current = await this.prisma.purchaseDecision.findFirst({ where: { ownerId, stockCheckResultId } });
    const decision = await this.upsert(ownerId, stockCheckResultId, {
      status: current?.openedAt ? "OPENED" : "NEW",
      snoozedUntil: null
    });
    await this.prisma.stockCheckResult.update({ where: { id: stockCheckResultId }, data: { snoozedUntil: null } });
    await this.log(ownerId, "PURCHASE_UNSNOOZED", "Product unsnoozed manually.", decision, { stockCheckResultId });
    await this.log(ownerId, "PURCHASE_DECISION_CHANGED", `Purchase decision changed to ${decision?.status ?? "NEW"}.`, decision, { status: decision?.status ?? "NEW" });
    return decision;
  }

  async updateNote(ownerId: string, stockCheckResultId: string, note: string | null) {
    const decision = await this.upsert(ownerId, stockCheckResultId, { note: sanitizeNote(note) });
    await this.log(ownerId, "PURCHASE_NOTE_UPDATED", "Private purchase note updated.", decision, { stockCheckResultId, noteLength: note?.length ?? 0 });
    await this.log(ownerId, "PURCHASE_DECISION_CHANGED", "Purchase decision note changed.", decision, { status: decision?.status ?? "NEW" });
    return decision;
  }

  private async upsert(ownerId: string, stockCheckResultId: string, data: {
    status?: PurchaseDecisionStatus;
    skipReason?: PurchaseSkipReason | null;
    note?: string | null;
    quantity?: number | null;
    finalPriceCents?: number | null;
    openedAt?: Date | null;
    boughtAt?: Date | null;
    skippedAt?: Date | null;
    snoozedUntil?: Date | null;
  }) {
    const stock = await this.prisma.stockCheckResult.findFirst({ where: { id: stockCheckResultId, store: { ownerId } } });
    if (!stock) return null;
    const decision = await this.prisma.purchaseDecision.upsert({
      where: { stockCheckResultId },
      create: {
        ownerId,
        stockCheckResultId,
        status: data.status ?? "NEW",
        skipReason: data.skipReason ?? undefined,
        note: data.note ?? undefined,
        quantity: data.quantity ?? undefined,
        finalPriceCents: data.finalPriceCents ?? undefined,
        openedAt: data.openedAt ?? undefined,
        boughtAt: data.boughtAt ?? undefined,
        skippedAt: data.skippedAt ?? undefined,
        snoozedUntil: data.snoozedUntil ?? undefined
      },
      update: data,
      include
    });
    return this.toView(decision);
  }

  private toView(decision: DecisionWithStock) {
    const stock = decision.stockCheckResult;
    const alertStatuses = stock.alertEvents.flatMap((event) => event.deliveries.map((delivery) => delivery.status));
    return {
      id: decision.id,
      stockCheckResultId: decision.stockCheckResultId,
      status: decision.status,
      skipReason: decision.skipReason,
      note: decision.note,
      quantity: decision.quantity,
      finalPriceCents: decision.finalPriceCents,
      openedAt: decision.openedAt?.toISOString() ?? null,
      boughtAt: decision.boughtAt?.toISOString() ?? null,
      skippedAt: decision.skippedAt?.toISOString() ?? null,
      snoozedUntil: decision.snoozedUntil?.toISOString() ?? stock.snoozedUntil?.toISOString() ?? null,
      updatedAt: decision.updatedAt.toISOString(),
      product: {
        id: stock.retailerProduct.id,
        name: stock.retailerProduct.name,
        imageUrl: stock.retailerProduct.imageUrl,
        productUrl: stock.retailerProduct.productUrl,
        sku: stock.retailerProduct.externalId,
        storeName: stock.store.name,
        storeSlug: stock.store.slug,
        priceCents: stock.priceCents,
        msrpCents: stock.msrpCents,
        acceptedMaxPriceCents: stock.acceptedMaxPriceCents,
        priceStatus: stock.priceStatus,
        stockStatus: stock.stockStatus,
        source: (stock.rawMetadata as Record<string, unknown> | null)?.source ?? "MANUAL",
        lastSeenAt: stock.checkedAt.toISOString(),
        alertDeliveryStatus: alertStatuses.includes("SENT") ? "SENT" : alertStatuses[0] ?? stock.alertStatus
      }
    };
  }

  private async log(ownerId: string, action: Parameters<AuditService["log"]>[0]["action"], summary: string, decision: ReturnType<PurchaseDecisionService["toView"]> | null, metadata: Record<string, unknown>) {
    await this.audit.log({
      action,
      summary,
      actorUserId: ownerId,
      metadata: {
        ...metadata,
        purchaseDecisionId: decision?.id ?? null,
        status: decision?.status ?? null,
        stockCheckResultId: decision?.stockCheckResultId ?? null
      }
    });
  }
}
