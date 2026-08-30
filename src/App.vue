<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import DashboardHeader from './components/DashboardHeader.vue';
import AppWorkspace from './components/AppWorkspace.vue';
import AppDialogs from './components/AppDialogs.vue';
import { useAppState } from './composables/useAppState';
import { useAuth } from './composables/useAuth';
import { useBookingManager } from './composables/useBookingManager';
import { useRoomSearch } from './composables/useRoomSearch';

const user = ref(null);

const appState = useAppState({ user });
const auth = useAuth({
  user,
  reloadBookings: appState.loadBookings,
  clearBookings: appState.clearBookings
});

const bookingManager = useBookingManager({
  date: appState.date,
  rooms: appState.rooms,
  requireLogin: auth.requireLogin,
  reloadBookings: appState.loadBookings
});

const roomSearch = useRoomSearch({
  rooms: appState.rooms,
  dayBookings: appState.dayBookings,
  requireLogin: auth.requireLogin
});

const {
  date,
  rooms,
  viewMode,
  dbStatus,
  dayBookings,
  bookingCount,
  availableRoomCount,
  nextEnding,
  loadBookings,
  handleResize,
  bootstrap
} = appState;

const {
  isLoggedIn,
  authOpen,
  authMode,
  authSubmitting,
  authForm,
  authMessage,
  openAuth,
  submitAuth,
  logout,
  bootstrapUser
} = auth;

const {
  bookingOpen,
  bookingForm,
  bookingMessage,
  parseMessage,
  whatsappPaste,
  isEditing,
  openNewBooking,
  openEditBooking,
  closeBooking,
  submitBooking,
  deleteBooking,
  applyWhatsappParse
} = bookingManager;

const {
  findOpen,
  findForm,
  findResults,
  findMessage,
  openFindRoom,
  clearFindResults,
  searchAvailableRooms
} = roomSearch;

function onWindowResize() {
  handleResize(isLoggedIn);
}

watch(date, async () => {
  if (user.value) {
    await loadBookings();
  }
});

watch(user, nextUser => {
  if (!nextUser) {
    clearFindResults();
    if (!authOpen.value) {
      openAuth('login');
    }
  }
});

onMounted(() => {
  window.addEventListener('resize', onWindowResize);
  bootstrap(bootstrapUser, () => openAuth('login')).catch(error => {
    console.error(error);
    dbStatus.kind = 'status-error';
    dbStatus.text = error.message || '初始化失败';
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
});
</script>

<template>
  <div class="app-shell">
    <div class="app">
      <DashboardHeader
        :date="date"
        :status-kind="dbStatus.kind"
        :status-text="dbStatus.text"
        :is-logged-in="isLoggedIn"
        :username="user?.username || ''"
        :booking-count="String(bookingCount)"
        :available-room-count="String(availableRoomCount)"
        :next-ending="nextEnding"
        @update:date="date = $event"
        @login="openAuth('login')"
        @register="openAuth('register')"
        @logout="logout"
        @find-room="openFindRoom"
        @new-booking="openNewBooking"
      />

      <AppWorkspace
        :is-logged-in="isLoggedIn"
        :rooms="rooms"
        :day-bookings="dayBookings"
        :view-mode="viewMode"
        @update:view-mode="viewMode = $event"
        @edit="openEditBooking"
      />
    </div>

    <AppDialogs
      :auth-open="authOpen"
      :auth-mode="authMode"
      :auth-form="authForm"
      :auth-message="authMessage"
      :auth-submitting="authSubmitting"
      :booking-open="bookingOpen"
      :rooms="rooms"
      :booking-form="bookingForm"
      :whatsapp-paste="whatsappPaste"
      :parse-message="parseMessage"
      :booking-message="bookingMessage"
      :editing-booking="isEditing"
      :find-open="findOpen"
      :find-form="findForm"
      :find-results="findResults"
      :find-message="findMessage"
      @update:auth-open="authOpen = $event"
      @update:auth-mode="authMode = $event"
      @submit-auth="submitAuth"
      @update:booking-open="value => (value ? (bookingOpen = true) : closeBooking())"
      @update:whatsapp-paste="whatsappPaste = $event"
      @submit-booking="submitBooking"
      @delete-booking="deleteBooking"
      @parse-booking="applyWhatsappParse"
      @update:find-open="findOpen = $event"
      @submit-find="searchAvailableRooms"
    />
  </div>
</template>
