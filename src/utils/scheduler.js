export const HOURS = Array.from({ length: 12 }, (_, index) => 12 + index);

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
  return room?.id === 9 ? name : `${name} · ${room.capacity} 人房`;
}

export function roomSecondaryLabel(room) {
  if (!room) return '';
  return room.id === 9 ? '开放座位区' : `${room.capacity} 人房`;
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
    status: 'confirmed',
    deposit: false,
    note: ''
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
    .replace(/&#x20;/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[，、]/g, ',')
    .replace(/[：]/g, ':')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function extractLabeledValue(text, label) {
  const patterns = [
    new RegExp(`${label}\\s*:\\s*([^\\n]+)`, 'i'),
    new RegExp(`${label}\\s*：\\s*([^\\n]+)`, 'i')
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return '';
}

function extractAnyLabeledValue(text, labels) {
  for (const label of labels) {
    const value = extractLabeledValue(text, label);
    if (value) return value;
  }
  return '';
}

function findLineContaining(text, pattern) {
  const lines = String(text || '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);

  return lines.find(line => pattern.test(line)) || '';
}

function parseDateText(raw) {
  const value = String(raw || '').replace(/\s+/g, '');
  if (!value) return '';

  const match =
    value.match(/^(\d{1,4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,4})$/) ||
    value.match(/^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})$/);
  if (!match) return '';

  const a = Number(match[1]);
  const b = Number(match[2]);
  const c = Number(match[3]);

  let year;
  let month;
  let day;

  if (String(match[1]).length === 4) {
    year = a;
    month = b;
    day = c;
  } else if (String(match[3]).length === 4) {
    year = c;
    if (a > 12) {
      day = a;
      month = b;
    } else {
      month = a;
      day = b;
    }
  } else {
    year = 2000 + c;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
  }

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
  const match = value.match(/(\d+(?:\.\d+)?)(?:小时|hrs?|hours?|h)/);
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
    return { start: '12:00', end: '23:00', note: '已识别为不限时，默认填入 12:00 - 23:00。' };
  }

  const rangeMatch = normalized.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|~|至|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (rangeMatch) {
    const start = parseClockText(rangeMatch[1]);
    const end = parseClockText(rangeMatch[2]);
    return { start, end, note: '' };
  }

  const start = parseClockText(normalized);
  if (!start) return { start: '', end: '', note: '' };

  if (durationInfo?.type === 'unlimited') {
    return { start, end: '23:00', note: '已识别为不限时，默认填入 23:00 结束。' };
  }

  if (durationInfo?.type === 'fixed' && Number.isFinite(durationInfo.minutes)) {
    return { start, end: addMinutes(start, durationInfo.minutes), note: '' };
  }

  return { start, end: '', note: '' };
}

export function parseWhatsappText(text) {
  const normalized = normalizePasteText(text);

  const activity = extractAnyLabeledValue(normalized, ['游玩项目', 'activity']);
  const date = parseDateText(extractAnyLabeledValue(normalized, ['预约日期', 'preferred date', 'visit date', 'date']));
  const customer = extractAnyLabeledValue(normalized, ['称呼', 'name', 'customer']);
  const phone = extractAnyLabeledValue(normalized, ['电话号码', 'phone', 'mobile', 'contact']);
  const paxRaw = extractAnyLabeledValue(normalized, ['人数', 'group size', 'group', 'people', 'pax', 'guests']);
  const durationRaw = extractAnyLabeledValue(normalized, ['套餐', '时长', 'duration']);
  const durationInfo = parseDurationText(durationRaw);
  const timeInfo = parseAppointmentTime(
    extractAnyLabeledValue(normalized, ['预约时间', 'preferred time', 'visit time', 'time']),
    durationInfo
  );
  const paxMatch = String(paxRaw || '').match(/(\d+)/);
  const explicitNote = extractAnyLabeledValue(normalized, ['备注', 'note', 'notes']);
  const visitType = extractAnyLabeledValue(normalized, ['visit type', 'type']);
  const depositLine = findLineContaining(normalized, /deposit/i);
  const deposit = /deposit/i.test(normalized) && /(paid|received|done|settled|已付|已繳|已缴)/i.test(normalized);

  const noteParts = [];
  if (explicitNote) noteParts.push(explicitNote);
  if (visitType) noteParts.push(`Visit type: ${visitType}`);
  if (deposit && depositLine) noteParts.push(depositLine);
  else if (deposit) noteParts.push('Deposit paid');

  const result = {
    activity,
    date,
    customer,
    phone,
    pax: paxMatch ? Number(paxMatch[1]) : '',
    start: timeInfo.start,
    end: timeInfo.end,
    note: noteParts.join(' | '),
    deposit,
    notes: [],
    missing: []
  };

  if (timeInfo.note) result.notes.push(timeInfo.note);
  if (visitType) result.notes.push(`Visit type: ${visitType}`);
  if (depositLine) result.notes.push(depositLine);
  if (!result.activity) result.missing.push('activity / 游玩项目');
  if (!result.date) result.missing.push('preferred date / 预约日期');
  if (!result.pax) result.missing.push('group size / 人数');
  if (!result.start) result.missing.push('preferred time / 预约时间');
  if (!result.end) result.missing.push('end time / 结束时间');
  if (!result.phone) result.missing.push('phone / 电话号码');

  return result;
}
