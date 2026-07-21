<script setup lang="ts">
import { CartAssistStatus } from "@pokedad-radar/shared";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();
const statuses = Object.values(CartAssistStatus);
const manualStatuses = [CartAssistStatus.CAPTCHA_DETECTED, CartAssistStatus.QUEUE_DETECTED, CartAssistStatus.HUMAN_CHECK_REQUIRED];
</script>

<template>
  <section class="mb-5 rounded border border-radar-line bg-white p-5 shadow-soft">
    <h2 class="text-base font-semibold">Cart assist safety</h2>
    <p class="mt-2 text-sm text-slate-600">
      This phase is open-only. CAPTCHA, queue, and human-check states stop the system and require manual user action.
    </p>
  </section>

  <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <div v-for="status in statuses" :key="status" class="min-h-44 rounded border border-radar-line bg-white p-4 shadow-soft">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold">{{ status }}</h2>
        <StatusBadge :label="String(radar.cartQueue.filter((attempt) => attempt.status === status).length)" :tone="radar.statusTone(status)" />
      </div>
      <div class="mt-4 space-y-3">
        <article v-for="attempt in radar.cartQueue.filter((item) => item.status === status)" :key="attempt.id" class="rounded border border-radar-line p-3">
          <div class="font-medium">{{ attempt.productName }}</div>
          <div class="text-sm text-slate-600">{{ attempt.storeName }} · Qty {{ attempt.requestedQuantity }}</div>
          <p class="mt-2 text-sm">{{ attempt.lastMessage }}</p>
          <p v-if="attempt.stopReason" class="mt-2 rounded bg-red-50 p-2 text-sm font-semibold text-red-700">{{ attempt.stopReason }}</p>
          <div v-if="manualStatuses.includes(attempt.status)" class="mt-2 rounded bg-amber-50 p-2 text-sm font-semibold text-amber-800">
            Stopped. Manual user action is required before retry.
          </div>
          <div class="mt-3 flex gap-2">
            <a class="rounded border border-radar-line px-2 py-1 text-xs font-semibold" :href="attempt.cartUrl" target="_blank">Open Cart</a>
            <button class="rounded border border-radar-line px-2 py-1 text-xs font-semibold" type="button" @click="radar.cartAction(attempt.id, 'retry')">Retry</button>
            <button class="rounded border border-radar-line px-2 py-1 text-xs font-semibold" type="button" @click="radar.cartAction(attempt.id, 'stop')">Stop</button>
          </div>
        </article>
        <p v-if="!radar.cartQueue.some((attempt) => attempt.status === status)" class="text-sm text-slate-500">No items</p>
      </div>
    </div>
  </section>
</template>
