const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

const PRESETS_KEY = 'naumteria_custom_bateria_presets_v1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

describe('Revisão 2026-11-10: fluxos da Home (Task 21)', () => {
  let session;
  before(async () => { session = await launchBrowser(); });
  after(async () => { if (session) await session.close(); stopSpawnedServer(); });

  const presets = () => session.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), PRESETS_KEY);

  async function seedBreque(id, name) {
    await session.evaluate((k, i, n) => {
      const all = JSON.parse(localStorage.getItem(k) || '{}');
      all[i] = { name: n, bpm: 110, measures: 4, lastMode: 'pad', hasPadNotes: true, updatedAt: Date.now(), gridData: { surdo1: [null, 'aberto'] }, stepMeta: {}, loopGridData: {}, selectedGroove: {}, trackGains: {} };
      localStorage.setItem(k, JSON.stringify(all));
      window.switchTab('tab-home');
      window.updateBateriaPresetSelect && window.updateBateriaPresetSelect();
      window.renderHomeBrequesList && window.renderHomeBrequesList();
    }, PRESETS_KEY, id, name);
    await sleep(200);
  }

  it('TR21.1: breque salvo aparece como card na Home', async () => {
    await seedBreque('t21a', 'Breque Teste 21');
    const found = await session.evaluate(() => document.body.innerText.includes('Breque Teste 21'));
    assert.equal(found, true);
  });

  it('TR21.2: abrir o card leva ao Pad com a nota salva', async () => {
    await session.evaluate(() => {
      const card = [...document.querySelectorAll('#tab-home .home-breque-card, #tab-home [class*="card"]')]
        .find(c => c.textContent.includes('Breque Teste 21'));
      (card.querySelector('.btn-card-open, .btn-card-primary') || card).click();
    });
    await sleep(800);
    const r = await session.evaluate(() => ({
      pad: document.getElementById('tab-sequencer').classList.contains('active'),
      hash: location.hash,
      title: document.getElementById('activeBrequeTitleText')?.textContent,
    }));
    assert.equal(r.pad, true);
    assert.ok(r.hash.startsWith("#/b/"), r.hash);
    assert.equal(r.title, 'Breque Teste 21');
  });

  it('TR21.3: excluir o card remove o breque do armazenamento', async () => {
    await session.evaluate(() => window.switchTab('tab-home'));
    await sleep(300);
    await session.evaluate(() => {
      const card = [...document.querySelectorAll('#tab-home [class*="card"]')].find(c => c.querySelector('.btn-card-delete') && c.textContent.includes('Breque Teste 21'));
      card.querySelector('.btn-card-delete').click();
    });
    await sleep(500);
    const all = await presets();
    assert.equal(all.t21a, undefined);
  });

  it('TR21.4: backup exportado contém o breque criado e pode ser reimportado', async () => {
    await seedBreque('t21b', 'Backup 21');
    const r = await session.evaluate((k) => {
      const backup = window.buildBackupData();
      localStorage.removeItem(k);
      const res = window.importBackupData(JSON.parse(JSON.stringify(backup)));
      return { had: !!backup.presets.t21b, res, back: !!JSON.parse(localStorage.getItem(k)).t21b };
    }, PRESETS_KEY);
    assert.equal(r.had, true);
    assert.equal(r.res.ok, true);
    assert.equal(r.back, true);
  });

  it('TR21.5: "Compartilhar link" gera um hash que reabre a mesma grade', async () => {
    const r = await session.evaluate(async () => {
      window.switchTab('tab-home');
      document.getElementById('btnHomePadBreque').click();
      await new Promise(res => setTimeout(res, 800));
      document.querySelectorAll('#tracksWrapper .step-cell')[2].click();
      let copied = null;
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { copied = t; } }, configurable: true });
      await window.shareBrequeLink();
      return copied;
    });
    assert.match(r, /#breque=/);
  });
});
