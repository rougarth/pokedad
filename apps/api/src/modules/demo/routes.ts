import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CartAssistMode, CartAssistStatus, type DemoRadarRules } from "@pokedad-radar/shared";
import { DashboardRepository } from "../../repositories/dashboard.repository.js";
import { assertNoSensitiveKeys } from "../../security/sanitizer.js";
import { AuditService } from "../../services/audit.service.js";
import { PurchaseDecisionService } from "../purchase/purchase-decision.service.js";

const patchStoreSchema = z.object({
  monitoringEnabled: z.boolean().optional(),
  cartAssistMode: z.nativeEnum(CartAssistMode).optional(),
  defaultToleranceCents: z.number().int().nonnegative().optional(),
  lastError: z.string().max(500).optional()
});

const priceRuleSchema = z.object({
  label: z.string().min(1),
  scope: z.enum(["GLOBAL", "STORE", "CATEGORY", "PRODUCT"]),
  target: z.string().min(1),
  msrpCents: z.number().int().nonnegative().nullable().optional(),
  allowedMarkupCents: z.number().int().nonnegative(),
  maxAcceptedPriceCents: z.number().int().nonnegative().nullable().optional(),
  storeSpecificToleranceCents: z.number().int().nonnegative().nullable().optional(),
  categorySpecificToleranceCents: z.number().int().nonnegative().nullable().optional(),
  productSpecificOverrideCents: z.number().int().nonnegative().nullable().optional(),
  enabled: z.boolean().default(true)
});

const radarRulesSchema = z.object({
  monitorAllSealed: z.boolean(),
  selectedCategories: z.array(z.string()),
  monitorNewReleases: z.boolean(),
  ignoreSingles: z.boolean(),
  ignoreThirdPartySellers: z.boolean(),
  shippingPreferred: z.boolean(),
  pickupPreferred: z.boolean(),
  pickupZip: z.string(),
  pickupRadiusMiles: z.number().int().nonnegative(),
  quantityWantedPerProduct: z.number().int().positive(),
  maxQuantityPerStoreProduct: z.number().int().positive()
});

const boughtSchema = z.object({
  quantity: z.number().int().min(1).max(24).optional(),
  finalPriceCents: z.number().int().min(0).max(1_000_000).optional(),
  note: z.string().max(1000).nullable().optional()
});

const snoozeSchema = z.object({
  preset: z.enum(["ONE_HOUR", "SIX_HOURS", "TWENTY_FOUR_HOURS", "SEVEN_DAYS", "CUSTOM"]).default("ONE_HOUR"),
  snoozedUntil: z.string().datetime().optional(),
  note: z.string().max(1000).nullable().optional()
});

function services(app: FastifyInstance) {
  return {
    repo: new DashboardRepository(app.prisma),
    audit: new AuditService(app.prisma),
    purchase: new PurchaseDecisionService(app.prisma)
  };
}

function snoozeUntil(input: z.infer<typeof snoozeSchema>): Date {
  if (input.preset === "CUSTOM" && input.snoozedUntil) return new Date(input.snoozedUntil);
  const hours = input.preset === "SIX_HOURS" ? 6 : input.preset === "TWENTY_FOUR_HOURS" ? 24 : input.preset === "SEVEN_DAYS" ? 24 * 7 : 1;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function registerDemoRoutes(app: FastifyInstance): Promise<void> {
  app.get("/stores", async (request) => {
    const { repo } = services(app);
    return { stores: await repo.getStores(request.currentUser!.id) };
  });

  app.patch("/stores/:id", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const patch = patchStoreSchema.parse(request.body);
    const { repo, audit } = services(app);
    const store = await repo.updateStore(request.currentUser!.id, id, patch);
    if (!store) {
      return reply.notFound("Store not found");
    }
    await audit.log({
      action: "STORE_UPDATED",
      summary: `${store.name} settings updated.`,
      actorUserId: request.currentUser!.id,
      metadata: patch
    });
    return { store };
  });

  app.get("/radar-rules", async (request) => {
    const { repo } = services(app);
    return { radarRules: await repo.getRadarRules(request.currentUser!.id) };
  });

  app.put("/radar-rules", async (request) => {
    assertNoSensitiveKeys(request.body);
    const radarRules = radarRulesSchema.parse(request.body) as DemoRadarRules;
    const { repo, audit } = services(app);
    const saved = await repo.updateRadarRules(request.currentUser!.id, radarRules);
    await audit.log({
      action: "WATCH_RULE_UPDATED",
      summary: "Radar rules updated from dashboard.",
      actorUserId: request.currentUser!.id,
      metadata: radarRules as unknown
    });
    return { radarRules: saved };
  });

  app.get("/price-rules", async (request) => {
    const { repo } = services(app);
    return { priceRules: await repo.getPriceRules(request.currentUser!.id) };
  });

  app.post("/price-rules", async (request) => {
    assertNoSensitiveKeys(request.body);
    const body = priceRuleSchema.parse(request.body);
    const { repo, audit } = services(app);
    const priceRule = await repo.createPriceRule(request.currentUser!.id, body);
    await audit.log({
      action: "PRICE_RULE_UPDATED",
      summary: `Price rule created: ${priceRule.label}.`,
      actorUserId: request.currentUser!.id,
      metadata: priceRule as unknown
    });
    return { priceRule };
  });

  app.patch("/price-rules/:id", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const patch = priceRuleSchema.partial().parse(request.body);
    const { repo, audit } = services(app);
    const priceRule = await repo.updatePriceRule(request.currentUser!.id, id, patch);
    if (!priceRule) {
      return reply.notFound("Price rule not found");
    }
    await audit.log({
      action: "PRICE_RULE_UPDATED",
      summary: `Price rule updated: ${priceRule.label}.`,
      actorUserId: request.currentUser!.id,
      metadata: patch
    });
    return { priceRule };
  });

  app.get("/live-finds", async (request) => {
    const { repo } = services(app);
    return { liveFinds: await repo.getLiveFinds(request.currentUser!.id) };
  });

  app.post("/live-finds/:id/ignore", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { repo, audit } = services(app);
    const liveFind = await repo.updateLiveFind(request.currentUser!.id, id, { ignored: true });
    if (!liveFind) {
      return reply.notFound("Live find not found");
    }
    await audit.log({
      action: "LIVE_FIND_IGNORED",
      summary: `${liveFind.productName} ignored.`,
      actorUserId: request.currentUser!.id,
      metadata: { id }
    });
    return { liveFind };
  });

  app.post("/live-finds/:id/mark-bought", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = boughtSchema.parse(request.body ?? {});
    const { repo, audit, purchase } = services(app);
    const liveFind = await repo.updateLiveFind(request.currentUser!.id, id, { bought: true });
    if (!liveFind) {
      return reply.notFound("Live find not found");
    }
    const purchaseDecision = await purchase.bought(request.currentUser!.id, id, body);
    await audit.log({
      action: "LIVE_FIND_MARKED_BOUGHT",
      summary: `${liveFind.productName} marked bought.`,
      actorUserId: request.currentUser!.id,
      metadata: { id, purchaseDecisionId: purchaseDecision?.id ?? null }
    });
    return { liveFind, purchaseDecision };
  });

  app.post("/live-finds/:id/snooze", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = snoozeSchema.parse(request.body ?? {});
    const { repo, audit, purchase } = services(app);
    const snoozedUntil = snoozeUntil(body);
    const liveFind = await repo.updateLiveFind(request.currentUser!.id, id, { snoozedUntil });
    if (!liveFind) {
      return reply.notFound("Live find not found");
    }
    const purchaseDecision = await purchase.snooze(request.currentUser!.id, id, snoozedUntil, body.note);
    await audit.log({
      action: "LIVE_FIND_SNOOZED",
      summary: `${liveFind.productName} snoozed.`,
      actorUserId: request.currentUser!.id,
      metadata: { id, snoozedUntil: snoozedUntil.toISOString(), preset: body.preset, purchaseDecisionId: purchaseDecision?.id ?? null }
    });
    return { liveFind, purchaseDecision };
  });

  app.get("/cart-queue", async (request) => {
    const { repo } = services(app);
    return { cartQueue: await repo.getCartQueue(request.currentUser!.id) };
  });

  app.post("/cart-queue/:id/retry", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { repo, audit } = services(app);
    const attempt = await repo.getCartAttempt(request.currentUser!.id, id);
    if (!attempt) {
      return reply.notFound("Cart attempt not found");
    }

    if ([CartAssistStatus.CAPTCHA_DETECTED, CartAssistStatus.QUEUE_DETECTED, CartAssistStatus.HUMAN_CHECK_REQUIRED].includes(attempt.status)) {
      await audit.log({
        action: "CART_ASSIST_STOPPED",
        summary: `Retry blocked for ${attempt.productName}; manual action still required.`,
        actorUserId: request.currentUser!.id,
        metadata: { status: attempt.status }
      });
      return reply.code(409).send({ error: "Manual action required before retry", cartAttempt: attempt });
    }

    const cartAttempt = await repo.updateCartAttempt(request.currentUser!.id, id, {
      status: CartAssistStatus.PRODUCT_FOUND,
      lastMessage: "Placeholder retry queued. Helper remains open-only.",
      stopReason: null
    });
    await audit.log({
      action: "CART_QUEUE_RETRY_REQUESTED",
      summary: `Placeholder retry requested for ${attempt.productName}.`,
      actorUserId: request.currentUser!.id,
      metadata: { id }
    });
    return { cartAttempt };
  });

  app.post("/cart-queue/:id/stop", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { repo, audit } = services(app);
    const cartAttempt = await repo.updateCartAttempt(request.currentUser!.id, id, {
      status: CartAssistStatus.SKIPPED,
      lastMessage: "Stopped by user. No further helper action will run.",
      stopReason: "Stopped by dashboard user."
    });
    if (!cartAttempt) {
      return reply.notFound("Cart attempt not found");
    }
    await audit.log({
      action: "CART_ASSIST_STOPPED",
      summary: `Cart assist stopped for ${cartAttempt.productName}.`,
      actorUserId: request.currentUser!.id,
      metadata: { id }
    });
    return { cartAttempt };
  });

  app.get("/alerts", async (request) => {
    const { repo } = services(app);
    return { alertChannels: await repo.getAlertChannels(request.currentUser!.id) };
  });

  app.post("/alerts/test", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { channelId } = z.object({ channelId: z.string() }).parse(request.body);
    const { repo, audit } = services(app);
    const channel = await repo.testAlert(request.currentUser!.id, channelId);
    if (!channel) {
      return reply.notFound("Alert channel not found");
    }
    await audit.log({
      action: "ALERT_TEST_SENT",
      summary: `Test alert sent to ${channel.label}.`,
      actorUserId: request.currentUser!.id,
      metadata: { channelId, type: channel.type }
    });
    return { ok: true, channel };
  });

  app.get("/history", async (request) => {
    const { repo } = services(app);
    return { history: await repo.getHistory(request.currentUser!.id) };
  });

  app.get("/audit-logs", async (request) => {
    const { repo } = services(app);
    return { auditLogs: await repo.getAuditLogs(request.currentUser!.id) };
  });

  app.get("/dashboard-summary", async (request) => {
    const { repo } = services(app);
    const [stores, liveFinds, cartQueue] = await Promise.all([
      repo.getStores(request.currentUser!.id),
      repo.getLiveFinds(request.currentUser!.id),
      repo.getCartQueue(request.currentUser!.id)
    ]);
    return {
      connectedStores: stores.filter((store) => store.sessionState === "LOGGED_IN").length,
      activeMonitors: stores.filter((store) => store.monitoringEnabled).length,
      productsFoundToday: liveFinds.length,
      cartReadyItems: cartQueue.filter((attempt) => attempt.status === CartAssistStatus.CART_READY).length,
      humanActionNeeded: cartQueue.filter((attempt) => [CartAssistStatus.CAPTCHA_DETECTED, CartAssistStatus.QUEUE_DETECTED, CartAssistStatus.HUMAN_CHECK_REQUIRED].includes(attempt.status)).length,
      overpricedSkipped: liveFinds.filter((find) => find.priceStatus === "OVER_LIMIT").length,
      lastScanTime: stores.map((store) => store.lastCheckTime).sort().at(-1) ?? null,
      recentAlerts: liveFinds.filter((find) => find.alertStatus === "SENT" || find.alertStatus === "READY").slice(0, 5)
    };
  });
}
