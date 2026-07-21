import { createServer } from "node:http";
import Redis from "ioredis";
import { config } from "./config.js";
import { getStoreSafety, listStoreSafety } from "./safety-matrix.js";

const startedAt = new Date();
const subscriber = new Redis(config.redisUrl, { maxRetriesPerRequest: 1 });
const publisher = new Redis(config.redisUrl, { maxRetriesPerRequest: 1 });

function safeLog(level, message, metadata = {}) {
  const allowed = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !/secret|token|cookie|password|key|authorization/i.test(key))
  );
  console[level](JSON.stringify({ timestamp: new Date().toISOString(), level, worker: config.workerId, message, ...allowed }));
}

function scanResponse(command) {
  const safety = getStoreSafety(command.store);
  if (!safety) return { status: "ERROR", error: "Unknown store." };

  if (!safety.liveAllowed) {
    return {
      status: "MANUAL_ONLY",
      store: safety.storeKey,
      safetyMode: safety.mode,
      message: "Live adapter disabled until official or explicitly allowed access is confirmed."
    };
  }

  return {
    status: config.bestBuyConfigured ? "API_MANAGED" : "CONFIGURATION_NEEDED",
    store: safety.storeKey,
    message: config.bestBuyConfigured
      ? "Run the authenticated readiness flow from PokeDad Radar Scan Settings."
      : "Best Buy official API configuration is required."
  };
}

async function publishResult(command, result) {
  await publisher.publish("pokedad:safe-result", JSON.stringify({
    requestId: typeof command.requestId === "string" ? command.requestId : null,
    ...result,
    timestamp: new Date().toISOString()
  }));
}

async function handleCommand(raw) {
  let command;
  try {
    command = JSON.parse(raw);
  } catch {
    safeLog("warn", "Rejected malformed command.");
    return;
  }

  if (command.action === "status") {
    await publishResult(command, { status: "READY", stores: listStoreSafety() });
    return;
  }

  if (command.action === "scan") {
    const result = scanResponse(command);
    safeLog("info", "Store readiness command handled.", { store: command.store, status: result.status });
    await publishResult(command, result);
    return;
  }

  await publishResult(command, { status: "ERROR", error: "Unsupported command." });
}

await subscriber.subscribe("pokedad:safe-command");
subscriber.on("message", (_channel, message) => void handleCommand(message));

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      status: "ok",
      worker: config.workerId,
      startedAt: startedAt.toISOString(),
      bestBuyConfigured: config.bestBuyConfigured,
      liveRetailerRequestsEnabled: false
    }));
    return;
  }
  response.writeHead(404).end();
});

server.listen(config.port, "0.0.0.0", () => safeLog("info", "Safe bot worker ready.", { port: config.port }));

async function shutdown() {
  server.close();
  await subscriber.quit();
  await publisher.quit();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
