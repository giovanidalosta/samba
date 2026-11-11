const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ensureServerRunning, stopSpawnedServer } = require('./harness.js');

const BASE = 'http://localhost:3000';

describe('Revisão 2026-11-10: servidor estático', () => {
  before(async () => {
    await ensureServerRunning();
  });

  after(() => {
    stopSpawnedServer();
  });

  it('TR6.1: arquivos e pastas ocultos (.git) não são servidos', async () => {
    for (const p of ['/.git/config', '/.gitignore', '/assets/../.git/HEAD', '/%2e%2e/%2egit/config']) {
      const res = await fetch(BASE + p);
      assert.equal(res.status, 404, `${p} deveria ser 404, recebido ${res.status}`);
    }
  });

  it('TR6.4: só arquivos públicos são servidos (allowlist)', async () => {
    for (const p of ['/server.js', '/package.json', '/PROJECT.md', '/tests/harness.js', '/docs/superpowers/plans/2026-11-10-revisao-app.md', '/GIT~1/config']) {
      const res = await fetch(BASE + p);
      assert.equal(res.status, 404, `${p} deveria ser 404, recebido ${res.status}`);
    }
    for (const p of ['/', '/beatbox_studio.js', '/beatbox_studio.css', '/manifest.json', '/sw.js', '/assets/soundbank.js', '/assets/icon.svg']) {
      const res = await fetch(BASE + p);
      assert.equal(res.status, 200, `${p} deveria ser 200, recebido ${res.status}`);
    }
  });

  it('TR6.6: arquivos de extensão não pública dentro de assets/ não são servidos', async () => {
    const fs = require('fs');
    const path = require('path');
    const tmp = path.join(__dirname, '..', 'assets', 'tmp_review.bak');
    fs.writeFileSync(tmp, 'segredo');
    try {
      const res = await fetch(BASE + '/assets/tmp_review.bak');
      assert.equal(res.status, 404);
    } finally { fs.unlinkSync(tmp); }
  });

  it('TR6.5: escape % malformado retorna 400 e o servidor continua de pé', async () => {
    const http = require('http');
    const status = await new Promise((resolve, reject) => {
      http.get({ host: 'localhost', port: 3000, path: '/%E0%A4%A' }, r => { r.resume(); resolve(r.statusCode); }).on('error', reject);
    });
    assert.equal(status, 400);
    const res = await fetch(BASE + '/index.html');
    assert.equal(res.status, 200);
  });

  it('TR6.2: index.html continua sem cache agressivo', async () => {
    const res = await fetch(BASE + '/index.html');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
  });

  it('TR6.3: áudios e fontes recebem cache de longa duração', async () => {
    const res = await fetch(BASE + '/assets/audio/sn_2e.mp3');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control') || '', /max-age=\d+/);
  });
});
