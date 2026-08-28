const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const HTML_FILE = path.join(ROOT, 'board_game_scheduler_macaron.html');
const DB_FILE = path.join(ROOT, 'scheduler.sqlite');
const AUTH_SECRET = process.env.AUTH_SECRET || 'timetable-management-local-secret';

const rooms = [
  { id: 1, name: '包间 1', capacity: 5 },
  { id: 2, name: '包间 2', capacity: 9 },
  { id: 3, name: '包间 3', capacity: 9 },
  { id: 4, name: '包间 4', capacity: 5 },
  { id: 5, name: '包间 5', capacity: 5 },
  { id: 6, name: '包间 6', capacity: 5 },
  { id: 7, name: '包间 7', capacity: 9 },
  { id: 8, name: '包间 8', capacity: 9 },
  { id: 9, name: '公共区', capacity: 9 }
];

const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    room_id INTEGER NOT NULL,
    activity TEXT NOT NULL DEFAULT '',
    customer TEXT NOT NULL,
    phone TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    pax INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const bookingColumns = db.prepare("PRAGMA table_info(bookings)").all().map(row => row.name);
if (!bookingColumns.includes('activity')) {
  db.exec("ALTER TABLE bookings ADD COLUMN activity TEXT NOT NULL DEFAULT ''");
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createToken(user) {
  const payload = {
    uid: user.id,
    username: user.username,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  };
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadPart).digest('base64url');
  return `${payloadPart}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payloadPart, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payloadPart).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index === -1) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  res.end(JSON.stringify(body));
}

function serveHtml(res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(HTML_FILE).pipe(res);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('JSON 格式无效'));
      }
    });
    req.on('error', reject);
  });
}

function getUserFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.auth_token;
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(payload.uid);
  return user || null;
}

function getUserByUsername(username) {
  return db.prepare('SELECT id, username, password_salt, password_hash FROM users WHERE username = ?').get(username);
}

const getBookingsByDate = db.prepare(`
  SELECT id, date, room_id AS roomId, activity, customer, phone, start_time AS start, end_time AS end, pax, status
  FROM bookings
  WHERE user_id = ? AND date = ?
  ORDER BY start_time, room_id, id
`);

const insertBooking = db.prepare(`
  INSERT INTO bookings
    (user_id, date, room_id, activity, customer, phone, start_time, end_time, pax, status)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getBookingById = db.prepare(`
  SELECT id, date, room_id AS roomId, activity, customer, phone, start_time AS start, end_time AS end, pax, status
  FROM bookings
  WHERE id = ? AND user_id = ?
`);

const conflictCheck = db.prepare(`
  SELECT id
  FROM bookings
  WHERE user_id = ? AND date = ? AND room_id = ? AND NOT (end_time <= ? OR start_time >= ?)
  LIMIT 1
`);

const conflictCheckExcludeId = db.prepare(`
  SELECT id
  FROM bookings
  WHERE user_id = ? AND date = ? AND room_id = ? AND id != ? AND NOT (end_time <= ? OR start_time >= ?)
  LIMIT 1
`);

const updateBooking = db.prepare(`
  UPDATE bookings
  SET date = ?, room_id = ?, activity = ?, customer = ?, phone = ?, start_time = ?, end_time = ?, pax = ?, status = ?
  WHERE id = ? AND user_id = ?
`);

const deleteBooking = db.prepare(`
  DELETE FROM bookings
  WHERE id = ? AND user_id = ?
`);

const insertUser = db.prepare(`
  INSERT INTO users (username, password_salt, password_hash)
  VALUES (?, ?, ?)
`);

function jsonResponse(res, statusCode, body, extraHeaders = {}) {
  send(res, statusCode, body, extraHeaders);
}

function setAuthCookie(res, token) {
  const cookie = `auth_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
  res.setHeader('Set-Cookie', cookie);
}

function clearAuthCookie(res) {
  const cookie = 'auth_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';
  res.setHeader('Set-Cookie', cookie);
}

function normalizeUsername(input) {
  return String(input || '').trim();
}

function normalizePassword(input) {
  return String(input || '');
}

function normalizeString(input) {
  return String(input || '').trim();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const method = req.method || 'GET';

  try {
    if (method === 'GET' && url.pathname === '/') {
      serveHtml(res);
      return;
    }

    if (method === 'GET' && url.pathname === '/board_game_scheduler_macaron.html') {
      serveHtml(res);
      return;
    }

    if (method === 'GET' && url.pathname === '/api/rooms') {
      jsonResponse(res, 200, { rooms });
      return;
    }

    if (method === 'GET' && url.pathname === '/api/me') {
      const user = getUserFromRequest(req);
      jsonResponse(res, 200, { user });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/register') {
      const body = await readJson(req);
      const username = normalizeUsername(body.username);
      const password = normalizePassword(body.password);

      if (username.length < 3 || password.length < 6) {
        jsonResponse(res, 400, { error: '用户名至少 3 个字符，密码至少 6 个字符。' });
        return;
      }
      if (getUserByUsername(username)) {
        jsonResponse(res, 409, { error: '这个用户名已经被注册了。' });
        return;
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      const info = insertUser.run(username, salt, passwordHash);
      const user = { id: Number(info.lastInsertRowid), username };
      const token = createToken(user);
      setAuthCookie(res, token);
      jsonResponse(res, 200, { user });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/login') {
      const body = await readJson(req);
      const username = normalizeUsername(body.username);
      const password = normalizePassword(body.password);
      const userRow = getUserByUsername(username);

      if (!userRow) {
        jsonResponse(res, 401, { error: '用户名或密码错误。' });
        return;
      }

      const candidate = hashPassword(password, userRow.password_salt);
      const stored = Buffer.from(userRow.password_hash);
      const input = Buffer.from(candidate);
      if (stored.length !== input.length || !crypto.timingSafeEqual(stored, input)) {
        jsonResponse(res, 401, { error: '用户名或密码错误。' });
        return;
      }

      const user = { id: userRow.id, username: userRow.username };
      const token = createToken(user);
      setAuthCookie(res, token);
      jsonResponse(res, 200, { user });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/logout') {
      clearAuthCookie(res);
      jsonResponse(res, 200, { ok: true });
      return;
    }

    const user = getUserFromRequest(req);

    if (method === 'GET' && url.pathname === '/api/bookings') {
      if (!user) {
        jsonResponse(res, 401, { error: '请先登录。' });
        return;
      }
      const date = normalizeString(url.searchParams.get('date'));
      if (!date) {
        jsonResponse(res, 400, { error: '缺少 date 参数。' });
        return;
      }
      const bookings = getBookingsByDate.all(user.id, date);
      jsonResponse(res, 200, { bookings });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/bookings') {
      if (!user) {
        jsonResponse(res, 401, { error: '请先登录。' });
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
        jsonResponse(res, 400, { error: '请完整填写预约信息。' });
        return;
      }
      if (end <= start) {
        jsonResponse(res, 400, { error: '结束时间必须晚于开始时间。' });
        return;
      }

      const room = rooms.find(r => r.id === roomId);
      if (!room) {
        jsonResponse(res, 400, { error: '请选择有效的包间。' });
        return;
      }
      if (pax > room.capacity) {
        jsonResponse(res, 400, { error: `${room.name} 最多可容纳 ${room.capacity} 人。` });
        return;
      }

      const conflict = conflictCheck.get(user.id, date, roomId, start, end);
      if (conflict) {
        jsonResponse(res, 409, { error: '这个时间段已经有预约了。' });
        return;
      }

      const info = insertBooking.run(user.id, date, roomId, activity, customer, phone, start, end, pax, status);
      jsonResponse(res, 200, {
        booking: {
          id: Number(info.lastInsertRowid),
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

    const bookingMatch = url.pathname.match(/^\/api\/bookings\/(\d+)$/);
    if (bookingMatch && method === 'GET') {
      if (!user) {
        jsonResponse(res, 401, { error: '请先登录。' });
        return;
      }
      const booking = getBookingById.get(Number(bookingMatch[1]), user.id);
      if (!booking) {
        jsonResponse(res, 404, { error: '未找到预约。' });
        return;
      }
      jsonResponse(res, 200, { booking });
      return;
    }

    if (bookingMatch && method === 'PUT') {
      if (!user) {
        jsonResponse(res, 401, { error: '请先登录。' });
        return;
      }

      const bookingId = Number(bookingMatch[1]);
      const current = getBookingById.get(bookingId, user.id);
      if (!current) {
        jsonResponse(res, 404, { error: '未找到预约。' });
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
        jsonResponse(res, 400, { error: '请完整填写预约信息。' });
        return;
      }
      if (end <= start) {
        jsonResponse(res, 400, { error: '结束时间必须晚于开始时间。' });
        return;
      }

      const room = rooms.find(r => r.id === roomId);
      if (!room) {
        jsonResponse(res, 400, { error: '请选择有效的包间。' });
        return;
      }
      if (pax > room.capacity) {
        jsonResponse(res, 400, { error: `${room.name} 最多可容纳 ${room.capacity} 人。` });
        return;
      }

      const conflict = conflictCheckExcludeId.get(user.id, date, roomId, bookingId, start, end);
      if (conflict) {
        jsonResponse(res, 409, { error: '这个时间段已经有预约了。' });
        return;
      }

      updateBooking.run(date, roomId, activity, customer, phone, start, end, pax, status, bookingId, user.id);
      jsonResponse(res, 200, {
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

    if (bookingMatch && method === 'DELETE') {
      if (!user) {
        jsonResponse(res, 401, { error: '请先登录。' });
        return;
      }
      const bookingId = Number(bookingMatch[1]);
      const info = deleteBooking.run(bookingId, user.id);
      if (info.changes === 0) {
        jsonResponse(res, 404, { error: '未找到预约。' });
        return;
      }
      jsonResponse(res, 200, { ok: true });
      return;
    }

    jsonResponse(res, 404, { error: '未找到接口。' });
  } catch (error) {
    console.error(error);
    jsonResponse(res, 500, { error: error.message || '服务器错误。' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`服务已启动: http://${HOST}:${PORT}`);
});
