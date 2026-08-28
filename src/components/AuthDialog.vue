<script setup>
import BaseDialog from './BaseDialog.vue';

defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'login'
  },
  form: {
    type: Object,
    required: true
  },
  message: {
    type: Object,
    required: true
  },
  submitting: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'update:mode', 'submit']);
</script>

<template>
  <BaseDialog :model-value="modelValue" panel-class="auth-dialog" @update:model-value="emit('update:modelValue', $event)">
    <form class="dialog-shell auth-shell" @submit.prevent="emit('submit')">
      <div class="auth-hero">
        <div class="auth-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" focusable="false">
            <path d="M7 10.5C7 7.462 9.462 5 12.5 5C15.538 5 18 7.462 18 10.5C18 13.538 15.538 16 12.5 16C9.462 16 7 13.538 7 10.5Z" stroke-width="1.7"/>
            <path d="M4.5 19.5C6.381 17.59 9.108 16.5 12 16.5C14.892 16.5 17.619 17.59 19.5 19.5" stroke-width="1.7" stroke-linecap="round"/>
          </svg>
        </div>

        <div class="auth-title">
          <div class="auth-copy">
            <h2>{{ mode === 'login' ? '登录' : '注册' }}</h2>
            <p>{{ mode === 'login' ? '登录后可以保存和查看自己的预约数据。' : '注册新账户后会自动登录。' }}</p>
          </div>
          <button type="button" class="icon-btn" aria-label="关闭" title="关闭" @click="emit('update:modelValue', false)">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" focusable="false">
              <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="auth-tabs">
          <button type="button" class="btn tab" :class="{ active: mode === 'login' }" @click="emit('update:mode', 'login')">登录</button>
          <button type="button" class="btn tab" :class="{ active: mode === 'register' }" @click="emit('update:mode', 'register')">注册</button>
        </div>
      </div>

      <div class="auth-forms">
        <div class="form-grid auth-grid">
          <label class="full auth-field">
            用户名
            <input v-model="form.username" autocomplete="username" placeholder="请输入用户名" required />
          </label>

          <label class="full auth-field">
            密码
            <input
              v-model="form.password"
              type="password"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              placeholder="请输入密码"
              required
            />
          </label>

          <label v-if="mode === 'register'" class="full auth-field">
            确认密码
            <input v-model="form.password2" type="password" autocomplete="new-password" placeholder="请再次输入密码" required />
          </label>
        </div>

        <div v-if="message.text" :class="['message', message.type || 'error']">{{ message.text }}</div>

        <div class="auth-actions">
          <button type="submit" class="btn primary auth-submit" :disabled="submitting">
            {{ submitting ? '提交中...' : mode === 'login' ? '登录' : '注册并登录' }}
          </button>
        </div>

        <div class="auth-note">仅保存你的预约数据，不会在页面直接展示密码。</div>
      </div>
    </form>
  </BaseDialog>
</template>
