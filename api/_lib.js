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
const SESSION_COOKIE_NAME = 'auth_token';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_RENEW_WINDOW_SECONDS = 60 * 60 * 24 * 7;

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

function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashSessionToken(token) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(String(token || '')).digest('hex');
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

function enforceHttps(req, res) {
  if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    return false;
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (forwardedProto !== 'http') {
    return false;
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = new URL(req.url, 'http://localhost');
  url.protocol = 'https:';
  if (host) {
    url.host = host;
  }

  res.statusCode = 308;
  res.setHeader('Location', url.toString());
  res.end();
  return true;
}

function setAuthCookie(res, token) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`
  ];
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
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
          deposit BOOLEAN NOT NULL DEFAULT FALSE,
          note TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          session_hash TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        )
      `);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS activity TEXT NOT NULL DEFAULT ''`);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit BOOLEAN NOT NULL DEFAULT FALSE`);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT ''`);
      await pool.query(`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at)`);
      await pool.query(`DELETE FROM sessions WHERE expires_at <= NOW()`);
      globalThis.__timetableInitPromise = initPromise;
    })();
  }
  await initPromise;
}

async function createSession(res, userId) {
  await ensureReady();
  const token = createSessionToken();
  const sessionHash = hashSessionToken(token);
  await pool.query(
    `INSERT INTO sessions (user_id, session_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'))`,
    [userId, sessionHash, SESSION_MAX_AGE_SECONDS]
  );
  setAuthCookie(res, token);
}

async function destroySession(req, res) {
  await ensureReady();
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE_NAME];
  if (token) {
    await pool.query('DELETE FROM sessions WHERE session_hash = $1', [hashSessionToken(token)]);
  }
  clearAuthCookie(res);
}

async function getUserFromRequest(req, res) {
  await ensureReady();
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;

  const sessionHash = hashSessionToken(token);
  const result = await pool.query(
    `SELECT s.id AS session_id, s.expires_at, u.id, u.username
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.session_hash = $1
     LIMIT 1`,
    [sessionHash]
  );
  const session = result.rows[0];
  if (!session) return null;

  const expiresAt = new Date(session.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [session.session_id]);
    if (res) clearAuthCookie(res);
    return null;
  }

  const renewThreshold = Date.now() + SESSION_RENEW_WINDOW_SECONDS * 1000;
  if (expiresAt.getTime() <= renewThreshold) {
    await pool.query(
      `UPDATE sessions
       SET last_seen_at = NOW(),
           expires_at = NOW() + ($2 * INTERVAL '1 second')
       WHERE id = $1`,
      [session.session_id, SESSION_MAX_AGE_SECONDS]
    );
    if (res) setAuthCookie(res, token);
  } else {
    await pool.query('UPDATE sessions SET last_seen_at = NOW() WHERE id = $1', [session.session_id]);
  }

  return { id: session.id, username: session.username };
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
  createSession,
  destroySession,
  parseCookies,
  readJson,
  sendJson,
  enforceHttps,
  setAuthCookie,
  clearAuthCookie,
  hashSessionToken,
  getUserFromRequest,
  getUserByUsername
};
