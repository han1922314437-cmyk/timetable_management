<script setup>
defineProps({
  label: {
    type: String,
    default: ''
  },
  value: {
    type: String,
    default: ''
  },
  compact: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <div class="card">
    <div class="label">{{ label }}</div>
    <div :class="['value', { compact }]">{{ value }}</div>
  </div>
</template>
