import { computed, reactive, ref } from 'vue';
import { api } from '../lib/api';

export function useAuth({ user, reloadBookings, clearBookings }) {
  const authOpen = ref(false);
  const authMode = ref('login');
  const authSubmitting = ref(false);
  const authForm = reactive({
    username: '',
    password: '',
    password2: ''
  });
  const authMessage = reactive({
    type: '',
    text: ''
  });

  const isLoggedIn = computed(() => !!user.value);

  function resetAuthMessage() {
    authMessage.type = '';
    authMessage.text = '';
  }

  function openAuth(mode = 'login') {
    authMode.value = mode;
    authOpen.value = true;
    resetAuthMessage();
  }

  function closeAuth() {
    authOpen.value = false;
  }

  function requireLogin() {
    if (isLoggedIn.value) return true;
    openAuth('login');
    return false;
  }

  function setUser(nextUser) {
    user.value = nextUser || null;
  }

  function bootstrapUser(nextUser) {
    setUser(nextUser);
    if (!nextUser) {
      openAuth('login');
    }
  }

  async function submitAuth() {
    authSubmitting.value = true;
    resetAuthMessage();

    try {
      if (authMode.value === 'register' && authForm.password !== authForm.password2) {
        throw new Error('两次输入的密码不一致。');
      }

      const endpoint = authMode.value === 'login' ? '/api/login' : '/api/register';
      const data = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          username: authForm.username.trim(),
          password: authForm.password
        })
      });

      user.value = data.user || null;
      closeAuth();
      authForm.password = '';
      authForm.password2 = '';
      await reloadBookings();
    } catch (error) {
      authMessage.type = 'error';
      authMessage.text = error.message;
    } finally {
      authSubmitting.value = false;
    }
  }

  async function logout() {
    await api('/api/logout', { method: 'POST', body: '{}' });
    user.value = null;
    clearBookings();
    openAuth('login');
  }

  return {
    user,
    isLoggedIn,
    authOpen,
    authMode,
    authSubmitting,
    authForm,
    authMessage,
    resetAuthMessage,
    openAuth,
    closeAuth,
    requireLogin,
    setUser,
    bootstrapUser,
    submitAuth,
    logout
  };
}
