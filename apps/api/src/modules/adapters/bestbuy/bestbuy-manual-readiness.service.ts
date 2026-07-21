import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { StoreAdapter } from "../store-adapter.interface.js";
import { checkBestBuyRedisReadiness, getBestBuySchedulerState } from "./bestbuy-scheduler.service.js";
import { BestBuyScanService } from "./bestbuy-scan.service.js";
import type { BestBuyManualReadiness } from "./bestbuy-scan.types.js";

const TOKEN_TTL_MS = 5 * 60_000;
const readinessTokens = new Map<string, { token: string; expiresAt: number }>();

export class BestBuyManualReadinessService {
  constructor(private readonly prisma: PrismaClient, private readonly adapter: StoreAdapter) {}

  async check(ownerId: string, issueToken = false): Promise<BestBuyManualReadiness> {
    const scan = new BestBuyScanService(this.prisma, this.adapter);
    const [config, scanState, schedulerState, redisReady, alertChannelCount] = await Promise.all([
      scan.getConfig(ownerId),
      scan.getState(ownerId),
      getBestBuySchedulerState(this.prisma, ownerId),
      checkBestBuyRedisReadiness(),
      this.prisma.alertChannel.count({ where: { ownerId, enabled: true, encryptedSecretId: { not: null }, type: { in: ["DISCORD_WEBHOOK", "TELEGRAM"] } } })
    ]);
    const configured = this.adapter.getStatus().configured;
    const schedulerStopped = !config.scheduledScanEnabled && !schedulerState.active && schedulerState.status === "STOPPED";
    const cooldownEndsAt = scanState.nextAllowedScanAt && new Date(scanState.nextAllowedScanAt).getTime() > Date.now() ? scanState.nextAllowedScanAt : undefined;
    const reasons: string[] = [];
    const warnings: string[] = [];
    let status: BestBuyManualReadiness["status"] = "READY_FOR_MANUAL_SCAN";

    if (!configured || !config.enabled) {
      status = "CONFIGURATION_NEEDED";
      reasons.push(!configured ? "BEST_BUY_API_KEY is not configured." : "Best Buy scans are disabled.");
    } else if (!schedulerStopped) {
      status = "SCHEDULER_MUST_BE_STOPPED";
      reasons.push("Disable the scheduled worker before a one-time manual scan.");
    } else if (scanState.locked) {
      status = "SCAN_RUNNING";
      reasons.push("Another Best Buy scan is already running.");
    } else if (!redisReady) {
      status = "DEPENDENCY_UNAVAILABLE";
      reasons.push("Redis is unavailable; the manual scan safety check cannot continue.");
    } else if (cooldownEndsAt) {
      status = "COOLDOWN_ACTIVE";
      reasons.push("The conservative scan cooldown is still active.");
    }

    if (alertChannelCount === 0) warnings.push("No enabled encrypted Discord or Telegram channel is available; results will remain in Notification History only.");
    if (configured) warnings.push("Credential presence is confirmed locally, but Best Buy approval is confirmed by the user immediately before scanning.");

    const ready = status === "READY_FOR_MANUAL_SCAN";
    const result: BestBuyManualReadiness = {
      status,
      ready,
      configured,
      schedulerStopped,
      redisReady,
      alertChannelReady: alertChannelCount > 0,
      checkedAt: new Date().toISOString(),
      cooldownEndsAt,
      reasons,
      warnings
    };
    if (ready && issueToken) {
      const token = randomUUID();
      const expiresAt = Date.now() + TOKEN_TTL_MS;
      readinessTokens.set(ownerId, { token, expiresAt });
      result.readinessToken = token;
      result.readinessExpiresAt = new Date(expiresAt).toISOString();
    }
    return result;
  }

  consumeToken(ownerId: string, token: string): boolean {
    const current = readinessTokens.get(ownerId);
    readinessTokens.delete(ownerId);
    return Boolean(current && current.token === token && current.expiresAt > Date.now());
  }
}
