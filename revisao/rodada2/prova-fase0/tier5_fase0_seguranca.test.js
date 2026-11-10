const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { launchBrowser, ensureServerRunning, stopSpawnedServer } = require('./harness.js');

const PORT = 3125;
const BASE = `http://localhost:${PORT}/`;
const toHash = (obj) => '#breque=' + Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');

function rawGet(rawPath) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: rawPath, method: 'GET' }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', () => resolve(-1));
    req.setTimeout(2000, () => { req.destroy(); resolve(-1); });
    req.end();
  });
}

async function withDeadline(promise, ms) {
  let timer;
  const deadline = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`aba não respondeu em ${ms} ms`)), ms); });
  try { return await Promise.race([promise, deadline]); } finally { clearTimeout(timer); }
}

describe('Tier 5: Fase 0 — entrada hostil, XSS, travamento e servidor', () => {
  let session;
  const dialogs = [];

  before(async () => {
    session = await launchBrowser();
    session.ws.addEventListener('message', (evt) => {
      try {
        const d = JSON.parse(evt.data);
        if (d.method === 'Page.javascriptDialogOpening') dialogs.push(d.params.message);
      } catch (e) {}
    });
  });

  after(async () => {
    if (session) await session.close();
    stopSpawnedServer();
  });

  async function openUrl(url) {
    await session.send('Page.navigate', { url });
    await session.waitFor(() => document.readyState === 'complete' && typeof window.BeatboxStudio === 'object', 10000);
  }

  it('T0.1a: sanitizeBreque limita BPM/compassos e aplica whitelist de meter, subdivisão e articulações', async () => {
    const r = await session.evaluate(() => {
      const a = window.sanitizeBreque({ b: -120, c: 1e9, m: '7/8', s: '<img>', vol: { caixa: '9', surdo1: 'abc' }, t: { 0: 3, 1: 5, 9999: 6, x: 3 }, g: { caixa: ['<img>', 'rufado', 42, { a: 1 }] } });
      const b = window.sanitizeBreque({ b: '<img src=x onerror=alert(7)>', c: 2.6 });
      const c = window.sanitizeBreque({ b: 1e9, c: -3 });
      const d = window.sanitizeBreque(null);
      return {
        a: { bpm: a.bpm, measures: a.measures, meter: a.meter, sub: a.subdivision, vol: a.volumes, tup: a.beatTuplets, caixa0to3: a.gridData.caixa.slice(0, 4), caixaLen: a.gridData.caixa.length, warnings: a.warnings },
        b: { bpm: b.bpm, measures: b.measures }, c: { bpm: c.bpm, measures: c.measures }, d: { bpm: d.bpm, measures: d.measures, meter: d.meter }
      };
    });
    assert.equal(r.a.bpm, 30);
    assert.equal(r.a.measures, 32);
    assert.equal(r.a.meter, '2/4');
    assert.equal(r.a.sub, 'semicolcheia');
    assert.deepEqual(r.a.vol, { caixa: 1.5, surdo1: 1.0 });
    assert.deepEqual(r.a.tup, { 0: 3 });
    assert.deepEqual(r.a.caixa0to3, [null, 'rufado', null, null]);
    assert.equal(r.a.caixaLen, 32 * 8, 'grade normalizada para compassos × passos');
    assert.ok(r.a.warnings.includes('bpm') && r.a.warnings.includes('measures'));
    assert.deepEqual(r.b, { bpm: 120, measures: 3 });
    assert.deepEqual(r.c, { bpm: 300, measures: 1 });
    assert.deepEqual(r.d, { bpm: 120, measures: 4, meter: '2/4' });
  });

  it('T0.1b: presets nativos passam pela sanitização sem perder notas', async () => {
    const diffs = await session.evaluate(() => {
      const out = [];
      Object.keys(BATERIA_PRESETS).forEach(k => {
        applyBateriaPreset(k);
        const clean = window.sanitizeBreque({ bpm: state.bpm, meter: state.meter, subdivision: state.subdivision, measures: state.measures, gridData: state.gridData });
        INSTRUMENTS.forEach(inst => {
          const before = (state.gridData[inst.id] || []).filter(Boolean).length;
          const after = clean.gridData[inst.id].filter(Boolean).length;
          if (before !== after) out.push(`${k}/${inst.id}: ${before}→${after}`);
        });
        if (clean.warnings.length) out.push(`${k}: warnings ${clean.warnings}`);
      });
      return out;
    });
    assert.deepEqual(diffs, []);
  });

  it('T0.2a: XSS armazenado via link #breque= não executa após salvar e recarregar', async () => {
    dialogs.length = 0;
    await openUrl(BASE + toHash({ v: '2', b: '<img src=x onerror=alert(7)>', m: '2/4', s: 'semicolcheia', c: 4, g: {} }));
    await session.waitFor(() => document.getElementById('bpmDisplay').textContent === '120', 3000);
    await session.evaluate(async () => {
      window.appPrompt = async () => 'Breque Hostil';
      document.getElementById('btnSaveToMyBreques').click();
      await new Promise(r => setTimeout(r, 300));
      return true;
    });
    await openUrl(BASE);
    const home = await session.evaluate(async () => {
      window.switchTab('tab-home');
      await new Promise(r => setTimeout(r, 300));
      const card = Array.from(document.querySelectorAll('#homeBrequeList .home-breque-card')).find(c => c.textContent.includes('Breque Hostil'));
      return { found: !!card, injected: document.querySelectorAll('#homeBrequeList img').length, pill: card && card.querySelector('.home-badge-pill').textContent.trim() };
    });
    assert.ok(home.found, 'o breque salvo aparece na Home');
    assert.equal(home.injected, 0, 'nenhum <img> injetado na lista');
    assert.equal(home.pill, '120 BPM');
    assert.equal(dialogs.filter(m => m === '7').length, 0, 'alert(7) não pode disparar');
  });

  it('T0.2b: dado legado no localStorage com BPM hostil é exibido como texto, não como HTML', async () => {
    const r = await session.evaluate(async () => {
      const key = 'naumteria_custom_bateria_presets_v1';
      const all = JSON.parse(localStorage.getItem(key) || '{}');
      all.legado = { name: 'Legado', bpm: '<img src=x onerror="window.__xss=1">', measures: '<b>9</b>', gridData: {} };
      localStorage.setItem(key, JSON.stringify(all));
      window.renderHomeBrequesList();
      await new Promise(r => setTimeout(r, 200));
      return { injected: document.querySelectorAll('#homeBrequeList img, #homeBrequeList b').length, xss: window.__xss === 1 };
    });
    assert.deepEqual(r, { injected: 0, xss: false });
  });

  it('T0.2c: projeto .json do Estúdio com volume/offset/id hostis não injeta HTML', async () => {
    await session.resetStudioState();
    const evil = '1"><img src=x onerror="window.__xss2=1">';
    const r = await session.evaluate(async (evilStr) => {
      const json = JSON.stringify({ bpm: -5, tracks: [{ name: 'A', id: evilStr, volume: evilStr, offsetMs: evilStr, mediaType: evilStr }, { name: 'B', id: 'dup', volume: 0.5 }, { name: 'C', id: 'dup', mediaDataUrl: 'https://example.invalid/x.webm' }] });
      const input = document.getElementById('projectFileInput');
      const dt = new DataTransfer();
      dt.items.add(new File([json], 'p.json', { type: 'application/json' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 600));
      window.BeatboxStudio.switchViewMode('mosaic');
      window.BeatboxStudio.renderStudioViews();
      window.BeatboxStudio.switchViewMode('timeline');
      const ids = Array.from(document.querySelectorAll('.tcp-name-input')).map(i => i.dataset.id);
      return { injected: document.querySelectorAll('#tab-beatbox img[src="x"]').length, xss: window.__xss2 === 1, rows: ids.length, uniqueIds: new Set(ids).size, bpm: document.getElementById('studioBpm').value };
    }, evil);
    assert.equal(r.injected, 0);
    assert.equal(r.xss, false);
    assert.equal(r.rows, 3);
    assert.equal(r.uniqueIds, 3, 'ids duplicados ou inválidos são regenerados');
  });

  it('T0.2d: nome de faixa com HTML não executa no toast de duplicar/limpar', async () => {
    await session.resetStudioState();
    const r = await session.evaluate(async () => {
      window.BeatboxStudio.addTrack('<img src=x onerror="window.__toast=1">');
      window.BeatboxStudio.renderStudioViews();
      document.querySelector('.tcp-menu-duplicate').click();
      await new Promise(r => setTimeout(r, 300));
      const toast = document.getElementById('globalAppToast');
      return { xss: window.__toast === 1, imgs: toast ? toast.querySelectorAll('img').length : -1, text: toast ? toast.textContent : '' };
    });
    assert.equal(r.xss, false);
    assert.equal(r.imgs, 0);
    assert.ok(r.text.includes('<img'), 'o nome aparece literalmente como texto');
  });

  it('T0.3a: BPM -120 ou 1e9 no link não trava a aba ao tocar', async () => {
    for (const b of [-120, 1e9, 'abc']) {
      await openUrl(BASE + toHash({ v: '2', b, m: '2/4', s: 'semicolcheia', c: 4, g: {} }));
      const r = await withDeadline(session.evaluate(async () => {
        document.getElementById('btnPlay').click();
        await new Promise(r => setTimeout(r, 400));
        const out = { bpm: state.bpm, playing: state.isPlaying };
        stopPlayback();
        return out;
      }), 4000);
      assert.ok(r.bpm >= 30 && r.bpm <= 300, `BPM ${b} deve virar valor válido (veio ${r.bpm})`);
      assert.equal(r.playing, true);
    }
  });

  it('T0.3b: o agendador não entra em laço infinito mesmo com state.bpm corrompido em tempo de execução', async () => {
    for (const bad of [-120, 1e9, 0, NaN]) {
      const r = await withDeadline(session.evaluate(async (v) => {
        state.bpm = v === null ? NaN : v;
        startPlayback();
        await new Promise(r => setTimeout(r, 200));
        const out = { playing: state.isPlaying };
        stopPlayback();
        state.bpm = 120;
        return out;
      }, Number.isNaN(bad) ? null : bad), 3000);
      assert.equal(r.playing, false, `bpm=${bad} deve parar a reprodução, não travar`);
    }
  });

  it('T0.4: servidor serve só os arquivos do app, aguenta URL malformada e não sai da pasta', async () => {
    await ensureServerRunning();
    const sibling = path.resolve(__dirname, '..') + '-secret';
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(path.join(sibling, 'x.txt'), 'segredo');
    try {
      assert.equal(await rawGet('/'), 200);
      assert.equal(await rawGet('/index.html'), 200);
      assert.equal(await rawGet('/assets/soundbank.js'), 200);
      assert.equal(await rawGet('/sw.js'), 200);
      for (const p of ['/.git/config', '/server.js', '/tests/harness.js', '/PROJECT.md', '/package.json', '/assets/.hidden']) {
        assert.equal(await rawGet(p), 404, `${p} não pode ser servido`);
      }
      assert.equal(await rawGet('/%E0%A4%A'), 400);
      assert.equal(await rawGet('/index.html'), 200, 'servidor continua vivo após URL malformada');
      const escape = await rawGet('/..%2f' + path.basename(sibling) + '%2fx.txt');
      assert.ok(escape === 403 || escape === 404, `pasta vizinha não pode vazar (veio ${escape})`);
    } finally {
      fs.rmSync(sibling, { recursive: true, force: true });
    }
  });
});
