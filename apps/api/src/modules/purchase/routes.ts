import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertNoSensitiveKeys } from "../../security/sanitizer.js";
import { PurchaseDecisionService } from "./purchase-decision.service.js";

const paramsSchema = z.object({ id: z.string() });
const skippedSchema = z.object({
  skipReason: z.enum(["PRICE_TOO_HIGH", "SOLD_OUT", "NOT_INTERESTED", "WRONG_PRODUCT", "ALREADY_BOUGHT", "NEEDS_REVIEW", "OTHER"]).default("OTHER"),
  note: z.string().max(1000).nullable().optional()
});
const noteSchema = z.object({ note: z.string().max(1000).nullable() });

export async function registerPurchaseRoutes(app: FastifyInstance): Promise<void> {
  const service = () => new PurchaseDecisionService(app.prisma);

  app.get("/purchase-decisions", async (request) => ({ purchaseDecisions: await service().list(request.currentUser!.id) }));

  app.get("/purchase-decisions/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const decision = await service().detail(request.currentUser!.id, id);
    return decision ? { purchaseDecision: decision } : reply.notFound("Purchase decision not found");
  });

  app.post("/live-finds/:id/opened", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const decision = await service().opened(request.currentUser!.id, id);
    return decision ? { purchaseDecision: decision } : reply.notFound("Live find not found");
  });

  app.post("/live-finds/:id/mark-skipped", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { id } = paramsSchema.parse(request.params);
    const body = skippedSchema.parse(request.body ?? {});
    const decision = await service().skipped(request.currentUser!.id, id, body);
    return decision ? { purchaseDecision: decision } : reply.notFound("Live find not found");
  });

  app.post("/live-finds/:id/unsnooze", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const decision = await service().unsnooze(request.currentUser!.id, id);
    return decision ? { purchaseDecision: decision } : reply.notFound("Live find not found");
  });

  app.patch("/live-finds/:id/note", async (request, reply) => {
    assertNoSensitiveKeys(request.body);
    const { id } = paramsSchema.parse(request.params);
    const body = noteSchema.parse(request.body ?? {});
    const decision = await service().updateNote(request.currentUser!.id, id, body.note);
    return decision ? { purchaseDecision: decision } : reply.notFound("Live find not found");
  });
}
