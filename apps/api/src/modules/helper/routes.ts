import type { FastifyInstance } from "fastify";
import { createHash, timingSafeEqual } from "node:crypto";
import { PriceStatus, StockStatus } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env.js";
import { assertNoSensitiveKeys, sanitizeForAudit } from "../../security/sanitizer.js";
import { AuditService } from "../../services/audit.service.js";
import { MSRPMappingService } from "../msrp/msrp-mapping.service.js";

const helperStatusSchema = z.object({
  helperId: z.string().min(1),
  commandId: z.string().optional(),
  status: z.string().min(1),
  message: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional()
});

const allowedStores = {
  bjs: ["bjs.com"],
  costco: ["costco.com"],
  "sams-club": ["samsclub.com"],
  walmart: ["walmart.com"]
} as const;

const capturedSignalSchema = z.object({
  storeKey: z.enum(["bjs", "costco", "sams-club", "walmart"]),
  productName: z.string().trim().min(2).max(300),
  productUrl: z.string().url().max(2048),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  sku: z.string().trim().max(120).nullable().optional(),
  priceCents: z.number().int().min(0).max(1_000_000).nullable(),
  currency: z.literal("USD"),
  stockStatus: z.enum(["IN_STOCK", "OUT_OF_STOCK", "UNKNOWN"]),
  sellerName: z.string().trim().max(200).nullable().optional(),
  capturedAt: z.string().datetime(),
  captureMode: z.literal("USER_TRIGGERED_LOCAL_PAGE")
});

function validHelperToken(value: unknown): boolean {
  if (typeof value !== "string" || !env.HELPER_SHARED_TOKEN) return false;
  const expected = Buffer.from(env.HELPER_SHARED_TOKEN);
  const actual = Buffer.from(value);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function assertAllowedUrl(storeKey: keyof typeof allowedStores, rawUrl: string): void {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !allowedStores[storeKey].some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
    throw new Error("Retailer URL does not match the selected supported store.");
  }
}

export async function registerHelperRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/v1/helper")) {
      return;
    }

    const token = request.headers["x-helper-token"];
    if (!validHelperToken(token)) {
      return reply.code(401).send({ error: "Invalid helper token" });
    }
  });

  app.post("/v1/helper/heartbeat", async (request) => {
    assertNoSensitiveKeys(request.body);
    const input = helperStatusSchema.parse(request.body);
    return {
      ok: true,
      received: sanitizeForAudit(input),
      nextPollMs: 5000
    };
  });

  app.get("/v1/helper/commands", async () => ({
    commands: [],
    message: "No pending commands. Real command queue lands after auth and persistence are wired."
  }));

  app.post("/v1/helper/signals", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const input = capturedSignalSchema.parse(request.body);
    try {
      assertAllowedUrl(input.storeKey, input.productUrl);
    } catch {
      return reply.code(400).send({ error: "Unsupported retailer URL" });
    }

    const owner = await app.prisma.user.findUnique({ where: { email: env.ADMIN_EMAIL } });
    if (!owner) return reply.code(503).send({ error: "Local admin user is not initialized" });
    const store = await app.prisma.store.findUnique({ where: { ownerId_slug: { ownerId: owner.id, slug: input.storeKey } } });
    if (!store) return reply.code(404).send({ error: "Store is not configured" });

    const externalId = input.sku || `local-${createHash("sha256").update(input.productUrl).digest("hex").slice(0, 24)}`;
    const retailerProduct = await app.prisma.retailerProduct.upsert({
      where: { storeId_externalId: { storeId: store.id, externalId } },
      create: {
        storeId: store.id,
        externalId,
        productUrl: input.productUrl,
        imageUrl: input.imageUrl ?? null,
        name: input.productName,
        sellerName: input.sellerName ?? null,
        sellerIsOfficial: false,
        marketplaceListing: false,
        suspicious: false
      },
      update: {
        productUrl: input.productUrl,
        imageUrl: input.imageUrl ?? null,
        name: input.productName,
        sellerName: input.sellerName ?? null
      }
    });

    const stockCheck = await app.prisma.stockCheckResult.create({
      data: {
        storeId: store.id,
        retailerProductId: retailerProduct.id,
        checkedAt: new Date(input.capturedAt),
        priceCents: input.priceCents,
        accepted: false,
        sellerName: input.sellerName ?? null,
        sellerAccepted: false,
        priceStatus: PriceStatus.UNKNOWN_MSRP,
        stockStatus: input.stockStatus as StockStatus,
        rawMetadata: {
          source: "LOCAL_BROWSER_CAPTURE",
          captureMode: input.captureMode,
          currency: input.currency,
          backendRetailerRequestMade: false
        }
      }
    });

    const mapping = await new MSRPMappingService(app.prisma).createOrUpdateCandidate(owner.id, {
      storeKey: input.storeKey,
      retailerSku: input.sku ?? externalId,
      retailerProductId: retailerProduct.id,
      productName: input.productName,
      productUrl: input.productUrl,
      imageUrl: input.imageUrl ?? null,
      currentPriceCents: input.priceCents,
      notes: "Captured explicitly from a user-opened retailer page; backend made no retailer request."
    });

    await new AuditService(app.prisma).log({
      action: "ADAPTER_TEST_SEARCH_RUN",
      actorUserId: owner.id,
      summary: `User-triggered local signal captured for ${store.name}.`,
      metadata: {
        storeKey: input.storeKey,
        stockCheckId: stockCheck.id,
        retailerProductId: retailerProduct.id,
        mappingStatus: mapping.status,
        source: "LOCAL_BROWSER_CAPTURE",
        backendRetailerRequestMade: false
      }
    });

    return reply.code(201).send({
      ok: true,
      source: "LOCAL_BROWSER_CAPTURE",
      stockCheckId: stockCheck.id,
      retailerProductId: retailerProduct.id,
      mappingStatus: mapping.status,
      backendRetailerRequestMade: false
    });
  });
}
