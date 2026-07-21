import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({
    ok: true,
    service: "pokedad-radar-api",
    timestamp: new Date().toISOString()
  }));

  app.get("/config/status", async () => ({
    bestBuyApiKeyConfigured: Boolean(env.BEST_BUY_API_KEY.trim())
  }));
}
