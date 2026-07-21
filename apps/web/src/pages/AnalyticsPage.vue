<script setup lang="ts">
import { computed, onMounted } from "vue";
import { Download } from "@lucide/vue";
import MetricTile from "@/components/MetricTile.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();

const summaryCards = computed(() => {
  const summary = radar.analytics?.summary ?? {};
  return [
    ["Total bought", summary.totalBoughtItems ?? 0, "teal"],
    ["Estimated spend", radar.formatPrice(summary.totalEstimatedSpendCents as number | undefined), "teal"],
    ["Bought this week", summary.boughtThisWeek ?? 0, "neutral"],
    ["Bought this month", summary.boughtThisMonth ?? 0, "neutral"],
    ["Skipped items", summary.skippedItems ?? 0, "gold"],
    ["Snoozed items", summary.snoozedItems ?? 0, "gold"],
    ["Active wishlist", summary.activeWishlistItems ?? 0, "neutral"],
    ["Urgent wishlist", summary.urgentWishlistItems ?? 0, "red"],
    ["Upcoming releases", summary.upcomingReleases ?? 0, "gold"],
    ["Manual opens", summary.manualLinksOpened ?? 0, "neutral"],
    ["Alerts sent", summary.alertsSent ?? 0, "teal"],
    ["Needs mapping", summary.needsMsrpMapping ?? 0, "red"]
  ] as const;
});

const boughtRows = computed(() => radar.analytics?.purchaseHistory.boughtRecently ?? []);
const skippedRows = computed(() => [
  ...(radar.analytics?.purchaseHistory.skippedRecently ?? []),
  ...(radar.analytics?.purchaseHistory.tooExpensive ?? []),
  ...(radar.analytics?.purchaseHistory.soldOut ?? []),
  ...(radar.analytics?.purchaseHistory.notInterested ?? []),
  ...(radar.analytics?.purchaseHistory.needsReview ?? [])
]);

function text(row: Record<string, unknown>, key: string) {
  return row[key] == null || row[key] === "" ? "-" : String(row[key]);
}

function cents(row: Record<string, unknown>, key: string) {
  return typeof row[key] === "number" ? radar.formatPrice(row[key] as number) : "Missing";
}

onMounted(async () => {
  await radar.loadAnalytics();
});
</script>

<template>
  <div class="space-y-5">
    <section class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">Analytics</h2>
          <p class="mt-1 text-sm text-slate-600">Private local analytics for spending, decisions, wishlist progress, releases, manual links, alerts, and MSRP mapping.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <StatusBadge label="LOCAL ONLY" tone="blue" />
          <StatusBadge label="NO EXTERNAL ANALYTICS" tone="slate" />
        </div>
      </div>
      <p class="mt-3 text-xs text-slate-500">Analytics are derived from your local database. No retailer URLs are fetched by the backend, and no tracking pixels or third-party data sharing are used.</p>
    </section>

    <section class="rounded border border-radar-line bg-white p-4">
      <div class="flex flex-wrap gap-3">
        <select v-model="radar.analyticsPeriod" class="rounded border border-radar-line px-3 py-2 text-sm" @change="radar.loadAnalytics()">
          <option value="TODAY">Today</option>
          <option value="LAST_7_DAYS">Last 7 days</option>
          <option value="LAST_30_DAYS">Last 30 days</option>
          <option value="THIS_MONTH">This month</option>
          <option value="ALL_TIME">All time</option>
        </select>
        <select v-model="radar.analyticsMockMode" class="rounded border border-radar-line px-3 py-2 text-sm" @change="radar.loadAnalytics()">
          <option value="ALL">Mock/demo + real</option>
          <option value="MOCK_ONLY">Mock/demo only</option>
          <option value="REAL_ONLY">Real only</option>
        </select>
        <button class="inline-flex items-center gap-2 rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="radar.exportAnalyticsCsv('bought')"><Download class="size-4" /> Bought CSV</button>
        <button class="inline-flex items-center gap-2 rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="radar.exportAnalyticsCsv('skipped')"><Download class="size-4" /> Skipped CSV</button>
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <MetricTile v-for="[label, value, tone] in summaryCards" :key="label" :label="label" :value="value" :tone="tone" />
    </section>

    <section v-if="radar.analytics" class="grid gap-4 xl:grid-cols-3">
      <div class="rounded border border-radar-line bg-white p-4">
        <h3 class="text-sm font-semibold">Spending</h3>
        <div class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between"><span>Total spend</span><strong>{{ radar.formatPrice(radar.analytics.spending.totalSpendCents) }}</strong></div>
          <div class="flex justify-between"><span>This week</span><strong>{{ radar.formatPrice(radar.analytics.spending.spendThisWeekCents) }}</strong></div>
          <div class="flex justify-between"><span>This month</span><strong>{{ radar.formatPrice(radar.analytics.spending.spendThisMonthCents) }}</strong></div>
          <div class="flex justify-between"><span>Average item</span><strong>{{ radar.formatPrice(radar.analytics.spending.averageItemPriceCents) }}</strong></div>
          <div class="flex justify-between"><span>Bought vs skipped</span><strong>{{ radar.analytics.spending.boughtVsSkippedRatio }}</strong></div>
        </div>
      </div>
      <div class="rounded border border-radar-line bg-white p-4">
        <h3 class="text-sm font-semibold">Spend by Store</h3>
        <div class="mt-3 space-y-2 text-sm">
          <div v-for="row in radar.analytics.spending.spendByStore.slice(0, 6)" :key="row.label" class="flex justify-between"><span>{{ row.label }}</span><strong>{{ radar.formatPrice(row.amountCents) }}</strong></div>
          <p v-if="radar.analytics.spending.spendByStore.length === 0" class="text-slate-500">No purchases with final price yet.</p>
        </div>
      </div>
      <div class="rounded border border-radar-line bg-white p-4">
        <h3 class="text-sm font-semibold">Missing Final Price</h3>
        <div class="mt-3 space-y-2 text-sm">
          <div v-for="row in radar.analytics.spending.missingFinalPrice.slice(0, 5)" :key="text(row, 'id')" class="rounded bg-radar-panel p-2">
            <div class="font-medium">{{ text(row, "productName") }}</div>
            <StatusBadge label="MISSING_PRICE" tone="gold" />
          </div>
          <p v-if="radar.analytics.spending.missingFinalPrice.length === 0" class="text-slate-500">No missing final prices.</p>
        </div>
      </div>
    </section>

    <section v-if="radar.analytics" class="grid gap-4 xl:grid-cols-2">
      <section class="table-shell rounded">
        <div class="border-b border-radar-line p-3"><h3 class="text-sm font-semibold">Bought Recently</h3></div>
        <table>
          <thead><tr><th>Product</th><th>Store</th><th>Final</th><th>Qty</th><th>Priority</th><th>Date</th></tr></thead>
          <tbody>
            <tr v-for="row in boughtRows.slice(0, 12)" :key="text(row, 'id')">
              <td><div class="font-medium">{{ text(row, "productName") }}</div><StatusBadge v-if="row.isMockDemo" label="MOCK/DEMO" tone="blue" /></td>
              <td>{{ text(row, "storeName") }}</td>
              <td>{{ cents(row, "finalPriceCents") }}</td>
              <td>{{ text(row, "quantity") }}</td>
              <td><StatusBadge :label="text(row, 'wishlistPriority')" :tone="radar.statusTone(text(row, 'wishlistPriority'))" /></td>
              <td>{{ radar.formatTime(text(row, "decisionDate")) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="table-shell rounded">
        <div class="border-b border-radar-line p-3"><h3 class="text-sm font-semibold">Skipped / Too Expensive</h3></div>
        <table>
          <thead><tr><th>Product</th><th>Store</th><th>Status</th><th>Reason</th><th>Date</th></tr></thead>
          <tbody>
            <tr v-for="row in skippedRows.slice(0, 12)" :key="`${text(row, 'id')}-${text(row, 'status')}`">
              <td><div class="font-medium">{{ text(row, "productName") }}</div><StatusBadge v-if="row.isMockDemo" label="MOCK/DEMO" tone="blue" /></td>
              <td>{{ text(row, "storeName") }}</td>
              <td><StatusBadge :label="text(row, 'status')" :tone="radar.statusTone(text(row, 'status'))" /></td>
              <td>{{ text(row, "skipReason") }}</td>
              <td>{{ radar.formatTime(text(row, "decisionDate")) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </section>

    <section v-if="radar.analytics" class="grid gap-4 xl:grid-cols-2">
      <section class="table-shell rounded">
        <div class="border-b border-radar-line p-3"><h3 class="text-sm font-semibold">Wishlist Progress</h3></div>
        <table>
          <thead><tr><th>Wishlist</th><th>Progress</th><th>Priority</th><th>Links</th><th>Releases</th></tr></thead>
          <tbody>
            <tr v-for="row in radar.analytics.wishlistProgress.slice(0, 14)" :key="text(row, 'id')">
              <td><div class="font-medium">{{ text(row, "name") }}</div><div class="text-xs text-slate-500">{{ text(row, "setName") }}</div></td>
              <td>{{ text(row, "boughtQuantity") }} / {{ text(row, "desiredQuantity") }}<div class="mt-1 h-2 rounded bg-slate-100"><div class="h-2 rounded bg-radar-teal" :style="{ width: `${row.progressPercent ?? 0}%` }"></div></div></td>
              <td><StatusBadge :label="text(row, 'priority')" :tone="radar.statusTone(text(row, 'priority'))" /></td>
              <td>{{ text(row, "relatedManualLinkCount") }}</td>
              <td>{{ text(row, "relatedReleaseCount") }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="table-shell rounded">
        <div class="border-b border-radar-line p-3"><h3 class="text-sm font-semibold">Release Coverage</h3></div>
        <table>
          <thead><tr><th>Release</th><th>Date</th><th>Priority</th><th>Links</th><th>Coverage</th></tr></thead>
          <tbody>
            <tr v-for="row in radar.analytics.releaseCoverage.slice(0, 14)" :key="text(row, 'id')">
              <td><div class="font-medium">{{ text(row, "title") }}</div><div class="text-xs text-slate-500">{{ text(row, "wishlistItemName") }}</div></td>
              <td>{{ radar.formatTime(text(row, "releaseDate")) }}</td>
              <td><StatusBadge :label="text(row, 'priority')" :tone="radar.statusTone(text(row, 'priority'))" /></td>
              <td>{{ text(row, "manualStoreLinkCount") }}</td>
              <td><span class="text-xs text-slate-500">{{ Array.isArray(row.coverageWarnings) && row.coverageWarnings.length ? row.coverageWarnings.join(", ") : "Covered" }}</span></td>
            </tr>
          </tbody>
        </table>
      </section>
    </section>

    <section v-if="radar.analytics" class="grid gap-4 xl:grid-cols-3">
      <section class="table-shell rounded xl:col-span-2">
        <div class="border-b border-radar-line p-3"><h3 class="text-sm font-semibold">Manual Link Activity</h3></div>
        <table>
          <thead><tr><th>Link</th><th>Store</th><th>Safety</th><th>Opened</th><th>Last opened</th></tr></thead>
          <tbody>
            <tr v-for="row in radar.analytics.manualLinkActivity.mostOpened.slice(0, 12)" :key="text(row, 'id')">
              <td><div class="font-medium">{{ text(row, "title") }}</div><StatusBadge label="MANUAL ONLY" tone="blue" /></td>
              <td>{{ text(row, "storeDisplayName") }}</td>
              <td><StatusBadge :label="text(row, 'riskLevel')" :tone="radar.statusTone(text(row, 'riskLevel'))" /></td>
              <td>{{ text(row, "openCount") }}</td>
              <td>{{ radar.formatTime(text(row, "lastOpenedAt")) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <div class="rounded border border-radar-line bg-white p-4">
        <h3 class="text-sm font-semibold">Manual Link Breakdown</h3>
        <div class="mt-3 space-y-2 text-sm">
          <div v-for="row in radar.analytics.manualLinkActivity.byStore.slice(0, 8)" :key="row.label" class="flex justify-between"><span>{{ row.label }}</span><strong>{{ row.count }}</strong></div>
          <div class="border-t border-radar-line pt-2">Attached to wishlist: <strong>{{ radar.analytics.manualLinkActivity.attachedToWishlist }}</strong></div>
          <div>Attached to releases: <strong>{{ radar.analytics.manualLinkActivity.attachedToReleaseCalendar }}</strong></div>
        </div>
      </div>
    </section>

    <section v-if="radar.analytics" class="grid gap-4 xl:grid-cols-2">
      <div class="rounded border border-radar-line bg-white p-4">
        <h3 class="text-sm font-semibold">Alert Analytics</h3>
        <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>Created: <strong>{{ radar.analytics.alerts.alertsCreated }}</strong></div>
          <div>Sent: <strong>{{ radar.analytics.alerts.alertsSent }}</strong></div>
          <div>Failed: <strong>{{ radar.analytics.alerts.alertsFailed }}</strong></div>
          <div>Suppressed: <strong>{{ radar.analytics.alerts.alertsSuppressed }}</strong></div>
          <div>Discord sent: <strong>{{ radar.analytics.alerts.discordDeliveriesSent }}</strong></div>
          <div>Mock/demo/test: <strong>{{ radar.analytics.alerts.mockDemoTestAlerts }}</strong></div>
          <div>Release reminders: <strong>{{ radar.analytics.alerts.releaseReminderAlerts }}</strong></div>
          <div>Unknown MSRP: <strong>{{ radar.analytics.alerts.unknownMsrpAlerts }}</strong></div>
        </div>
      </div>
      <div class="rounded border border-radar-line bg-white p-4">
        <h3 class="text-sm font-semibold">MSRP Mapping</h3>
        <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>Mapped: <strong>{{ radar.analytics.msrpMapping.mappedProducts }}</strong></div>
          <div>Unmapped: <strong>{{ radar.analytics.msrpMapping.unmappedProducts }}</strong></div>
          <div>Needs review: <strong>{{ radar.analytics.msrpMapping.needsReview }}</strong></div>
          <div>Ignored: <strong>{{ radar.analytics.msrpMapping.ignored }}</strong></div>
          <div>Suggestions accepted: <strong>{{ radar.analytics.msrpMapping.suggestionsAccepted }}</strong></div>
          <div>Manual mappings: <strong>{{ radar.analytics.msrpMapping.manualMappings }}</strong></div>
        </div>
      </div>
    </section>
  </div>
</template>
