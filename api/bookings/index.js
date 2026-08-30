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
    status: row.status,
    deposit: !!row.deposit,
    note: row.note || ''
  };
}

module.exports = async function handler(req, res) {
  if (enforceHttps(req, res)) return;

  await ensureReady();
  const user = await getUserFromRequest(req, res);

  if (req.method === 'GET') {
    if (!user) {
      sendJson(res, 401, { error: '请先登录。' });
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const date = normalizeString(url.searchParams.get('date'));
    if (!date) {
      sendJson(res, 400, { error: '缺少 date 参数。' });
      return;
    }

    const result = await pool.query(
      `SELECT id, date, room_id, activity, customer, phone, start_time, end_time, pax, status, deposit, note
       FROM bookings
       WHERE user_id = $1 AND date = $2
       ORDER BY start_time, room_id, id`,
      [user.id, date]
    );
    sendJson(res, 200, { bookings: result.rows.map(toBooking) });
    return;
  }

  if (req.method === 'POST') {
    if (!user) {
      sendJson(res, 401, { error: '请先登录。' });
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
    const deposit = !!body.deposit;
    const note = normalizeString(body.note);

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
       WHERE user_id = $1 AND date = $2 AND room_id = $3
         AND NOT (end_time <= $4 OR start_time >= $5)
       LIMIT 1`,
      [user.id, date, roomId, start, end]
    );
    if (conflict.rowCount > 0) {
      sendJson(res, 409, { error: '这个时间段已经有预约了。' });
      return;
    }

    const inserted = await pool.query(
      `INSERT INTO bookings
         (user_id, date, room_id, activity, customer, phone, start_time, end_time, pax, status, deposit, note)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [user.id, date, roomId, activity, customer, phone, start, end, pax, status, deposit, note]
    );

    sendJson(res, 200, {
      booking: {
        id: inserted.rows[0].id,
        date,
        roomId,
        activity,
        customer,
        phone,
        start,
        end,
        pax,
        status,
        deposit,
        note
      }
    });
    return;
  }

  sendJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'GET, POST' });
};
