const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

describe('Revisão 2026-11-10: desfazer/refazer no Pad (Task 19)', () => {
  let session;
  before(async () => { session = await launchBrowser(); });
  after(async () => { if (session) await session.close(); stopSpawnedServer(); });

  async function openFreshPad() {
    await session.evaluate(async () => {
      window.switchTab('tab-home');
      document.getElementById('btnHomePadBreque').click();
      for (let i = 0; i < 50 && !document.querySelector('#tracksWrapper .step-cell'); i++) await new Promise(r => setTimeout(r, 50));
      await new Promise(r => setTimeout(r, 500));
    });
  }
  async function clickCell(i) {
    await session.evaluate((n) => {
      document.querySelectorAll('[data-t]').forEach(e => e.removeAttribute('data-t'));
      const c = document.querySelectorAll('#tracksWrapper .step-cell')[n];
      c.scrollIntoView({ block: 'center', inline: 'center' });
      c.setAttribute('data-t', '1');
    }, i);
    await session.click('[data-t="1"]');
    await sleep(350);
  }
  const cellLabel = (i) => session.evaluate((n) => document.querySelectorAll('#tracksWrapper .step-cell')[n].getAttribute('aria-label'), i);
  const disabled = (id) => session.evaluate((x) => document.getElementById(x).disabled, id);

  it('TR19.1: desfazer remove a nota e refazer a traz de volta', async () => {
    await openFreshPad();
    assert.equal(await disabled('btnPadUndo'), true);
    await clickCell(4);
    assert.match(await cellLabel(4), /: (AB|MP|AF)$/);
    assert.equal(await disabled('btnPadUndo'), false);
    await session.evaluate(() => document.getElementById('btnPadUndo').click());
    await sleep(100);
    assert.match(await cellLabel(4), /: vazio$/);
    assert.equal(await disabled('btnPadRedo'), false);
    await session.evaluate(() => document.getElementById('btnPadRedo').click());
    await sleep(100);
    assert.match(await cellLabel(4), /: (AB|MP|AF)$/);
  });

  it('TR19.2: Ctrl+Z e Ctrl+Shift+Z funcionam na aba do Pad', async () => {
    await openFreshPad();
    await clickCell(6);
    await session.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })));
    await sleep(100);
    assert.match(await cellLabel(6), /: vazio$/);
    await session.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true })));
    await sleep(100);
    assert.match(await cellLabel(6), /: (AB|MP|AF)$/);
  });

  it('TR19.3: nova edição depois de desfazer descarta o "refazer"', async () => {
    await openFreshPad();
    await clickCell(2);
    await session.evaluate(() => document.getElementById('btnPadUndo').click());
    await sleep(100);
    await clickCell(3);
    assert.equal(await disabled('btnPadRedo'), true);
  });

  it('TR19.4: a pilha guarda no máximo 50 estados', async () => {
    await openFreshPad();
    const depth = await session.evaluate(async () => {
      const cells = [...document.querySelectorAll('#tracksWrapper .step-cell')];
      for (let i = 0; i < 60; i++) {
        cells[i % cells.length].click();
        document.dispatchEvent(new Event('pointerup'));
        await new Promise(r => setTimeout(r, 160));
      }
      return window.padUndoDepth();
    });
    assert.ok(depth <= 51 && depth >= 50, 'profundidade ' + depth);
  });

  it('TR19.5: abrir outro breque zera o histórico', async () => {
    await openFreshPad();
    await clickCell(1);
    assert.equal(await disabled('btnPadUndo'), false);
    await openFreshPad();
    assert.equal(await disabled('btnPadUndo'), true);
  });
});
