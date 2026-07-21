<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { CheckCircle2, Clock3, Pause, Play, Save, ShieldCheck, X } from "@lucide/vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();
const confirmationOpen = ref(false);
const confirmationText = ref("");
const approvalConfirmed = ref(false);
const readOnlyConfirmed = ref(false);
const actionMessage = ref("");
const scanning = ref(false);
const canConfirm = computed(() => approvalConfirmed.value && readOnlyConfirmed.value && confirmationText.value === "RUN ONE READ-ONLY SCAN" && radar.bestBuyManualReadiness.ready);

onMounted(() => {
  Promise.all([radar.loadBestBuyScan(), radar.loadAlertSettings(), radar.loadAdapters(), radar.checkBestBuyManualReadiness(false)]).catch(() => undefined);
});

async function runReadinessCheck() {
  actionMessage.value = "";
  const readiness = await radar.checkBestBuyManualReadiness(true);
  actionMessage.value = readiness.ready ? "Readiness passed. Review the confirmation before running one scan." : readiness.reasons.join(" ");
}

function openConfirmation() {
  confirmationText.value = "";
  approvalConfirmed.value = false;
  readOnlyConfirmed.value = false;
  confirmationOpen.value = true;
}

async function confirmManualScan() {
  if (!canConfirm.value) return;
  scanning.value = true;
  actionMessage.value = "";
  try {
    await radar.runBestBuyScanNow(confirmationText.value, approvalConfirmed.value);
    actionMessage.value = "One manual read-only scan completed. Review the result summary and Notification History.";
    confirmationOpen.value = false;
  } catch (error) {
    actionMessage.value = String(error);
  } finally {
    scanning.value = false;
  }
}

</script>

<template>
  <div class="space-y-6">
    <section class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">Best Buy Scan Rules</h2>
          <p class="mt-1 text-sm text-slate-600">Read-only scan loop settings. These settings never enable cart, checkout, or purchase automation.</p>
        </div>
        <StatusBadge :label="radar.bestBuyScanStatus.status" :tone="radar.statusTone(radar.bestBuyScanStatus.status)" />
      </div>

      <div class="mt-5 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-semibold">Best Buy Approval Pending</h3>
            <p class="mt-1">Best Buy API approval pending. Live scans are paused until BEST_BUY_API_KEY is configured.</p>
          </div>
          <StatusBadge :label="radar.bestBuyManualReadiness.configured ? 'READY' : 'APPROVAL_PENDING'" :tone="radar.bestBuyManualReadiness.configured ? 'green' : 'gold'" />
        </div>
        <p class="mt-3 text-xs font-semibold uppercase">Setup checklist</p>
        <ol class="mt-2 grid gap-1 text-sm md:grid-cols-2">
          <li>1. Apply for Best Buy Developer API access.</li>
          <li>2. Wait for approval.</li>
          <li>3. Add BEST_BUY_API_KEY to `.env`.</li>
          <li>4. Add BEST_BUY_API_KEY to `apps/api/.env`.</li>
          <li>5. Restart API.</li>
          <li>6. Confirm `/config/status` shows key configured.</li>
          <li>7. Run one controlled manual live scan.</li>
          <li>8. Only then enable scheduled scan.</li>
        </ol>
      </div>

      <div class="mt-5 border-y border-radar-line py-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-start gap-3"><ShieldCheck class="mt-0.5 size-5 text-radar-teal" /><div><h3 class="text-sm font-semibold">Manual Real Scan Readiness</h3><p class="mt-1 text-sm text-slate-600">A readiness token and explicit confirmation are required for each single read-only scan.</p></div></div>
          <StatusBadge :label="radar.bestBuyManualReadiness.status" :tone="radar.statusTone(radar.bestBuyManualReadiness.status)" />
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="border border-radar-line p-3"><p class="text-xs font-semibold uppercase text-slate-500">Configuration</p><StatusBadge class="mt-2" :label="radar.bestBuyManualReadiness.configured ? 'READY' : 'CONFIGURATION_NEEDED'" :tone="radar.bestBuyManualReadiness.configured ? 'green' : 'gold'" /></div>
          <div class="border border-radar-line p-3"><p class="text-xs font-semibold uppercase text-slate-500">Scheduler</p><StatusBadge class="mt-2" :label="radar.bestBuyManualReadiness.schedulerStopped ? 'STOPPED' : 'MUST_STOP'" :tone="radar.bestBuyManualReadiness.schedulerStopped ? 'green' : 'red'" /></div>
          <div class="border border-radar-line p-3"><p class="text-xs font-semibold uppercase text-slate-500">Redis lock</p><StatusBadge class="mt-2" :label="radar.bestBuyManualReadiness.redisReady ? 'READY' : 'UNAVAILABLE'" :tone="radar.bestBuyManualReadiness.redisReady ? 'green' : 'red'" /></div>
          <div class="border border-radar-line p-3"><p class="text-xs font-semibold uppercase text-slate-500">Alert channel</p><StatusBadge class="mt-2" :label="radar.bestBuyManualReadiness.alertChannelReady ? 'READY' : 'HISTORY_ONLY'" :tone="radar.bestBuyManualReadiness.alertChannelReady ? 'green' : 'gold'" /></div>
        </div>
        <div v-if="radar.bestBuyManualReadiness.reasons.length" class="mt-3 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p v-for="reason in radar.bestBuyManualReadiness.reasons" :key="reason">{{ reason }}</p></div>
        <div v-if="radar.bestBuyManualReadiness.warnings.length" class="mt-3 text-xs text-slate-600"><p v-for="warning in radar.bestBuyManualReadiness.warnings" :key="warning">{{ warning }}</p></div>
        <div class="mt-4 flex flex-wrap gap-2"><button class="flex items-center gap-2 rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="runReadinessCheck"><CheckCircle2 class="size-4" /> Run Readiness Check</button><button class="flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="!radar.bestBuyManualReadiness.ready || !radar.bestBuyManualReadiness.readinessToken" type="button" @click="openConfirmation"><Play class="size-4" /> Review Manual Scan</button></div>
      </div>

      <div class="mt-5 border-b border-radar-line pb-5">
        <div class="flex flex-wrap items-center justify-between gap-3"><h3 class="text-sm font-semibold">Last Scan Result</h3><StatusBadge :label="radar.bestBuyScanStatus.status" :tone="radar.statusTone(radar.bestBuyScanStatus.status)" /></div>
        <dl class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><dt class="text-xs font-semibold uppercase text-slate-500">Best Buy requests</dt><dd class="mt-1 text-sm">{{ radar.bestBuyScanStatus.lastRequestCount }}</dd></div><div><dt class="text-xs font-semibold uppercase text-slate-500">Products checked</dt><dd class="mt-1 text-sm">{{ radar.bestBuyScanStatus.lastProductsCheckedCount }}</dd></div><div><dt class="text-xs font-semibold uppercase text-slate-500">Matches found</dt><dd class="mt-1 text-sm">{{ radar.bestBuyScanStatus.lastMatchCount }}</dd></div><div><dt class="text-xs font-semibold uppercase text-slate-500">Duration</dt><dd class="mt-1 text-sm">{{ radar.bestBuyScanStatus.lastScanDurationMs == null ? 'Not available' : `${radar.bestBuyScanStatus.lastScanDurationMs} ms` }}</dd></div></dl>
        <p v-if="radar.bestBuyScanStatus.lastError" class="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Last error:</strong> {{ radar.bestBuyScanStatus.lastError }}</p>
      </div>

      <div class="mt-5 border-y border-radar-line py-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-start gap-3"><Clock3 class="mt-0.5 size-5 text-radar-teal" /><div><h3 class="text-sm font-semibold">Scheduled Read-Only Worker</h3><p class="mt-1 text-sm text-slate-600">Scheduler remains paused while approval/key is missing. Redis-locked scans run no more often than every 30 minutes only after explicit enablement.</p></div></div>
          <StatusBadge :label="radar.bestBuySchedulerState.status" :tone="radar.statusTone(radar.bestBuySchedulerState.status)" />
        </div>
        <dl class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Last worker tick</dt><dd class="mt-1 text-sm">{{ radar.formatTime(radar.bestBuySchedulerState.lastTickAt) }}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Last scheduled scan</dt><dd class="mt-1 text-sm">{{ radar.formatTime(radar.bestBuySchedulerState.lastScheduledScanAt) }}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Next run</dt><dd class="mt-1 text-sm">{{ radar.formatTime(radar.bestBuySchedulerState.nextRunAt) }}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Last result</dt><dd class="mt-1 text-sm">{{ radar.bestBuySchedulerState.lastResultStatus ?? 'None' }}</dd></div>
        </dl>
        <p v-if="!radar.bestBuyManualReadiness.configured" class="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Scheduler paused safely: BEST_BUY_API_KEY is not configured, so no live scan job will be scheduled and no retailer request will be made.</p>
        <p v-if="radar.bestBuySchedulerState.lastError" class="mt-3 text-sm text-amber-800">{{ radar.bestBuySchedulerState.lastError }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button v-if="!radar.bestBuyScanConfig.scheduledScanEnabled" class="flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white" type="button" @click="radar.setBestBuySchedulerEnabled(true)"><Play class="size-4" /> Enable Scheduler</button>
          <button v-else class="flex items-center gap-2 rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="radar.setBestBuySchedulerEnabled(false)"><Pause class="size-4" /> Disable Scheduler</button>
        </div>
      </div>

      <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm">
          <input v-model="radar.bestBuyScanConfig.enabled" type="checkbox" />
          Scan enabled
        </label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm">
          <input v-model="radar.bestBuyScanConfig.onlyOfficialBestBuySeller" type="checkbox" />
          Official seller only
        </label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm">
          <input v-model="radar.bestBuyScanConfig.onlyPokemonTcgSealedProducts" type="checkbox" />
          Sealed Pokemon TCG only
        </label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm">
          <input v-model="radar.bestBuyScanConfig.applyPriceRules" type="checkbox" />
          Apply price rules
        </label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm">
          <input v-model="radar.bestBuyScanConfig.createLiveFindCandidates" type="checkbox" />
          Create live-find candidates
        </label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm">
          <input v-model="radar.bestBuyScanConfig.sendAlertsForAcceptedPrices" type="checkbox" />
          Create alert events
        </label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm">
          <input v-model="radar.bestBuyScanConfig.sendAlertsAutomatically" type="checkbox" />
          Send alerts automatically
        </label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm">
          <input v-model="radar.bestBuyScanConfig.sendScanFailureAlerts" type="checkbox" />
          Send scan failure alerts
        </label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm">
          <input v-model="radar.bestBuyScanConfig.ignoreOverLimitProducts" type="checkbox" />
          Ignore over-limit products
        </label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm">
          <input v-model="radar.bestBuyScanConfig.alertOnUnknownMsrp" type="checkbox" />
          Alert on unknown MSRP
        </label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm">
          <input v-model="radar.bestBuyScanConfig.autoSuggestMsrpCategory" type="checkbox" />
          Auto-suggest MSRP category
        </label>
      </div>

      <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label class="block text-sm">
          <span class="text-xs font-semibold uppercase text-slate-500">Scan interval seconds</span>
          <input v-model.number="radar.bestBuyScanConfig.scanIntervalSeconds" class="mt-2 w-full rounded border border-radar-line px-3 py-2" :min="radar.bestBuyScanConfig.scheduledScanEnabled ? 1800 : 300" type="number" />
        </label>
        <label class="block text-sm">
          <span class="text-xs font-semibold uppercase text-slate-500">Alert cooldown minutes</span>
          <input v-model.number="radar.bestBuyScanConfig.alertCooldownMinutes" class="mt-2 w-full rounded border border-radar-line px-3 py-2" min="15" type="number" />
        </label>
        <label class="block text-sm">
          <span class="text-xs font-semibold uppercase text-slate-500">Max results per scan</span>
          <input v-model.number="radar.bestBuyScanConfig.maxResultsPerScan" class="mt-2 w-full rounded border border-radar-line px-3 py-2" min="1" max="100" type="number" />
        </label>
        <label class="block text-sm">
          <span class="text-xs font-semibold uppercase text-slate-500">API call delay ms</span>
          <input v-model.number="radar.bestBuyScanConfig.minimumDelayBetweenApiCallsMs" class="mt-2 w-full rounded border border-radar-line px-3 py-2" min="1000" type="number" />
        </label>
      </div>

      <label class="mt-5 block text-sm">
        <span class="text-xs font-semibold uppercase text-slate-500">Search terms</span>
        <textarea v-model="radar.bestBuySearchTermsText" class="mt-2 min-h-48 w-full rounded border border-radar-line px-3 py-2 font-mono text-sm"></textarea>
      </label>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <button class="flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white" type="button" @click="radar.saveBestBuyScanConfig()">
          <Save class="size-4" />
          Save Settings
        </button>
        <span class="rounded border border-radar-line px-3 py-2 text-sm font-semibold text-slate-500">Manual scan requires readiness confirmation</span>
        <span class="text-sm text-slate-600">Last scan: {{ radar.formatTime(radar.bestBuyScanStatus.lastScanFinishedAt) }}</span>
      </div>
    </section>

    <section class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <h2 class="text-base font-semibold">Alert Template Settings</h2>
      <p class="mt-1 text-sm text-slate-600">Controls mobile message presentation only. It does not change retailer or purchase behavior.</p>
      <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm"><input v-model="radar.alertTemplateSettings.compactMobileAlerts" type="checkbox" /> Use compact mobile alerts</label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm"><input v-model="radar.alertTemplateSettings.includeProductImage" type="checkbox" /> Include product image</label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm"><input v-model="radar.alertTemplateSettings.includeMsrpDetails" type="checkbox" /> Include MSRP details</label>
        <label class="flex items-center gap-3 rounded border border-radar-line p-3 text-sm"><input v-model="radar.alertTemplateSettings.includeOpenProductLink" type="checkbox" /> Include Open Product link</label>
      </div>
      <button class="mt-5 flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white" type="button" @click="radar.saveAlertSettings()"><Save class="size-4" /> Save Alert Settings</button>
    </section>

    <div v-if="confirmationOpen" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div class="w-full max-w-xl rounded border border-radar-line bg-white shadow-xl">
        <header class="flex items-center justify-between border-b border-radar-line p-4"><div><h2 class="font-semibold">Confirm One Read-Only Scan</h2><p class="text-xs text-slate-500">This authorization is single-use and expires shortly.</p></div><button class="rounded border border-radar-line p-2" title="Close confirmation" type="button" @click="confirmationOpen = false"><X class="size-4" /></button></header>
        <div class="space-y-4 p-5">
          <label class="flex items-start gap-3 text-sm"><input v-model="approvalConfirmed" class="mt-1" type="checkbox" /><span>I confirm the Best Buy Developer dashboard shows this API key is approved for official API access.</span></label>
          <label class="flex items-start gap-3 text-sm"><input v-model="readOnlyConfirmed" class="mt-1" type="checkbox" /><span>I confirm this is one read-only scan with no cart, checkout, scraping, browser automation, or purchase action.</span></label>
          <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Type RUN ONE READ-ONLY SCAN</span><input v-model="confirmationText" autocomplete="off" class="mt-2 w-full rounded border border-radar-line px-3 py-2 font-mono" /></label>
          <div class="flex justify-end gap-2"><button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="confirmationOpen = false">Cancel</button><button class="flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="!canConfirm || scanning" type="button" @click="confirmManualScan"><Play class="size-4" /> Run One Scan</button></div>
        </div>
      </div>
    </div>
    <p v-if="actionMessage" class="fixed bottom-4 right-4 z-50 max-w-md border border-radar-line bg-white p-3 text-sm shadow-xl">{{ actionMessage }}</p>
  </div>
</template>
