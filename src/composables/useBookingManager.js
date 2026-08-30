import { computed, reactive, ref } from 'vue';
import { api } from '../lib/api';
import { createBookingForm, parseWhatsappText, toMin } from '../utils/scheduler';

export function useBookingManager({ date, rooms, requireLogin, reloadBookings }) {
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
  const editingBookingId = ref(null);

  const isEditing = computed(() => !!editingBookingId.value);

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
    bookingForm.deposit = !!booking.deposit;
    bookingForm.note = booking.note || '';
    whatsappPaste.value = '';
    resetBookingMessage();
    resetParseMessage();
    bookingOpen.value = true;
  }

  function closeBooking() {
    bookingOpen.value = false;
    resetBookingForm();
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
      status: bookingForm.status,
      deposit: !!bookingForm.deposit,
      note: bookingForm.note.trim()
    };

    resetBookingMessage();

    try {
      if (!payload.phone || !payload.start || !payload.end || toMin(payload.end) <= toMin(payload.start)) {
        throw new Error('请填写有效的电话和时间范围。');
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
      await reloadBookings();
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
      await reloadBookings();
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
    if (typeof parsed.deposit === 'boolean') {
      bookingForm.deposit = parsed.deposit;
      if (parsed.deposit) {
        foundFields.push('定金已付');
      }
    }
    if (parsed.note) {
      bookingForm.note = parsed.note;
      foundFields.push('备注');
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

    if (date.value && parsed.date) {
      await reloadBookings();
    }
  }

  return {
    bookingOpen,
    bookingForm,
    bookingMessage,
    parseMessage,
    whatsappPaste,
    editingBookingId,
    isEditing,
    openNewBooking,
    openEditBooking,
    closeBooking,
    submitBooking,
    deleteBooking,
    applyWhatsappParse
  };
}
