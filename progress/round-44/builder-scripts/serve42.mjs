// Round 42 critic: tiny static servers. node serve42.mjs <port> <dir> <prefix> [outer]
// prefix "/" serves dir at the root (as Vercel serves a static dist/); "/nested/game/" serves it under a nested path.
// "outer" mode: a device-width page on http://localhost:<port> that frames http://127.0.0.1:5194/nested/game/<query>.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const [port, dir, prefix = '/', mode] = process.argv.slice(2);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.map': 'application/json', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (mode === 'outer') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0;height:100%;background:#000}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style></head><body><iframe allow="autoplay; fullscreen" src="http://127.0.0.1:5194/nested/game/${u.search}"></iframe></body></html>`);
    return;
  }
  if (!u.pathname.startsWith(prefix)) { res.writeHead(404); res.end('nf'); return; }
  let p = decodeURIComponent(u.pathname.slice(prefix.length)); if (p === '' || p.endsWith('/')) p += 'index.html';
  const f = path.join(dir, p);
  if (!f.startsWith(path.resolve(dir)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
}).listen(Number(port), '127.0.0.1'.length && mode === 'outer' ? 'localhost' : '127.0.0.1', () => console.log('up', port, dir, prefix, mode || ''));
