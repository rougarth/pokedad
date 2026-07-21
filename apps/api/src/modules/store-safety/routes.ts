import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuditService } from "../../services/audit.service.js";
import { getStoreSafetyItem, storeSafetyMatrix } from "./store-safety-matrix.js";

const paramsSchema = z.object({ storeKey: z.string().min(1).max(80) });

export async function registerStoreSafetyRoutes(app: FastifyInstance): Promise<void> {
  const audit = () => new AuditService(app.prisma);

  app.get("/store-safety-matrix", async (request) => {
    await audit().log({
      action: "STORE_SAFETY_MATRIX_VIEWED",
      summary: "Store safety matrix viewed.",
      actorUserId: request.currentUser!.id,
      metadata: { itemCount: storeSafetyMatrix.length }
    });
    return { stores: storeSafetyMatrix };
  });

  app.get("/store-safety-matrix/:storeKey", async (request, reply) => {
    const { storeKey } = paramsSchema.parse(request.params);
    const item = getStoreSafetyItem(storeKey);
    if (!item) {
      return reply.notFound("Store safety item not found");
    }
    await audit().log({
      action: "STORE_SAFETY_DETAIL_VIEWED",
      summary: `${item.displayName} safety matrix detail viewed.`,
      actorUserId: request.currentUser!.id,
      metadata: { storeKey: item.storeKey, recommendedMode: item.recommendedMode, riskLevel: item.riskLevel }
    });
    return { store: item };
  });
}
