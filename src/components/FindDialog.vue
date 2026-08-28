<script setup>
import BaseDialog from './BaseDialog.vue';
import { roomSecondaryLabel } from '../utils/scheduler';

defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  form: {
    type: Object,
    required: true
  },
  results: {
    type: Array,
    default: () => []
  },
  message: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'submit']);
</script>

<template>
  <BaseDialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <form class="dialog-shell" @submit.prevent="emit('submit')">
      <div class="dialog-title">
        <div>
          <h2>查找可用包间</h2>
          <p>请输入顾客需要的时间和人数。</p>
        </div>
        <button type="button" class="icon-btn" aria-label="关闭" title="关闭" @click="emit('update:modelValue', false)">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" focusable="false">
            <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="form-grid">
        <label>
          开始时间
          <input v-model="form.start" type="time" min="13:00" max="23:00" step="1800" />
        </label>

        <label>
          结束时间
          <input v-model="form.end" type="time" min="13:00" max="23:00" step="1800" />
        </label>

        <label class="full">
          人数
          <input v-model.number="form.pax" type="number" min="1" max="30" />
        </label>
      </div>

      <div class="dialog-actions">
        <button type="submit" class="btn primary">查询包间</button>
      </div>

      <div class="result-list">
        <div v-if="message" class="result">{{ message }}</div>
        <template v-else-if="results.length">
          <div v-for="room in results" :key="room.id" class="result">
            <div>
              <b>{{ room.name }}</b>
              <div class="result-subtext">{{ roomSecondaryLabel(room) }}</div>
            </div>
            <span class="badge">可用</span>
          </div>
        </template>
      </div>
    </form>
  </BaseDialog>
</template>
