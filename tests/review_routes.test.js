const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

describe('Revisão 2026-11-10: rotas por hash e botão Voltar (U5)', () => {
  let session;
  before(async () => { session = await launchBrowser(); });
  after(async () => {
    if (session) await session.close();
    stopSpawnedServer();
  });

  const hash = () => session.evaluate(() => location.hash);
  const activeTab = () => session.evaluate(() => ['tab-home', 'tab-sequencer', 'tab-beatbox'].find(id => document.getElementById(id).classList.contains('active')));

  async function openPadWithNote() {
    await session.evaluate(async () => {
      window.switchTab('tab-home');
      document.getElementById('btnHomePadBreque').click();
      for (let i = 0; i < 50 && !document.querySelector('#tracksWrapper .step-cell'); i++) await new Promise(r => setTimeout(r, 50));
      await new Promise(r => setTimeout(r, 500)); // a grade antiga ainda existe até o novo breque terminar de carregar
      const c = document.querySelectorAll('#tracksWrapper .step-cell')[4];
      c.scrollIntoView({ block: 'center', inline: 'center' });
      c.setAttribute('data-t', '1');
    });
    await session.click('[data-t="1"]');
    await sleep(500);
  }

  it('TR10.1: a URL acompanha Home, Pad e Estúdio', async () => {
    await openPadWithNote();
    assert.match(await hash(), /^#\/b\/.+\/pad$/);
    await session.evaluate(() => window.switchTab('tab-beatbox'));
    assert.match(await hash(), /^#\/b\/.+\/estudio$/);
    await session.evaluate(() => window.switchTab('tab-home'));
    assert.equal(await hash(), '#/');
  });

  it('TR10.2: Voltar do navegador volta do Home para o breque e do breque para o Home', async () => {
    await openPadWithNote();
    await session.evaluate(() => window.switchTab('tab-home'));
    await session.evaluate(() => history.back());
    await sleep(700);
    assert.equal(await activeTab(), 'tab-sequencer');
    await session.evaluate(() => history.back());
    await sleep(500);
    assert.equal(await activeTab(), 'tab-home');
  });

  it('TR10.3: abrir a rota de um breque existente (hash colado) abre o breque', async () => {
    await openPadWithNote();
    const route = await hash();
    await session.evaluate(() => window.switchTab('tab-home'));
    await session.evaluate((r) => { location.hash = r; }, route);
    await sleep(700);
    assert.equal(await activeTab(), 'tab-sequencer');
  });

  it('TR10.4: rota de breque inexistente cai no Home', async () => {
    await session.evaluate(() => { location.hash = '#/b/custom%3Ainexistente/pad'; });
    await sleep(500);
    assert.equal(await activeTab(), 'tab-home');
    assert.equal(await hash(), '#/');
  });
});
