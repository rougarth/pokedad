import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { z } from "zod";
import { env } from "../../config/env.js";

const mockScanSchema = z.object({
  store: z.enum(["best-buy", "target", "walmart", "pokemon-center", "gamestop", "amazon", "costco", "sams-club", "bjs"]),
  sku: z.string().trim().min(1).max(100).default("demo")
});

type BotResult = {
  requestId?: string | null;
  status: string;
  store?: string;
  sku?: string | null;
  mock?: boolean;
  message?: string;
  error?: string;
  stores?: unknown[];
  timestamp?: string;
};

async function sendBotCommand(command: Record<string, unknown>): Promise<BotResult> {
  const requestId = randomUUID();
  const subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 });
  const publisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 });

  try {
    await subscriber.subscribe("pokedad:safe-result");
    return await new Promise<BotResult>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Safe bot worker is unavailable.")), 3_000);
      subscriber.on("message", (_channel: string, raw: string) => {
        try {
          const result = JSON.parse(raw) as BotResult;
          if (result.requestId !== requestId) return;
          clearTimeout(timeout);
          resolve(result);
        } catch {
          // Ignore unrelated malformed messages.
        }
      });
      void publisher.publish("pokedad:safe-command", JSON.stringify({ ...command, requestId }));
    });
  } finally {
    await Promise.allSettled([subscriber.quit(), publisher.quit()]);
  }
}

export async function registerBotRoutes(app: FastifyInstance): Promise<void> {
  app.get("/bot/status", async (_request, reply) => {
    try {
      return { connected: true, result: await sendBotCommand({ action: "status" }) };
    } catch {
      return reply.code(503).send({ connected: false, error: "Safe bot worker is unavailable." });
    }
  });

  app.post("/bot/mock-scan", async (request, reply) => {
    const body = mockScanSchema.parse(request.body);
    try {
      const result = await sendBotCommand({ action: "scan", store: body.store, sku: body.sku, mode: "mock" });
      request.log.info({ store: body.store, status: result.status, mock: true }, "Safe bot mock scan completed");
      return { connected: true, result };
    } catch {
      return reply.code(503).send({ connected: false, error: "Safe bot worker is unavailable." });
    }
  });
}
