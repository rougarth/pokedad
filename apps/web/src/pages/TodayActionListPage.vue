<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { BellRing, CheckCircle2, Clock, ExternalLink, FileSearch, Gift, ListChecks, MapPin, PauseCircle, Star, Tags } from "@lucide/vue";
import MetricTile from "@/components/MetricTile.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore, type TodayActionItem } from "@/stores/radar";

const radar = useRadarStore();
const activeTab = ref<"ALL" | "URGENT" | "RELEASES" | "WISHLIST" | "MANUAL_LINKS" | "NEEDS_REVIEW" | "DECISIONS" | "COMPLETED">("ALL");
const message = ref("");

const tabs = [
  "ALL",
  "URGENT",
  "RELEASES",
  "WISHLIST",
  "MANUAL_LINKS",
  "NEEDS_REVIEW",
  "DECISIONS",
  "COMPLETED"
] as const;

const visibleItems = computed(() => {
  const items = activeTab.value === "COMPLETED" ? radar.todayCompletedItems : radar.todayItems;
  return items.filter((item) => {
    if (activeTab.value === "ALL" || activeTab.value === "COMPLETED") return true;
    if (activeTab.value === "URGENT") return item.priority === "URGENT";
    if (activeTab.value === "RELEASES") return item.type === "RELEASE_TODAY" || item.type === "RELEASE_SOON";
    if (activeTab.value === "WISHLIST") return item.type === "WISHLIST_PRIORITY";
    if (activeTab.value === "MANUAL_LINKS") return item.type === "MANUAL_LINK_CHECK";
    if (activeTab.value === "NEEDS_REVIEW") return item.type === "MSRP_MAPPING_NEEDED" || item.type === "ALERT_REVIEW";
    if (activeTab.value === "DECISIONS") return item.type === "PURCHASE_DECISION_NEEDED" || item.type === "MOCK_FIND_REVIEW" || item.type === "SNOOZE_EXPIRED";
    return true;
  });
});

const urgentToday = computed(() => radar.todayItems.filter((item) => item.priority === "URGENT" || item.type === "RELEASE_TODAY").slice(0, 8));
const upcomingReleases = computed(() => radar.todayItems.filter((item) => item.type === "RELEASE_TODAY" || item.type === "RELEASE_SOON").slice(0, 8));
const manualLinksByStore = computed(() => {
  const groups = new Map<string, TodayActionItem[]>();
  for (const item of radar.todayItems.filter((entry) => entry.type === "MANUAL_LINK_CHECK")) {
    groups.set(item.storeName ?? item.storeKey ?? "Store", [...(groups.get(item.storeName ?? item.storeKey ?? "Store") ?? []), item]);
  }
  return [...groups.entries()];
});

function iconFor(type: string) {
  if (type.includes("RELEASE")) return Gift;
  if (type.includes("WISHLIST")) return Star;
  if (type.includes("MANUAL")) return ExternalLink;
  if (type.includes("MSRP")) return Tags;
  if (type.includes("ALERT")) return BellRing;
  if (type.includes("BOUGHT")) return CheckCircle2;
  if (type.includes("SNOOZE")) return PauseCircle;
  return ListChecks;
}

async function markBought(item: TodayActionItem) {
  if (!item.stockCheckResultId) return;
  await radar.markFindBought(item.stockCheckResultId, { quantity: 1, note: "Marked bought from Today's Action List." });
  await radar.markTodayItemDone(item);
  message.value = "Marked bought.";
}

async function markSkipped(item: TodayActionItem) {
  if (!item.stockCheckResultId) return;
  await radar.markFindSkipped(item.stockCheckResultId, { skipReason: "OTHER", note: "Skipped from Today's Action List." });
  await radar.markTodayItemDone(item);
  message.value = "Marked skipped.";
}

async function snoozeDecision(item: TodayActionItem) {
  if (item.stockCheckResultId) {
    await radar.snoozeFind(item.stockCheckResultId, { preset: "TWENTY_FOUR_HOURS", note: "Snoozed from Today's Action List." });
  } else {
    await radar.snoozeTodayItem(item, "TWENTY_FOUR_HOURS");
  }
  message.value = "Snoozed for 24 hours.";
}

async function releaseAction(item: TodayActionItem, action: "released" | "bought" | "skipped") {
  if (!item.releaseCalendarItemId) return;
  await radar.markReleaseCalendarItem(item.releaseCalendarItemId, action);
  await radar.markTodayItemDone(item);
  message.value = `Release marked ${action}.`;
}

async function openFirstLink(item: TodayActionItem) {
  const link = item.manualStoreLinks[0];
  if (!link) return;
  await radar.openTodayManualLink(link);
  message.value = "Opened manually and tracked locally.";
}

onMounted(async () => {
  await Promise.all([radar.loadToday(), radar.loadManualStoreLinks(), radar.loadReleaseCalendar(), radar.loadNotifications(), radar.loadMSRPMappings("ALL")]);
});
</script>

<template>
  <div class="space-y-5">
    <section class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">Today's Action List</h2>
          <p class="mt-1 text-sm text-slate-600">A daily manual review dashboard combining wishlist priorities, releases, manual links, mock finds, alerts, and purchase decisions.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <StatusBadge label="MANUAL ONLY" tone="blue" />
          <StatusBadge label="NO CART / CHECKOUT" tone="slate" />
        </div>
      </div>
      <p class="mt-3 text-xs text-slate-500">No live retailer scanning, scraping, backend URL fetching, browser automation, add-to-cart, or checkout is performed.</p>
    </section>

    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <MetricTile label="Urgent items" :value="radar.todaySummary.urgentItems" tone="red" />
      <MetricTile label="Releases today" :value="radar.todaySummary.releasesToday" tone="gold" />
      <MetricTile label="This week" :value="radar.todaySummary.upcomingReleasesThisWeek" />
      <MetricTile label="Manual links" :value="radar.todaySummary.manualLinksToCheck" />
      <MetricTile label="Needs mapping" :value="radar.todaySummary.needsMapping" tone="gold" />
      <MetricTile label="Decisions needed" :value="radar.todaySummary.decisionsNeeded" tone="teal" />
      <MetricTile label="Bought this week" :value="radar.todaySummary.boughtThisWeek" tone="teal" />
      <MetricTile label="Skipped this week" :value="radar.todaySummary.skippedThisWeek" />
    </section>

    <section class="grid gap-4 xl:grid-cols-2">
      <div class="rounded border border-radar-line bg-white p-4">
        <h3 class="text-sm font-semibold">Urgent Today</h3>
        <div class="mt-3 space-y-2">
          <div v-for="item in urgentToday" :key="item.key" class="rounded border border-radar-line p-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="font-medium">{{ item.title }}</div>
                <div class="text-xs text-slate-500">{{ item.source }} · {{ item.storeName ?? item.setName ?? "Private tracker" }}</div>
              </div>
              <StatusBadge :label="item.priority" :tone="radar.statusTone(item.priority)" />
            </div>
          </div>
          <p v-if="urgentToday.length === 0" class="text-sm text-slate-500">No urgent items right now.</p>
        </div>
      </div>

      <div class="rounded border border-radar-line bg-white p-4">
        <h3 class="text-sm font-semibold">Upcoming Releases</h3>
        <div class="mt-3 space-y-2">
          <div v-for="item in upcomingReleases" :key="item.key" class="rounded border border-radar-line p-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="font-medium">{{ item.title }}</div>
                <div class="text-xs text-slate-500">{{ radar.formatTime(item.dueAt) }} · {{ item.wishlistItemName ?? "No wishlist item" }}</div>
              </div>
              <StatusBadge :label="item.type" tone="gold" />
            </div>
          </div>
          <p v-if="upcomingReleases.length === 0" class="text-sm text-slate-500">No release items due soon.</p>
        </div>
      </div>
    </section>

    <section class="rounded border border-radar-line bg-white p-4">
      <h3 class="text-sm font-semibold">Manual Links to Check</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="[store, items] in manualLinksByStore" :key="store" class="rounded border border-radar-line p-3">
          <div class="font-medium">{{ store }}</div>
          <div class="mt-2 space-y-2">
            <button v-for="item in items" :key="item.key" class="flex w-full items-center justify-between gap-2 rounded border border-radar-line px-3 py-2 text-left text-sm" type="button" @click="openFirstLink(item)">
              <span>{{ item.title }}</span>
              <ExternalLink class="size-4" />
            </button>
          </div>
        </div>
        <p v-if="manualLinksByStore.length === 0" class="text-sm text-slate-500">No manual links need attention.</p>
      </div>
    </section>

    <section class="rounded border border-radar-line bg-white">
      <div class="flex flex-wrap gap-2 border-b border-radar-line p-3">
        <button v-for="tab in tabs" :key="tab" class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" :class="{ 'bg-radar-panel': activeTab === tab }" type="button" @click="activeTab = tab">{{ tab }}</button>
      </div>
      <div class="divide-y divide-radar-line">
        <article v-for="item in visibleItems" :key="item.key" class="grid gap-3 p-4 lg:grid-cols-[2rem_minmax(0,1fr)_auto]">
          <component :is="iconFor(item.type)" class="mt-1 size-5 text-radar-teal" />
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-semibold">{{ item.title }}</h3>
              <StatusBadge :label="item.priority" :tone="radar.statusTone(item.priority)" />
              <StatusBadge :label="item.type" tone="blue" />
              <StatusBadge v-for="badge in item.badges.slice(0, 3)" :key="badge" :label="badge" :tone="radar.statusTone(badge)" />
            </div>
            <div class="mt-1 text-sm text-slate-600">
              {{ item.source }}
              <span v-if="item.storeName"> · {{ item.storeName }}</span>
              <span v-if="item.setName"> · {{ item.setName }}</span>
              <span v-if="item.dueAt"> · Due {{ radar.formatTime(item.dueAt) }}</span>
            </div>
            <div v-if="item.priceCents != null" class="mt-2 flex flex-wrap gap-2 text-sm">
              <span>Price: {{ radar.formatPrice(item.priceCents) }}</span>
              <span>MSRP: {{ radar.formatPrice(item.msrpCents) }}</span>
              <span>Max: {{ radar.formatPrice(item.acceptedMaxPriceCents) }}</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-1">
              <span v-for="reason in item.reasons" :key="reason" class="rounded bg-radar-panel px-2 py-1 text-xs text-slate-600">{{ reason }}</span>
            </div>
            <div v-if="item.manualStoreLinks.length" class="mt-3 flex flex-wrap gap-2">
              <button v-for="link in item.manualStoreLinks" :key="link.id" class="inline-flex items-center gap-1 rounded border border-radar-line px-2 py-1 text-xs font-semibold" type="button" @click="radar.openTodayManualLink(link)">
                <ExternalLink class="size-3" /> Open {{ link.storeDisplayName }}
              </button>
            </div>
          </div>
          <div class="flex flex-wrap content-start gap-2 lg:justify-end">
            <button v-if="item.stockCheckResultId" class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" type="button" @click="markBought(item)">Bought</button>
            <button v-if="item.stockCheckResultId" class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" type="button" @click="markSkipped(item)">Skipped</button>
            <button v-if="item.releaseCalendarItemId" class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" type="button" @click="releaseAction(item, 'released')">Released</button>
            <button v-if="item.releaseCalendarItemId" class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" type="button" @click="releaseAction(item, 'bought')">Bought</button>
            <button class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" type="button" @click="snoozeDecision(item)"><Clock class="mr-1 inline size-3" />Snooze</button>
            <button class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" type="button" @click="radar.markTodayItemDone(item)">Done</button>
            <button class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" type="button" @click="radar.dismissTodayItem(item)">Dismiss</button>
            <router-link v-if="item.msrpMappingId" class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" to="/msrp-mapping"><FileSearch class="mr-1 inline size-3" />Map MSRP</router-link>
            <router-link v-if="item.notificationId" class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" to="/notifications">Details</router-link>
            <router-link v-if="item.wishlistItemId" class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" to="/wishlist"><Star class="mr-1 inline size-3" />Wishlist</router-link>
            <router-link v-if="item.releaseCalendarItemId" class="rounded border border-radar-line px-3 py-2 text-xs font-semibold" to="/release-calendar"><MapPin class="mr-1 inline size-3" />Release</router-link>
          </div>
        </article>
        <div v-if="visibleItems.length === 0" class="p-8 text-center text-sm text-slate-500">Nothing in this tab.</div>
      </div>
    </section>

    <p v-if="message" class="text-sm text-slate-600">{{ message }}</p>
  </div>
</template>
