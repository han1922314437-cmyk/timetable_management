<script setup>
import { computed } from 'vue';
import { HOURS, fmt, getRoomName, roomSecondaryLabel, statusLabel, toMin } from '../utils/scheduler';

const props = defineProps({
  rooms: {
    type: Array,
    default: () => []
  },
  bookings: {
    type: Array,
    default: () => []
  },
  viewMode: {
    type: String,
    default: 'timeline'
  }
});

const emit = defineEmits(['update:viewMode', 'edit']);

const timelineStart = 13 * 60;
const totalMinutes = 11 * 60;

const roomsWithBookings = computed(() =>
  props.rooms.map(room => ({
    ...room,
    displayName: getRoomName(room),
    secondary: roomSecondaryLabel(room),
    bookings: props.bookings.filter(booking => booking.roomId === room.id).sort((a, b) => toMin(a.start) - toMin(b.start))
  }))
);

function bookingStyle(booking) {
  const left = ((toMin(booking.start) - timelineStart) / totalMinutes) * 100;
  const width = ((toMin(booking.end) - toMin(booking.start)) / totalMinutes) * 100;
  return {
    left: `${left}%`,
    width: `${width}%`
  };
}

function bookingPhone(booking) {
  return booking.phone || booking.customer || '未填写';
}
</script>

<template>
  <div class="timeline-card">
    <div class="timeline-head">
      <div class="view-switch" role="tablist" aria-label="视图切换">
        <button type="button" class="btn" :class="{ active: viewMode === 'timeline' }" @click="emit('update:viewMode', 'timeline')">时间轴</button>
        <button type="button" class="btn" :class="{ active: viewMode === 'list' }" @click="emit('update:viewMode', 'list')">列表</button>
      </div>

      <div class="legend">
        <span><i class="dot confirmed-dot"></i>已确认</span>
        <span><i class="dot pending-dot"></i>待确认</span>
      </div>
    </div>

    <div v-if="viewMode === 'list'" class="list-view">
      <section v-for="room in roomsWithBookings" :key="room.id" class="list-room">
        <div class="list-room-head">
          <div>
            <b>{{ room.displayName }}</b>
            <span>{{ room.secondary }}</span>
          </div>
          <span>{{ room.bookings.length ? `${room.bookings.length} 条预约` : '空闲' }}</span>
        </div>

        <div v-if="room.bookings.length" class="list-bookings">
          <button v-for="booking in room.bookings" :key="booking.id" type="button" :class="['list-booking', booking.status]" @click="emit('edit', booking)">
            <strong>{{ bookingPhone(booking) }}</strong>
            <span>{{ fmt(booking.start) }} - {{ fmt(booking.end) }} · {{ statusLabel(booking.status) }}<template v-if="booking.activity"> · {{ booking.activity }}</template></span>
          </button>
        </div>

        <div v-else class="list-empty">暂无预约</div>
      </section>
    </div>

    <div v-else class="scroll">
      <div class="timeline">
        <div class="grid-row grid-header-row">
          <div class="room-label"><b>区域</b></div>
          <div class="time-head">
            <div v-for="hour in HOURS" :key="hour">{{ String(hour).padStart(2, '0') }}:00</div>
          </div>
        </div>

        <div v-for="room in roomsWithBookings" :key="room.id" class="grid-row">
          <div class="room-label">
            <b>{{ room.displayName }}</b>
            <span v-if="room.id !== 9">{{ room.capacity }} 人</span>
          </div>

          <div class="track">
            <button
              v-for="booking in room.bookings"
              :key="booking.id"
              type="button"
              :class="['booking', booking.status]"
              :style="bookingStyle(booking)"
              :title="`${bookingPhone(booking)} · ${fmt(booking.start)} - ${fmt(booking.end)} · ${booking.pax} 人`"
              @click="emit('edit', booking)"
            >
              <strong>{{ bookingPhone(booking) }}</strong>
              <span>{{ fmt(booking.start) }} - {{ fmt(booking.end) }} · {{ statusLabel(booking.status) }}<template v-if="booking.activity"> · {{ booking.activity }}</template></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
