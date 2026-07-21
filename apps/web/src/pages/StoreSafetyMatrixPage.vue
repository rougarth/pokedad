<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ExternalLink, ShieldCheck, X } from "@lucide/vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore, type StoreSafetyMatrixItem, type StoreSafetyMode } from "@/stores/radar";

const radar = useRadarStore();
const filter = ref<"ALL" | StoreSafetyMode | "HIGH_RISK">("ALL");

const filterOptions = [
  ["ALL", "All"],
  ["OFFICIAL_API_CANDIDATE", "Official API candidates"],
  ["MANUAL_OPEN_ONLY", "Manual/open-only"],
  ["RESEARCH_PENDING", "Research pending"],
  ["BLOCKED_FOR_AUTOMATION", "Blocked"],
  ["HIGH_RISK", "High risk"]
] as const;

const filteredStores = computed(() => {
  if (filter.value === "ALL") return radar.storeSafetyMatrix;
  if (filter.value === "HIGH_RISK") return radar.storeSafetyMatrix.filter((store) => store.riskLevel === "HIGH");
  return radar.storeSafetyMatrix.filter((store) => store.recommendedMode === filter.value);
});

function supportLabel(value: boolean | null): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

function supportTone(value: boolean | null): "green" | "gold" | "slate" {
  if (value === true) return "green";
  if (value === false) return "slate";
  return "gold";
}

async function openDetail(store: StoreSafetyMatrixItem) {
  await radar.loadStoreSafetyDetail(store.storeKey);
}

onMounted(() => radar.loadStoreSafetyMatrix().catch((error) => { radar.error = String(error); }));
</script>

<template>
  <div class="space-y-5">
    <section class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">Store Safety Matrix</h2>
          <p class="mt-1 text-sm text-slate-600">Conservative research map for future adapters. No live scanners are enabled from this page.</p>
        </div>
        <StatusBadge label="READ-ONLY / RESEARCH" tone="blue" />
      </div>
      <p class="mt-3 text-xs text-slate-500">A store can move toward an adapter only after official or explicitly allowed read-only access is confirmed. Cart, checkout, scraping, browser automation, credential storage, and protection bypass remain blocked.</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <button v-for="([value, label]) in filterOptions" :key="value" class="rounded border px-3 py-2 text-sm font-semibold" :class="filter === value ? 'border-radar-teal bg-teal-50 text-radar-teal' : 'border-radar-line bg-white'" type="button" @click="filter = value">{{ label }}</button>
      </div>
    </section>

    <section class="table-shell rounded">
      <table>
        <thead>
          <tr>
            <th>Store</th>
            <th>Mode</th>
            <th>Risk</th>
            <th>Official API</th>
            <th>Price</th>
            <th>Availability</th>
            <th>Seller filtering</th>
            <th>App status</th>
            <th>Next safe step</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="store in filteredStores" :key="store.storeKey">
            <td>
              <div class="font-medium">{{ store.displayName }}</div>
              <div class="text-xs text-slate-500">{{ store.storeKey }}</div>
            </td>
            <td><StatusBadge :label="store.recommendedMode" :tone="radar.statusTone(store.recommendedMode)" /></td>
            <td><StatusBadge :label="store.riskLevel" :tone="radar.statusTone(store.riskLevel)" /></td>
            <td><StatusBadge :label="supportLabel(store.officialApiFound)" :tone="supportTone(store.officialApiFound)" /></td>
            <td><StatusBadge :label="supportLabel(store.supportsPrice)" :tone="supportTone(store.supportsPrice)" /></td>
            <td><StatusBadge :label="supportLabel(store.supportsAvailability)" :tone="supportTone(store.supportsAvailability)" /></td>
            <td><StatusBadge :label="supportLabel(store.supportsSellerFiltering)" :tone="supportTone(store.supportsSellerFiltering)" /></td>
            <td>{{ store.status }}</td>
            <td class="max-w-md text-sm text-slate-600">{{ store.nextSafeStep }}</td>
            <td><button class="rounded border border-radar-line p-2" title="View details" type="button" @click="openDetail(store)"><ShieldCheck class="size-4" /></button></td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="radar.selectedStoreSafety" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded border border-radar-line bg-white shadow-xl">
        <header class="sticky top-0 flex items-center justify-between border-b border-radar-line bg-white p-4">
          <div>
            <h2 class="font-semibold">{{ radar.selectedStoreSafety.displayName }}</h2>
            <div class="mt-2 flex flex-wrap gap-2">
              <StatusBadge :label="radar.selectedStoreSafety.recommendedMode" :tone="radar.statusTone(radar.selectedStoreSafety.recommendedMode)" />
              <StatusBadge :label="radar.selectedStoreSafety.riskLevel" :tone="radar.statusTone(radar.selectedStoreSafety.riskLevel)" />
            </div>
          </div>
          <button class="rounded border border-radar-line p-2" title="Close" type="button" @click="radar.closeStoreSafetyDetail()"><X class="size-4" /></button>
        </header>
        <div class="space-y-5 p-5">
          <section>
            <h3 class="text-xs font-semibold uppercase text-slate-500">API access notes</h3>
            <p class="mt-2 text-sm text-slate-700">{{ radar.selectedStoreSafety.apiAccessNotes }}</p>
          </section>
          <section>
            <h3 class="text-xs font-semibold uppercase text-slate-500">Supported capabilities</h3>
            <dl class="mt-2 grid gap-3 sm:grid-cols-2">
              <div><dt class="text-xs text-slate-500">Product search</dt><dd>{{ supportLabel(radar.selectedStoreSafety.supportsProductSearch) }}</dd></div>
              <div><dt class="text-xs text-slate-500">Product lookup</dt><dd>{{ supportLabel(radar.selectedStoreSafety.supportsProductLookup) }}</dd></div>
              <div><dt class="text-xs text-slate-500">Price</dt><dd>{{ supportLabel(radar.selectedStoreSafety.supportsPrice) }}</dd></div>
              <div><dt class="text-xs text-slate-500">Availability</dt><dd>{{ supportLabel(radar.selectedStoreSafety.supportsAvailability) }}</dd></div>
              <div><dt class="text-xs text-slate-500">Seller/source filtering</dt><dd>{{ supportLabel(radar.selectedStoreSafety.supportsSellerFiltering) }}</dd></div>
            </dl>
          </section>
          <section>
            <h3 class="text-xs font-semibold uppercase text-slate-500">Safety notes</h3>
            <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li v-for="note in radar.selectedStoreSafety.safetyNotes" :key="note">{{ note }}</li>
            </ul>
          </section>
          <section>
            <h3 class="text-xs font-semibold uppercase text-slate-500">Terms concerns</h3>
            <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li v-for="note in radar.selectedStoreSafety.termsConcerns" :key="note">{{ note }}</li>
            </ul>
          </section>
          <section>
            <h3 class="text-xs font-semibold uppercase text-slate-500">Blocked capabilities</h3>
            <div class="mt-2 flex flex-wrap gap-2">
              <StatusBadge v-for="capability in radar.selectedStoreSafety.blockedCapabilities" :key="capability" :label="capability" tone="red" />
            </div>
          </section>
          <section class="rounded border border-radar-line bg-radar-panel p-4">
            <h3 class="text-sm font-semibold">Next phase recommendation</h3>
            <p class="mt-2 text-sm text-slate-700">{{ radar.selectedStoreSafety.nextSafeStep }}</p>
            <a class="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-radar-teal" href="/wishlist"><ExternalLink class="size-4" /> Use wishlist for manual tracking</a>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
