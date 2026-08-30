import { computed, reactive, ref } from 'vue';
import { api } from '../lib/api';
import { fmt, getRoomName, todayIso, toMin } from '../utils/scheduler';

export function useAppState({ user }) {
  const date = ref(todayIso());
  const rooms = ref([]);
  const bookings = ref([]);
  const viewMode = ref(window.innerWidth <= 720 ? 'list' : 'timeline');
  const dbStatus = reactive({
    kind: 'status-warn',
    text: '正在连接数据库...'
  });

  const dayBookings = computed(() =>
    bookings.value.filter(booking => booking.date === date.value).sort((a, b) => toMin(a.start) - toMin(b.start))
  );
  const bookingCount = computed(() => dayBookings.value.length);
  const availableRoomCount = computed(() =>
    rooms.value.filter(room => room.id === 9 || !dayBookings.value.some(booking => booking.roomId === room.id)).length
  );
  const nextEnding = computed(() => {
    const ending = [...dayBookings.value].sort((a, b) => toMin(a.end) - toMin(b.end))[0];
    return ending ? `${getRoomName(rooms.value.find(room => room.id === ending.roomId))} · ${fmt(ending.end)}` : '—';
  });

  function clearBookings() {
    bookings.value = [];
  }

  function setRooms(rawRooms) {
    rooms.value = (rawRooms || []).map(room => ({
      ...room,
      name: getRoomName(room)
    }));
  }

  async function loadBookings() {
    if (!user.value) {
      clearBookings();
      return;
    }

    const data = await api(`/api/bookings?date=${encodeURIComponent(date.value)}`);
    bookings.value = data.bookings || [];
  }

  function handleResize(isLoggedIn) {
    if (!isLoggedIn.value) {
      viewMode.value = window.innerWidth <= 720 ? 'list' : 'timeline';
    }
  }

  async function bootstrap(authBootstrapUser, authOpenLogin) {
    dbStatus.kind = 'status-warn';
    dbStatus.text = '正在连接数据库...';

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
    authBootstrapUser(me.user || null);

    if (me.user) {
      await loadBookings();
    } else {
      authOpenLogin();
    }
  }

  return {
    date,
    rooms,
    bookings,
    viewMode,
    dbStatus,
    dayBookings,
    bookingCount,
    availableRoomCount,
    nextEnding,
    clearBookings,
    setRooms,
    loadBookings,
    handleResize,
    bootstrap
  };
}
