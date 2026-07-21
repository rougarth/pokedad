<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { LockKeyhole } from "@lucide/vue";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();
const router = useRouter();
const showLocalDefaults = import.meta.env.DEV;
const email = ref(showLocalDefaults ? "admin@pokedad.local" : "");
const password = ref(showLocalDefaults ? "pokedad-dev-password" : "");
const error = ref("");

async function login() {
  error.value = "";
  try {
    await radar.login(email.value, password.value);
    await router.replace("/");
  } catch {
    error.value = "Invalid email or password.";
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-6">
    <form class="w-full max-w-sm rounded border border-radar-line bg-white p-6 shadow-soft" @submit.prevent="login">
      <div class="mb-6 flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded bg-radar-teal text-white">
          <LockKeyhole class="size-5" aria-hidden="true" />
        </div>
        <div>
          <h1 class="text-xl font-semibold">PokeDad Radar</h1>
          <p class="text-sm text-slate-500">Private access</p>
        </div>
      </div>
      <label class="mb-2 block text-sm font-medium" for="email">Email</label>
      <input id="email" v-model="email" class="mb-4 h-11 w-full rounded border border-radar-line px-3" type="email" autocomplete="username" />
      <label class="mb-2 block text-sm font-medium" for="password">Password</label>
      <input id="password" v-model="password" class="mb-3 h-11 w-full rounded border border-radar-line px-3" type="password" autocomplete="current-password" />
      <p v-if="error" class="mb-3 rounded bg-red-50 p-2 text-sm font-semibold text-red-700">{{ error }}</p>
      <button class="h-11 w-full rounded bg-radar-teal font-semibold text-white hover:bg-teal-700" type="submit">
        Sign in
      </button>
      <p v-if="showLocalDefaults" class="mt-4 text-xs text-slate-500">Local default: admin@pokedad.local / pokedad-dev-password</p>
    </form>
  </div>
</template>
