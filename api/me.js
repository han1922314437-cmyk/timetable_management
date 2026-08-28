const { ensureReady, getUserFromRequest, sendJson } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
    return;
  }

  await ensureReady();
  const user = await getUserFromRequest(req);
  sendJson(res, 200, { user });
};
