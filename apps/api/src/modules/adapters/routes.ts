import type { AuditAction } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { evaluateAcceptablePrice, type DemoPriceRule } from "@pokedad-radar/shared";
import { env } from "../../config/env.js";
import { DashboardRepository } from "../../repositories/dashboard.repository.js";
import { assertNoSensitiveKeys } from "../../security/sanitizer.js";
import { AuditService } from "../../services/audit.service.js";
import { assertCapabilityAllowed } from "./adapter-safety.js";
import { BestBuyAdapter } from "./bestbuy/bestbuy.adapter.js";
import { BestBuyMockScanService } from "./bestbuy/bestbuy-mock-scan.service.js";
import { BestBuyScanService } from "./bestbuy/bestbuy-scan.service.js";
import { BestBuyManualReadinessService } from "./bestbuy/bestbuy-manual-readiness.service.js";
import { getBestBuySchedulerState, saveBestBuySchedulerState } from "./bestbuy/bestbuy-scheduler.service.js";
import { getStoreSafetyItem } from "../store-safety/store-safety-matrix.js";
import type { BestBuyScanConfig } from "./bestbuy/bestbuy-scan.types.js";
import { StoreAdapterRegistry } from "./store-adapter.registry.js";
import type { ProductSearchResult } from "./types.js";

const searchSchema = z.object({
  query: z.string().min(1).max(80).default("pokemon tcg"),
  limit: z.number().int().min(1).max(20).optional()
});

const lookupSchema = z.object({
  sku: z.string().min(1).max(40)
});

const bestBuyScanConfigSchema = z.object({
  enabled: z.boolean().optional(),
  scheduledScanEnabled: z.boolean().optional(),
  scanIntervalSeconds: z.number().int().min(300).max(24 * 60 * 60).optional(),
  searchTerms: z.array(z.string().min(1).max(80)).min(1).max(20).optional(),
  maxResultsPerScan: z.number().int().min(1).max(100).optional(),
  minimumDelayBetweenApiCallsMs: z.number().int().min(1000).max(60_000).optional(),
  onlyOfficialBestBuySeller: z.boolean().optional(),
  onlyPokemonTcgSealedProducts: z.boolean().optional(),
  applyPriceRules: z.boolean().optional(),
  createLiveFindCandidates: z.boolean().optional(),
  sendAlertsForAcceptedPrices: z.boolean().optional(),
  sendAlertsAutomatically: z.boolean().optional(),
  sendScanFailureAlerts: z.boolean().optional(),
  ignoreOverLimitProducts: z.boolean().optional(),
  ignoreUnknownSuspiciousProducts: z.boolean().optional(),
  alertOnUnknownMsrp: z.boolean().optional(),
  autoSuggestMsrpCategory: z.boolean().optional(),
  alertCooldownMinutes: z.number().int().min(15).max(7 * 24 * 60).optional()
});

const manualScanConfirmationSchema = z.object({
  readinessToken: z.string().uuid(),
  confirmReadOnly: z.literal(true),
  approvalConfirmed: z.literal(true),
  confirmationText: z.literal("RUN ONE READ-ONLY SCAN")
});

function buildRegistry(): StoreAdapterRegistry {
  const registry = new StoreAdapterRegistry();
  registry.register(new BestBuyAdapter(env.BEST_BUY_API_KEY));
  return registry;
}

function services(app: FastifyInstance) {
  const bestBuyAdapter = new BestBuyAdapter(env.BEST_BUY_API_KEY);
  return {
    repo: new DashboardRepository(app.prisma),
    audit: new AuditService(app.prisma),
    registry: buildRegistry(),
    bestBuyScan: new BestBuyScanService(app.prisma, bestBuyAdapter),
    bestBuyReadiness: new BestBuyManualReadinessService(app.prisma, bestBuyAdapter),
    bestBuyMock: new BestBuyMockScanService(app.prisma)
  };
}

async function logAdapterAction(audit: AuditService, input: {
  action: AuditAction;
  actorUserId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await audit.log({
    action: input.action,
    summary: input.summary,
    actorUserId: input.actorUserId,
    metadata: input.metadata
  });
}

async function handleMissingConfig(audit: AuditService, actorUserId: string, storeKey: string) {
  await logAdapterAction(audit, {
    action: "ADAPTER_MISSING_API_KEY",
    actorUserId,
    summary: `${storeKey} adapter needs an API key before live checks can run.`,
    metadata: { storeKey }
  });
}

function applyPriceRules(results: ProductSearchResult[], priceRules: DemoPriceRule[]): ProductSearchResult[] {
  return results.map((result) => {
    if (result.priceCents == null) {
      return result;
    }

    const rule = findBestRule(result, priceRules);
    const evaluated = evaluateAcceptablePrice({
      priceCents: result.priceCents,
      msrpCents: rule?.msrpCents ?? result.msrpCents ?? result.regularPriceCents,
      customMaxPriceCents: rule?.maxAcceptedPriceCents ?? result.maxAcceptedPriceCents,
      toleranceCents: rule?.allowedMarkupCents,
      sellerAccepted: result.sellerAccepted
    });

    return {
      ...result,
      msrpCents: rule?.msrpCents ?? result.msrpCents ?? result.regularPriceCents,
      maxAcceptedPriceCents: evaluated.acceptedMaxPriceCents,
      priceStatus: evaluated.priceStatus
    };
  });
}

function findBestRule(result: ProductSearchResult, priceRules: DemoPriceRule[]): DemoPriceRule | undefined {
  const name = result.name.toLowerCase();
  const enabled = priceRules.filter((rule) => rule.enabled);
  return enabled.find((rule) => rule.scope === "PRODUCT" && name.includes(rule.target.toLowerCase()))
    ?? enabled.find((rule) => rule.scope === "CATEGORY" && categoryMatches(name, rule.target))
    ?? enabled.find((rule) => rule.scope === "STORE" && rule.target.toLowerCase().includes("best buy"))
    ?? enabled.find((rule) => rule.scope === "GLOBAL");
}

function categoryMatches(name: string, target: string): boolean {
  const normalized = target.toLowerCase();
  if (normalized.includes("elite trainer")) return name.includes("elite trainer") || name.includes(" etb");
  if (normalized.includes("booster bundle")) return name.includes("booster bundle");
  if (normalized.includes("booster box")) return name.includes("booster box");
  if (normalized.includes("ultra premium")) return name.includes("ultra premium") || name.includes(" upc");
  if (normalized.includes("premium collection")) return name.includes("premium collection");
  if (normalized.includes("collection box")) return name.includes("collection box");
  if (normalized.includes("sleeved booster")) return name.includes("sleeved") || name.includes("booster pack");
  return name.includes(normalized);
}

export async function registerAdapterRoutes(app: FastifyInstance): Promise<void> {
  app.get("/adapters", async (request) => {
    const { registry, audit } = services(app);
    const adapters = registry.list().map((adapter) => adapter.getStatus());
    await logAdapterAction(audit, {
      action: "ADAPTER_STATUS_CHECKED",
      actorUserId: request.currentUser!.id,
      summary: "Store adapter statuses checked.",
      metadata: { adapterCount: adapters.length, storeKeys: adapters.map((adapter) => adapter.storeKey) }
    });
    return { adapters };
  });

  app.get("/adapters/:storeKey/status", async (request, reply) => {
    const { storeKey } = z.object({ storeKey: z.string() }).parse(request.params);
    const { registry, audit } = services(app);
    const adapter = registry.get(storeKey);
    if (!adapter) {
      const safety = getStoreSafetyItem(storeKey);
      if (safety) {
        await logAdapterAction(audit, {
          action: "BLOCKED_STORE_ADAPTER_ATTEMPTED",
          actorUserId: request.currentUser!.id,
          summary: `${safety.displayName} live adapter is disabled until official/allowed access is confirmed.`,
          metadata: { storeKey, recommendedMode: safety.recommendedMode, riskLevel: safety.riskLevel }
        });
      }
      return reply.notFound("Adapter not found");
    }
    await logAdapterAction(audit, {
      action: "ADAPTER_STATUS_CHECKED",
      actorUserId: request.currentUser!.id,
      summary: `${adapter.displayName} adapter status checked.`,
      metadata: { storeKey, configured: adapter.getStatus().configured }
    });
    return { adapter: adapter.getStatus() };
  });

  app.get("/adapters/best-buy/scan-config", async (request) => {
    const { bestBuyScan } = services(app);
    return {
      config: await bestBuyScan.getConfig(request.currentUser!.id),
      scanStatus: await bestBuyScan.getState(request.currentUser!.id)
    };
  });

  app.put("/adapters/best-buy/scan-config", async (request) => {
    assertNoSensitiveKeys(request.body);
    const patch = bestBuyScanConfigSchema.parse(request.body) as Partial<BestBuyScanConfig>;
    const { bestBuyScan } = services(app);
    const config = await bestBuyScan.saveConfig(request.currentUser!.id, patch);
    return {
      config,
      scanStatus: await bestBuyScan.getState(request.currentUser!.id)
    };
  });

  app.get("/adapters/best-buy/scan-status", async (request) => {
    const { bestBuyScan } = services(app);
    return {
      config: await bestBuyScan.getConfig(request.currentUser!.id),
      scanStatus: await bestBuyScan.getState(request.currentUser!.id),
      schedulerState: await getBestBuySchedulerState(app.prisma, request.currentUser!.id)
    };
  });

  app.get("/adapters/best-buy/manual-readiness", async (request) => {
    const { bestBuyReadiness } = services(app);
    return { readiness: await bestBuyReadiness.check(request.currentUser!.id) };
  });

  app.post("/adapters/best-buy/manual-readiness", async (request) => {
    const { bestBuyReadiness, audit } = services(app);
    const readiness = await bestBuyReadiness.check(request.currentUser!.id, true);
    await logAdapterAction(audit, {
      action: "ADAPTER_STATUS_CHECKED",
      actorUserId: request.currentUser!.id,
      summary: "Best Buy manual scan readiness checked.",
      metadata: { storeKey: "best-buy", status: readiness.status, ready: readiness.ready, schedulerStopped: readiness.schedulerStopped, redisReady: readiness.redisReady, alertChannelReady: readiness.alertChannelReady }
    });
    return { readiness };
  });

  app.get("/adapters/best-buy/scheduler-status", async (request) => {
    const { bestBuyScan } = services(app);
    return {
      config: await bestBuyScan.getConfig(request.currentUser!.id),
      scanStatus: await bestBuyScan.getState(request.currentUser!.id),
      schedulerState: await getBestBuySchedulerState(app.prisma, request.currentUser!.id)
    };
  });

  app.post("/adapters/best-buy/enable-scheduler", async (request) => {
    const { bestBuyScan, audit } = services(app);
    if (!env.BEST_BUY_API_KEY.trim()) {
      const config = await bestBuyScan.saveConfig(request.currentUser!.id, { scheduledScanEnabled: false });
      await saveBestBuySchedulerState(app.prisma, request.currentUser!.id, {
        status: "CONFIGURATION_NEEDED",
        active: false,
        nextRunAt: undefined,
        lastError: "Best Buy API approval/key is required before scheduled scans can run."
      });
      await logAdapterAction(audit, {
        action: "BEST_BUY_SCAN_API_KEY_MISSING",
        actorUserId: request.currentUser!.id,
        summary: "Scheduled Best Buy scan blocked while approval/key is pending.",
        metadata: { storeKey: "best-buy", schedulerActive: false, noRetailerRequest: true }
      });
      return { config, scanStatus: await bestBuyScan.getState(request.currentUser!.id), schedulerState: await getBestBuySchedulerState(app.prisma, request.currentUser!.id), error: "Best Buy API approval pending. Live scheduled scans are paused until BEST_BUY_API_KEY is configured." };
    }
    const config = await bestBuyScan.saveConfig(request.currentUser!.id, { enabled: true, scheduledScanEnabled: true });
    await saveBestBuySchedulerState(app.prisma, request.currentUser!.id, {
      status: "WAITING",
      active: true,
      nextRunAt: new Date(Date.now() + config.scanIntervalSeconds * 1000).toISOString(),
      lastError: undefined
    });
    return { config, scanStatus: await bestBuyScan.getState(request.currentUser!.id), schedulerState: await getBestBuySchedulerState(app.prisma, request.currentUser!.id) };
  });

  app.post("/adapters/best-buy/disable-scheduler", async (request) => {
    const { bestBuyScan } = services(app);
    const config = await bestBuyScan.saveConfig(request.currentUser!.id, { scheduledScanEnabled: false });
    await saveBestBuySchedulerState(app.prisma, request.currentUser!.id, { status: "STOPPED", active: false });
    return { config, scanStatus: await bestBuyScan.getState(request.currentUser!.id), schedulerState: await getBestBuySchedulerState(app.prisma, request.currentUser!.id) };
  });

  app.post("/adapters/best-buy/run-scan", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const parsedConfirmation = manualScanConfirmationSchema.safeParse(request.body);
    if (!parsedConfirmation.success) return reply.code(400).send({ error: "Explicit read-only approval confirmation and a fresh readiness token are required." });
    const confirmation = parsedConfirmation.data;
    const { bestBuyScan, bestBuyReadiness } = services(app);
    const readiness = await bestBuyReadiness.check(request.currentUser!.id);
    if (!readiness.ready) return reply.code(409).send({ readiness, error: "Manual scan readiness requirements are not satisfied." });
    if (!bestBuyReadiness.consumeToken(request.currentUser!.id, confirmation.readinessToken)) return reply.code(409).send({ readiness, error: "Readiness confirmation expired or was already used. Run the readiness check again." });
    const result = await bestBuyScan.runManualScan(request.currentUser!.id);
    const responseCode = result.scanStatus.status === "SUCCEEDED"
      ? 200
      : result.scanStatus.status === "CONFIGURATION_NEEDED"
        ? 409
        : result.scanStatus.status === "RATE_LIMITED"
          ? 429
          : result.scanStatus.status === "DISABLED"
            ? 409
            : result.scanStatus.status === "RUNNING"
              ? 409
              : 502;
    return reply.code(responseCode).send(result);
  });

  app.post("/adapters/best-buy/mock-scan", async (request) => {
    const { bestBuyMock } = services(app);
    return await bestBuyMock.run(request.currentUser!.id);
  });

  app.post("/adapters/best-buy/mock-discord-alert", async (request, reply) => {
    const { bestBuyMock } = services(app);
    const result = await bestBuyMock.sendMockDiscordAlert(request.currentUser!.id);
    return reply.code(result.delivered ? 200 : 422).send(result);
  });

  app.post("/adapters/best-buy/enable-scan", async (request) => {
    const { bestBuyScan } = services(app);
    const config = await bestBuyScan.saveConfig(request.currentUser!.id, { enabled: true });
    return {
      config,
      scanStatus: await bestBuyScan.getState(request.currentUser!.id)
    };
  });

  app.post("/adapters/best-buy/disable-scan", async (request) => {
    const { bestBuyScan } = services(app);
    const config = await bestBuyScan.saveConfig(request.currentUser!.id, { enabled: false });
    return {
      config,
      scanStatus: await bestBuyScan.getState(request.currentUser!.id)
    };
  });

  app.post("/adapters/:storeKey/search", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { storeKey } = z.object({ storeKey: z.string() }).parse(request.params);
    const body = searchSchema.parse(request.body);
    const { registry, repo, audit } = services(app);
    const adapter = registry.get(storeKey);
    if (!adapter) {
      return reply.notFound("Adapter not found");
    }
    const status = adapter.getStatus();
    if (!status.configured) {
      await handleMissingConfig(audit, request.currentUser!.id, storeKey);
      return reply.code(409).send({ adapter: status, results: [], error: status.message });
    }
    try {
      assertCapabilityAllowed(adapter, "PRODUCT_SEARCH");
      const rawResults = await adapter.searchProducts!(body);
      const results = applyPriceRules(rawResults, await repo.getPriceRules(request.currentUser!.id));
      await logAdapterAction(audit, {
        action: "ADAPTER_TEST_SEARCH_RUN",
        actorUserId: request.currentUser!.id,
        summary: `${adapter.displayName} test search run.`,
        metadata: { storeKey, query: body.query, resultCount: results.length }
      });
      return { adapter: status, results };
    } catch (error) {
      await logAdapterAction(audit, {
        action: "ADAPTER_ERROR",
        actorUserId: request.currentUser!.id,
        summary: `${adapter.displayName} adapter search failed.`,
        metadata: { storeKey, error: String(error) }
      });
      return reply.code(502).send({ adapter: status, results: [], error: String(error) });
    }
  });

  app.post("/adapters/:storeKey/lookup", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { storeKey } = z.object({ storeKey: z.string() }).parse(request.params);
    const body = lookupSchema.parse(request.body);
    const { registry, repo, audit } = services(app);
    const adapter = registry.get(storeKey);
    if (!adapter) {
      return reply.notFound("Adapter not found");
    }
    const status = adapter.getStatus();
    if (!status.configured) {
      await handleMissingConfig(audit, request.currentUser!.id, storeKey);
      return reply.code(409).send({ adapter: status, result: null, error: status.message });
    }
    try {
      assertCapabilityAllowed(adapter, "PRODUCT_LOOKUP");
      const rawResult = await adapter.lookupProduct!(body);
      const result = rawResult ? applyPriceRules([rawResult], await repo.getPriceRules(request.currentUser!.id))[0] : null;
      await logAdapterAction(audit, {
        action: "ADAPTER_LOOKUP_RUN",
        actorUserId: request.currentUser!.id,
        summary: `${adapter.displayName} SKU lookup run.`,
        metadata: { storeKey, sku: body.sku, found: Boolean(result) }
      });
      return { adapter: status, result };
    } catch (error) {
      await logAdapterAction(audit, {
        action: "ADAPTER_ERROR",
        actorUserId: request.currentUser!.id,
        summary: `${adapter.displayName} adapter lookup failed.`,
        metadata: { storeKey, error: String(error) }
      });
      return reply.code(502).send({ adapter: status, result: null, error: String(error) });
    }
  });

  app.post("/adapters/:storeKey/check-availability", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { storeKey } = z.object({ storeKey: z.string() }).parse(request.params);
    const body = lookupSchema.parse(request.body);
    const { registry, audit } = services(app);
    const adapter = registry.get(storeKey);
    if (!adapter) {
      return reply.notFound("Adapter not found");
    }
    const status = adapter.getStatus();
    if (!status.configured) {
      await handleMissingConfig(audit, request.currentUser!.id, storeKey);
      return reply.code(409).send({ adapter: status, result: null, error: status.message });
    }
    try {
      assertCapabilityAllowed(adapter, "AVAILABILITY_CHECK");
      const result = await adapter.checkAvailability!(body);
      return { adapter: status, result };
    } catch (error) {
      await logAdapterAction(audit, {
        action: "ADAPTER_ERROR",
        actorUserId: request.currentUser!.id,
        summary: `${adapter.displayName} adapter availability check failed.`,
        metadata: { storeKey, error: String(error) }
      });
      return reply.code(502).send({ adapter: status, result: null, error: String(error) });
    }
  });

  app.post("/adapters/best-buy/test-scan", async (request, reply) => {
    const { audit } = services(app);
    await logAdapterAction(audit, {
      action: "BEST_BUY_SCAN_API_KEY_MISSING",
      actorUserId: request.currentUser!.id,
      summary: "Legacy Best Buy test scan endpoint blocked; use Mock Scan Mode or manual readiness.",
      metadata: { storeKey: "best-buy", noRetailerRequest: true }
    });
    return reply.code(409).send({ error: "Live test scans are paused. Use /adapters/best-buy/mock-scan while approval is pending, or run manual readiness after BEST_BUY_API_KEY is configured." });
  });
}
