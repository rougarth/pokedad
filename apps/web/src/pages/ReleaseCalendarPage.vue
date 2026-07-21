<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { BellRing, CalendarDays, ExternalLink, PauseCircle, PlayCircle, Save, Trash2 } from "@lucide/vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore, type ReleaseCalendarItem, type ReleaseCalendarStatus, type ReleaseReminderOffset } from "@/stores/radar";

const radar = useRadarStore();
const editingId = ref<string | null>(null);
const message = ref("");
const viewMode = ref<"LIST" | "CALENDAR">("LIST");
const filters = reactive({ status: "UPCOMING", priority: "ALL", period: "ALL", search: "" });

const form = reactive({
  title: "",
  setName: "",
  productName: "",
  categoryId: "",
  releaseDate: "",
  timezone: "America/New_York",
  priority: "NORMAL" as "LOW" | "NORMAL" | "HIGH" | "URGENT",
  status: "UPCOMING" as ReleaseCalendarStatus,
  wishlistItemId: "",
  notes: "",
  isActive: true,
  discordReminder: true,
  reminderOffsets: ["ONE_DAY", "ONE_HOUR", "AT_RELEASE"] as ReleaseReminderOffset[],
  manualStoreLinkIds: [] as string[]
});

const offsetOptions: Array<{ value: ReleaseReminderOffset; label: string }> = [
  { value: "SEVEN_DAYS", label: "7 days before" },
  { value: "THREE_DAYS", label: "3 days before" },
  { value: "ONE_DAY", label: "1 day before" },
  { value: "TWELVE_HOURS", label: "12 hours before" },
  { value: "ONE_HOUR", label: "1 hour before" },
  { value: "AT_RELEASE", label: "At release time" }
];

const filteredItems = computed(() => {
  const now = new Date();
  const search = filters.search.trim().toLowerCase();
  return radar.releaseCalendarItems.filter((item) => {
    const releaseDate = new Date(item.releaseDate);
    if (filters.status !== "ALL" && item.status !== filters.status) return false;
    if (filters.priority !== "ALL" && item.priority !== filters.priority) return false;
    if (filters.period === "THIS_WEEK") {
      const week = new Date();
      week.setDate(week.getDate() + 7);
      if (releaseDate < now || releaseDate > week) return false;
    }
    if (filters.period === "THIS_MONTH") {
      const month = new Date();
      month.setDate(month.getDate() + 31);
      if (releaseDate < now || releaseDate > month) return false;
    }
    if (search && !`${item.title} ${item.setName ?? ""} ${item.productName ?? ""} ${item.notes ?? ""}`.toLowerCase().includes(search)) return false;
    return true;
  });
});

const calendarBuckets = computed(() => {
  const groups = new Map<string, ReleaseCalendarItem[]>();
  for (const item of filteredItems.value) {
    const key = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(item.releaseDate));
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
});

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function resetForm() {
  editingId.value = null;
  Object.assign(form, {
    title: "",
    setName: "",
    productName: "",
    categoryId: "",
    releaseDate: "",
    timezone: "America/New_York",
    priority: "NORMAL",
    status: "UPCOMING",
    wishlistItemId: "",
    notes: "",
    isActive: true,
    discordReminder: true,
    reminderOffsets: ["ONE_DAY", "ONE_HOUR", "AT_RELEASE"],
    manualStoreLinkIds: []
  });
}

function editItem(item: ReleaseCalendarItem) {
  editingId.value = item.id;
  Object.assign(form, {
    title: item.title,
    setName: item.setName ?? "",
    productName: item.productName ?? "",
    categoryId: item.categoryId ?? "",
    releaseDate: localDateTime(item.releaseDate),
    timezone: item.timezone ?? "America/New_York",
    priority: item.priority,
    status: item.status,
    wishlistItemId: item.wishlistItemId ?? "",
    notes: item.notes ?? "",
    isActive: item.isActive,
    discordReminder: item.discordReminder,
    reminderOffsets: [...item.reminderOffsets],
    manualStoreLinkIds: item.manualStoreLinks.map((link) => link.id)
  });
}

function payload() {
  return {
    title: form.title,
    setName: form.setName || null,
    productName: form.productName || null,
    categoryId: form.categoryId || null,
    releaseDate: new Date(form.releaseDate).toISOString(),
    timezone: form.timezone || "America/New_York",
    priority: form.priority,
    status: form.status,
    wishlistItemId: form.wishlistItemId || null,
    notes: form.notes || null,
    isActive: form.isActive,
    discordReminder: form.discordReminder,
    reminderOffsets: form.reminderOffsets,
    manualStoreLinkIds: form.manualStoreLinkIds
  };
}

async function save() {
  if (!form.title.trim() || !form.releaseDate) {
    message.value = "Title and release date are required.";
    return;
  }
  if (editingId.value) {
    await radar.updateReleaseCalendarItem(editingId.value, payload());
    message.value = "Release item updated.";
  } else {
    await radar.createReleaseCalendarItem(payload());
    message.value = "Release item created.";
  }
  resetForm();
}

async function sendTest(item: ReleaseCalendarItem) {
  try {
    await radar.sendReleaseTestReminder(item.id);
    message.value = "Test release reminder sent or recorded in Notification History.";
  } catch (error) {
    message.value = String(error);
  }
}

onMounted(async () => {
  await Promise.all([radar.loadReleaseCalendar(), radar.loadWishlist(), radar.loadManualStoreLinks(), radar.loadMSRPCategories()]);
});
</script>

<template>
  <div class="space-y-5">
    <section class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">Release Calendar</h2>
          <p class="mt-1 text-sm text-slate-600">Manual release tracking and reminders for Pokemon TCG sets/products.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <StatusBadge label="MANUAL ONLY" tone="blue" />
          <StatusBadge label="NO RETAILER REQUESTS" tone="slate" />
        </div>
      </div>
      <p class="mt-3 text-xs text-slate-500">Release dates, reminders, wishlist relations, and manual links are user-maintained. No scanner, scraper, cart, checkout, or retailer automation is active.</p>
    </section>

    <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div class="space-y-4">
        <section class="rounded border border-radar-line bg-white p-4">
          <div class="flex flex-wrap gap-3">
            <select v-model="filters.status" class="rounded border border-radar-line px-3 py-2 text-sm">
              <option value="ALL">All statuses</option>
              <option>UPCOMING</option><option>PLANNED</option><option>WATCHING</option><option>RELEASED</option><option>BOUGHT</option><option>SKIPPED</option><option>CANCELED</option>
            </select>
            <select v-model="filters.priority" class="rounded border border-radar-line px-3 py-2 text-sm">
              <option value="ALL">All priorities</option>
              <option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option>
            </select>
            <select v-model="filters.period" class="rounded border border-radar-line px-3 py-2 text-sm">
              <option value="ALL">Any date</option><option value="THIS_WEEK">This week</option><option value="THIS_MONTH">This month</option>
            </select>
            <input v-model="filters.search" class="min-w-52 rounded border border-radar-line px-3 py-2 text-sm" placeholder="Search releases" />
            <div class="ml-auto flex rounded border border-radar-line">
              <button class="px-3 py-2 text-sm font-semibold" :class="{ 'bg-radar-panel': viewMode === 'LIST' }" type="button" @click="viewMode = 'LIST'">List</button>
              <button class="px-3 py-2 text-sm font-semibold" :class="{ 'bg-radar-panel': viewMode === 'CALENDAR' }" type="button" @click="viewMode = 'CALENDAR'">Calendar</button>
            </div>
          </div>
        </section>

        <section v-if="viewMode === 'LIST'" class="table-shell rounded">
          <table>
            <thead>
              <tr>
                <th>Release</th><th>Date</th><th>Priority</th><th>Status</th><th>Next reminder</th><th>Manual links</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredItems" :key="item.id" :class="{ 'opacity-50': !item.isActive }">
                <td>
                  <div class="font-medium">{{ item.title }}</div>
                  <div class="text-xs text-slate-500">{{ item.setName ?? "No set" }} · {{ item.productName ?? "Any product" }}</div>
                  <div v-if="item.wishlistItemName" class="mt-1 text-xs text-slate-500">Wishlist: {{ item.wishlistItemName }}</div>
                </td>
                <td>{{ radar.formatTime(item.releaseDate) }}</td>
                <td><StatusBadge :label="item.priority" :tone="radar.statusTone(item.priority)" /></td>
                <td><StatusBadge :label="item.status" :tone="radar.statusTone(item.status)" /></td>
                <td>{{ radar.formatTime(item.nextReminderAt) }}</td>
                <td>
                  <div class="flex flex-wrap gap-2">
                    <button v-for="link in item.manualStoreLinks" :key="link.id" class="inline-flex items-center gap-1 rounded border border-radar-line px-2 py-1 text-xs font-semibold" type="button" @click="radar.openReleaseManualLink(item.id, link)">
                      <ExternalLink class="size-3" /> {{ link.storeDisplayName }}
                    </button>
                  </div>
                </td>
                <td>
                  <div class="flex flex-wrap gap-2">
                    <button class="rounded border border-radar-line p-2" title="Edit" type="button" @click="editItem(item)"><Save class="size-4" /></button>
                    <button class="rounded border border-radar-line p-2" title="Test reminder" type="button" @click="sendTest(item)"><BellRing class="size-4" /></button>
                    <button class="rounded border border-radar-line px-2 py-1 text-xs font-semibold" type="button" @click="radar.markReleaseCalendarItem(item.id, 'released')">Released</button>
                    <button class="rounded border border-radar-line px-2 py-1 text-xs font-semibold" type="button" @click="radar.markReleaseCalendarItem(item.id, 'bought')">Bought</button>
                    <button class="rounded border border-radar-line px-2 py-1 text-xs font-semibold" type="button" @click="radar.markReleaseCalendarItem(item.id, 'skipped')">Skipped</button>
                    <button v-if="item.isActive" class="rounded border border-radar-line p-2" title="Disable" type="button" @click="radar.setReleaseCalendarItemEnabled(item.id, false)"><PauseCircle class="size-4" /></button>
                    <button v-else class="rounded border border-radar-line p-2" title="Enable" type="button" @click="radar.setReleaseCalendarItemEnabled(item.id, true)"><PlayCircle class="size-4" /></button>
                    <button class="rounded border border-radar-line p-2" title="Delete" type="button" @click="radar.deleteReleaseCalendarItem(item.id)"><Trash2 class="size-4" /></button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredItems.length === 0"><td colspan="7" class="py-10 text-center text-slate-500">No release items match this filter.</td></tr>
            </tbody>
          </table>
        </section>

        <section v-else class="space-y-3">
          <div v-for="[date, items] in calendarBuckets" :key="date" class="rounded border border-radar-line bg-white p-4">
            <div class="mb-3 flex items-center gap-2 font-semibold"><CalendarDays class="size-4" /> {{ date }}</div>
            <div class="grid gap-2 md:grid-cols-2">
              <div v-for="item in items" :key="item.id" class="rounded border border-radar-line p-3">
                <div class="font-medium">{{ item.title }}</div>
                <div class="mt-2 flex flex-wrap gap-2">
                  <StatusBadge :label="item.priority" :tone="radar.statusTone(item.priority)" />
                  <StatusBadge :label="item.status" :tone="radar.statusTone(item.status)" />
                </div>
                <p class="mt-2 text-xs text-slate-500">{{ item.reminderOffsetLabels.join(", ") }}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside class="space-y-4">
        <section class="rounded border border-radar-line bg-white p-4">
          <h3 class="text-sm font-semibold">{{ editingId ? "Edit Release" : "Add Release" }}</h3>
          <div class="mt-3 space-y-3">
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Title</span><input v-model="form.title" class="mt-1 w-full rounded border border-radar-line px-3 py-2" /></label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Set</span><input v-model="form.setName" class="mt-1 w-full rounded border border-radar-line px-3 py-2" /></label>
              <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Product</span><input v-model="form.productName" class="mt-1 w-full rounded border border-radar-line px-3 py-2" /></label>
            </div>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Release date/time</span><input v-model="form.releaseDate" class="mt-1 w-full rounded border border-radar-line px-3 py-2" type="datetime-local" /></label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Timezone</span><input v-model="form.timezone" class="mt-1 w-full rounded border border-radar-line px-3 py-2" /></label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Priority</span><select v-model="form.priority" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option></select></label>
              <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Status</span><select v-model="form.status" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option>PLANNED</option><option>UPCOMING</option><option>WATCHING</option><option>RELEASED</option><option>BOUGHT</option><option>SKIPPED</option><option>CANCELED</option></select></label>
            </div>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Wishlist item</span><select v-model="form.wishlistItemId" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option value="">None</option><option v-for="item in radar.wishlistItems" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Category</span><select v-model="form.categoryId" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option value="">None</option><option v-for="category in radar.msrpCategories" :key="category.id" :value="category.id">{{ category.label }}</option></select></label>
            <div class="rounded border border-radar-line p-3">
              <div class="text-xs font-semibold uppercase text-slate-500">Reminder offsets</div>
              <div class="mt-2 grid gap-2 md:grid-cols-2">
                <label v-for="offset in offsetOptions" :key="offset.value" class="flex items-center gap-2 text-sm"><input v-model="form.reminderOffsets" :value="offset.value" type="checkbox" /> {{ offset.label }}</label>
              </div>
            </div>
            <label class="flex items-center gap-2 text-sm"><input v-model="form.discordReminder" type="checkbox" /> Discord reminder enabled</label>
            <label class="flex items-center gap-2 text-sm"><input v-model="form.isActive" type="checkbox" /> Active</label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Related manual links</span><select v-model="form.manualStoreLinkIds" class="mt-1 min-h-32 w-full rounded border border-radar-line px-3 py-2" multiple><option v-for="link in radar.manualStoreLinks" :key="link.id" :value="link.id">{{ link.storeDisplayName }} - {{ link.title }}</option></select></label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Notes</span><textarea v-model="form.notes" class="mt-1 min-h-20 w-full rounded border border-radar-line px-3 py-2"></textarea></label>
            <div class="flex gap-2">
              <button class="rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white" type="button" @click="save">Save</button>
              <button class="rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="resetForm">Clear</button>
            </div>
            <p v-if="message" class="text-sm text-slate-600">{{ message }}</p>
          </div>
        </section>
      </aside>
    </section>
  </div>
</template>
