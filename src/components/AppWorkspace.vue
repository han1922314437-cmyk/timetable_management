<script setup>
import TimelineBoard from './TimelineBoard.vue';

defineProps({
  isLoggedIn: {
    type: Boolean,
    default: false
  },
  rooms: {
    type: Array,
    default: () => []
  },
  dayBookings: {
    type: Array,
    default: () => []
  },
  viewMode: {
    type: String,
    default: 'timeline'
  }
});

const emit = defineEmits(['update:viewMode', 'edit']);
</script>

<template>
  <template v-if="isLoggedIn">
    <TimelineBoard
      :rooms="rooms"
      :bookings="dayBookings"
      :view-mode="viewMode"
      @update:view-mode="emit('update:viewMode', $event)"
      @edit="emit('edit', $event)"
    />
  </template>
</template>
