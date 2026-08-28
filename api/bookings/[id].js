const {
  ensureReady,
  pool,
  rooms,
  normalizeString,
  getUserFromRequest,
  readJson,
  sendJson,
  enforceHttps
} = require('../_lib');

function toBooking(row) {
  return {
    id: row.id,
    date: row.date,
    roomId: row.room_id,
    activity: row.activity || '',
    customer: row.customer || '',
    phone: row.phone,
    start: row.start_time,
    end: row.end_time,
    pax: row.pax,
    status: row.status
  };
}

module.exports = async function handler(req, res) {
  if (enforceHttps(req, res)) return;

  await ensureReady();
  const user = await getUserFromRequest(req, res);
  const url = new URL(req.url, 'http://localhost');
  const match = url.pathname.match(/\/api\/bookings\/(\d+)$/);
  const bookingId = Number(match && match[1]);

  if (!Number.isInteger(bookingId)) {
    sendJson(res, 400, { error: '无效的预约 ID。' });
    return;
  }
  if (!user) {
    sendJson(res, 401, { error: '请先登录。' });
    return;
  }

  if (req.method === 'GET') {
    const result = await pool.query(
      `SELECT id, date, room_id, activity, customer, phone, start_time, end_time, pax, status
       FROM bookings
       WHERE id = $1 AND user_id = $2`,
      [bookingId, user.id]
    );
    const booking = result.rows[0];
    if (!booking) {
      sendJson(res, 404, { error: '未找到预约。' });
      return;
    }
    sendJson(res, 200, { booking: toBooking(booking) });
    return;
  }

  if (req.method === 'PUT') {
    const currentRes = await pool.query(
      'SELECT id FROM bookings WHERE id = $1 AND user_id = $2',
      [bookingId, user.id]
    );
    if (currentRes.rowCount === 0) {
      sendJson(res, 404, { error: '未找到预约。' });
      return;
    }

    const body = await readJson(req);
    const date = normalizeString(body.date);
    const activity = normalizeString(body.activity);
    const customer = normalizeString(body.customer);
    const phone = normalizeString(body.phone);
    const start = normalizeString(body.start);
    const end = normalizeString(body.end);
    const roomId = Number(body.roomId);
    const pax = Number(body.pax);
    const status = body.status === 'pending' ? 'pending' : 'confirmed';

    if (!date || !phone || !start || !end || !Number.isInteger(roomId) || !Number.isFinite(pax)) {
      sendJson(res, 400, { error: '请完整填写预约信息。' });
      return;
    }
    if (end <= start) {
      sendJson(res, 400, { error: '结束时间必须晚于开始时间。' });
      return;
    }

    const room = rooms.find(item => item.id === roomId);
    if (!room) {
      sendJson(res, 400, { error: '请选择有效的包间。' });
      return;
    }
    if (pax > room.capacity) {
      sendJson(res, 400, { error: `${room.name} 最多可容纳 ${room.capacity} 人。` });
      return;
    }

    const conflict = await pool.query(
      `SELECT id
       FROM bookings
       WHERE user_id = $1 AND date = $2 AND room_id = $3 AND id <> $4
         AND NOT (end_time <= $5 OR start_time >= $6)
       LIMIT 1`,
      [user.id, date, roomId, bookingId, start, end]
    );
    if (conflict.rowCount > 0) {
      sendJson(res, 409, { error: '这个时间段已经有预约了。' });
      return;
    }

    await pool.query(
      `UPDATE bookings
       SET date = $1, room_id = $2, activity = $3, customer = $4, phone = $5,
           start_time = $6, end_time = $7, pax = $8, status = $9
       WHERE id = $10 AND user_id = $11`,
      [date, roomId, activity, customer, phone, start, end, pax, status, bookingId, user.id]
    );

    sendJson(res, 200, {
      booking: {
        id: bookingId,
        date,
        roomId,
        activity,
        customer,
        phone,
        start,
        end,
        pax,
        status
      }
    });
    return;
  }

  if (req.method === 'DELETE') {
    const deleted = await pool.query(
      'DELETE FROM bookings WHERE id = $1 AND user_id = $2',
      [bookingId, user.id]
    );
    if (deleted.rowCount === 0) {
      sendJson(res, 404, { error: '未找到预约。' });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'GET, PUT, DELETE' });
};
