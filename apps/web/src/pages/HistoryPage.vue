<script setup lang="ts">
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();
</script>

<template>
  <section class="table-shell rounded">
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Store</th>
          <th>Price</th>
          <th>Found</th>
          <th>Alert</th>
          <th>Cart assist</th>
          <th>Skip reason</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="event in radar.history" :key="event.id">
          <td class="font-medium">{{ event.productName }}</td>
          <td>{{ event.storeName }}</td>
          <td>{{ radar.formatPrice(event.priceCents) }}</td>
          <td>
            <div>{{ radar.formatTime(event.foundAt) }}</div>
            <div v-if="event.soldOutAt" class="text-xs text-slate-500">Sold out {{ radar.formatTime(event.soldOutAt) }}</div>
          </td>
          <td><StatusBadge :label="event.alertSent ? 'Sent' : 'Not sent'" :tone="event.alertSent ? 'green' : 'slate'" /></td>
          <td><StatusBadge :label="event.cartAssistWorked ? 'Worked' : 'No'" :tone="event.cartAssistWorked ? 'green' : 'slate'" /></td>
          <td><StatusBadge :label="event.skipReason" :tone="radar.statusTone(event.skipReason)" /></td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
