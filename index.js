const fs = require('node:fs');
const path = require('node:path');

const HTML_FILE = path.join(__dirname, 'board_game_scheduler_macaron.html');

const routes = {
  '/api/health': require('./api/health'),
  '/api/rooms': require('./api/rooms'),
  '/api/me': require('./api/me'),
  '/api/register': require('./api/register'),
  '/api/login': require('./api/login'),
  '/api/logout': require('./api/logout'),
  '/api/bookings': require('./api/bookings/index'),
};

function serveHtml(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  fs.createReadStream(HTML_FILE).pipe(res);
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/board_game_scheduler_macaron.html') {
    serveHtml(res);
    return;
  }

  if (url.pathname.startsWith('/api/bookings/')) {
    return require('./api/bookings/[id]')(req, res);
  }

  const route = routes[url.pathname];
  if (route) {
    return route(req, res);
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'Not Found' }));
};
