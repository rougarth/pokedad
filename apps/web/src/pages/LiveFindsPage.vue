<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ExternalLink, Clock, Ban, Radar, X } from "@lucide/vue";
import { RouterLink } from "vue-router";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore, type PurchaseSkipReason } from "@/stores/radar";
import type { DemoLiveFind } from "@pokedad-radar/shared";

const radar = useRadarStore();
const selectedFind = ref<DemoLiveFind | null>(null);
const quantity = ref<number | null>(1);
const finalPrice = ref<string>("");
const note = ref("");
const skipReason = ref<PurchaseSkipReason>("OTHER");
const snoozePreset = ref<"ONE_HOUR" | "SIX_HOURS" | "TWENTY_FOUR_HOURS" | "SEVEN_DAYS" | "CUSTOM">("ONE_HOUR");
const customSnooze = ref("");
const actionMessage = ref("");

const finalPriceCents = computed(() => {
  const value = Number(finalPrice.value);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : undefined;
});
const relatedManualLinks = computed(() => {
  if (!selectedFind.value) return [];
  const find = selectedFind.value;
  return radar.manualStoreLinks.filter((link) => {
    if (!link.isActive) return false;
    if (find.wishlistItemId && link.wishlistItemId === find.wishlistItemId) return true;
    if (find.wishlistSetName && link.setName === find.wishlistSetName) return true;
    if (find.category && link.categoryLabel && link.categoryLabel.toLowerCase().includes(String(find.category).toLowerCase().replaceAll("_", " "))) return true;
    return link.title.toLowerCase().includes(find.productName.toLowerCase().split(" ").slice(-2).join(" "));
  }).slice(0, 8);
});

function openAssist(find: DemoLiveFind) {
  selectedFind.value = find;
  quantity.value = find.purchaseQuantity ?? 1;
  finalPrice.value = find.purchaseFinalPriceCents == null ? "" : String((find.purchaseFinalPriceCents / 100).toFixed(2));
  note.value = find.purchaseNote ?? "";
  skipReason.value = "OTHER";
  snoozePreset.value = "ONE_HOUR";
  customSnooze.value = "";
  actionMessage.value = "";
}

async function openProduct() {
  if (!selectedFind.value) return;
  await radar.markFindOpened(selectedFind.value);
  window.open(selectedFind.value.productUrl, "_blank", "noopener,noreferrer");
}

async function markBought() {
  if (!selectedFind.value) return;
  await radar.markFindBought(selectedFind.value.id, { quantity: quantity.value, finalPriceCents: finalPriceCents.value, note: note.value || null });
  actionMessage.value = "Marked bought. Manual checkout decision saved.";
  selectedFind.value = radar.finds.find((find) => find.id === selectedFind.value?.id) ?? selectedFind.value;
}

async function markSkipped(reason: PurchaseSkipReason = skipReason.value) {
  if (!selectedFind.value) return;
  await radar.markFindSkipped(selectedFind.value.id, { skipReason: reason, note: note.value || null });
  actionMessage.value = "Skipped decision saved.";
  selectedFind.value = radar.finds.find((find) => find.id === selectedFind.value?.id) ?? selectedFind.value;
}

async function snoozeProduct() {
  if (!selectedFind.value) return;
  await radar.snoozeFind(selectedFind.value.id, { preset: snoozePreset.value, snoozedUntil: customSnooze.value ? new Date(customSnooze.value).toISOString() : undefined, note: note.value || null });
  actionMessage.value = "Product snoozed.";
  selectedFind.value = radar.finds.find((find) => find.id === selectedFind.value?.id) ?? selectedFind.value;
}

async function unsnoozeProduct() {
  if (!selectedFind.value) return;
  await radar.unsnoozeFind(selectedFind.value.id);
  actionMessage.value = "Product unsnoozed.";
  selectedFind.value = radar.finds.find((find) => find.id === selectedFind.value?.id) ?? selectedFind.value;
}

async function saveNote() {
  if (!selectedFind.value) return;
  await radar.updateFindNote(selectedFind.value.id, note.value || null);
  actionMessage.value = "Private note saved.";
}

onMounted(() => {
  radar.loadManualStoreLinks().catch(() => undefined);
});
</script>

<template>
  <div class="space-y-4">
    <section class="flex flex-wrap items-center justify-between gap-3 rounded border border-radar-line bg-white p-4 shadow-soft">
      <div>
        <h2 class="text-base font-semibold">Live Finds</h2>
        <p class="text-sm text-slate-600">Best Buy scan is read-only and creates open-product candidates only.</p>
        <div class="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>Last scan: {{ radar.formatTime(radar.bestBuyScanStatus.lastScanFinishedAt) }}</span>
          <span>Next allowed: {{ radar.formatTime(radar.bestBuyScanStatus.nextAllowedScanAt) }}</span>
        </div>
      </div>
      <StatusBadge :label="radar.bestBuyScanStatus.status" :tone="radar.statusTone(radar.bestBuyScanStatus.status)" />
      <RouterLink class="flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white" to="/scan-settings">
        <Radar class="size-4" />
        Prepare Best Buy Manual Scan
      </RouterLink>
      <p v-if="radar.adapterLastMessage" class="basis-full text-sm text-slate-600">{{ radar.adapterLastMessage }}</p>
      <p v-if="radar.bestBuyScanStatus.lastError" class="basis-full text-sm font-medium text-radar-red">{{ radar.bestBuyScanStatus.lastError }}</p>
    </section>

    <section class="table-shell rounded">
    <table>
      <thead>
        <tr>
          <th>Image</th>
          <th>Product</th>
          <th>Store</th>
          <th>Seller</th>
          <th>Price</th>
          <th>MSRP</th>
          <th>Max</th>
          <th>Price status</th>
          <th>Stock</th>
          <th>Shipping / pickup</th>
          <th>Cart assist</th>
          <th>Alert</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="find in radar.finds" :key="find.id" :class="{ 'opacity-50': find.ignored || find.bought }">
          <td><div class="size-12 rounded" :style="{ backgroundColor: find.imageColor }"></div></td>
          <td>
            <div class="font-medium">{{ find.productName }}</div>
            <StatusBadge v-if="find.source === 'BEST_BUY_API'" class="mt-1" label="BEST_BUY_API" tone="blue" />
            <StatusBadge v-if="find.source === 'BEST_BUY_MOCK_DEMO'" class="mt-1" label="MOCK / DEMO" tone="blue" />
            <StatusBadge v-if="find.wishlistPriority" class="mt-1" :label="`Wishlist ${find.wishlistPriority}`" :tone="radar.statusTone(find.wishlistPriority)" />
            <StatusBadge v-if="find.wishlistAlertBehavior" class="mt-1" :label="find.wishlistAlertBehavior" :tone="radar.statusTone(find.wishlistAlertBehavior)" />
            <div v-if="find.wishlistItemName" class="text-xs text-slate-500">Matched: {{ find.wishlistItemName }}</div>
            <div v-if="find.wishlistSetName" class="text-xs text-slate-500">Set: {{ find.wishlistSetName }}</div>
            <StatusBadge v-if="find.purchaseDecisionStatus" class="mt-1" :label="find.purchaseDecisionStatus" :tone="radar.statusTone(find.purchaseDecisionStatus)" />
            <div v-if="find.ignored" class="text-xs text-slate-500">Ignored</div>
            <div v-if="find.bought" class="text-xs text-radar-teal">Marked bought</div>
            <div v-if="find.snoozedUntil" class="text-xs text-radar-gold">Snoozed until {{ radar.formatTime(find.snoozedUntil) }}</div>
          </td>
          <td>{{ find.storeName }}</td>
          <td>{{ find.seller }}</td>
          <td>{{ radar.formatPrice(find.priceCents) }}</td>
          <td>{{ radar.formatPrice(find.msrpCents) }}</td>
          <td>{{ radar.formatPrice(find.maxAcceptedPriceCents) }}</td>
          <td><StatusBadge :label="find.priceStatus" :tone="radar.statusTone(find.priceStatus)" /></td>
          <td><StatusBadge :label="find.stockStatus" :tone="radar.statusTone(find.stockStatus)" /></td>
          <td>
            <div>Ship: {{ find.shippingStatus }}</div>
            <div>Pickup: {{ find.pickupStatus }}</div>
          </td>
          <td><StatusBadge :label="find.cartAssistStatus" :tone="radar.statusTone(find.cartAssistStatus)" /></td>
          <td><StatusBadge :label="find.alertStatus" :tone="radar.statusTone(find.alertStatus)" /></td>
          <td>
            <div class="flex gap-2">
              <button class="rounded border border-radar-line p-2" title="Manual purchase assist" type="button" @click="openAssist(find)"><ExternalLink class="size-4" /></button>
              <button class="rounded border border-radar-line p-2" title="Snooze" type="button" @click="openAssist(find)"><Clock class="size-4" /></button>
              <button class="rounded border border-radar-line p-2" title="Ignore" type="button" @click="radar.liveFindAction(find.id, 'ignore')"><Ban class="size-4" /></button>
              <button class="rounded border border-radar-line px-2 text-xs font-semibold" type="button" @click="openAssist(find)">Decide</button>
              <button v-if="find.priceStatus === 'UNKNOWN_MSRP'" class="rounded border border-radar-line px-2 text-xs font-semibold" title="Create MSRP mapping candidate" type="button" @click="radar.suggestMSRPFromFind(find)">Map MSRP</button>
              <button v-if="find.priceStatus === 'UNKNOWN_MSRP'" class="rounded border border-radar-line px-2 text-xs font-semibold" type="button" @click="radar.suggestMSRPFromFind(find).then((mapping) => radar.reviewMSRP(mapping.id))">Needs Review</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    </section>

    <div v-if="selectedFind" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div class="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded border border-radar-line bg-white shadow-xl">
        <header class="sticky top-0 flex items-center justify-between border-b border-radar-line bg-white p-4">
          <div>
            <h2 class="font-semibold">Manual Purchase Assist</h2>
            <p class="text-xs text-slate-500">Manual checkout only. No cart, checkout, or store automation runs here.</p>
          </div>
          <button class="rounded border border-radar-line p-2" title="Close" type="button" @click="selectedFind = null"><X class="size-4" /></button>
        </header>
        <div class="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section class="space-y-4">
            <div class="flex gap-4">
              <div class="size-20 shrink-0 rounded border border-radar-line" :style="{ backgroundColor: selectedFind.imageColor }"></div>
              <div>
                <h3 class="text-lg font-semibold">{{ selectedFind.productName }}</h3>
                <p class="text-sm text-slate-600">{{ selectedFind.storeName }} · {{ selectedFind.seller }}</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <StatusBadge :label="selectedFind.source ?? 'MANUAL'" tone="blue" />
                  <StatusBadge :label="selectedFind.priceStatus" :tone="radar.statusTone(selectedFind.priceStatus)" />
                  <StatusBadge :label="selectedFind.stockStatus" :tone="radar.statusTone(selectedFind.stockStatus)" />
                  <StatusBadge v-if="selectedFind.purchaseDecisionStatus" :label="selectedFind.purchaseDecisionStatus" :tone="radar.statusTone(selectedFind.purchaseDecisionStatus)" />
                  <StatusBadge v-if="selectedFind.wishlistPriority" :label="`Wishlist ${selectedFind.wishlistPriority}`" :tone="radar.statusTone(selectedFind.wishlistPriority)" />
                </div>
              </div>
            </div>
            <dl class="grid gap-3 sm:grid-cols-3">
              <div><dt class="text-xs font-semibold uppercase text-slate-500">Price</dt><dd>{{ radar.formatPrice(selectedFind.priceCents) }}</dd></div>
              <div><dt class="text-xs font-semibold uppercase text-slate-500">MSRP</dt><dd>{{ radar.formatPrice(selectedFind.msrpCents) }}</dd></div>
              <div><dt class="text-xs font-semibold uppercase text-slate-500">Max accepted</dt><dd>{{ radar.formatPrice(selectedFind.maxAcceptedPriceCents) }}</dd></div>
              <div><dt class="text-xs font-semibold uppercase text-slate-500">Shipping</dt><dd>{{ selectedFind.shippingStatus }}</dd></div>
              <div><dt class="text-xs font-semibold uppercase text-slate-500">Pickup</dt><dd>{{ selectedFind.pickupStatus }}</dd></div>
              <div><dt class="text-xs font-semibold uppercase text-slate-500">Last seen</dt><dd>{{ radar.formatTime(selectedFind.foundAt) }}</dd></div>
            </dl>
            <div v-if="selectedFind.wishlistItemName || selectedFind.wishlistPriority" class="rounded border border-radar-line bg-radar-panel p-4">
              <p class="text-sm font-semibold">Wishlist Match</p>
              <dl class="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt class="text-xs font-semibold uppercase text-slate-500">Priority</dt><dd>{{ selectedFind.wishlistPriority ?? "NORMAL" }}</dd></div>
                <div><dt class="text-xs font-semibold uppercase text-slate-500">Alert behavior</dt><dd>{{ selectedFind.wishlistAlertBehavior ?? "ALERT_IMMEDIATELY" }}</dd></div>
                <div><dt class="text-xs font-semibold uppercase text-slate-500">Matched item</dt><dd>{{ selectedFind.wishlistItemName ?? "No specific item" }}</dd></div>
                <div><dt class="text-xs font-semibold uppercase text-slate-500">Set</dt><dd>{{ selectedFind.wishlistSetName ?? "Any set" }}</dd></div>
                <div><dt class="text-xs font-semibold uppercase text-slate-500">Desired qty</dt><dd>{{ selectedFind.wishlistDesiredQuantity ?? "-" }}</dd></div>
                <div><dt class="text-xs font-semibold uppercase text-slate-500">Wishlist max</dt><dd>{{ radar.formatPrice(selectedFind.wishlistMaxPriceCents) }}</dd></div>
              </dl>
              <p v-if="selectedFind.wishlistMatchReasons?.length" class="mt-2 text-xs text-slate-500">Why: {{ selectedFind.wishlistMatchReasons.join(", ") }}</p>
            </div>
            <div class="rounded border border-radar-line bg-slate-50 p-4">
              <p class="text-sm font-semibold">Manual checkout checklist</p>
              <ol class="mt-2 space-y-1 text-sm text-slate-700">
                <li>1. Confirm seller is official retailer.</li>
                <li>2. Confirm price is still within your max.</li>
                <li>3. Confirm shipping/pickup option.</li>
                <li>4. Confirm quantity limit.</li>
                <li>5. Complete payment only on the retailer website.</li>
              </ol>
              <button class="mt-3 inline-flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white" type="button" @click="openProduct"><ExternalLink class="size-4" /> Open Product</button>
            </div>
            <div v-if="relatedManualLinks.length" class="rounded border border-radar-line bg-white p-4">
              <p class="text-sm font-semibold">Related retailer links</p>
              <p class="mt-1 text-xs text-slate-500">Manual open-only links. No scanner or backend retailer request runs.</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button v-for="link in relatedManualLinks" :key="link.id" class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="radar.openManualStoreLink(link)">Open {{ link.storeDisplayName }}</button>
              </div>
            </div>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Private note</span><textarea v-model="note" class="mt-2 min-h-24 w-full rounded border border-radar-line px-3 py-2" placeholder="Local private note only. Do not store credentials or payment details."></textarea></label>
            <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="saveNote">Save Note</button>
          </section>
          <aside class="space-y-4">
            <section class="rounded border border-radar-line p-4">
              <h3 class="text-sm font-semibold">Bought</h3>
              <label class="mt-3 block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Quantity</span><input v-model.number="quantity" class="mt-2 w-full rounded border border-radar-line px-3 py-2" min="1" max="24" type="number" /></label>
              <label class="mt-3 block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Final price</span><input v-model="finalPrice" class="mt-2 w-full rounded border border-radar-line px-3 py-2" placeholder="26.99" /></label>
              <button class="mt-3 w-full rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white" type="button" @click="markBought">Mark Bought</button>
            </section>
            <section class="rounded border border-radar-line p-4">
              <h3 class="text-sm font-semibold">Skipped</h3>
              <select v-model="skipReason" class="mt-3 w-full rounded border border-radar-line px-3 py-2 text-sm">
                <option value="PRICE_TOO_HIGH">Price too high</option>
                <option value="SOLD_OUT">Already sold out</option>
                <option value="NOT_INTERESTED">Not interested</option>
                <option value="WRONG_PRODUCT">Wrong product</option>
                <option value="ALREADY_BOUGHT">Already bought</option>
                <option value="NEEDS_REVIEW">Needs MSRP mapping</option>
                <option value="OTHER">Other</option>
              </select>
              <div class="mt-3 grid gap-2">
                <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="markSkipped('PRICE_TOO_HIGH')">Mark Too Expensive</button>
                <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="markSkipped('SOLD_OUT')">Mark Already Sold Out</button>
                <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="markSkipped('NOT_INTERESTED')">Mark Not Interested</button>
                <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="markSkipped('NEEDS_REVIEW')">Mark Needs MSRP Mapping</button>
              </div>
              <button class="mt-3 w-full rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="markSkipped()">Mark Skipped</button>
            </section>
            <section class="rounded border border-radar-line p-4">
              <h3 class="text-sm font-semibold">Snooze</h3>
              <select v-model="snoozePreset" class="mt-3 w-full rounded border border-radar-line px-3 py-2 text-sm">
                <option value="ONE_HOUR">1 hour</option>
                <option value="SIX_HOURS">6 hours</option>
                <option value="TWENTY_FOUR_HOURS">24 hours</option>
                <option value="SEVEN_DAYS">7 days</option>
                <option value="CUSTOM">Custom</option>
              </select>
              <input v-if="snoozePreset === 'CUSTOM'" v-model="customSnooze" class="mt-3 w-full rounded border border-radar-line px-3 py-2 text-sm" type="datetime-local" />
              <button class="mt-3 w-full rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="snoozeProduct">Snooze Product</button>
              <button v-if="selectedFind.snoozedUntil" class="mt-2 w-full rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="unsnoozeProduct">Unsnooze</button>
            </section>
            <p v-if="actionMessage" class="rounded border border-radar-line bg-radar-panel p-3 text-sm text-slate-700">{{ actionMessage }}</p>
          </aside>
        </div>
      </div>
    </div>
  </div>
</template>
