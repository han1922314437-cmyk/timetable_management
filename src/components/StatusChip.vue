<script setup>
defineProps({
  kind: {
    type: String,
    default: 'status-warn'
  },
  text: {
    type: String,
    default: ''
  }
});
</script>

<template>
  <span :class="['chip', 'status-chip', kind]">{{ text }}</span>
</template>
