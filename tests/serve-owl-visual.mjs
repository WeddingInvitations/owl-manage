// Read-only local visual preview. No application scripts are served or executed:
// Firebase, authentication and production data are deliberately unreachable.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(resolve(root) + sep) || !types[extname(file)]) {
    response.writeHead(403).end('Not available in visual preview');
    return;
  }
  try {
    let body = await readFile(file);
    if (extname(file) === '.html') body = Buffer.from(body.toString().replace(/<script\b[\s\S]*?<\/script>/g, ''));
    response.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-store' });
    response.end(body);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(8124, '127.0.0.1', () => console.log('Offline OwlManage visual preview: http://127.0.0.1:8124'));