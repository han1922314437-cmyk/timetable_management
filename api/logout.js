const { clearAuthCookie, sendJson, enforceHttps } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
    return;
  }

  if (enforceHttps(req, res)) return;

  clearAuthCookie(res);
  sendJson(res, 200, { ok: true });
};
