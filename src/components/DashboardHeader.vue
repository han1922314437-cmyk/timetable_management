<script setup>
import StatCard from './StatCard.vue';
import StatusChip from './StatusChip.vue';

defineProps({
  date: {
    type: String,
    required: true
  },
  statusKind: {
    type: String,
    default: 'status-warn'
  },
  statusText: {
    type: String,
    default: ''
  },
  isLoggedIn: {
    type: Boolean,
    default: false
  },
  username: {
    type: String,
    default: ''
  },
  bookingCount: {
    type: String,
    default: ''
  },
  availableRoomCount: {
    type: String,
    default: ''
  },
  nextEnding: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:date', 'login', 'register', 'logout', 'find-room', 'new-booking']);
</script>

<template>
  <div class="topbar">
    <div class="date-controls">
      <input :value="date" type="date" @input="emit('update:date', $event.target.value)" />
    </div>

    <div class="auth-panel">
      <StatusChip :kind="statusKind" :text="statusText" />
      <span class="chip">{{ isLoggedIn ? `当前账号：${username}` : '未登录' }}</span>
      <button v-if="!isLoggedIn" class="btn" @click="emit('login')">登录</button>
      <button v-if="!isLoggedIn" class="btn" @click="emit('register')">注册</button>
      <button v-if="isLoggedIn" class="btn" @click="emit('logout')">退出</button>
    </div>
  </div>

  <template v-if="isLoggedIn">
    <div class="actions">
      <button class="btn" @click="emit('find-room')">查找空闲包间</button>
      <button class="btn primary" @click="emit('new-booking')">+ 新增预约</button>
    </div>

    <div class="cards">
      <StatCard label="预约数量" :value="bookingCount" />
      <StatCard label="可用包间" :value="availableRoomCount" />
      <StatCard label="即将结束的预约" :value="nextEnding" compact />
    </div>
  </template>
</template>
