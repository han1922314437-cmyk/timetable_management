const { ensureReady, sendJson, rooms } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
    return;
  }

  await ensureReady();
  sendJson(res, 200, { rooms });
};
