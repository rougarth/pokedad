<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { ExternalLink, FlaskConical, Pause, Play, Search } from "@lucide/vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();
const bestBuy = computed(() => radar.adapters.find((adapter) => adapter.storeKey === "best-buy"));
const bestBuySafety = computed(() => radar.storeSafetyMatrix.find((store) => store.storeKey === "best-buy"));

onMounted(() => {
  radar.loadAdapters().catch(() => undefined);
  radar.loadSafeBotStatus().catch(() => undefined);
  radar.loadBestBuyScan().catch(() => undefined);
  radar.loadStoreSafetyMatrix().catch(() => undefined);
});
</script>

<template>
  <div class="space-y-6">
    <section class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">PokeDad Safe Bot Worker</h2>
          <p class="mt-1 text-sm text-slate-600">Integrated through authenticated API and Redis. Mock/manual only for stores without approved APIs.</p>
        </div>
        <StatusBadge :label="radar.safeBotStatus.connected ? radar.safeBotStatus.status : 'UNAVAILABLE'" :tone="radar.safeBotStatus.connected ? 'green' : 'red'" />
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
        <label class="text-xs font-semibold uppercase text-slate-500">Store
          <select v-model="radar.safeBotStore" class="mt-2 w-full rounded border border-radar-line bg-white px-3 py-2 text-sm">
            <option value="best-buy">Best Buy</option><option value="target">Target</option><option value="walmart">Walmart</option><option value="pokemon-center">Pokemon Center</option><option value="gamestop">GameStop</option><option value="amazon">Amazon</option><option value="costco">Costco</option><option value="sams-club">Sam's Club</option><option value="bjs">BJ's</option>
          </select>
        </label>
        <label class="text-xs font-semibold uppercase text-slate-500">SKU / reference
          <input v-model="radar.safeBotSku" class="mt-2 w-full rounded border border-radar-line px-3 py-2 text-sm" maxlength="100" />
        </label>
        <button class="self-end rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="radar.loadSafeBotStatus()">Check Status</button>
        <button class="flex self-end items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="!radar.safeBotStatus.connected" type="button" @click="radar.runSafeBotMockScan()"><FlaskConical class="size-4" /> Run Mock</button>
      </div>
      <p class="mt-3 rounded border border-radar-line bg-radar-panel p-3 text-sm text-slate-700">{{ radar.safeBotStatus.message ?? 'No retailer request is made by this worker.' }}</p>
    </section>
    <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="rounded border border-radar-line bg-white p-5 shadow-soft">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-3">
              <img alt="Best Buy Developer API" class="h-8 w-auto object-contain" src="https://developer.bestbuy.com/images/bestbuy-logo.png" />
              <h2 class="text-base font-semibold">Best Buy Developer API</h2>
            </div>
            <p class="mt-2 text-sm text-slate-600">Official Products API, read-only scan only. No cart or checkout automation.</p>
            <div v-if="bestBuySafety" class="mt-3 flex flex-wrap gap-2">
              <StatusBadge :label="bestBuySafety.recommendedMode" :tone="radar.statusTone(bestBuySafety.recommendedMode)" />
              <StatusBadge :label="`Risk ${bestBuySafety.riskLevel}`" :tone="radar.statusTone(bestBuySafety.riskLevel)" />
            </div>
          </div>
          <StatusBadge
            :label="bestBuy?.configured ? 'Configured' : 'APPROVAL_PENDING'"
            :tone="bestBuy?.configured ? 'green' : 'gold'"
          />
        </div>

        <p v-if="bestBuySafety && bestBuySafety.recommendedMode !== 'OFFICIAL_API_CANDIDATE'" class="mt-4 rounded border border-radar-line bg-radar-panel p-3 text-sm text-slate-700">Live adapter disabled until official/allowed access is confirmed.</p>

        <p v-if="bestBuy?.message" class="mt-4 rounded border border-radar-line bg-radar-panel p-3 text-sm text-slate-700">{{ bestBuy.message }}</p>
        <div v-if="!bestBuy?.configured" class="mt-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p class="font-semibold">Best Buy API approval pending. Live scans are paused until BEST_BUY_API_KEY is configured.</p>
          <p class="mt-1">Mock/demo mode is available below and never calls Best Buy. Official read-only live scans can run only after approval, env setup, API restart, readiness check, and explicit manual confirmation.</p>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <p class="text-xs font-semibold uppercase text-slate-500">Capabilities</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <StatusBadge v-for="capability in bestBuy?.capabilities ?? []" :key="capability" :label="capability" tone="blue" />
            </div>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase text-slate-500">Blocked capabilities</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <StatusBadge v-for="capability in bestBuy?.blockedCapabilities ?? []" :key="capability" :label="capability" tone="red" />
            </div>
          </div>
        </div>

        <div class="mt-5">
          <p class="text-xs font-semibold uppercase text-slate-500">Safety notes</p>
          <ul class="mt-2 space-y-1 text-sm text-slate-600">
            <li v-for="note in bestBuy?.safetyNotes ?? []" :key="note">{{ note }}</li>
          </ul>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p class="text-xs font-semibold uppercase text-slate-500">Scan</p>
            <StatusBadge :label="radar.bestBuyScanConfig.enabled ? 'Enabled' : 'Disabled'" :tone="radar.bestBuyScanConfig.enabled ? 'green' : 'gold'" />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase text-slate-500">Last status</p>
            <StatusBadge :label="radar.bestBuyScanStatus.status" :tone="radar.statusTone(radar.bestBuyScanStatus.status)" />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase text-slate-500">Last scan</p>
            <p class="text-sm text-slate-700">{{ radar.formatTime(radar.bestBuyScanStatus.lastScanFinishedAt) }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase text-slate-500">Alerts</p>
            <p class="text-sm text-slate-700">{{ radar.bestBuyScanStatus.lastAlertCount }} ready / {{ radar.bestBuyScanStatus.lastSuppressedDuplicateCount }} suppressed</p>
          </div>
        </div>
        <div class="mt-5 border-t border-radar-line pt-5">
          <p class="text-xs font-semibold uppercase text-slate-500">Latest result summary</p>
          <dl class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt class="text-xs text-slate-500">Started</dt><dd class="text-sm font-medium">{{ radar.formatTime(radar.bestBuyScanStatus.lastScanStartedAt) }}</dd></div>
            <div><dt class="text-xs text-slate-500">Finished</dt><dd class="text-sm font-medium">{{ radar.formatTime(radar.bestBuyScanStatus.lastScanFinishedAt) }}</dd></div>
            <div><dt class="text-xs text-slate-500">Duration</dt><dd class="text-sm font-medium">{{ radar.bestBuyScanStatus.lastScanDurationMs == null ? 'Not available' : `${radar.bestBuyScanStatus.lastScanDurationMs} ms` }}</dd></div>
            <div><dt class="text-xs text-slate-500">Returned</dt><dd class="text-sm font-medium">{{ radar.bestBuyScanStatus.lastResultCount }}</dd></div>
            <div><dt class="text-xs text-slate-500">Accepted</dt><dd class="text-sm font-medium">{{ radar.bestBuyScanStatus.lastAcceptedCount }}</dd></div>
            <div><dt class="text-xs text-slate-500">Over limit</dt><dd class="text-sm font-medium">{{ radar.bestBuyScanStatus.lastOverLimitCount }}</dd></div>
            <div><dt class="text-xs text-slate-500">Unknown MSRP</dt><dd class="text-sm font-medium">{{ radar.bestBuyScanStatus.lastUnknownMsrpCount }}</dd></div>
            <div><dt class="text-xs text-slate-500">New mappings</dt><dd class="text-sm font-medium">{{ radar.bestBuyScanStatus.lastMappingCandidateCreatedCount }}</dd></div>
          </dl>
        </div>
        <p v-if="radar.bestBuyScanStatus.lastError" class="mt-3 text-sm font-medium text-radar-red">{{ radar.bestBuyScanStatus.lastError }}</p>
      </div>

      <div class="rounded border border-radar-line bg-white p-5 shadow-soft">
        <h2 class="text-base font-semibold">Adapter Test</h2>
        <label class="mt-4 block text-xs font-semibold uppercase text-slate-500" for="adapter-query">Search query</label>
        <select id="adapter-query" v-model="radar.adapterQuery" class="mt-2 w-full rounded border border-radar-line bg-white px-3 py-2 text-sm">
          <option>pokemon cards</option>
          <option>pokemon tcg</option>
          <option>pokemon booster</option>
        </select>

        <button class="mt-3 flex w-full items-center justify-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="!bestBuy?.configured" type="button" @click="radar.testBestBuySearch()">
          <Search class="size-4" />
          Test Search
        </button>

        <RouterLink class="mt-3 flex w-full items-center justify-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white" to="/scan-settings">
          <Play class="size-4" />
          Prepare Manual Scan
        </RouterLink>

        <button class="mt-3 flex w-full items-center justify-center gap-2 rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="radar.runBestBuyMockScan()">
          <FlaskConical class="size-4" />
          Run Mock Scan
        </button>

        <button v-if="radar.bestBuyScanConfig.enabled" class="mt-3 flex w-full items-center justify-center gap-2 rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="radar.setBestBuyScanEnabled(false)">
          <Pause class="size-4" />
          Disable Scan
        </button>
        <button v-else class="mt-3 flex w-full items-center justify-center gap-2 rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="radar.setBestBuyScanEnabled(true)">
          <Play class="size-4" />
          Enable Scan
        </button>

        <label class="mt-4 block text-xs font-semibold uppercase text-slate-500" for="adapter-sku">SKU lookup</label>
        <input id="adapter-sku" v-model="radar.adapterLookupSku" class="mt-2 w-full rounded border border-radar-line px-3 py-2 text-sm" placeholder="Best Buy SKU" />
        <button class="mt-3 flex w-full items-center justify-center gap-2 rounded border border-radar-line px-3 py-2 text-sm font-semibold disabled:opacity-50" :disabled="!bestBuy?.configured" type="button" @click="radar.testBestBuyLookup()">
          <Play class="size-4" />
          Test SKU Lookup
        </button>

        <a class="mt-3 flex w-full items-center justify-center gap-2 rounded border border-radar-line px-3 py-2 text-sm font-semibold" href="https://www.bestbuy.com/site/searchpage.jsp?st=pokemon%20tcg" target="_blank">
          <ExternalLink class="size-4" />
          Open Store
        </a>

        <p v-if="radar.adapterLastMessage" class="mt-4 rounded border border-radar-line bg-radar-panel p-3 text-sm text-slate-700">{{ radar.adapterLastMessage }}</p>
        <p v-else-if="!bestBuy?.configured" class="mt-4 rounded border border-radar-line bg-radar-panel p-3 text-sm text-slate-700">APPROVAL_PENDING: add `BEST_BUY_API_KEY` to the local API environment after Best Buy approval and restart the API. Until then, use Mock Scan Mode only.</p>
      </div>
    </section>

    <section class="table-shell rounded">
      <div class="border-b border-radar-line p-3">
        <h2 class="text-sm font-semibold">Future Store Adapter Safety</h2>
        <p class="mt-1 text-xs text-slate-500">Research-only stores remain disabled for live adapters until official/allowed access is confirmed.</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Store</th>
            <th>Mode</th>
            <th>Risk</th>
            <th>App status</th>
            <th>Adapter availability</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="store in radar.storeSafetyMatrix" :key="store.storeKey">
            <td>{{ store.displayName }}</td>
            <td><StatusBadge :label="store.recommendedMode" :tone="radar.statusTone(store.recommendedMode)" /></td>
            <td><StatusBadge :label="store.riskLevel" :tone="radar.statusTone(store.riskLevel)" /></td>
            <td>{{ store.status }}</td>
            <td class="text-sm text-slate-600">
              <span v-if="store.recommendedMode === 'OFFICIAL_API_CANDIDATE'">Official API candidate; still gated by approval/readiness.</span>
              <span v-else>Live adapter disabled until official/allowed access is confirmed.</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="table-shell rounded">
      <table>
        <thead>
          <tr>
            <th>Image</th>
            <th>Product</th>
            <th>SKU</th>
            <th>Price</th>
            <th>Regular</th>
            <th>Online availability</th>
            <th>Price status</th>
            <th>Product URL</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="radar.adapterResults.length === 0">
            <td colspan="8" class="text-sm text-slate-500">No adapter results yet.</td>
          </tr>
          <tr v-for="product in radar.adapterResults" :key="product.externalId">
            <td>
              <img v-if="product.imageUrl" :src="product.imageUrl" alt="" class="size-12 rounded object-contain" />
              <div v-else class="size-12 rounded bg-radar-panel"></div>
            </td>
            <td>
              <div class="font-medium">{{ product.name }}</div>
              <div class="text-xs text-slate-500">{{ product.seller }}</div>
            </td>
            <td>{{ product.sku ?? product.externalId }}</td>
            <td>{{ radar.formatPrice(product.priceCents) }}</td>
            <td>{{ radar.formatPrice(product.regularPriceCents) }}</td>
            <td><StatusBadge :label="product.onlineAvailability" :tone="radar.statusTone(product.onlineAvailability)" /></td>
            <td><StatusBadge :label="product.priceStatus ?? 'UNKNOWN_MSRP'" :tone="radar.statusTone(product.priceStatus ?? 'UNKNOWN_MSRP')" /></td>
            <td><a class="text-sm font-semibold text-radar-teal" :href="product.productUrl" target="_blank">Open Product</a></td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
