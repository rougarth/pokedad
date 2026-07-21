import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { env } from "../../config/env.js";

type BotResult = {
  requestId?: string | null;
  status: string;
  store?: string;
  sku?: string | null;
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

}
