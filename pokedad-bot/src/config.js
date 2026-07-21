import dotenv from "dotenv";

dotenv.config();

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

export const config = Object.freeze({
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  apiBaseUrl: process.env.API_BASE_URL || "http://127.0.0.1:4000",
  port: parsePort(process.env.BOT_PORT, 3456),
  workerId: process.env.WORKER_ID || "safe-worker-1",
  bestBuyConfigured: process.env.BEST_BUY_API_KEY_CONFIGURED === "true",
  proxyEnabled: process.env.OUTBOUND_PROXY_ENABLED === "true",
  proxyFile: process.env.OUTBOUND_PROXY_FILE || "./proxies.txt"
});
