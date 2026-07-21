<script setup lang="ts">
import { ProductCategoryKind } from "@pokedad-radar/shared";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();
const categories = Object.values(ProductCategoryKind);
</script>

<template>
  <section class="grid gap-4 xl:grid-cols-2">
    <div class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <h2 class="mb-4 text-base font-semibold">Coverage</h2>
      <div class="grid gap-3">
        <label class="flex items-center gap-3"><input v-model="radar.radarRules.monitorAllSealed" type="checkbox" /> Monitor all sealed Pokemon TCG products</label>
        <label class="flex items-center gap-3"><input v-model="radar.radarRules.monitorNewReleases" type="checkbox" /> Monitor new releases</label>
        <label class="flex items-center gap-3"><input v-model="radar.radarRules.ignoreSingles" type="checkbox" /> Ignore singles</label>
        <label class="flex items-center gap-3"><input v-model="radar.radarRules.ignoreThirdPartySellers" type="checkbox" /> Ignore third-party sellers</label>
      </div>
      <h3 class="mb-3 mt-6 text-sm font-semibold">Categories</h3>
      <div class="grid gap-2 sm:grid-cols-2">
        <label v-for="category in categories" :key="category" class="flex items-center gap-2 text-sm">
          <input v-model="radar.radarRules.selectedCategories" :value="category" type="checkbox" />
          {{ category }}
        </label>
      </div>
    </div>
    <div class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <h2 class="mb-4 text-base font-semibold">Fulfillment</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex items-center gap-3"><input v-model="radar.radarRules.shippingPreferred" type="checkbox" /> Shipping preferred</label>
        <label class="flex items-center gap-3"><input v-model="radar.radarRules.pickupPreferred" type="checkbox" /> Pickup preferred</label>
        <label class="text-sm font-medium">ZIP code<input v-model="radar.radarRules.pickupZip" class="mt-2 h-10 w-full rounded border border-radar-line px-3" /></label>
        <label class="text-sm font-medium">Pickup radius<input v-model.number="radar.radarRules.pickupRadiusMiles" class="mt-2 h-10 w-full rounded border border-radar-line px-3" type="number" /></label>
        <label class="text-sm font-medium">Quantity wanted<input v-model.number="radar.radarRules.quantityWantedPerProduct" class="mt-2 h-10 w-full rounded border border-radar-line px-3" type="number" /></label>
        <label class="text-sm font-medium">Max per store/product<input v-model.number="radar.radarRules.maxQuantityPerStoreProduct" class="mt-2 h-10 w-full rounded border border-radar-line px-3" type="number" /></label>
      </div>
      <button class="mt-5 h-10 rounded bg-radar-teal px-4 font-semibold text-white" type="button" @click="radar.saveRadarRules()">Save rules</button>
    </div>
  </section>
</template>
