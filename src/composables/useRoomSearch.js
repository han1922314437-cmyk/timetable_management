import { reactive, ref } from 'vue';
import { createFindForm, overlap, toMin } from '../utils/scheduler';

export function useRoomSearch({ rooms, dayBookings, requireLogin }) {
  const findOpen = ref(false);
  const findForm = reactive(createFindForm());
  const findResults = ref([]);
  const findMessage = ref('');

  function openFindRoom() {
    if (!requireLogin()) return;
    findOpen.value = true;
    findResults.value = [];
    findMessage.value = '';
  }

  function clearFindResults() {
    findResults.value = [];
    findMessage.value = '';
  }

  async function searchAvailableRooms() {
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

  return {
    findOpen,
    findForm,
    findResults,
    findMessage,
    openFindRoom,
    clearFindResults,
    searchAvailableRooms
  };
}
