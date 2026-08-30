<script setup>
import BaseDialog from './BaseDialog.vue';
import { roomCapacityLabel } from '../utils/scheduler';

defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  rooms: {
    type: Array,
    default: () => []
  },
  form: {
    type: Object,
    required: true
  },
  parseInput: {
    type: String,
    default: ''
  },
  parseMessage: {
    type: Object,
    required: true
  },
  message: {
    type: Object,
    required: true
  },
  editing: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'update:parseInput', 'submit', 'delete', 'parse']);
</script>

<template>
  <BaseDialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <form class="dialog-shell" @submit.prevent="emit('submit')">
      <div class="dialog-title">
        <div>
          <h2>{{ editing ? '编辑预约' : '新增预约' }}</h2>
        </div>
        <button type="button" class="icon-btn" aria-label="关闭" title="关闭" @click="emit('update:modelValue', false)">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" focusable="false">
            <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <label class="full">
        粘贴 WhatsApp 文本
        <textarea
          :value="parseInput"
          placeholder="把顾客发来的预约内容直接贴在这里，然后点“智能识别”"
          @input="emit('update:parseInput', $event.target.value)"
        />
      </label>

      <div class="dialog-actions align-start">
        <button type="button" class="btn" @click="emit('parse')">智能识别</button>
      </div>

      <div v-if="parseMessage.text" :class="['message', parseMessage.type || 'error']">{{ parseMessage.text }}</div>

      <div class="form-grid">
        <label>
          顾客姓名（选填）
          <input v-model="form.customer" />
        </label>

        <label>
          游玩项目（选填）
          <input v-model="form.activity" />
        </label>

        <label>
          联系电话
          <input v-model="form.phone" />
        </label>

        <label>
          开始时间
          <input v-model="form.start" type="time" min="12:00" max="23:00" step="1800" required />
        </label>

        <label>
          结束时间
          <input v-model="form.end" type="time" min="12:00" max="23:00" step="1800" required />
        </label>

        <label>
          人数
          <input v-model.number="form.pax" type="number" min="1" max="30" required />
        </label>

        <label>
          包间
          <select v-model.number="form.roomId" required>
            <option disabled value="">请选择包间</option>
            <option v-for="room in rooms" :key="room.id" :value="room.id">{{ roomCapacityLabel(room) }}</option>
          </select>
        </label>

        <label class="full">
          状态
          <select v-model="form.status">
            <option value="confirmed">已确认</option>
            <option value="pending">待确认</option>
          </select>
        </label>

        <label class="full">
          定金
          <select v-model="form.deposit">
            <option :value="false">未付</option>
            <option :value="true">已付</option>
          </select>
        </label>

        <label class="full">
          备注（选填）
          <textarea v-model="form.note" rows="3" placeholder="填写给自己看的自定义备注" />
        </label>
      </div>

      <div v-if="message.text" :class="['message', message.type || 'error']">{{ message.text }}</div>

      <div class="dialog-actions">
        <button v-if="editing" type="button" class="btn danger-text" @click="emit('delete')">删除预约</button>
        <button type="button" class="btn" @click="emit('update:modelValue', false)">取消</button>
        <button type="submit" class="btn primary">{{ editing ? '保存修改' : '保存预约' }}</button>
      </div>
    </form>
  </BaseDialog>
</template>
