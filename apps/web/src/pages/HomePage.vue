<script setup lang="ts">
import MetricTile from "@/components/MetricTile.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricTile label="Stores connected" :value="radar.connectedStores" tone="teal" />
      <MetricTile label="Active monitors" :value="radar.activeMonitors" />
      <MetricTile label="Cart-ready items" :value="radar.cartReadyItems" tone="gold" />
      <MetricTile label="Human action needed" :value="radar.humanActionNeeded" tone="red" />
      <MetricTile label="Products found today" :value="radar.finds.length" />
      <MetricTile label="Overpriced skipped" :value="radar.overpricedSkipped" tone="red" />
      <MetricTile label="Alert channels" :value="radar.alertChannels.filter((channel) => channel.enabled).length" tone="teal" />
      <MetricTile label="Last scan" :value="radar.formatTime(radar.stores.map((store) => store.lastCheckTime).sort().at(-1))" />
    </section>

    <section class="table-shell rounded">
      <table>
        <thead>
          <tr>
            <th>Recent alert</th>
            <th>Store</th>
            <th>Price</th>
            <th>Price status</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="find in radar.recentAlerts" :key="find.id">
            <td class="font-medium">{{ find.productName }}</td>
            <td>{{ find.storeName }}</td>
            <td>{{ radar.formatPrice(find.priceCents) }}</td>
            <td><StatusBadge :label="find.priceStatus" :tone="radar.statusTone(find.priceStatus)" /></td>
            <td><StatusBadge :label="find.alertStatus" :tone="radar.statusTone(find.alertStatus)" /></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <h2 class="text-base font-semibold">Safety posture</h2>
      <p class="mt-2 text-sm text-slate-600">
        All stores are demo/open-only. Cart assist can open product/cart flows later through a local helper, but this MVP does not automate checkout or bypass CAPTCHA, queues, login checks, purchase limits, or human verification.
      </p>
    </section>
  </div>
</template>
