const { ensureReady, pool, sendJson } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
    return;
  }

  try {
    await ensureReady();
    await pool.query('SELECT 1');
    sendJson(res, 200, { ok: true, message: '数据库：已连接 Supabase' });
  } catch (error) {
    sendJson(res, 503, {
      ok: false,
      message: `数据库：${error.message || '未连接'}`
    });
  }
};
