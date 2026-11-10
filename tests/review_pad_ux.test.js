const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

describe('Revisão 2026-11-10: UX do Pad (U6, U7, U8–U10)', () => {
  let session;
  before(async () => { session = await launchBrowser(); });
  after(async () => {
    if (session) await session.close();
    stopSpawnedServer();
  });

  async function openFreshPad() {
    await session.evaluate(async () => {
      window.switchTab('tab-home');
      document.getElementById('btnHomePadBreque').click();
      for (let i = 0; i < 50 && !document.querySelector('#tracksWrapper .step-cell'); i++) await new Promise(r => setTimeout(r, 50));
    });
    await sleep(200);
  }

  const visible = (sel) => session.evaluate((s) => {
    const el = document.querySelector(s);
    return !!el && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
  }, sel);

  it('TR11.1: grade vazia mostra a faixa de ajuda; some depois da primeira nota', async () => {
    await openFreshPad();
    assert.equal(await visible('#padHelpStrip'), true);
    const text = await session.evaluate(() => document.getElementById('padHelpStrip').textContent);
    assert.match(text, /Toque numa célula/);
    await session.evaluate(() => {
      const c = document.querySelectorAll('#tracksWrapper .step-cell')[4];
      c.scrollIntoView({ block: 'center', inline: 'center' });
      c.setAttribute('data-t', '1');
    });
    await session.click('[data-t="1"]');
    await sleep(150);
    assert.equal(await visible('#padHelpStrip'), false);
  });

  it('TR11.2: o botão "?" abre a legenda com sigla → nome para cada naipe', async () => {
    await openFreshPad();
    await session.evaluate(() => document.getElementById('btnPadLegend').click());
    await sleep(100);
    assert.equal(await visible('#padLegendPopover'), true);
    const info = await session.evaluate(() => {
      const pop = document.getElementById('padLegendPopover');
      return { text: pop.textContent, rows: pop.querySelectorAll('[data-legend-row]').length };
    });
    assert.match(info.text, /AB/);
    assert.match(info.text, /Toque Aberto/);
    assert.match(info.text, /Surdo de 1ª/);
    assert.ok(info.rows >= 8);
    await session.evaluate(() => document.getElementById('btnPadLegend').click());
    await sleep(100);
    assert.equal(await visible('#padLegendPopover'), false);
  });

  describe('mobile (390px)', () => {
    before(async () => {
      await session.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await openFreshPad();
    });
    after(async () => { await session.send('Emulation.clearDeviceMetricsOverride'); });

    it('TR12.1: cabeçalho do naipe tem até 112px e esconde pílulas e levada', async () => {
      const r = await session.evaluate(() => {
        const h = document.querySelector('#tracksWrapper .track-header');
        const vis = (sel) => { const el = h.querySelector(sel); return !!el && el.offsetParent !== null; };
        return { w: h.getBoundingClientRect().width, palette: vis('.track-art-palette'), bottom: vis('.track-header-bottom'), name: vis('.track-name') };
      });
      assert.ok(r.w <= 112, 'largura ' + r.w);
      assert.equal(r.palette, false);
      assert.equal(r.bottom, false);
      assert.equal(r.name, true);
    });

    it('TR12.2: tocar no nome abre o bottom sheet com pílulas e levada; backdrop fecha', async () => {
      await session.evaluate(() => document.querySelector('#tracksWrapper .track-info').click());
      await sleep(100);
      const open = await session.evaluate(() => {
        const h = document.querySelector('#tracksWrapper .track-header');
        const ex = h.querySelector('.track-header-extra');
        const r = ex.getBoundingClientRect();
        return { visible: ex.offsetParent !== null || getComputedStyle(ex).position === 'fixed' && getComputedStyle(ex).display !== 'none',
          atBottom: Math.abs(r.bottom - window.innerHeight) < 2, pills: ex.querySelectorAll('.art-brush-pill').length, select: !!ex.querySelector('select') };
      });
      assert.equal(open.visible, true);
      assert.equal(open.atBottom, true);
      assert.ok(open.pills >= 3);
      assert.equal(open.select, true);
      await session.evaluate(() => document.getElementById('padSheetBackdrop').click());
      await sleep(100);
      const hidden = await session.evaluate(() => getComputedStyle(document.querySelector('#tracksWrapper .track-header-extra')).display === 'none');
      assert.equal(hidden, true);
    });

    it('TR12.3: sheet continua aberto depois de escolher uma pílula (re-render)', async () => {
      await session.evaluate(() => document.querySelector('#tracksWrapper .track-info').click());
      await sleep(100);
      await session.evaluate(() => document.querySelectorAll('#tracksWrapper .track-header-extra .art-brush-pill')[1].click());
      await sleep(150);
      const shown = await session.evaluate(() => getComputedStyle(document.querySelector('#tracksWrapper .track-header-extra')).display !== 'none');
      assert.equal(shown, true);
      await session.evaluate(() => document.getElementById('padSheetBackdrop').click());
    });
  });

  it('TR12.4: scrollbars do Pad são finas', async () => {
    const sw = await session.evaluate(() => getComputedStyle(document.getElementById('gridContainer')).scrollbarWidth);
    assert.equal(sw, 'thin');
  });

  describe('Estúdio: duplicidades e avisos (Task 13)', () => {
    async function openStudio() {
      await openFreshPad();
      await session.evaluate(async () => {
        window.switchTab('tab-beatbox');
        await new Promise(r => setTimeout(r, 500));
        const S = window.BeatboxStudio;
        for (const t of [...S.__test.getTracks()]) S.removeTrack(t.id);
        await S.switchViewMode('timeline');
      });
    }
    const shown = (sel) => session.evaluate((q) => {
      const el = document.querySelector(q);
      return !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
    }, sel);

    it('TR13.1: o botão de importar não se chama "Pad" (duplicava o seletor de modo)', async () => {
      await openStudio();
      const shortLabel = await session.evaluate(() => document.querySelector('#btnImportFromPad .toolbar-btn-label-short').textContent.trim());
      assert.notEqual(shortLabel, 'Pad');
    });

    it('TR13.2: cada card do Mosaico tem um único "✕"', async () => {
      await openStudio();
      const n = await session.evaluate(() => {
        const S = window.BeatboxStudio;
        const t = S.addTrack('Teste'); t.mediaUrl = 'blob:x'; t.duration = 2;
        S.renderStudioViews();
        const card = document.querySelector('#mosaicGrid .track-card:not(.track-add-card)');
        return [...card.querySelectorAll('button')].filter(b => /[✕×]/.test(b.textContent)).length;
      });
      assert.equal(n, 1);
    });

    it('TR13.3: "Cortar [S]" só aparece com faixas gravadas e o atalho tem classe própria', async () => {
      await openStudio();
      assert.equal(await shown('#btnSplitAtPlayhead'), false);
      await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('G'); t.mediaUrl = 'blob:y'; t.duration = 2;
        window.BeatboxStudio.renderStudioViews();
      });
      assert.equal(await shown('#btnSplitAtPlayhead'), true);
      assert.equal(await session.evaluate(() => !!document.querySelector('#btnSplitAtPlayhead .kbd-hint')), true);
    });

    it('TR13.4: na Cabine só existe um controle de gravar (o do dock some)', async () => {
      await openStudio();
      assert.equal(await shown('#btnStudioRecord'), true);
      await session.evaluate(() => window.BeatboxStudio.switchViewMode('record'));
      await sleep(100);
      assert.equal(await shown('#btnStudioRecord'), false);
      assert.equal(await shown('#btnStartRecord'), true);
      await session.evaluate(() => window.BeatboxStudio.switchViewMode('timeline'));
    });

    it('TR13.5: aviso "Gire o celular" nunca aparece na Cabine nem junto do aviso de fones', async () => {
      await session.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      try {
        await session.evaluate(() => { sessionStorage.removeItem('orient_hint_dismissed'); });
        await openStudio();
        await session.evaluate(() => { window.checkOrientation(); });
        assert.equal(await shown('#mobileOrientHint'), true, 'precondição: aviso aparece na timeline');
        await session.evaluate(() => window.showHeadphonesToast && window.showHeadphonesToast());
        const both = await session.evaluate(() => {
          const vis = (id) => getComputedStyle(document.getElementById(id)).display !== 'none';
          return { orient: vis('mobileOrientHint'), hp: vis('mobileHeadphonesToast') };
        });
        assert.equal(both.orient && both.hp, false, 'no máximo um aviso por vez');
        await session.evaluate(() => window.BeatboxStudio.switchViewMode('record'));
        await session.evaluate(() => { window.checkOrientation(); });
        assert.equal(await shown('#mobileOrientHint'), false);
      } finally {
        await session.send('Emulation.clearDeviceMetricsOverride');
        await session.evaluate(() => window.BeatboxStudio.switchViewMode('timeline'));
      }
    });
  });

  it('TR14.1: avisos do Pad usam o diálogo do app, não o nativo do navegador', async () => {
    await openFreshPad();
    const r = await session.evaluate(async () => {
      window.__native = 0;
      window.alert = () => { window.__native++; };
      window.prompt = () => { window.__native++; return null; };
      window.confirm = () => { window.__native++; return false; };
      const orig = window.appAlert;
      window.__appAlerts = [];
      window.appAlert = (m) => { window.__appAlerts.push(m); return Promise.resolve(); };
      // grade vazia: salvar preset da bateria deve avisar
      document.getElementById('bateriaPresetSelect').value = '';
      await window.saveCurrentBateriaAsPreset?.();
      const btn = [...document.querySelectorAll('.btn-save-groove')][0];
      btn && btn.click();
      await new Promise(r => setTimeout(r, 200));
      window.appAlert = orig;
      return { native: window.__native, app: window.__appAlerts.length };
    });
    assert.equal(r.native, 0);
    assert.ok(r.app >= 1, 'o aviso deve passar por appAlert');
  });

  describe('grade acessível por teclado (Task 15)', () => {
    it('TR15.1: grade tem role=grid, células gridcell com rótulo e um único tabstop', async () => {
      await openFreshPad();
      const r = await session.evaluate(() => {
        const cells = [...document.querySelectorAll('#tracksWrapper .step-cell')];
        return {
          grid: document.getElementById('tracksWrapper').getAttribute('role'),
          roles: new Set(cells.map(c => c.getAttribute('role'))).size === 1 && cells[0].getAttribute('role'),
          label: cells[0].getAttribute('aria-label'),
          label5: cells[5].getAttribute('aria-label'),
          tabstops: cells.filter(c => c.tabIndex === 0).length,
        };
      });
      assert.equal(r.grid, 'grid');
      assert.equal(r.roles, 'gridcell');
      assert.match(r.label, /^Surdo de 1ª, compasso 1, tempo 1, semicolcheia 1: vazio$/);
      assert.match(r.label5, /compasso 1, tempo 2, semicolcheia 2/);
      assert.equal(r.tabstops, 1);
    });

    it('TR15.2: setas navegam, Enter marca e atualiza o rótulo, Espaço alterna de novo', async () => {
      await openFreshPad();
      await session.evaluate(() => document.querySelector('#tracksWrapper .step-cell[data-instrument="surdo1"][data-step="0"]').focus());
      const key = (k) => session.evaluate((key) => {
        const el = document.activeElement;
        el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      }, k);
      await key('ArrowRight');
      await key('ArrowRight');
      let at = await session.evaluate(() => ({ step: document.activeElement.dataset.step, inst: document.activeElement.dataset.instrument }));
      assert.deepEqual(at, { step: '2', inst: 'surdo1' });
      await key('ArrowDown');
      at = await session.evaluate(() => ({ step: document.activeElement.dataset.step, inst: document.activeElement.dataset.instrument }));
      assert.equal(at.step, '2');
      assert.notEqual(at.inst, 'surdo1');
      await key('ArrowUp');
      await key('Enter');
      const lbl = await session.evaluate(() => document.activeElement.getAttribute('aria-label'));
      assert.match(lbl, /: (AB|MP|AF)$/);
      await key(' ');
      await key(' ');
      const tabstops = await session.evaluate(() => [...document.querySelectorAll('#tracksWrapper .step-cell')].filter(c => c.tabIndex === 0).length);
      assert.equal(tabstops, 1);
    });
  });
});
