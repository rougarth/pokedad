<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ExternalLink, PauseCircle, PlayCircle, Save, Trash2 } from "@lucide/vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore, type ManualStoreLink, type ManualStoreLinkType, type WishlistPriority } from "@/stores/radar";

const radar = useRadarStore();
const editingId = ref<string | null>(null);
const message = ref("");
const filters = reactive({ storeKey: "ALL", priority: "ALL", linkType: "ALL", active: "ACTIVE", search: "" });
const form = reactive({
  storeKey: "target",
  title: "",
  url: "",
  linkType: "SEARCH" as ManualStoreLinkType,
  priority: "NORMAL" as WishlistPriority,
  wishlistItemId: "",
  setName: "",
  categoryId: "",
  notes: "",
  isActive: true
});

const storeOptions = computed(() => radar.storeSafetyMatrix.map((store) => ({ key: store.storeKey, label: store.displayName })));
const selectedSafety = computed(() => radar.storeSafetyMatrix.find((store) => store.storeKey === form.storeKey));
const filteredLinks = computed(() => {
  const search = filters.search.trim().toLowerCase();
  return radar.manualStoreLinks.filter((link) => {
    if (filters.storeKey !== "ALL" && link.storeKey !== filters.storeKey) return false;
    if (filters.priority !== "ALL" && link.priority !== filters.priority) return false;
    if (filters.linkType !== "ALL" && link.linkType !== filters.linkType) return false;
    if (filters.active === "ACTIVE" && !link.isActive) return false;
    if (filters.active === "INACTIVE" && link.isActive) return false;
    if (search && !`${link.title} ${link.notes ?? ""} ${link.storeDisplayName}`.toLowerCase().includes(search)) return false;
    return true;
  });
});

function resetForm() {
  editingId.value = null;
  Object.assign(form, { storeKey: "target", title: "", url: "", linkType: "SEARCH", priority: "NORMAL", wishlistItemId: "", setName: "", categoryId: "", notes: "", isActive: true });
}

function editLink(link: ManualStoreLink) {
  editingId.value = link.id;
  Object.assign(form, {
    storeKey: link.storeKey,
    title: link.title,
    url: link.url,
    linkType: link.linkType,
    priority: link.priority,
    wishlistItemId: link.wishlistItemId ?? "",
    setName: link.setName ?? "",
    categoryId: link.categoryId ?? "",
    notes: link.notes ?? "",
    isActive: link.isActive
  });
}

function payload() {
  return {
    storeKey: form.storeKey,
    title: form.title,
    url: form.url,
    linkType: form.linkType,
    priority: form.priority,
    wishlistItemId: form.wishlistItemId || null,
    setName: form.setName || null,
    categoryId: form.categoryId || null,
    notes: form.notes || null,
    isActive: form.isActive
  };
}

async function save() {
  if (editingId.value) {
    await radar.updateManualStoreLink(editingId.value, payload());
    message.value = "Manual link updated.";
  } else {
    await radar.createManualStoreLink(payload());
    message.value = "Manual link created.";
  }
  resetForm();
}

async function openLink(link: ManualStoreLink) {
  await radar.openManualStoreLink(link);
  message.value = "Opened manually in a new tab and recorded locally.";
}

onMounted(async () => {
  await Promise.all([radar.loadManualStoreLinks(), radar.loadWishlist(), radar.loadMSRPCategories(), radar.loadStoreSafetyMatrix()]);
});
</script>

<template>
  <div class="space-y-5">
    <section class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">Manual Store Links</h2>
          <p class="mt-1 text-sm text-slate-600">Safe launch center for user-provided retailer links. The backend never fetches or scans these URLs.</p>
        </div>
        <StatusBadge label="MANUAL / OPEN ONLY" tone="blue" />
      </div>
      <p class="mt-3 text-xs text-slate-500">No scanning, scraping, cart, checkout, browser automation, credential storage, or retailer requests are performed.</p>
    </section>

    <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div class="space-y-4">
        <section class="rounded border border-radar-line bg-white p-4">
          <div class="grid gap-3 md:grid-cols-5">
            <select v-model="filters.storeKey" class="rounded border border-radar-line px-3 py-2 text-sm">
              <option value="ALL">All stores</option>
              <option v-for="store in storeOptions" :key="store.key" :value="store.key">{{ store.label }}</option>
            </select>
            <select v-model="filters.priority" class="rounded border border-radar-line px-3 py-2 text-sm">
              <option value="ALL">All priorities</option>
              <option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option><option>IGNORE</option>
            </select>
            <select v-model="filters.linkType" class="rounded border border-radar-line px-3 py-2 text-sm">
              <option value="ALL">All types</option>
              <option>PRODUCT</option><option>SEARCH</option><option>CATEGORY</option><option>RELEASE_PAGE</option><option>STORE_HOME</option><option>CUSTOM</option>
            </select>
            <select v-model="filters.active" class="rounded border border-radar-line px-3 py-2 text-sm">
              <option value="ALL">All status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
            </select>
            <input v-model="filters.search" class="rounded border border-radar-line px-3 py-2 text-sm" placeholder="Search title/notes" />
          </div>
        </section>

        <section class="table-shell rounded">
          <table>
            <thead>
              <tr>
                <th>Store</th><th>Title</th><th>Type</th><th>Priority</th><th>Wishlist</th><th>Safety</th><th>Last opened</th><th>Count</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="link in filteredLinks" :key="link.id" :class="{ 'opacity-50': !link.isActive }">
                <td><div class="font-medium">{{ link.storeDisplayName }}</div><div class="text-xs text-slate-500">{{ link.storeKey }}</div></td>
                <td><div class="font-medium">{{ link.title }}</div><div class="max-w-sm text-xs text-slate-500">{{ link.notes }}</div></td>
                <td><StatusBadge :label="link.linkType" tone="blue" /></td>
                <td><StatusBadge :label="link.priority" :tone="radar.statusTone(link.priority)" /></td>
                <td>{{ link.wishlistItemName ?? link.setName ?? "-" }}</td>
                <td><div class="flex flex-col gap-1"><StatusBadge :label="link.safetyMode" :tone="radar.statusTone(link.safetyMode)" /><StatusBadge :label="link.riskLevel" :tone="radar.statusTone(link.riskLevel)" /></div></td>
                <td>{{ radar.formatTime(link.lastOpenedAt) }}</td>
                <td>{{ link.openCount }}</td>
                <td>
                  <div class="flex flex-wrap gap-2">
                    <button class="rounded border border-radar-line p-2" title="Open link manually" type="button" @click="openLink(link)"><ExternalLink class="size-4" /></button>
                    <button class="rounded border border-radar-line p-2" title="Edit" type="button" @click="editLink(link)"><Save class="size-4" /></button>
                    <button v-if="link.isActive" class="rounded border border-radar-line p-2" title="Disable" type="button" @click="radar.setManualStoreLinkEnabled(link.id, false)"><PauseCircle class="size-4" /></button>
                    <button v-else class="rounded border border-radar-line p-2" title="Enable" type="button" @click="radar.setManualStoreLinkEnabled(link.id, true)"><PlayCircle class="size-4" /></button>
                    <button class="rounded border border-radar-line p-2" title="Delete" type="button" @click="radar.deleteManualStoreLink(link.id)"><Trash2 class="size-4" /></button>
                  </div>
                  <p class="mt-2 max-w-xs text-xs text-slate-500">{{ link.warningMessage }}</p>
                </td>
              </tr>
              <tr v-if="filteredLinks.length === 0"><td colspan="9" class="py-10 text-center text-slate-500">No manual links match this filter.</td></tr>
            </tbody>
          </table>
        </section>
      </div>

      <aside class="space-y-4">
        <section class="rounded border border-radar-line bg-white p-4">
          <h3 class="text-sm font-semibold">{{ editingId ? "Edit Manual Link" : "Add Manual Link" }}</h3>
          <div class="mt-3 space-y-3">
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Store</span><select v-model="form.storeKey" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option v-for="store in storeOptions" :key="store.key" :value="store.key">{{ store.label }}</option></select></label>
            <p v-if="selectedSafety" class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{{ selectedSafety.displayName }}: {{ selectedSafety.recommendedMode }} / {{ selectedSafety.riskLevel }}. Manual link tracking only.</p>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Title</span><input v-model="form.title" class="mt-1 w-full rounded border border-radar-line px-3 py-2" /></label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">URL</span><input v-model="form.url" class="mt-1 w-full rounded border border-radar-line px-3 py-2" placeholder="https://..." /></label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Type</span><select v-model="form.linkType" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option>PRODUCT</option><option>SEARCH</option><option>CATEGORY</option><option>RELEASE_PAGE</option><option>STORE_HOME</option><option>CUSTOM</option></select></label>
              <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Priority</span><select v-model="form.priority" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option><option>IGNORE</option></select></label>
            </div>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Wishlist item</span><select v-model="form.wishlistItemId" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option value="">None</option><option v-for="item in radar.wishlistItems" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Set name</span><input v-model="form.setName" class="mt-1 w-full rounded border border-radar-line px-3 py-2" /></label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Category</span><select v-model="form.categoryId" class="mt-1 w-full rounded border border-radar-line px-3 py-2"><option value="">None</option><option v-for="category in radar.msrpCategories" :key="category.id" :value="category.id">{{ category.label }}</option></select></label>
            <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Notes</span><textarea v-model="form.notes" class="mt-1 min-h-20 w-full rounded border border-radar-line px-3 py-2" placeholder="check mornings, pickup only, verify seller manually"></textarea></label>
            <label class="flex items-center gap-2 text-sm"><input v-model="form.isActive" type="checkbox" /> Active</label>
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
