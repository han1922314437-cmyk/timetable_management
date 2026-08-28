const { clearAuthCookie, sendJson } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
    return;
  }

  clearAuthCookie(res);
  sendJson(res, 200, { ok: true });
};
