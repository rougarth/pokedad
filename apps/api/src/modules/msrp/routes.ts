import type { MSRPMappingStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertNoSensitiveKeys } from "../../security/sanitizer.js";
import { MSRPMappingService } from "./msrp-mapping.service.js";

const statusSchema = z.enum(["UNMAPPED", "SUGGESTED", "MAPPED", "IGNORED", "NEEDS_REVIEW"]);

const suggestSchema = z.object({
  storeKey: z.string().min(1).default("best-buy"),
  retailerSku: z.string().optional().nullable(),
  retailerProductId: z.string().optional().nullable(),
  productName: z.string().min(1),
  productUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  currentPriceCents: z.number().int().nonnegative().optional().nullable()
});

const mapSchema = z.object({
  categoryId: z.string().min(1),
  notes: z.string().max(1000).optional().nullable(),
  acceptedMaxPriceCents: z.number().int().nonnegative().optional().nullable()
});

const patchSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
  status: statusSchema.optional(),
  mappedCategoryId: z.string().optional().nullable(),
  acceptedMaxPriceCents: z.number().int().nonnegative().optional().nullable()
});

function service(app: FastifyInstance): MSRPMappingService {
  return new MSRPMappingService(app.prisma);
}

export async function registerMSRPMappingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/msrp-mappings", async (request) => {
    const { status } = z.object({ status: statusSchema.optional() }).parse(request.query);
    return { mappings: await service(app).list(request.currentUser!.id, status as MSRPMappingStatus | undefined) };
  });

  app.get("/msrp-mappings/unmapped", async (request) => {
    const svc = service(app);
    const [unmapped, suggested, review] = await Promise.all([
      svc.list(request.currentUser!.id, "UNMAPPED"),
      svc.list(request.currentUser!.id, "SUGGESTED"),
      svc.list(request.currentUser!.id, "NEEDS_REVIEW")
    ]);
    return { mappings: [...suggested, ...unmapped, ...review] };
  });

  app.get("/msrp-mappings/categories", async (request) => {
    return { categories: await service(app).categories(request.currentUser!.id) };
  });

  app.get("/msrp-mappings/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const mapping = await service(app).get(request.currentUser!.id, id);
    if (!mapping) return reply.notFound("MSRP mapping not found");
    return { mapping };
  });

  app.post("/msrp-mappings/suggest", async (request) => {
    assertNoSensitiveKeys(request.body);
    const body = suggestSchema.parse(request.body);
    const svc = service(app);
    const mapping = await svc.createOrUpdateCandidate(request.currentUser!.id, body);
    return { mapping };
  });

  app.post("/msrp-mappings/:id/map", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = mapSchema.parse(request.body);
    const mapping = await service(app).map(request.currentUser!.id, id, body);
    if (!mapping) return reply.notFound("MSRP mapping not found");
    return { mapping };
  });

  app.post("/msrp-mappings/:id/ignore", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const mapping = await service(app).ignore(request.currentUser!.id, id);
    if (!mapping) return reply.notFound("MSRP mapping not found");
    return { mapping };
  });

  app.post("/msrp-mappings/:id/needs-review", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const mapping = await service(app).needsReview(request.currentUser!.id, id);
    if (!mapping) return reply.notFound("MSRP mapping not found");
    return { mapping };
  });

  app.patch("/msrp-mappings/:id", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = patchSchema.parse(request.body);
    const mapping = await service(app).patch(request.currentUser!.id, id, body);
    if (!mapping) return reply.notFound("MSRP mapping not found");
    return { mapping };
  });
}
