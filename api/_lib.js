const crypto = require('node:crypto');
const { Pool } = require('pg');

const rooms = [
  { id: 1, name: '包间1', capacity: 5 },
  { id: 2, name: '包间2', capacity: 9 },
  { id: 3, name: '包间3', capacity: 9 },
  { id: 4, name: '包间4', capacity: 5 },
  { id: 5, name: '包间5', capacity: 5 },
  { id: 6, name: '包间6', capacity: 5 },
  { id: 7, name: '包间7', capacity: 9 },
  { id: 8, name: '包间8', capacity: 9 },
  { id: 9, name: '公共区域', capacity: 999 }
];

const AUTH_SECRET = process.env.AUTH_SECRET || 'timetable-management-secret';
const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

let pool = globalThis.__timetablePool;
if (!pool) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.VERCEL ? { rejectUnauthorized: false } : undefined
  });
  globalThis.__timetablePool = pool;
}

let initPromise = globalThis.__timetableInitPromise || null;

function normalizeString(input) {
  return String(input || '').trim();
}

function normalizeUsername(input) {
  return normalizeString(input);
}

function normalizePassword(input) {
  return String(input || '');
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

function sendJson(res, statusCode, body, extraHeaders = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(body));
}

function setAuthCookie(res, token) {
  const parts = [
    `auth_token=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 30}`
  ];
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
  const parts = [
    'auth_token=',
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

async function ensureReady() {
  if (!DATABASE_URL) {
    throw new Error('Missing POSTGRES_URL or DATABASE_URL environment variable.');
  }
  if (!initPromise) {
    initPromise = (async () => {
      await pool.query(`SET TIME ZONE 'Asia/Shanghai'`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          room_id INTEGER NOT NULL,
          activity TEXT NOT NULL DEFAULT '',
          customer TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          pax INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS activity TEXT NOT NULL DEFAULT ''`);
      globalThis.__timetableInitPromise = initPromise;
    })();
  }
  await initPromise;
}

async function getUserFromRequest(req) {
  await ensureReady();
  const cookies = parseCookies(req.headers.cookie || '');
  const payload = verifyToken(cookies.auth_token);
  if (!payload) return null;
  const result = await pool.query('SELECT id, username FROM users WHERE id = $1', [payload.uid]);
  return result.rows[0] || null;
}

async function getUserByUsername(username) {
  await ensureReady();
  const result = await pool.query(
    'SELECT id, username, password_salt, password_hash FROM users WHERE username = $1',
    [username]
  );
  return result.rows[0] || null;
}

module.exports = {
  pool,
  rooms,
  ensureReady,
  normalizeString,
  normalizeUsername,
  normalizePassword,
  hashPassword,
  createToken,
  parseCookies,
  readJson,
  sendJson,
  setAuthCookie,
  clearAuthCookie,
  getUserFromRequest,
  getUserByUsername
};
