const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = __dirname;
const PUBLIC_ROOT_FILES = new Set([
  'index.html',
  'beatbox_studio.js',
  'beatbox_studio.css',
  'manifest.json',
  'sw.js'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    const reqUrl = new URL(req.url, 'http://localhost');
    pathname = decodeURIComponent(reqUrl.pathname);
  } catch (e) {
    // URL ou escape % malformado não pode derrubar o servidor
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('400 Bad Request');
  }

  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (safePath !== PUBLIC_DIR && !safePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  // Allowlist: só os arquivos públicos do app. Nada de .git, tests/, docs/, server.js, package.json...
  const relativeSegments = path.relative(PUBLIC_DIR, safePath).split(path.sep);
  const relPath = relativeSegments.join('/');
  const isPublic = PUBLIC_ROOT_FILES.has(relPath) ||
    (relativeSegments[0] === 'assets' && relativeSegments.length > 1);
  if (!isPublic || relativeSegments.some(seg => seg.startsWith('.') || seg.includes('~'))) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404 Not Found');
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Áudios e fontes mudam raramente: cache de 1 dia. Código e HTML: sempre revalidar.
    const relPosix = path.relative(PUBLIC_DIR, safePath).split(path.sep).join('/');
    const isStaticMedia = relPosix.startsWith('assets/audio/') || relPosix.startsWith('assets/fonts/');

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': isStaticMedia ? 'public, max-age=86400' : 'no-cache'
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

