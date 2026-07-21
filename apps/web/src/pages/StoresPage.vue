<script setup lang="ts">
import { ExternalLink, RotateCw, ToggleLeft } from "@lucide/vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();
</script>

<template>
  <section class="table-shell rounded">
    <table>
      <thead>
        <tr>
          <th>Store</th>
          <th>Session</th>
          <th>Monitoring</th>
          <th>Cart assist</th>
          <th>Seller rule</th>
          <th>Last check</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="store in radar.stores" :key="store.name">
          <td class="font-medium">{{ store.name }}</td>
          <td><StatusBadge :label="store.sessionState" :tone="radar.statusTone(store.sessionState)" /></td>
          <td><StatusBadge :label="store.monitoringEnabled ? 'Enabled' : 'Disabled'" :tone="store.monitoringEnabled ? 'green' : 'slate'" /></td>
          <td><StatusBadge :label="store.cartAssistMode" :tone="radar.statusTone(store.cartAssistMode)" /></td>
          <td>{{ store.sellerPolicy }}</td>
          <td>
            <div>{{ store.priceToleranceLabel }}</div>
            <div class="text-xs text-slate-500">{{ radar.formatTime(store.lastCheckTime) }}</div>
            <div v-if="store.lastError" class="mt-1 text-xs font-medium text-radar-red">{{ store.lastError }}</div>
          </td>
          <td>
            <div class="flex gap-2">
              <a class="rounded border border-radar-line p-2" :href="store.loginUrl" target="_blank" title="Open store login"><ExternalLink class="size-4" /></a>
              <button class="rounded border border-radar-line p-2" title="Test session placeholder" type="button" @click="radar.patchStore(store.id, { lastError: 'Demo session test requested. Local helper remains open-only.' } as never)"><RotateCw class="size-4" /></button>
              <button class="rounded border border-radar-line p-2" title="Toggle monitoring" type="button" @click="radar.patchStore(store.id, { monitoringEnabled: !store.monitoringEnabled })"><ToggleLeft class="size-4" /></button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
