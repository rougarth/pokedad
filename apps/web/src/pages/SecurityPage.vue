<script setup lang="ts">
import { ref } from "vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();
const newPassword = ref("");
const passwordMessage = ref("");

async function changePassword() {
  passwordMessage.value = "";
  if (newPassword.value.length < 8) {
    passwordMessage.value = "Use at least 8 characters.";
    return;
  }
  await radar.changePassword(newPassword.value);
  newPassword.value = "";
  passwordMessage.value = "Password updated.";
}
</script>

<template>
  <section class="grid gap-4 xl:grid-cols-2">
    <div class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <h2 class="mb-4 text-base font-semibold">Dashboard User</h2>
      <div class="mb-5 rounded border border-radar-line p-3 text-sm">
        <div class="font-semibold">{{ radar.currentUser?.displayName ?? "Local admin" }}</div>
        <div class="text-slate-600">{{ radar.currentUser?.email }}</div>
      </div>
      <h3 class="mb-3 text-sm font-semibold">Change Password</h3>
      <div class="grid gap-3">
        <input v-model="newPassword" class="h-10 rounded border border-radar-line px-3" type="password" placeholder="New password" />
        <button class="h-10 rounded bg-radar-teal font-semibold text-white" type="button" @click="changePassword">Update password</button>
        <p v-if="passwordMessage" class="text-sm font-semibold text-radar-teal">{{ passwordMessage }}</p>
      </div>
    </div>
    <div class="rounded border border-radar-line bg-white p-5 shadow-soft">
      <h2 class="mb-4 text-base font-semibold">Guardrails</h2>
      <div class="space-y-3 text-sm">
        <p class="rounded border border-radar-line p-3">No payment data, CVV, retailer passwords, cookies, or session tokens are stored in the backend.</p>
        <p class="rounded border border-radar-line p-3">Audit log payloads are sanitized before write.</p>
        <p class="rounded border border-radar-line p-3">Alert secrets use a placeholder AES-256-GCM service for encrypted settings.</p>
        <p class="rounded border border-radar-line p-3">Encrypted alert token records: {{ radar.alertChannels.length }}</p>
        <p class="rounded border border-radar-line p-3">Cart assist remains open-only/local-helper-ready, with no real retailer automation.</p>
      </div>
    </div>
  </section>

  <section class="table-shell mt-5 rounded">
    <table>
      <thead>
        <tr>
          <th>Action</th>
          <th>Summary</th>
          <th>Time</th>
          <th>Metadata</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in radar.auditLogs" :key="log.id">
          <td><StatusBadge :label="log.action" :tone="radar.statusTone(log.action)" /></td>
          <td>{{ log.summary }}</td>
          <td>{{ radar.formatTime(log.createdAt) }}</td>
          <td class="max-w-lg truncate text-xs text-slate-500">{{ JSON.stringify(log.metadata ?? {}) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
