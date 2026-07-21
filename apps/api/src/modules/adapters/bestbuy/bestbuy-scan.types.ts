import type { DemoLiveFind } from "@pokedad-radar/shared";
import type { AdapterStatus, ProductSearchResult } from "../types.js";

export type BestBuyScanStatus =
  | "IDLE"
  | "CONFIGURATION_NEEDED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "RATE_LIMITED"
  | "DISABLED";

export interface BestBuyScanConfig {
  enabled: boolean;
  scheduledScanEnabled: boolean;
  scanIntervalSeconds: number;
  searchTerms: string[];
  maxResultsPerScan: number;
  minimumDelayBetweenApiCallsMs: number;
  onlyOfficialBestBuySeller: boolean;
  onlyPokemonTcgSealedProducts: boolean;
  applyPriceRules: boolean;
  createLiveFindCandidates: boolean;
  sendAlertsForAcceptedPrices: boolean;
  sendAlertsAutomatically: boolean;
  sendScanFailureAlerts: boolean;
  ignoreOverLimitProducts: boolean;
  ignoreUnknownSuspiciousProducts: boolean;
  alertOnUnknownMsrp: boolean;
  autoSuggestMsrpCategory: boolean;
  alertCooldownMinutes: number;
}

export type BestBuySchedulerStatus = "STOPPED" | "WAITING" | "RUNNING" | "CONFIGURATION_NEEDED" | "REDIS_UNAVAILABLE" | "ERROR";

export interface BestBuySchedulerState {
  status: BestBuySchedulerStatus;
  active: boolean;
  lastTickAt?: string;
  lastScheduledScanAt?: string;
  nextRunAt?: string;
  lastResultStatus?: BestBuyScanStatus;
  lastError?: string;
}

export interface BestBuyScanState {
  status: BestBuyScanStatus;
  locked: boolean;
  lastScanStartedAt?: string;
  lastScanFinishedAt?: string;
  lastSuccessfulScanAt?: string;
  lastScanDurationMs?: number;
  lastRequestCount: number;
  lastProductsCheckedCount: number;
  lastMatchCount: number;
  lastError?: string;
  lastResultCount: number;
  lastAcceptedCount: number;
  lastOverLimitCount: number;
  lastUnknownMsrpCount: number;
  lastMappingCandidateCreatedCount: number;
  lastAlertCount: number;
  lastSuppressedDuplicateCount: number;
  nextAllowedScanAt?: string;
}

export type BestBuyManualReadinessStatus = "CONFIGURATION_NEEDED" | "READY_FOR_MANUAL_SCAN" | "COOLDOWN_ACTIVE" | "SCAN_RUNNING" | "SCHEDULER_MUST_BE_STOPPED" | "DEPENDENCY_UNAVAILABLE";

export interface BestBuyManualReadiness {
  status: BestBuyManualReadinessStatus;
  ready: boolean;
  configured: boolean;
  schedulerStopped: boolean;
  redisReady: boolean;
  alertChannelReady: boolean;
  checkedAt: string;
  cooldownEndsAt?: string;
  reasons: string[];
  warnings: string[];
  readinessToken?: string;
  readinessExpiresAt?: string;
}

export interface BestBuyScanResponse {
  adapter: AdapterStatus;
  config: BestBuyScanConfig;
  scanStatus: BestBuyScanState;
  results: ProductSearchResult[];
  liveFinds: DemoLiveFind[];
  error?: string;
}
