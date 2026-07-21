import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertNoSensitiveKeys } from "../../security/sanitizer.js";
import { ManualStoreLinkService } from "./manual-store-link.service.js";

const paramsSchema = z.object({ id: z.string() });
const linkTypeSchema = z.enum(["PRODUCT", "SEARCH", "CATEGORY", "RELEASE_PAGE", "STORE_HOME", "CUSTOM"]);
const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "IGNORE"]);

const inputSchema = z.object({
  storeKey: z.string().min(1).max(80),
  title: z.string().min(1).max(180),
  url: z.string().url().max(2000),
  linkType: linkTypeSchema.default("SEARCH"),
  priority: prioritySchema.default("NORMAL"),
  wishlistItemId: z.string().nullable().optional(),
  setName: z.string().max(120).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional()
});

const patchSchema = inputSchema.partial();

export async function registerManualStoreLinkRoutes(app: FastifyInstance): Promise<void> {
  const service = () => new ManualStoreLinkService(app.prisma);

  app.get("/manual-store-links", async (request) => ({ manualStoreLinks: await service().list(request.currentUser!.id) }));

  app.get("/manual-store-links/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const link = await service().detail(request.currentUser!.id, id);
    return link ? { manualStoreLink: link } : reply.notFound("Manual store link not found");
  });

  app.post("/manual-store-links", async (request) => {
    assertNoSensitiveKeys(request.body);
    const body = inputSchema.parse(request.body ?? {});
    return { manualStoreLink: await service().create(request.currentUser!.id, body) };
  });

  app.patch("/manual-store-links/:id", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { id } = paramsSchema.parse(request.params);
    const body = patchSchema.parse(request.body ?? {});
    const link = await service().update(request.currentUser!.id, id, body);
    return link ? { manualStoreLink: link } : reply.notFound("Manual store link not found");
  });

  app.delete("/manual-store-links/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const deleted = await service().delete(request.currentUser!.id, id);
    return deleted ? { deleted: true } : reply.notFound("Manual store link not found");
  });

  app.post("/manual-store-links/:id/opened", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const link = await service().opened(request.currentUser!.id, id);
    return link ? { manualStoreLink: link } : reply.notFound("Manual store link not found");
  });

  app.post("/manual-store-links/:id/enable", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const link = await service().setEnabled(request.currentUser!.id, id, true);
    return link ? { manualStoreLink: link } : reply.notFound("Manual store link not found");
  });

  app.post("/manual-store-links/:id/disable", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const link = await service().setEnabled(request.currentUser!.id, id, false);
    return link ? { manualStoreLink: link } : reply.notFound("Manual store link not found");
  });
}
