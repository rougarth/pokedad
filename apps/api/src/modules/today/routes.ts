import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuditService } from "../../services/audit.service.js";
import { ManualStoreLinkService } from "../manual-store-links/manual-store-link.service.js";
import { TodayService } from "./today.service.js";

const itemParamsSchema = z.object({ id: z.string() });
const linkParamsSchema = z.object({ id: z.string() });
const snoozeSchema = z.object({
  preset: z.enum(["ONE_HOUR", "SIX_HOURS", "TWENTY_FOUR_HOURS", "SEVEN_DAYS", "CUSTOM"]).default("TWENTY_FOUR_HOURS"),
  snoozedUntil: z.string().datetime().optional()
});

function decodeKey(value: string): string {
  return decodeURIComponent(value);
}

function snoozedUntil(input: z.infer<typeof snoozeSchema>): Date {
  if (input.preset === "CUSTOM" && input.snoozedUntil) return new Date(input.snoozedUntil);
  const now = new Date();
  const hours = input.preset === "ONE_HOUR" ? 1 : input.preset === "SIX_HOURS" ? 6 : input.preset === "SEVEN_DAYS" ? 24 * 7 : 24;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export async function registerTodayRoutes(app: FastifyInstance): Promise<void> {
  const service = () => new TodayService(app.prisma);
  const links = () => new ManualStoreLinkService(app.prisma);
  const audit = () => new AuditService(app.prisma);

  app.get("/today", async (request) => service().list(request.currentUser!.id));

  app.get("/today/summary", async (request) => ({ summary: await service().summary(request.currentUser!.id) }));

  app.post("/today/items/:id/dismiss", async (request) => {
    const { id } = itemParamsSchema.parse(request.params);
    const state = await service().setState(request.currentUser!.id, decodeKey(id), "DISMISSED");
    return { state };
  });

  app.post("/today/items/:id/snooze", async (request) => {
    const { id } = itemParamsSchema.parse(request.params);
    const input = snoozeSchema.parse(request.body ?? {});
    const state = await service().setState(request.currentUser!.id, decodeKey(id), "SNOOZED", snoozedUntil(input));
    return { state };
  });

  app.post("/today/items/:id/mark-done", async (request) => {
    const { id } = itemParamsSchema.parse(request.params);
    const state = await service().setState(request.currentUser!.id, decodeKey(id), "DONE");
    return { state };
  });

  app.post("/today/manual-links/:id/opened", async (request, reply) => {
    const { id } = linkParamsSchema.parse(request.params);
    const link = await links().opened(request.currentUser!.id, id);
    if (!link) return reply.notFound("Manual store link not found");
    await audit().log({
      action: "TODAY_MANUAL_LINK_OPENED",
      summary: "Manual store link opened from Today's Action List.",
      actorUserId: request.currentUser!.id,
      metadata: { manualStoreLinkId: id, storeKey: link.storeKey, backendFetchedRetailerUrl: false }
    });
    return { manualStoreLink: link };
  });
}
