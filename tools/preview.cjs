// Vista local con cabeceras y rutas equivalentes al sitio estático de Vercel.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = require('../vercel.json');
const blocked = new Set(fs.readFileSync(path.join(root,'.vercelignore'),'utf8').split(/\r?\n/).filter(Boolean));
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
const server = http.createServer((req,res) => {
  let url;
  try {url = decodeURIComponent(new URL(req.url,'http://localhost').pathname);} catch {res.writeHead(400);return res.end();}
  for (const header of config.headers[0].headers) res.setHeader(header.key, header.value.replace('; upgrade-insecure-requests',''));
  // No upgrade-insecure-requests en localhost: el servidor de pruebas no usa TLS.
  const segments = url.split('/').filter(Boolean);
  if (segments.some(segment=>segment.startsWith('.')) || blocked.has(segments[0]) || blocked.has(segments.join('/'))) {res.writeHead(404);return res.end('Not found');}
  if (url.endsWith('.html') && req.method !== 'POST') {res.writeHead(308,{Location:url==='/index.html'?'/':url.slice(0,-5)});return res.end();}
  const relative = url==='/'?'index.html':url.slice(1);
  let file = path.resolve(root,relative);
  if (!file.startsWith(root+path.sep)) {res.writeHead(404);return res.end();}
  if (!path.extname(file) && fs.existsSync(file+'.html')) file += '.html';
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);return res.end('Not found');}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');
  res.writeHead(200);
  if(req.method==='HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});
server.listen(4173,'127.0.0.1',()=>console.log('Glam preview: http://127.0.0.1:4173'));
