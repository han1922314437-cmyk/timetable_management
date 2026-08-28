const crypto = require('node:crypto');
const {
  ensureReady,
  pool,
  normalizeUsername,
  normalizePassword,
  hashPassword,
  createToken,
  setAuthCookie,
  readJson,
  sendJson,
  enforceHttps
} = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
    return;
  }

  if (enforceHttps(req, res)) return;

  await ensureReady();

  try {
    const body = await readJson(req);
    const username = normalizeUsername(body.username);
    const password = normalizePassword(body.password);

    const result = await pool.query(
      'SELECT id, username, password_salt, password_hash FROM users WHERE username = $1',
      [username]
    );
    const userRow = result.rows[0];
    if (!userRow) {
      sendJson(res, 401, { error: '用户名或密码错误。' });
      return;
    }

    const candidate = hashPassword(password, userRow.password_salt);
    const stored = Buffer.from(userRow.password_hash);
    const input = Buffer.from(candidate);
    if (stored.length !== input.length || !crypto.timingSafeEqual(stored, input)) {
      sendJson(res, 401, { error: '用户名或密码错误。' });
      return;
    }

    const user = { id: userRow.id, username: userRow.username };
    setAuthCookie(res, createToken(user));
    sendJson(res, 200, { user });
  } catch (error) {
    sendJson(res, 500, { error: error.message || '服务器错误' });
  }
};
