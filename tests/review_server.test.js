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
