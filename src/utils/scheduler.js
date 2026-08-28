export const HOURS = Array.from({ length: 11 }, (_, index) => 13 + index);

export function todayIso() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

export function toMin(time) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return hour * 60 + minute;
}

export function fmt(time) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function overlap(a, b, c, d) {
  return toMin(a) < toMin(d) && toMin(b) > toMin(c);
}

export function statusLabel(status) {
  return ({ confirmed: '已确认', pending: '待确认' })[status] || status;
}

export function getRoomName(room) {
  if (!room) return '';
  if (room.id === 9) return '公共区域';
  return `包间${room.id}`;
}

export function roomCapacityLabel(room) {
  const name = getRoomName(room);
  return room?.id === 9 ? name : `${name} · ${room.capacity} 人`;
}

export function roomSecondaryLabel(room) {
  if (!room) return '';
  return room.id === 9 ? '开放座位' : `${room.capacity} 人房`;
}

export function createBookingForm() {
  return {
    customer: '',
    activity: '',
    phone: '',
    start: '15:00',
    end: '18:00',
    pax: 6,
    roomId: '',
    status: 'confirmed'
  };
}

export function createFindForm() {
  return {
    start: '15:00',
    end: '19:00',
    pax: 6
  };
}

function normalizePasteText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/：/g, ':')
    .replace(/[　]/g, ' ')
    .trim();
}

function extractLabeledValue(text, label) {
  const patterns = [
    new RegExp(`${label}\\s*:\\s*([^\\n]+)`, 'i'),
    new RegExp(`${label}\\s*[:：]\\s*([^\\n]+)`, 'i')
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

function parseDateText(raw) {
  const value = String(raw || '').replace(/\s+/g, '');
  if (!value) return '';
  const match = value.match(/(?:(\d{4})[\/.\-年])?(\d{1,2})[\/.\-月](\d{1,2})/);
  if (!match) return '';
  const year = match[1] ? Number(match[1]) : new Date().getFullYear();
  const first = Number(match[2]);
  const second = Number(match[3]);
  const month = first > 12 ? second : second;
  const day = first > 12 ? first : first;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return date.toISOString().slice(0, 10);
}

function parseClockText(raw) {
  let value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  let hasPmPrefix = false;

  if (/^(下午|晚上|中午)/.test(value)) {
    hasPmPrefix = true;
    value = value.replace(/^(下午|晚上|中午)\s*/, '');
  } else if (/^上午/.test(value)) {
    value = value.replace(/^上午\s*/, '');
  }

  const direct = value.match(/^(\d{1,2})(?:[:点时](\d{2}))?\s*(am|pm)?$/i);
  if (!direct) return '';

  let hour = Number(direct[1]);
  const minute = Number(direct[2] || 0);
  const suffix = direct[3] || (hasPmPrefix ? 'pm' : '');

  if (suffix) {
    if (hour === 12) hour = suffix === 'am' ? 0 : 12;
    else if (suffix === 'pm') hour += 12;
  }

  if (hour > 23 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function addMinutes(time, minutes) {
  const [hour, minute] = time.split(':').map(Number);
  const total = hour * 60 + minute + minutes;
  const safe = Math.min(total, 23 * 60);
  const hh = Math.floor(safe / 60);
  const mm = safe % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function parseDurationText(raw) {
  const value = String(raw || '').replace(/\s+/g, '').toLowerCase();
  if (!value) return null;
  if (value.includes('无限') || value.includes('unlimited') || value.includes('不限')) {
    return { type: 'unlimited', minutes: null };
  }
  const match = value.match(/(\d+(?:\.\d+)?)小时/);
  if (!match) return null;
  const hours = Number(match[1]);
  if (!Number.isFinite(hours)) return null;
  return { type: 'fixed', minutes: Math.round(hours * 60) };
}

function parseAppointmentTime(text, durationInfo) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return { start: '', end: '', note: '' };

  const lower = normalized.toLowerCase();
  if (lower.includes('unlimited') || lower.includes('无限') || lower.includes('不限')) {
    return { start: '13:00', end: '23:00', note: '已识别为无限时，默认填入 13:00 - 23:00。' };
  }

  const rangeMatch = normalized.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|~|至|到)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (rangeMatch) {
    const start = parseClockText(rangeMatch[1]);
    const end = parseClockText(rangeMatch[2]);
    return { start, end, note: '' };
  }

  const start = parseClockText(normalized);
  if (!start) return { start: '', end: '', note: '' };

  if (durationInfo?.type === 'unlimited') {
    return { start, end: '23:00', note: '已识别为无限时，默认填入 23:00 结束。' };
  }

  if (durationInfo?.type === 'fixed' && Number.isFinite(durationInfo.minutes)) {
    return { start, end: addMinutes(start, durationInfo.minutes), note: '' };
  }

  return { start, end: '', note: '' };
}

export function parseWhatsappText(text) {
  const normalized = normalizePasteText(text);
  const paxRaw = extractLabeledValue(normalized, '人数');
  const durationRaw = extractLabeledValue(normalized, '套餐') || extractLabeledValue(normalized, '时长');
  const durationInfo = parseDurationText(durationRaw);
  const timeInfo = parseAppointmentTime(extractLabeledValue(normalized, '预约时间'), durationInfo);
  const paxMatch = String(paxRaw || '').match(/(\d+)/);

  const result = {
    activity: extractLabeledValue(normalized, '游玩项目'),
    date: parseDateText(extractLabeledValue(normalized, '预约日期')),
    customer: extractLabeledValue(normalized, '称呼'),
    phone: extractLabeledValue(normalized, '电话号码'),
    pax: paxMatch ? Number(paxMatch[1]) : '',
    start: timeInfo.start,
    end: timeInfo.end,
    notes: [],
    missing: []
  };

  if (timeInfo.note) result.notes.push(timeInfo.note);
  if (!result.activity) result.missing.push('游玩项目');
  if (!result.date) result.missing.push('预约日期');
  if (!result.pax) result.missing.push('人数');
  if (!result.start) result.missing.push('预约时间');
  if (!result.end) result.missing.push('结束时间');
  if (!result.phone) result.missing.push('电话号码');

  return result;
}
