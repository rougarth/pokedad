import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertNoSensitiveKeys } from "../../security/sanitizer.js";
import { ReleaseCalendarService } from "./release-calendar.service.js";

const paramsSchema = z.object({ id: z.string() });
const linkParamsSchema = z.object({ id: z.string(), linkId: z.string() });
const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
const statusSchema = z.enum(["PLANNED", "UPCOMING", "RELEASED", "WATCHING", "BOUGHT", "SKIPPED", "CANCELED"]);
const reminderOffsetSchema = z.enum(["SEVEN_DAYS", "THREE_DAYS", "ONE_DAY", "TWELVE_HOURS", "ONE_HOUR", "AT_RELEASE"]);

const inputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  setName: z.string().trim().max(120).nullable().optional(),
  productName: z.string().trim().max(160).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  releaseDate: z.string().datetime(),
  timezone: z.string().trim().max(80).nullable().optional(),
  priority: prioritySchema.default("NORMAL"),
  status: statusSchema.default("UPCOMING"),
  wishlistItemId: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
  discordReminder: z.boolean().optional(),
  reminderOffsets: z.array(reminderOffsetSchema).default(["ONE_DAY", "ONE_HOUR", "AT_RELEASE"]),
  manualStoreLinkIds: z.array(z.string()).default([])
});

const patchSchema = inputSchema.partial();

function parseInput(input: z.infer<typeof inputSchema>) {
  return { ...input, releaseDate: new Date(input.releaseDate) };
}

function parsePatch(input: z.infer<typeof patchSchema>) {
  return { ...input, releaseDate: input.releaseDate ? new Date(input.releaseDate) : undefined };
}

export async function registerReleaseCalendarRoutes(app: FastifyInstance): Promise<void> {
  const service = () => new ReleaseCalendarService(app.prisma);

  app.get("/release-calendar", async (request) => ({ releaseCalendarItems: await service().list(request.currentUser!.id) }));

  app.get("/release-calendar/upcoming", async (request) => ({ releaseCalendarItems: await service().list(request.currentUser!.id, { upcoming: true }) }));

  app.get("/release-calendar/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const item = await service().detail(request.currentUser!.id, id);
    return item ? { releaseCalendarItem: item } : reply.notFound("Release calendar item not found");
  });

  app.post("/release-calendar", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const body = parseInput(inputSchema.parse(request.body ?? {}));
    const item = await service().create(request.currentUser!.id, body);
    return reply.code(201).send({ releaseCalendarItem: item });
  });

  app.patch("/release-calendar/:id", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { id } = paramsSchema.parse(request.params);
    const body = parsePatch(patchSchema.parse(request.body ?? {}));
    const item = await service().update(request.currentUser!.id, id, body);
    return item ? { releaseCalendarItem: item } : reply.notFound("Release calendar item not found");
  });

  app.delete("/release-calendar/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const deleted = await service().delete(request.currentUser!.id, id);
    return deleted ? { deleted: true } : reply.notFound("Release calendar item not found");
  });

  app.post("/release-calendar/:id/enable", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const item = await service().setEnabled(request.currentUser!.id, id, true);
    return item ? { releaseCalendarItem: item } : reply.notFound("Release calendar item not found");
  });

  app.post("/release-calendar/:id/disable", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const item = await service().setEnabled(request.currentUser!.id, id, false);
    return item ? { releaseCalendarItem: item } : reply.notFound("Release calendar item not found");
  });

  app.post("/release-calendar/:id/mark-released", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const item = await service().markStatus(request.currentUser!.id, id, "RELEASED");
    return item ? { releaseCalendarItem: item } : reply.notFound("Release calendar item not found");
  });

  app.post("/release-calendar/:id/mark-bought", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const item = await service().markStatus(request.currentUser!.id, id, "BOUGHT");
    return item ? { releaseCalendarItem: item } : reply.notFound("Release calendar item not found");
  });

  app.post("/release-calendar/:id/mark-skipped", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const item = await service().markStatus(request.currentUser!.id, id, "SKIPPED");
    return item ? { releaseCalendarItem: item } : reply.notFound("Release calendar item not found");
  });

  app.post("/release-calendar/:id/send-test-reminder", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const result = await service().sendTestReminder(request.currentUser!.id, id);
    return result ? reply.code(result.delivered ? 200 : 422).send(result) : reply.notFound("Release calendar item not found");
  });

  app.post("/release-calendar/:id/manual-links/:linkId/opened", async (request, reply) => {
    const { id, linkId } = linkParamsSchema.parse(request.params);
    const link = await service().openRelatedLink(request.currentUser!.id, id, linkId);
    return link ? { manualStoreLink: link } : reply.notFound("Related manual link not found");
  });
}
