<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ExternalLink, Eye, X } from "@lucide/vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();
const filters = [
  ["ALL", "All"], ["SENT", "Sent"], ["FAILED", "Failed"], ["SUPPRESSED", "Suppressed"], ["PENDING", "Pending"],
  ["DISCORD", "Discord"], ["TELEGRAM", "Telegram"], ["HIGH_URGENT", "High / Urgent"], ["TODAY", "Today"], ["LAST_7_DAYS", "Last 7 days"]
] as const;
const actionMessage = ref("");
const detailNote = ref("");

onMounted(() => radar.loadNotifications().catch((error) => { radar.error = String(error); }));

async function viewDetails(id: string) {
  const detail = await radar.loadNotificationDetail(id);
  detailNote.value = detail.purchaseDecision?.note ?? "";
  actionMessage.value = "";
}

async function openNotificationProduct() {
  const notification = radar.selectedNotification;
  if (!notification?.stockCheckResultId || !notification.productUrl) return;
  await radar.markFindOpened({ id: notification.stockCheckResultId });
  window.open(notification.productUrl, "_blank", "noopener,noreferrer");
}

async function markNotificationBought() {
  const id = radar.selectedNotification?.stockCheckResultId;
  if (!id) return;
  await radar.markFindBought(id, { note: detailNote.value || null });
  if (radar.selectedNotification) await radar.loadNotificationDetail(radar.selectedNotification.id);
  actionMessage.value = "Marked bought.";
}

async function markNotificationSkipped(skipReason: "PRICE_TOO_HIGH" | "SOLD_OUT" | "NOT_INTERESTED" | "NEEDS_REVIEW") {
  const id = radar.selectedNotification?.stockCheckResultId;
  if (!id) return;
  await radar.markFindSkipped(id, { skipReason, note: detailNote.value || null });
  if (radar.selectedNotification) await radar.loadNotificationDetail(radar.selectedNotification.id);
  actionMessage.value = "Skipped decision saved.";
}

async function saveNotificationNote() {
  const id = radar.selectedNotification?.stockCheckResultId;
  if (!id) return;
  await radar.updateFindNote(id, detailNote.value || null);
  if (radar.selectedNotification) await radar.loadNotificationDetail(radar.selectedNotification.id);
  actionMessage.value = "Private note saved.";
}
</script>

<template>
  <div class="space-y-5">
    <section class="border-b border-radar-line bg-white p-5 shadow-soft">
      <h2 class="text-base font-semibold">Notification History</h2>
      <p class="mt-1 text-sm text-slate-600">Alert events and provider delivery attempts. Sensitive channel configuration is never included.</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <button v-for="([value, label]) in filters" :key="value" class="rounded border px-3 py-2 text-sm font-semibold" :class="radar.notificationFilter === value ? 'border-radar-teal bg-teal-50 text-radar-teal' : 'border-radar-line bg-white'" type="button" @click="radar.loadNotifications(value)">{{ label }}</button>
      </div>
    </section>

    <div class="overflow-x-auto border border-radar-line bg-white shadow-soft">
      <table class="w-full min-w-[1100px] text-left text-sm">
        <thead class="border-b border-radar-line bg-slate-50 text-xs uppercase text-slate-500">
          <tr><th class="px-4 py-3">Alert</th><th class="px-4 py-3">Priority</th><th class="px-4 py-3">Product</th><th class="px-4 py-3">Price</th><th class="px-4 py-3">Channels</th><th class="px-4 py-3">Delivery</th><th class="px-4 py-3">Time</th><th class="px-4 py-3 text-right">Actions</th></tr>
        </thead>
        <tbody class="divide-y divide-radar-line">
          <tr v-for="item in radar.notifications" :key="item.id">
            <td class="px-4 py-4"><p class="font-semibold">{{ item.title }}</p><div class="mt-1 flex flex-wrap gap-1"><p class="text-xs text-slate-500">{{ item.alertType }}</p><StatusBadge v-if="item.isMockDemo" label="TEST" tone="blue" /><StatusBadge v-if="item.isMockDemo" label="MOCK" tone="blue" /><StatusBadge v-if="item.isMockDemo" label="DEMO" tone="blue" /></div></td>
            <td class="px-4 py-4">
              <StatusBadge :label="item.priority" :tone="radar.statusTone(item.priority)" />
              <StatusBadge v-if="item.wishlistPriority" class="mt-1" :label="`Wishlist ${item.wishlistPriority}`" :tone="radar.statusTone(item.wishlistPriority)" />
            </td>
            <td class="px-4 py-4"><p>{{ item.productName ?? 'System notification' }}</p><p class="text-xs text-slate-500">{{ item.storeName ?? 'PokeDad Radar' }}</p><p v-if="item.wishlistItemName" class="text-xs text-slate-500">Wishlist: {{ item.wishlistItemName }}</p></td>
            <td class="px-4 py-4">{{ radar.formatPrice(item.priceCents) }}</td>
            <td class="px-4 py-4">{{ item.channelsAttempted.map((channel) => channel.provider).join(', ') || 'None' }}</td>
            <td class="px-4 py-4"><StatusBadge :label="item.status" :tone="radar.statusTone(item.status)" /><p v-if="item.errorSummary" class="mt-2 max-w-xs text-xs text-red-700">{{ item.errorSummary }}</p></td>
            <td class="px-4 py-4">{{ radar.formatTime(item.sentAt ?? item.createdAt) }}</td>
            <td class="px-4 py-4"><div class="flex justify-end gap-2">
              <a v-if="item.productUrl" :href="item.productUrl" class="rounded border border-radar-line p-2" target="_blank" title="Open product"><ExternalLink class="size-4" /></a>
              <button class="rounded border border-radar-line p-2" title="View details" type="button" @click="viewDetails(item.id)"><Eye class="size-4" /></button>
            </div></td>
          </tr>
          <tr v-if="radar.notifications.length === 0"><td class="px-4 py-10 text-center text-slate-500" colspan="8">No notifications match this filter.</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="radar.selectedNotification" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded border border-radar-line bg-white shadow-xl">
        <header class="sticky top-0 flex items-center justify-between border-b border-radar-line bg-white p-4">
          <div><h2 class="font-semibold">{{ radar.selectedNotification.title }}</h2><div class="mt-1 flex flex-wrap gap-1"><p class="text-xs text-slate-500">{{ radar.selectedNotification.alertType }}</p><StatusBadge v-if="radar.selectedNotification.isMockDemo" label="TEST" tone="blue" /><StatusBadge v-if="radar.selectedNotification.isMockDemo" label="MOCK" tone="blue" /><StatusBadge v-if="radar.selectedNotification.isMockDemo" label="DEMO" tone="blue" /></div></div>
          <button class="rounded border border-radar-line p-2" title="Close details" type="button" @click="radar.closeNotificationDetail()"><X class="size-4" /></button>
        </header>
        <div class="space-y-6 p-5">
          <section><h3 class="text-xs font-semibold uppercase text-slate-500">Message preview</h3><pre class="mt-2 whitespace-pre-wrap rounded border border-radar-line bg-slate-50 p-4 font-sans text-sm">{{ radar.selectedNotification.messagePreview }}</pre></section>
          <section v-if="radar.selectedNotification.product"><h3 class="text-xs font-semibold uppercase text-slate-500">Product</h3><dl class="mt-2 grid gap-3 sm:grid-cols-3"><div><dt class="text-xs text-slate-500">Name</dt><dd>{{ radar.selectedNotification.product.name }}</dd></div><div><dt class="text-xs text-slate-500">Price / MSRP / Max</dt><dd>{{ radar.formatPrice(radar.selectedNotification.product.priceCents) }} / {{ radar.formatPrice(radar.selectedNotification.product.msrpCents) }} / {{ radar.formatPrice(radar.selectedNotification.product.acceptedMaxPriceCents) }}</dd></div><div><dt class="text-xs text-slate-500">Status</dt><dd>{{ radar.selectedNotification.product.priceStatus }} / {{ radar.selectedNotification.product.stockStatus }}</dd></div></dl></section>
          <section v-if="radar.selectedNotification.wishlistPriority || radar.selectedNotification.wishlistItemName">
            <h3 class="text-xs font-semibold uppercase text-slate-500">Wishlist reason</h3>
            <div class="mt-2 rounded border border-radar-line bg-radar-panel p-4 text-sm">
              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="radar.selectedNotification.wishlistPriority ?? 'NORMAL'" :tone="radar.statusTone(radar.selectedNotification.wishlistPriority ?? 'NORMAL')" />
                <StatusBadge v-if="radar.selectedNotification.wishlistAlertBehavior" :label="radar.selectedNotification.wishlistAlertBehavior" :tone="radar.statusTone(radar.selectedNotification.wishlistAlertBehavior)" />
              </div>
              <p class="mt-2 font-medium">{{ radar.selectedNotification.wishlistItemName ?? 'No named wishlist item' }}</p>
              <p class="text-xs text-slate-500">Set: {{ radar.selectedNotification.wishlistSetName ?? 'Any set' }}</p>
              <p v-if="radar.selectedNotification.wishlistMatchReasons?.length" class="mt-2 text-xs text-slate-500">Matched by {{ radar.selectedNotification.wishlistMatchReasons.join(', ') }}</p>
            </div>
          </section>
          <section v-if="radar.selectedNotification.product">
            <h3 class="text-xs font-semibold uppercase text-slate-500">Manual Purchase Assist</h3>
            <div class="mt-2 rounded border border-radar-line p-4">
              <div class="flex flex-wrap items-center gap-2">
                <StatusBadge :label="radar.selectedNotification.purchaseDecision?.status ?? 'NEW'" :tone="radar.statusTone(radar.selectedNotification.purchaseDecision?.status ?? 'NEW')" />
                <StatusBadge v-if="radar.selectedNotification.purchaseDecision?.skipReason" :label="radar.selectedNotification.purchaseDecision.skipReason" :tone="radar.statusTone(radar.selectedNotification.purchaseDecision.skipReason)" />
              </div>
              <dl class="mt-3 grid gap-3 sm:grid-cols-3">
                <div><dt class="text-xs text-slate-500">Quantity</dt><dd>{{ radar.selectedNotification.purchaseDecision?.quantity ?? 'Not set' }}</dd></div>
                <div><dt class="text-xs text-slate-500">Final price</dt><dd>{{ radar.formatPrice(radar.selectedNotification.purchaseDecision?.finalPriceCents) }}</dd></div>
                <div><dt class="text-xs text-slate-500">Snoozed until</dt><dd>{{ radar.formatTime(radar.selectedNotification.purchaseDecision?.snoozedUntil) }}</dd></div>
              </dl>
              <p v-if="radar.selectedNotification.purchaseDecision?.note" class="mt-3 rounded bg-slate-50 p-3 text-sm">{{ radar.selectedNotification.purchaseDecision.note }}</p>
              <div class="mt-4 rounded border border-radar-line bg-slate-50 p-3 text-sm">
                <p class="font-semibold">Manual checkout checklist</p>
                <p class="mt-1">Confirm official seller, price, fulfillment, quantity limit, and complete payment only on the retailer website.</p>
              </div>
              <textarea v-model="detailNote" class="mt-3 min-h-20 w-full rounded border border-radar-line px-3 py-2 text-sm" placeholder="Private note"></textarea>
              <div class="mt-3 flex flex-wrap gap-2">
                <button class="flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white" type="button" @click="openNotificationProduct"><ExternalLink class="size-4" /> Open Product</button>
                <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="markNotificationBought">Mark Bought</button>
                <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="markNotificationSkipped('PRICE_TOO_HIGH')">Too Expensive</button>
                <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="markNotificationSkipped('SOLD_OUT')">Sold Out</button>
                <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="markNotificationSkipped('NOT_INTERESTED')">Not Interested</button>
                <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="markNotificationSkipped('NEEDS_REVIEW')">Needs MSRP Mapping</button>
                <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="saveNotificationNote">Save Note</button>
              </div>
              <p v-if="actionMessage" class="mt-3 text-sm text-slate-600">{{ actionMessage }}</p>
            </div>
          </section>
          <section><h3 class="text-xs font-semibold uppercase text-slate-500">Delivery attempts</h3><div class="mt-2 divide-y divide-radar-line border border-radar-line"><div v-for="delivery in radar.selectedNotification.deliveries" :key="delivery.id" class="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"><div><p class="font-semibold">{{ delivery.channelName }} · {{ delivery.provider }}</p><p v-if="delivery.errorSummary" class="text-xs text-red-700">{{ delivery.errorSummary }}</p></div><StatusBadge :label="delivery.status" :tone="radar.statusTone(delivery.status)" /></div><p v-if="radar.selectedNotification.deliveries.length === 0" class="p-3 text-sm text-slate-500">No provider delivery was attempted.</p></div></section>
          <section><h3 class="text-xs font-semibold uppercase text-slate-500">Related audit events</h3><div class="mt-2 divide-y divide-radar-line border border-radar-line"><div v-for="audit in radar.selectedNotification.audits" :key="audit.id" class="p-3 text-sm"><p class="font-semibold">{{ audit.action }}</p><p class="text-slate-600">{{ audit.summary }}</p><p class="text-xs text-slate-500">{{ radar.formatTime(audit.createdAt) }}</p></div><p v-if="radar.selectedNotification.audits.length === 0" class="p-3 text-sm text-slate-500">No related audit event found.</p></div></section>
        </div>
      </div>
    </div>
  </div>
</template>
