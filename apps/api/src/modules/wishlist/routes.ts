import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertNoSensitiveKeys } from "../../security/sanitizer.js";
import { WishlistService } from "./wishlist.service.js";

const paramsSchema = z.object({ id: z.string() });
const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "IGNORE"]);
const alertBehaviorSchema = z.enum(["ALERT_IMMEDIATELY", "DASHBOARD_ONLY", "DO_NOT_ALERT", "REVIEW_FIRST"]);

const wishlistInputSchema = z.object({
  name: z.string().min(1).max(160),
  setName: z.string().max(120).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  storeKey: z.string().max(80).nullable().optional(),
  priority: prioritySchema.default("NORMAL"),
  alertBehavior: alertBehaviorSchema.default("ALERT_IMMEDIATELY"),
  desiredQuantity: z.number().int().min(1).max(999).nullable().optional(),
  maxPriceCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
  allowedMarkupCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
  keywords: z.array(z.string().max(80)).default([]),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional()
});

const wishlistPatchSchema = wishlistInputSchema.partial();

const matchPreviewSchema = z.object({
  productName: z.string().min(1).max(240),
  setName: z.string().max(120).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  categoryLabel: z.string().max(120).nullable().optional(),
  storeKey: z.string().max(80).nullable().optional(),
  sku: z.string().max(120).nullable().optional()
});

export async function registerWishlistRoutes(app: FastifyInstance): Promise<void> {
  const service = () => new WishlistService(app.prisma);

  app.get("/wishlist", async (request) => ({ wishlistItems: await service().list(request.currentUser!.id) }));

  app.get("/wishlist/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const item = await service().detail(request.currentUser!.id, id);
    return item ? { wishlistItem: item } : reply.notFound("Wishlist item not found");
  });

  app.post("/wishlist", async (request) => {
    assertNoSensitiveKeys(request.body);
    const body = wishlistInputSchema.parse(request.body ?? {});
    return { wishlistItem: await service().create(request.currentUser!.id, body) };
  });

  app.patch("/wishlist/:id", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { id } = paramsSchema.parse(request.params);
    const body = wishlistPatchSchema.parse(request.body ?? {});
    const item = await service().update(request.currentUser!.id, id, body);
    return item ? { wishlistItem: item } : reply.notFound("Wishlist item not found");
  });

  app.delete("/wishlist/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const deleted = await service().delete(request.currentUser!.id, id);
    return deleted ? { deleted: true } : reply.notFound("Wishlist item not found");
  });

  app.post("/wishlist/:id/enable", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const item = await service().setEnabled(request.currentUser!.id, id, true);
    return item ? { wishlistItem: item } : reply.notFound("Wishlist item not found");
  });

  app.post("/wishlist/:id/disable", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const item = await service().setEnabled(request.currentUser!.id, id, false);
    return item ? { wishlistItem: item } : reply.notFound("Wishlist item not found");
  });

  app.post("/wishlist/match-preview", async (request) => {
    assertNoSensitiveKeys(request.body);
    const body = matchPreviewSchema.parse(request.body ?? {});
    return { match: await service().preview(request.currentUser!.id, body) };
  });
}
