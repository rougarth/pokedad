import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { AnalyticsService, type AnalyticsFilters } from "./analytics.service.js";

const filterSchema = z.object({
  period: z.enum(["TODAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "ALL_TIME"]).optional(),
  storeKey: z.string().optional(),
  setName: z.string().optional(),
  categoryId: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  mockMode: z.enum(["MOCK_ONLY", "REAL_ONLY", "ALL"]).optional()
});

function filters(query: unknown): AnalyticsFilters {
  return filterSchema.parse(query);
}

function csv(reply: FastifyReply, filename: string, body: string) {
  return reply
    .header("content-type", "text/csv; charset=utf-8")
    .header("content-disposition", `attachment; filename="${filename}"`)
    .send(body);
}

export async function registerAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  const service = () => new AnalyticsService(app.prisma);

  app.get("/analytics/summary", async (request) => ({ summary: await service().summary(request.currentUser!.id, filters(request.query)) }));
  app.get("/analytics/spending", async (request) => ({ spending: await service().spending(request.currentUser!.id, filters(request.query)) }));
  app.get("/analytics/purchase-history", async (request) => ({ purchaseHistory: await service().purchaseHistory(request.currentUser!.id, filters(request.query)) }));
  app.get("/analytics/wishlist-progress", async (request) => ({ wishlistProgress: await service().wishlistProgress(request.currentUser!.id, filters(request.query)) }));
  app.get("/analytics/release-coverage", async (request) => ({ releaseCoverage: await service().releaseCoverage(request.currentUser!.id, filters(request.query)) }));
  app.get("/analytics/manual-link-activity", async (request) => ({ manualLinkActivity: await service().manualLinkActivity(request.currentUser!.id, filters(request.query)) }));
  app.get("/analytics/alerts", async (request) => ({ alertAnalytics: await service().alerts(request.currentUser!.id, filters(request.query)) }));
  app.get("/analytics/msrp-mapping", async (request) => ({ msrpMappingAnalytics: await service().msrpMapping(request.currentUser!.id, filters(request.query)) }));

  app.get("/analytics", async (request) => service().all(request.currentUser!.id, filters(request.query)));

  app.get("/analytics/export/bought.csv", async (request, reply) => {
    const body = await service().exportPurchases(request.currentUser!.id, "bought");
    return csv(reply, "pokedad-bought-history.csv", body);
  });

  app.get("/analytics/export/skipped.csv", async (request, reply) => {
    const body = await service().exportPurchases(request.currentUser!.id, "skipped");
    return csv(reply, "pokedad-skipped-history.csv", body);
  });
}
