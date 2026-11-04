import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import handler from '../api/wrapped.js';
const root = resolve(import.meta.dirname, '..');
const allowed = new Set(['index.html', 'style.css', 'app.js', 'viz/galaxy.js', 'viz/wordcloud.js', 'viz/timeline.js']);
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/wrapped') return handler(req, res);
  try {
    const path = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
    if (!allowed.has(path) || !resolve(root, path).startsWith(root + sep)) throw new Error('Not public');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' })[extname(path)] + '; charset=utf-8');
    res.end(await readFile(resolve(root, path)));
  } catch { res.statusCode = 404; res.end('No encontrado'); }
}).listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`GitHub Wrapped → http://localhost:${process.env.PORT || 3000}`));
