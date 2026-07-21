<script setup lang="ts">
import { onMounted } from "vue";
import { ExternalLink } from "@lucide/vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore, type MSRPMappingStatus } from "@/stores/radar";

const radar = useRadarStore();
const filters: Array<["ALL" | MSRPMappingStatus, string]> = [
  ["UNMAPPED", "Unmapped"],
  ["SUGGESTED", "Suggested"],
  ["MAPPED", "Mapped"],
  ["NEEDS_REVIEW", "Needs Review"],
  ["IGNORED", "Ignored"],
  ["ALL", "All"]
];

async function setFilter(status: "ALL" | MSRPMappingStatus) {
  radar.msrpMappingFilter = status;
  await radar.loadMSRPMappings(status);
}

onMounted(async () => {
  await Promise.all([
    radar.loadMSRPCategories(),
    radar.loadMSRPMappings(radar.msrpMappingFilter)
  ]);
});
</script>

<template>
  <div class="space-y-5">
    <section class="rounded border border-radar-line bg-white p-4 shadow-soft">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">MSRP Mapping</h2>
          <p class="text-sm text-slate-600">Map unknown scanned products to known Pokemon TCG MSRP categories. This never enables cart or checkout automation.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="[status, label] in filters"
            :key="status"
            class="rounded border border-radar-line px-3 py-2 text-sm font-semibold"
            :class="{ 'bg-radar-teal text-white': radar.msrpMappingFilter === status }"
            type="button"
            @click="setFilter(status)"
          >
            {{ label }}
          </button>
        </div>
      </div>
    </section>

    <section class="table-shell rounded">
      <table>
        <thead>
          <tr>
            <th>Image</th>
            <th>Product</th>
            <th>Store / SKU</th>
            <th>Price</th>
            <th>Suggestion</th>
            <th>Map to</th>
            <th>MSRP / Max</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="radar.msrpMappings.length === 0">
            <td colspan="9" class="text-sm text-slate-500">No MSRP mapping candidates for this filter.</td>
          </tr>
          <tr v-for="mapping in radar.msrpMappings" :key="mapping.id">
            <td>
              <img v-if="mapping.imageUrl && mapping.imageUrl.startsWith('http')" :src="mapping.imageUrl" alt="" class="size-12 rounded object-contain" />
              <div v-else class="size-12 rounded bg-radar-panel"></div>
            </td>
            <td>
              <div class="font-medium">{{ mapping.productName }}</div>
              <div class="mt-1 text-xs text-slate-500">{{ mapping.detectedKeywords.length ? mapping.detectedKeywords.join(", ") : "No keyword match yet" }}</div>
            </td>
            <td>
              <div>{{ mapping.storeKey }}</div>
              <div class="text-xs text-slate-500">{{ mapping.retailerSku ?? "No SKU" }}</div>
            </td>
            <td>{{ radar.formatPrice(mapping.currentPriceCents) }}</td>
            <td>
              <div>{{ mapping.suggestedCategoryLabel ?? "None" }}</div>
              <StatusBadge :label="mapping.confidence" :tone="mapping.confidence === 'HIGH' || mapping.confidence === 'MANUAL' ? 'green' : mapping.confidence === 'MEDIUM' ? 'blue' : 'gold'" />
            </td>
            <td>
              <select v-model="radar.msrpCategorySelections[mapping.id]" class="w-48 rounded border border-radar-line bg-white px-2 py-2 text-sm">
                <option value="">Select category</option>
                <option v-for="category in radar.msrpCategories" :key="category.id" :value="category.id">
                  {{ category.label }}
                </option>
              </select>
            </td>
            <td>
              <div>{{ radar.formatPrice(mapping.msrpCents) }}</div>
              <div class="text-xs text-slate-500">{{ radar.formatPrice(mapping.acceptedMaxPriceCents) }}</div>
            </td>
            <td><StatusBadge :label="mapping.status" :tone="radar.statusTone(mapping.status)" /></td>
            <td>
              <div class="flex flex-wrap gap-2">
                <button class="rounded bg-radar-teal px-2 py-1 text-xs font-semibold text-white" type="button" @click="radar.mapMSRP(mapping.id)">Map</button>
                <button v-if="mapping.suggestedCategoryId" class="rounded border border-radar-line px-2 py-1 text-xs font-semibold" type="button" @click="radar.mapMSRP(mapping.id, mapping.suggestedCategoryId)">Accept</button>
                <button class="rounded border border-radar-line px-2 py-1 text-xs font-semibold" type="button" @click="radar.reviewMSRP(mapping.id)">Review</button>
                <button class="rounded border border-radar-line px-2 py-1 text-xs font-semibold" type="button" @click="radar.ignoreMSRP(mapping.id)">Ignore</button>
                <a v-if="mapping.productUrl" class="rounded border border-radar-line p-1" :href="mapping.productUrl" target="_blank" title="Open product"><ExternalLink class="size-4" /></a>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
