<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  panelClass: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue']);
const dialogRef = ref(null);

watch(
  () => props.modelValue,
  value => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (value && !dialog.open) dialog.showModal();
    if (!value && dialog.open) dialog.close();
  }
);

onBeforeUnmount(() => {
  if (dialogRef.value?.open) dialogRef.value.close();
});
</script>

<template>
  <dialog ref="dialogRef" :class="['app-dialog', panelClass]" @close="emit('update:modelValue', false)">
    <slot />
  </dialog>
</template>
