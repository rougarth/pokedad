<script setup lang="ts">
const props = defineProps<{
  label: string;
  tone?: "green" | "blue" | "gold" | "red" | "slate";
}>();
</script>

<template>
  <span
    class="inline-flex min-h-7 items-center rounded px-2.5 text-xs font-semibold"
    :class="{
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200': props.tone === 'green',
      'bg-sky-50 text-sky-700 ring-1 ring-sky-200': props.tone === 'blue',
      'bg-amber-50 text-amber-800 ring-1 ring-amber-200': props.tone === 'gold',
      'bg-red-50 text-red-700 ring-1 ring-red-200': props.tone === 'red',
      'bg-slate-100 text-slate-700 ring-1 ring-slate-200': !props.tone || props.tone === 'slate'
    }"
  >
    {{ label }}
  </span>
</template>

