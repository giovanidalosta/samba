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
});
