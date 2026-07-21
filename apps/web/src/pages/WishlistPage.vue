<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Eye, PauseCircle, PlayCircle, Save, Trash2 } from "@lucide/vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore, type WishlistAlertBehavior, type WishlistItem, type WishlistPriority } from "@/stores/radar";

const radar = useRadarStore();
const editingId = ref<string | null>(null);
const message = ref("");
const previewProductName = ref("MOCK / DEMO - Prismatic Evolutions Pokemon Booster Bundle");
const previewStoreKey = ref("best-buy");

const form = reactive({
  name: "",
  setName: "",
  categoryId: "",
  storeKey: "",
  priority: "NORMAL" as WishlistPriority,
  alertBehavior: "ALERT_IMMEDIATELY" as WishlistAlertBehavior,
  desiredQuantity: 1 as number | null,
  maxPrice: "",
  allowedMarkup: "",
  keywordsText: "",
  isActive: true,
  notes: ""
});

const activeItems = computed(() => radar.wishlistItems.filter((item) => item.isActive));
const inactiveItems = computed(() => radar.wishlistItems.filter((item) => !item.isActive));
const defaultRules = computed(() => radar.wishlistItems.filter((item) => !item.setName || ["IGNORE", "HIGH", "URGENT"].includes(item.priority)).slice(0, 12));
const storeOptions = computed(() => radar.storeSafetyMatrix.map((store) => ({ key: store.storeKey, label: store.displayName })));
const selectedStoreSafety = computed(() => form.storeKey ? radar.storeSafetyMatrix.find((store) => store.storeKey === form.storeKey.trim()) : null);
const selectedStoreResearchOnly = computed(() => selectedStoreSafety.value != null && selectedStoreSafety.value.recommendedMode !== "OFFICIAL_API_CANDIDATE");

function cents(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function dollars(value?: number | null): string {
  return value == null ? "" : (value / 100).toFixed(2);
}

function resetForm() {
  editingId.value = null;
  Object.assign(form, {
    name: "",
    setName: "",
    categoryId: "",
    storeKey: "",
    priority: "NORMAL",
    alertBehavior: "ALERT_IMMEDIATELY",
    desiredQuantity: 1,
    maxPrice: "",
    allowedMarkup: "",
    keywordsText: "",
    isActive: true,
    notes: ""
  });
}

function editItem(item: WishlistItem) {
  editingId.value = item.id;
  Object.assign(form, {
    name: item.name,
    setName: item.setName ?? "",
    categoryId: item.categoryId ?? "",
    storeKey: item.storeKey ?? "",
    priority: item.priority,
    alertBehavior: item.alertBehavior,
    desiredQuantity: item.desiredQuantity ?? null,
    maxPrice: dollars(item.maxPriceCents),
    allowedMarkup: dollars(item.allowedMarkupCents),
    keywordsText: item.keywords.join(", "),
    isActive: item.isActive,
    notes: item.notes ?? ""
  });
}

function linksForWishlist(item: WishlistItem) {
  return radar.manualStoreLinks.filter((link) => link.wishlistItemId === item.id);
}

function releasesForWishlist(item: WishlistItem) {
  return radar.releaseCalendarItems.filter((release) => release.wishlistItemId === item.id);
}

function payload() {
  return {
    name: form.name,
    setName: form.setName || null,
    categoryId: form.categoryId || null,
    storeKey: form.storeKey || null,
    priority: form.priority,
    alertBehavior: form.alertBehavior,
    desiredQuantity: form.desiredQuantity,
    maxPriceCents: cents(form.maxPrice),
    allowedMarkupCents: cents(form.allowedMarkup),
    keywords: form.keywordsText.split(/,|\n/).map((item) => item.trim()).filter(Boolean),
    isActive: form.isActive,
    notes: form.notes || null
  };
}

async function save() {
  if (!form.name.trim()) {
    message.value = "Name is required.";
    return;
  }
  if (editingId.value) {
    await radar.updateWishlistItem(editingId.value, payload());
    message.value = "Wishlist item updated.";
  } else {
    await radar.createWishlistItem(payload());
    message.value = "Wishlist item created.";
  }
  resetForm();
}

async function preview() {
  const category = radar.msrpCategories.find((item) => item.id === form.categoryId);
  await radar.previewWishlistMatch({
    productName: previewProductName.value,
    categoryId: form.categoryId || undefined,
    categoryLabel: category?.label,
    storeKey: previewStoreKey.value || undefined
  });
  message.value = "Match preview refreshed.";
}

onMounted(async () => {
  await Promise.all([radar.loadWishlist(), radar.loadMSRPCategories(), radar.loadStoreSafetyMatrix(), radar.loadManualStoreLinks(), radar.loadReleaseCalendar()]);
});
</script>

<template>
  <div class="space-y-4">
    <section class="rounded border border-radar-line bg-white p-4 shadow-soft">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">Wishlist</h2>
          <p class="text-sm text-slate-600">Private product priorities for mock scans now and future read-only store adapters later.</p>
        </div>
        <StatusBadge label="NO CART / NO CHECKOUT" tone="slate" />
      </div>
      <p class="mt-2 text-xs text-slate-500">Wishlist rules only affect priority, dashboard visibility, and alert behavior. They do not run retailer automation.</p>
    </section>

    <section class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div class="space-y-4">
        <section class="table-shell rounded">
          <div class="border-b border-radar-line p-3">
            <h3 class="text-sm font-semibold">Active Wishlist Items</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Set</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Alert</th>
                <th>Max</th>
                <th>Qty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in activeItems" :key="item.id">
                <td>
                  <div class="font-medium">{{ item.name }}</div>
                  <div class="text-xs text-slate-500">{{ item.keywords.join(", ") }}</div>
                  <div v-if="linksForWishlist(item).length" class="mt-2 flex flex-wrap gap-1">
                    <button v-for="link in linksForWishlist(item)" :key="link.id" class="rounded border border-radar-line px-2 py-1 text-xs font-semibold" type="button" @click="radar.openManualStoreLink(link)">Open {{ link.storeDisplayName }}</button>
                  </div>
                  <div v-if="releasesForWishlist(item).length" class="mt-2 flex flex-wrap gap-1">
                    <span v-for="release in releasesForWishlist(item)" :key="release.id" class="rounded bg-radar-panel px-2 py-1 text-xs font-semibold">{{ release.title }} · {{ radar.formatTime(release.releaseDate) }}</span>
                  </div>
                </td>
                <td>{{ item.setName ?? "-" }}</td>
                <td>{{ item.categoryLabel ?? "Any" }}</td>
                <td><StatusBadge :label="item.priority" :tone="radar.statusTone(item.priority)" /></td>
                <td><StatusBadge :label="item.alertBehavior" :tone="radar.statusTone(item.alertBehavior)" /></td>
                <td>{{ radar.formatPrice(item.maxPriceCents) }}</td>
                <td>{{ item.desiredQuantity ?? "-" }}</td>
                <td>
                  <div class="flex gap-2">
                    <button class="rounded border border-radar-line p-2" title="Edit" type="button" @click="editItem(item)"><Save class="size-4" /></button>
                    <button class="rounded border border-radar-line p-2" title="Disable" type="button" @click="radar.setWishlistItemEnabled(item.id, false)"><PauseCircle class="size-4" /></button>
                    <button class="rounded border border-radar-line p-2" title="Delete" type="button" @click="radar.deleteWishlistItem(item.id)"><Trash2 class="size-4" /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="rounded border border-radar-line bg-white p-4">
          <h3 class="text-sm font-semibold">Default Priority Rules</h3>
          <div class="mt-3 grid gap-2 md:grid-cols-2">
            <div v-for="item in defaultRules" :key="item.id" class="rounded border border-radar-line p-3">
              <div class="font-medium">{{ item.name }}</div>
              <div class="mt-2 flex flex-wrap gap-2">
                <StatusBadge :label="item.priority" :tone="radar.statusTone(item.priority)" />
                <StatusBadge :label="item.alertBehavior" :tone="radar.statusTone(item.alertBehavior)" />
              </div>
            </div>
          </div>
        </section>

        <section v-if="inactiveItems.length" class="table-shell rounded">
          <div class="border-b border-radar-line p-3">
            <h3 class="text-sm font-semibold">Inactive</h3>
          </div>
          <table>
            <tbody>
              <tr v-for="item in inactiveItems" :key="item.id">
                <td>{{ item.name }}</td>
                <td><StatusBadge :label="item.priority" :tone="radar.statusTone(item.priority)" /></td>
                <td><button class="rounded border border-radar-line p-2" title="Enable" type="button" @click="radar.setWishlistItemEnabled(item.id, true)"><PlayCircle class="size-4" /></button></td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <aside class="space-y-4">
        <section class="rounded border border-radar-line bg-white p-4">
          <h3 class="text-sm font-semibold">{{ editingId ? "Edit Wishlist Item" : "Add Wishlist Item" }}</h3>
          <div class="mt-3 space-y-3">
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Name</span><input v-model="form.name" class="mt-1 w-full rounded border border-radar-line px-3 py-2" /></label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Set name</span><input v-model="form.setName" class="mt-1 w-full rounded border border-radar-line px-3 py-2" placeholder="Prismatic Evolutions" /></label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Category</span><select v-model="form.categoryId" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option value="">Any category</option><option v-for="category in radar.msrpCategories" :key="category.id" :value="category.id">{{ category.label }}</option></select></label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Store preference</span><select v-model="form.storeKey" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option value="">Any store</option><option v-for="store in storeOptions" :key="store.key" :value="store.key">{{ store.label }}</option></select></label>
            <p v-if="selectedStoreResearchOnly" class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">This store is not live-scanned yet. It is tracked for future research and manual reference only.</p>
            <p v-else-if="selectedStoreSafety" class="rounded border border-radar-line bg-radar-panel p-3 text-sm text-slate-700">Store safety: {{ selectedStoreSafety.recommendedMode }} / {{ selectedStoreSafety.riskLevel }}.</p>
            <div class="grid grid-cols-2 gap-3">
              <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Priority</span><select v-model="form.priority" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option><option>IGNORE</option></select></label>
              <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Alert behavior</span><select v-model="form.alertBehavior" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option>ALERT_IMMEDIATELY</option><option>DASHBOARD_ONLY</option><option>DO_NOT_ALERT</option><option>REVIEW_FIRST</option></select></label>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Qty</span><input v-model.number="form.desiredQuantity" class="mt-1 w-full rounded border border-radar-line px-3 py-2" min="1" type="number" /></label>
              <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Max price</span><input v-model="form.maxPrice" class="mt-1 w-full rounded border border-radar-line px-3 py-2" placeholder="34.99" /></label>
              <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Markup</span><input v-model="form.allowedMarkup" class="mt-1 w-full rounded border border-radar-line px-3 py-2" placeholder="8.00" /></label>
            </div>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Keywords</span><textarea v-model="form.keywordsText" class="mt-1 min-h-20 w-full rounded border border-radar-line px-3 py-2" placeholder="booster bundle, prismatic evolutions"></textarea></label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Notes</span><textarea v-model="form.notes" class="mt-1 min-h-20 w-full rounded border border-radar-line px-3 py-2"></textarea></label>
            <label class="flex items-center gap-2 text-sm"><input v-model="form.isActive" type="checkbox" /> Active</label>
            <div class="flex gap-2">
              <button class="rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white" type="button" @click="save">Save</button>
              <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="resetForm">Clear</button>
            </div>
          </div>
        </section>

        <section class="rounded border border-radar-line bg-white p-4">
          <h3 class="text-sm font-semibold">Match Preview</h3>
          <label class="mt-3 block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Sample product</span><input v-model="previewProductName" class="mt-1 w-full rounded border border-radar-line px-3 py-2" /></label>
          <label class="mt-3 block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Store key</span><input v-model="previewStoreKey" class="mt-1 w-full rounded border border-radar-line px-3 py-2" /></label>
          <button class="mt-3 inline-flex items-center gap-2 rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="preview"><Eye class="size-4" /> Preview Match</button>
          <div v-if="radar.wishlistMatchPreview" class="mt-3 rounded border border-radar-line bg-radar-panel p-3 text-sm">
            <div class="flex flex-wrap gap-2">
              <StatusBadge :label="radar.wishlistMatchPreview.priority" :tone="radar.statusTone(radar.wishlistMatchPreview.priority)" />
              <StatusBadge :label="radar.wishlistMatchPreview.alertBehavior" :tone="radar.statusTone(radar.wishlistMatchPreview.alertBehavior)" />
            </div>
            <p class="mt-2 font-medium">{{ radar.wishlistMatchPreview.matchedItemName ?? "No wishlist match" }}</p>
            <p class="text-xs text-slate-500">{{ radar.wishlistMatchPreview.matchReasons.join(", ") || "No reasons yet" }}</p>
          </div>
          <p v-if="message" class="mt-3 text-sm text-slate-600">{{ message }}</p>
        </section>
      </aside>
    </section>
  </div>
</template>
