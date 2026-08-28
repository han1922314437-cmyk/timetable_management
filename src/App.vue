<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { api } from './lib/api';
import AuthDialog from './components/AuthDialog.vue';
import BookingDialog from './components/BookingDialog.vue';
import FindDialog from './components/FindDialog.vue';
import StatCard from './components/StatCard.vue';
import StatusChip from './components/StatusChip.vue';
import TimelineBoard from './components/TimelineBoard.vue';
import {
  createBookingForm,
  createFindForm,
  fmt,
  getRoomName,
  overlap,
  parseWhatsappText,
  toMin,
  todayIso
} from './utils/scheduler';

const date = ref(todayIso());
const rooms = ref([]);
const bookings = ref([]);
const user = ref(null);
const viewMode = ref(window.innerWidth <= 720 ? 'list' : 'timeline');
const editingBookingId = ref(null);

const dbStatus = reactive({
  kind: 'status-warn',
  text: '正在连接数据库'
});

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

const bookingOpen = ref(false);
const bookingForm = reactive(createBookingForm());
const bookingMessage = reactive({
  type: '',
  text: ''
});
const parseMessage = reactive({
  type: '',
  text: ''
});
const whatsappPaste = ref('');

const findOpen = ref(false);
const findForm = reactive(createFindForm());
const findResults = ref([]);
const findMessage = ref('');

const isLoggedIn = computed(() => !!user.value);
const dayBookings = computed(() => bookings.value.filter(booking => booking.date === date.value).sort((a, b) => toMin(a.start) - toMin(b.start)));
const bookingCount = computed(() => dayBookings.value.length);
const availableRoomCount = computed(() => rooms.value.filter(room => !dayBookings.value.some(booking => booking.roomId === room.id)).length);
const nextEnding = computed(() => {
  const ending = [...dayBookings.value].sort((a, b) => toMin(a.end) - toMin(b.end))[0];
  return ending ? `${getRoomName(rooms.value.find(room => room.id === ending.roomId))} · ${fmt(ending.end)}` : '—';
});

function resetAuthMessage() {
  authMessage.type = '';
  authMessage.text = '';
}

function resetBookingMessage() {
  bookingMessage.type = '';
  bookingMessage.text = '';
}

function resetParseMessage() {
  parseMessage.type = '';
  parseMessage.text = '';
}

function resetBookingForm() {
  Object.assign(bookingForm, createBookingForm());
  bookingForm.roomId = rooms.value[0]?.id ?? '';
  editingBookingId.value = null;
  whatsappPaste.value = '';
  resetBookingMessage();
  resetParseMessage();
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

function openNewBooking() {
  if (!requireLogin()) return;
  resetBookingForm();
  bookingOpen.value = true;
}

function openEditBooking(booking) {
  editingBookingId.value = booking.id;
  bookingForm.customer = booking.customer || '';
  bookingForm.activity = booking.activity || '';
  bookingForm.phone = booking.phone || '';
  bookingForm.start = booking.start;
  bookingForm.end = booking.end;
  bookingForm.pax = booking.pax;
  bookingForm.roomId = booking.roomId;
  bookingForm.status = booking.status;
  whatsappPaste.value = '';
  resetBookingMessage();
  resetParseMessage();
  bookingOpen.value = true;
}

function closeBooking() {
  bookingOpen.value = false;
  resetBookingForm();
}

function openFindRoom() {
  if (!requireLogin()) return;
  findOpen.value = true;
  findResults.value = [];
  findMessage.value = '';
}

function setRooms(rawRooms) {
  rooms.value = (rawRooms || []).map(room => ({
    ...room,
    name: getRoomName(room)
  }));

  if (!bookingForm.roomId && rooms.value.length) {
    bookingForm.roomId = rooms.value[0].id;
  }
}

async function loadBookings() {
  if (!user.value) {
    bookings.value = [];
    return;
  }

  const data = await api(`/api/bookings?date=${encodeURIComponent(date.value)}`);
  bookings.value = data.bookings || [];
}

async function bootstrap() {
  dbStatus.kind = 'status-warn';
  dbStatus.text = '正在连接数据库';

  try {
    const health = await api('/api/health');
    dbStatus.kind = health.ok ? 'status-ok' : 'status-warn';
    dbStatus.text = health.message || (health.ok ? '数据库已连接' : '数据库状态待检查');
  } catch (error) {
    dbStatus.kind = 'status-error';
    dbStatus.text = `数据库连接失败：${error.message}`;
  }

  const roomData = await api('/api/rooms');
  setRooms(roomData.rooms);

  const me = await api('/api/me');
  user.value = me.user || null;

  if (user.value) {
    await loadBookings();
  } else {
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
    await loadBookings();
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
  bookings.value = [];
  openAuth('login');
}

async function submitBooking() {
  if (!requireLogin()) return;

  const payload = {
    date: date.value,
    customer: bookingForm.customer.trim(),
    activity: bookingForm.activity.trim(),
    phone: bookingForm.phone.trim(),
    start: bookingForm.start,
    end: bookingForm.end,
    pax: Number(bookingForm.pax),
    roomId: Number(bookingForm.roomId),
    status: bookingForm.status
  };

  resetBookingMessage();

  try {
    if (!payload.phone || !payload.start || !payload.end || toMin(payload.end) <= toMin(payload.start)) {
      throw new Error('请输入有效的电话和时间范围。');
    }

    if (editingBookingId.value) {
      await api(`/api/bookings/${editingBookingId.value}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await api('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    closeBooking();
    await loadBookings();
  } catch (error) {
    bookingMessage.type = 'error';
    bookingMessage.text = error.message;
  }
}

async function deleteBooking() {
  if (!editingBookingId.value) return;
  if (!window.confirm('确定要删除这条预约吗？')) return;

  try {
    await api(`/api/bookings/${editingBookingId.value}`, {
      method: 'DELETE',
      body: '{}'
    });
    closeBooking();
    await loadBookings();
  } catch (error) {
    bookingMessage.type = 'error';
    bookingMessage.text = error.message;
  }
}

async function applyWhatsappParse() {
  const parsed = parseWhatsappText(whatsappPaste.value);
  const foundFields = [];

  if (parsed.activity) {
    bookingForm.activity = parsed.activity;
    foundFields.push('游玩项目');
  }
  if (parsed.date) {
    date.value = parsed.date;
    foundFields.push('预约日期');
  }
  if (parsed.customer) {
    bookingForm.customer = parsed.customer;
    foundFields.push('顾客姓名');
  }
  if (parsed.phone) {
    bookingForm.phone = parsed.phone;
    foundFields.push('联系电话');
  }
  if (parsed.pax) {
    bookingForm.pax = parsed.pax;
    foundFields.push('人数');
  }
  if (parsed.start) {
    bookingForm.start = parsed.start;
    foundFields.push('开始时间');
  }
  if (parsed.end) {
    bookingForm.end = parsed.end;
    foundFields.push('结束时间');
  }

  const messages = [];
  if (foundFields.length) messages.push(`已识别：${foundFields.join('、')}。`);
  if (parsed.notes.length) messages.push(parsed.notes.join(' '));

  if (parsed.missing.length) {
    messages.push(`未找到：${parsed.missing.join('、')}。`);
    parseMessage.type = 'error';
    parseMessage.text = messages.join(' ');
  } else {
    parseMessage.type = foundFields.length ? 'success' : 'error';
    parseMessage.text = messages.join(' ') || '未识别到可用字段。';
  }

  if (user.value && parsed.date) {
    await loadBookings();
  }
}

function searchAvailableRooms() {
  if (!requireLogin()) return;

  if (!findForm.start || !findForm.end || toMin(findForm.end) <= toMin(findForm.start)) {
    findMessage.value = '时间范围无效';
    findResults.value = [];
    return;
  }

  const available = rooms.value.filter(room =>
    room.capacity >= Number(findForm.pax) &&
    !dayBookings.value.some(booking => booking.roomId === room.id && overlap(findForm.start, findForm.end, booking.start, booking.end))
  );

  findResults.value = available;
  findMessage.value = available.length ? '' : '当前没有可用包间';
}

function handleResize() {
  if (!isLoggedIn.value) {
    viewMode.value = window.innerWidth <= 720 ? 'list' : 'timeline';
  }
}

watch(date, async () => {
  if (user.value) {
    await loadBookings();
  }
});

watch(user, nextUser => {
  if (!nextUser) {
    authOpen.value = true;
    authMode.value = 'login';
  }
});

onMounted(() => {
  window.addEventListener('resize', handleResize);
  bootstrap().catch(error => {
    console.error(error);
    dbStatus.kind = 'status-error';
    dbStatus.text = error.message || '初始化失败';
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="app-shell">
    <div class="app">
      <div class="topbar">
        <div class="date-controls">
          <input v-model="date" type="date" />
        </div>

        <div class="auth-panel">
          <StatusChip :kind="dbStatus.kind" :text="dbStatus.text" />
          <span class="chip">{{ isLoggedIn ? `当前账号：${user.username}` : '未登录' }}</span>
          <button v-if="!isLoggedIn" class="btn" @click="openAuth('login')">登录</button>
          <button v-if="!isLoggedIn" class="btn" @click="openAuth('register')">注册</button>
          <button v-if="isLoggedIn" class="btn" @click="logout">退出</button>
        </div>
      </div>

      <template v-if="isLoggedIn">
        <div class="actions">
          <button class="btn" @click="openFindRoom">查找空闲包间</button>
          <button class="btn primary" @click="openNewBooking">+ 新增预约</button>
        </div>

        <div class="cards">
          <StatCard label="预约数量" :value="String(bookingCount)" />
          <StatCard label="可用包间" :value="String(availableRoomCount)" />
          <StatCard label="即将结束的预约" :value="nextEnding" compact />
        </div>

        <TimelineBoard :rooms="rooms" :bookings="dayBookings" :view-mode="viewMode" @update:view-mode="viewMode = $event" @edit="openEditBooking" />
      </template>
    </div>

    <AuthDialog
      v-model="authOpen"
      :mode="authMode"
      :form="authForm"
      :message="authMessage"
      :submitting="authSubmitting"
      @update:mode="authMode = $event"
      @submit="submitAuth"
    />

    <BookingDialog
      :model-value="bookingOpen"
      :rooms="rooms"
      :form="bookingForm"
      :parse-input="whatsappPaste"
      :parse-message="parseMessage"
      :message="bookingMessage"
      :editing="!!editingBookingId"
      @update:model-value="value => value ? bookingOpen = true : closeBooking()"
      @update:parse-input="whatsappPaste = $event"
      @parse="applyWhatsappParse"
      @submit="submitBooking"
      @delete="deleteBooking"
    />

    <FindDialog v-model="findOpen" :form="findForm" :results="findResults" :message="findMessage" @submit="searchAvailableRooms" />
  </div>
</template>
