<script setup lang="ts">
import { reactive } from "vue";
import { useRadarStore } from "@/stores/radar";
import StatusBadge from "@/components/StatusBadge.vue";

const radar = useRadarStore();
const draft = reactive({
  label: "Custom product override",
  scope: "PRODUCT" as const,
  target: "Specific sealed product",
  msrpCents: 4999,
  allowedMarkupCents: 500,
  maxAcceptedPriceCents: 5499,
  enabled: true
});
</script>

<template>
  <div class="space-y-5">
    <section class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <h2 class="mb-4 text-base font-semibold">Acceptable price rule</h2>
      <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <label class="text-sm font-medium">Label<input v-model="draft.label" class="mt-2 h-10 w-full rounded border border-radar-line px-3" /></label>
        <label class="text-sm font-medium">Scope<select v-model="draft.scope" class="mt-2 h-10 w-full rounded border border-radar-line px-3"><option>GLOBAL</option><option>STORE</option><option>CATEGORY</option><option>PRODUCT</option></select></label>
        <label class="text-sm font-medium">Target<input v-model="draft.target" class="mt-2 h-10 w-full rounded border border-radar-line px-3" /></label>
        <label class="text-sm font-medium">MSRP cents<input v-model.number="draft.msrpCents" class="mt-2 h-10 w-full rounded border border-radar-line px-3" type="number" /></label>
        <label class="text-sm font-medium">Allowed markup<input v-model.number="draft.allowedMarkupCents" class="mt-2 h-10 w-full rounded border border-radar-line px-3" type="number" /></label>
        <label class="text-sm font-medium">Max accepted<input v-model.number="draft.maxAcceptedPriceCents" class="mt-2 h-10 w-full rounded border border-radar-line px-3" type="number" /></label>
      </div>
      <button class="mt-4 h-10 rounded bg-radar-teal px-4 font-semibold text-white" type="button" @click="radar.createPriceRule(draft)">Add demo rule</button>
    </section>

    <section class="table-shell rounded">
    <table>
      <thead>
        <tr>
          <th>Rule</th>
          <th>Scope</th>
          <th>Target</th>
          <th>MSRP</th>
          <th>Allowed markup</th>
          <th>Max accepted</th>
          <th>Store/category/product tolerance</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="rule in radar.priceRules" :key="rule.id">
          <td class="font-medium">{{ rule.label }}</td>
          <td>{{ rule.scope }}</td>
          <td>{{ rule.target }}</td>
          <td>{{ radar.formatPrice(rule.msrpCents) }}</td>
          <td>{{ radar.formatPrice(rule.allowedMarkupCents) }}</td>
          <td>{{ radar.formatPrice(rule.maxAcceptedPriceCents) }}</td>
          <td>
            <div>Store: {{ radar.formatPrice(rule.storeSpecificToleranceCents) }}</div>
            <div>Category: {{ radar.formatPrice(rule.categorySpecificToleranceCents) }}</div>
            <div>Product: {{ radar.formatPrice(rule.productSpecificOverrideCents) }}</div>
          </td>
          <td>
            <button type="button" @click="radar.patchPriceRule(rule.id, { enabled: !rule.enabled })">
              <StatusBadge :label="rule.enabled ? 'Enabled' : 'Disabled'" :tone="rule.enabled ? 'green' : 'slate'" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    </section>
  </div>
</template>
