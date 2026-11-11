const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

const root = path.join(__dirname, '..');

describe('Revisão 2026-11-10: offline real (B2, B3)', () => {
  it('TR17.1: o service worker pré-cacheia todos os áudios de assets/audio', () => {
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    const files = fs.readdirSync(path.join(root, 'assets', 'audio')).filter(f => f.endsWith('.mp3'));
    assert.ok(files.length > 100);
    const missing = files.filter(f => !sw.includes(`'assets/audio/${f}'`));
    assert.deepEqual(missing, []);
    assert.ok(sw.includes('AUDIO_ASSETS.map((url) =>') && sw.includes('cache.add(url).catch'), 'cada áudio deve ser pré-cacheado individualmente');
  });

  it('TR17.2: CACHE_NAME vem do hash dos assets (sw.js em dia com "npm run build:sw")', () => {
    execFileSync(process.execPath, [path.join(root, 'scripts', 'build-sw.js'), '--check'], { stdio: 'pipe' });
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.match(sw, /const CACHE_NAME = 'naumteria-studio-[0-9a-f]{10}'/);
  });

  describe('soundbank adiado', () => {
    let session;
    before(async () => { session = await launchBrowser(); });
    after(async () => { if (session) await session.close(); stopSpawnedServer(); });

    it('TR17.3: soundbank.js usa defer e os samples ainda são pré-carregados', async () => {
      const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
      assert.match(html, /<script src="assets\/soundbank\.js" defer><\/script>/);
      const ok = await session.evaluate(async () => {
        for (let i = 0; i < 40 && !window.SAMBA_SOUNDBANK; i++) await new Promise(r => setTimeout(r, 50));
        await new Promise(r => setTimeout(r, 800));
        return { bank: Object.keys(window.SAMBA_SOUNDBANK || {}).length };
      });
      assert.ok(ok.bank >= 40, "soundbank carregou: " + ok.bank);
    });
  });

  it('TR20.1: index.html não carrega mais o JS inline e todos os js/*.js estão no SW', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const inlineSizes = [];
    let pos = 0;
    while ((pos = html.indexOf('<script', pos)) !== -1) {
      const tagEnd = html.indexOf('>', pos);
      const tag = html.slice(pos, tagEnd);
      const close = html.indexOf('</script>', tagEnd);
      if (!tag.includes(' src=')) inlineSizes.push(html.slice(tagEnd, close).split('\n').length);
      pos = close;
    }
    assert.ok(inlineSizes.every(n => n < 40), 'script inline grande: ' + inlineSizes);
    const files = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'));
    assert.ok(files.length >= 8);
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    for (const f of files) {
      assert.ok(html.includes('src="js/' + f + '"'), f + ' sem <script> no index.html');
      assert.ok(sw.includes("'js/" + f + "'"), f + ' fora do SW');
    }
  });
});
