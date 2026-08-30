<script setup>
import AuthDialog from './AuthDialog.vue';
import BookingDialog from './BookingDialog.vue';
import FindDialog from './FindDialog.vue';

defineProps({
  authOpen: {
    type: Boolean,
    default: false
  },
  authMode: {
    type: String,
    default: 'login'
  },
  authForm: {
    type: Object,
    required: true
  },
  authMessage: {
    type: Object,
    required: true
  },
  authSubmitting: {
    type: Boolean,
    default: false
  },
  bookingOpen: {
    type: Boolean,
    default: false
  },
  rooms: {
    type: Array,
    default: () => []
  },
  bookingForm: {
    type: Object,
    required: true
  },
  whatsappPaste: {
    type: String,
    default: ''
  },
  parseMessage: {
    type: Object,
    required: true
  },
  bookingMessage: {
    type: Object,
    required: true
  },
  editingBooking: {
    type: Boolean,
    default: false
  },
  findOpen: {
    type: Boolean,
    default: false
  },
  findForm: {
    type: Object,
    required: true
  },
  findResults: {
    type: Array,
    default: () => []
  },
  findMessage: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'update:authOpen',
  'update:authMode',
  'submit-auth',
  'update:bookingOpen',
  'update:whatsappPaste',
  'submit-booking',
  'delete-booking',
  'parse-booking',
  'update:findOpen',
  'submit-find'
]);
</script>

<template>
  <AuthDialog
    :model-value="authOpen"
    :mode="authMode"
    :form="authForm"
    :message="authMessage"
    :submitting="authSubmitting"
    @update:model-value="emit('update:authOpen', $event)"
    @update:mode="emit('update:authMode', $event)"
    @submit="emit('submit-auth')"
  />

  <BookingDialog
    :model-value="bookingOpen"
    :rooms="rooms"
    :form="bookingForm"
    :parse-input="whatsappPaste"
    :parse-message="parseMessage"
    :message="bookingMessage"
    :editing="editingBooking"
    @update:model-value="emit('update:bookingOpen', $event)"
    @update:parse-input="emit('update:whatsappPaste', $event)"
    @parse="emit('parse-booking')"
    @submit="emit('submit-booking')"
    @delete="emit('delete-booking')"
  />

  <FindDialog
    :model-value="findOpen"
    :form="findForm"
    :results="findResults"
    :message="findMessage"
    @update:model-value="emit('update:findOpen', $event)"
    @submit="emit('submit-find')"
  />
</template>
