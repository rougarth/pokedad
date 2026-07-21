import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { env } from "../../../config/env.js";
import type { StoreAdapter } from "../store-adapter.interface.js";
import { BestBuyScanService } from "./bestbuy-scan.service.js";
import type { BestBuySchedulerState, BestBuyScanConfig } from "./bestbuy-scan.types.js";

const SCHEDULER_STATE_KEY = "bestBuySchedulerState";
const POLL_INTERVAL_MS = 60_000;
const MINIMUM_SCHEDULE_SECONDS = 30 * 60;
const DEFAULT_STATE: BestBuySchedulerState = { status: "STOPPED", active: false };

function sanitizeError(error: unknown): string {
  return String(error).replace(/apiKey=[^&\s]+/gi, "apiKey=[REDACTED]").replace(/https?:\/\/\S+/gi, "[REDACTED_URL]").slice(0, 300);
}

function parseConfig(value: unknown): BestBuyScanConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as unknown as BestBuyScanConfig;
  return typeof config.enabled === "boolean" && typeof config.scheduledScanEnabled === "boolean" ? config : null;
}

function mergeState(value: unknown): BestBuySchedulerState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_STATE;
  return { ...DEFAULT_STATE, ...(value as Partial<BestBuySchedulerState>) };
}

export async function getBestBuySchedulerState(prisma: PrismaClient, ownerId: string): Promise<BestBuySchedulerState> {
  const setting = await prisma.appSetting.findUnique({ where: { ownerId_key: { ownerId, key: SCHEDULER_STATE_KEY } } });
  return mergeState(setting?.value);
}

export async function checkBestBuyRedisReadiness(): Promise<boolean> {
  const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableReadyCheck: true });
  redis.on("error", () => undefined);
  try {
    await redis.connect();
    return await redis.ping() === "PONG";
  } catch {
    return false;
  } finally {
    redis.disconnect(false);
  }
}

export async function saveBestBuySchedulerState(prisma: PrismaClient, ownerId: string, state: BestBuySchedulerState): Promise<void> {
  await prisma.appSetting.upsert({
    where: { ownerId_key: { ownerId, key: SCHEDULER_STATE_KEY } },
    create: { ownerId, key: SCHEDULER_STATE_KEY, value: state as unknown as Prisma.InputJsonValue },
    update: { value: state as unknown as Prisma.InputJsonValue }
  });
}

export class BestBuyScanScheduler {
  private redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableReadyCheck: true });
  private timer?: NodeJS.Timeout;
  private ticking = false;
  private stopped = true;

  constructor(private readonly prisma: PrismaClient, private readonly adapter: StoreAdapter) {}

  private attachRedisErrorHandler(): void {
    this.redis.on("error", () => undefined);
  }

  async start(): Promise<void> {
    if (!this.stopped) return;
    this.stopped = false;
    this.attachRedisErrorHandler();
    await this.ensureRedis().catch(() => false);
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    this.timer.unref();
    setTimeout(() => void this.tick(), 2_000).unref();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.redis.disconnect(false);
  }

  async tick(): Promise<void> {
    if (this.stopped || this.ticking) return;
    this.ticking = true;
    try {
      const settings = await this.prisma.appSetting.findMany({ where: { key: "bestBuyScanConfig" }, select: { ownerId: true, value: true } });
      for (const setting of settings) {
        const config = parseConfig(setting.value);
        if (!config?.enabled || !config.scheduledScanEnabled) continue;
        await this.tickOwner(setting.ownerId, config);
      }
    } catch {
      // Local dev often starts the API before Docker/PostgreSQL. Keep the API alive and retry on the next tick.
    } finally {
      this.ticking = false;
    }
  }

  private async tickOwner(ownerId: string, config: BestBuyScanConfig): Promise<void> {
    const now = new Date();
    if (!this.adapter.getStatus().configured) {
      await saveBestBuySchedulerState(this.prisma, ownerId, {
        status: "CONFIGURATION_NEEDED",
        active: false,
        lastTickAt: now.toISOString(),
        lastError: "Best Buy API approval/key is required before scheduled scans can run."
      });
      return;
    }

    const scan = new BestBuyScanService(this.prisma, this.adapter);
    const scanState = await scan.getState(ownerId);
    const nextRunAt = scanState.nextAllowedScanAt
      ? new Date(scanState.nextAllowedScanAt)
      : new Date((scanState.lastScanFinishedAt ? new Date(scanState.lastScanFinishedAt).getTime() : now.getTime()) + Math.max(MINIMUM_SCHEDULE_SECONDS, config.scanIntervalSeconds) * 1000);
    if (scanState.locked || nextRunAt.getTime() > now.getTime()) {
      await saveBestBuySchedulerState(this.prisma, ownerId, { status: scanState.locked ? "RUNNING" : "WAITING", active: true, lastTickAt: now.toISOString(), nextRunAt: nextRunAt.toISOString(), lastError: undefined });
      return;
    }

    if (!await this.ensureRedis()) {
      await saveBestBuySchedulerState(this.prisma, ownerId, { status: "REDIS_UNAVAILABLE", active: true, lastTickAt: now.toISOString(), nextRunAt: new Date(now.getTime() + POLL_INTERVAL_MS).toISOString(), lastError: "Redis is unavailable; scheduled scan was not started." });
      return;
    }

    const lockKey = `pokedad:best-buy:scheduler:${ownerId}`;
    const token = randomUUID();
    const leaseMs = Math.max(15 * 60_000, config.searchTerms.length * config.minimumDelayBetweenApiCallsMs + 5 * 60_000);
    const acquired = await this.redis.set(lockKey, token, "PX", leaseMs, "NX");
    if (acquired !== "OK") return;

    await saveBestBuySchedulerState(this.prisma, ownerId, { status: "RUNNING", active: true, lastTickAt: now.toISOString(), lastScheduledScanAt: now.toISOString() });
    try {
      const result = await scan.runManualScan(ownerId, "SCHEDULED");
      await saveBestBuySchedulerState(this.prisma, ownerId, {
        status: result.scanStatus.status === "CONFIGURATION_NEEDED" ? "CONFIGURATION_NEEDED" : result.scanStatus.status === "FAILED" ? "ERROR" : "WAITING",
        active: true,
        lastTickAt: new Date().toISOString(),
        lastScheduledScanAt: now.toISOString(),
        nextRunAt: result.scanStatus.nextAllowedScanAt,
        lastResultStatus: result.scanStatus.status,
        lastError: result.error
      });
    } catch (error) {
      await saveBestBuySchedulerState(this.prisma, ownerId, { status: "ERROR", active: true, lastTickAt: new Date().toISOString(), lastScheduledScanAt: now.toISOString(), nextRunAt: new Date(Date.now() + MINIMUM_SCHEDULE_SECONDS * 1000).toISOString(), lastError: sanitizeError(error) });
    } finally {
      await this.redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, lockKey, token).catch(() => undefined);
    }
  }

  private async ensureRedis(): Promise<boolean> {
    try {
      if (this.redis.status === "ready") return true;
      if (this.redis.status === "end") {
        this.redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableReadyCheck: true });
        this.attachRedisErrorHandler();
      }
      if (this.redis.status === "wait") await this.redis.connect();
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}
