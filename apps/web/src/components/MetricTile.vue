<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  tone?: "teal" | "gold" | "red" | "neutral";
}>();
</script>

<template>
  <section class="min-h-28 rounded border border-radar-line bg-white p-4 shadow-soft">
    <p class="text-sm font-medium text-slate-500">{{ label }}</p>
    <p
      class="mt-3 text-3xl font-semibold"
      :class="{
        'text-radar-teal': tone === 'teal',
        'text-radar-gold': tone === 'gold',
        'text-radar-red': tone === 'red',
        'text-radar-ink': !tone || tone === 'neutral'
      }"
    >
      {{ value }}
    </p>
  </section>
</template>

