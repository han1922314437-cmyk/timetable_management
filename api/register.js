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
  sendJson
} = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
    return;
  }

  await ensureReady();

  try {
    const body = await readJson(req);
    const username = normalizeUsername(body.username);
    const password = normalizePassword(body.password);

    if (username.length < 3 || password.length < 6) {
      sendJson(res, 400, { error: '用户名至少 3 个字符，密码至少 6 个字符。' });
      return;
    }

    const exists = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (exists.rowCount > 0) {
      sendJson(res, 409, { error: '这个用户名已经被注册了。' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const inserted = await pool.query(
      'INSERT INTO users (username, password_salt, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [username, salt, passwordHash]
    );

    const user = { id: inserted.rows[0].id, username };
    setAuthCookie(res, createToken(user));
    sendJson(res, 200, { user });
  } catch (error) {
    sendJson(res, 500, { error: error.message || '服务器错误' });
  }
};
