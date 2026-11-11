// Local-only integration harness: replaces Firebase imports with in-memory stubs.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  response.setHeader('Cache-Control', 'no-store');
  if (pathname === '/public-reservas/js/firebase.js' || pathname === '/tests/firebase-functions-mock.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(pathname.endsWith('/firebase.js')
      ? 'export const auth = window.testAuth; export const functions = {};'
      : 'export const httpsCallable = (_, name) => data => window.testCall(name, data);');
    return;
  }
  try {
    const file = resolve(root, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    let body = await readFile(file);
    if (pathname === '/public-reservas/js/booking.js') {
      body = Buffer.from(body.toString().replace('https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js', '/tests/firebase-functions-mock.js'));
    }
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    response.end(body);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(8123, '127.0.0.1', () => console.log('Local mocked booking tests: http://127.0.0.1:8123/tests/booking-performance.html'));
