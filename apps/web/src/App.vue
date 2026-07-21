<script setup lang="ts">
import { onMounted, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { LogOut, ShieldCheck } from "@lucide/vue";
import { navItems } from "@/router";
import { useRadarStore } from "@/stores/radar";

const route = useRoute();
const router = useRouter();
const radar = useRadarStore();

onMounted(() => {
  radar.checkAuth().then((user) => {
    if (!user && route.path !== "/login") {
      router.replace("/login");
      return;
    }
    if (user) {
      radar.loadAll();
    }
  });
});

watch(
  () => route.path,
  async (path) => {
    if (!radar.authChecked) {
      return;
    }
    if (!radar.currentUser && path !== "/login") {
      await router.replace("/login");
    }
  }
);

async function logout() {
  await radar.logout();
  await router.replace("/login");
}
</script>

<template>
  <main v-if="route.path === '/login'" class="min-h-screen bg-radar-panel text-radar-ink">
    <RouterView />
  </main>

  <main v-else class="min-h-screen bg-radar-panel text-radar-ink">
    <aside class="fixed inset-y-0 left-0 hidden w-64 border-r border-radar-line bg-white lg:block">
      <div class="flex h-16 items-center gap-3 border-b border-radar-line px-5">
        <div class="flex size-9 items-center justify-center rounded bg-radar-teal text-white">
          <ShieldCheck class="size-5" aria-hidden="true" />
        </div>
        <div>
          <p class="text-base font-semibold">PokeDad Radar</p>
          <p class="text-xs text-slate-500">Private dashboard</p>
        </div>
      </div>
      <nav class="space-y-1 p-3">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex h-10 items-center gap-3 rounded px-3 text-sm font-medium text-slate-700 hover:bg-radar-panel"
          active-class="bg-radar-teal text-white hover:bg-radar-teal"
        >
          <component :is="item.icon" class="size-4" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <section class="min-w-0 lg:pl-64">
      <header class="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-radar-line bg-white/95 px-4 backdrop-blur md:px-8">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-radar-teal">PokeDad Radar</p>
          <h1 class="text-lg font-semibold">{{ String(route.meta.title ?? "Dashboard") }}</h1>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="radar.error" class="hidden max-w-md truncate text-xs font-medium text-radar-red md:block">{{ radar.error }}</span>
          <span v-else class="hidden text-xs font-medium text-radar-teal md:block">{{ radar.currentUser?.email ?? "Checking session" }}</span>
          <button class="rounded border border-radar-line p-2 text-sm font-medium hover:bg-radar-panel" title="Logout" type="button" @click="logout">
            <LogOut class="size-4" />
          </button>
        </div>
      </header>

      <div class="p-4 md:p-8">
        <RouterView />
      </div>
    </section>
  </main>
</template>
