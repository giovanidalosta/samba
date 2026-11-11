const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

const PRESETS_KEY = 'naumteria_custom_bateria_presets_v1';
const GROOVES_KEY = 'naumteria_custom_grooves_v1';

describe('Revisão 2026-11-10: dados e backup (Task 18)', () => {
  let session;
  before(async () => { session = await launchBrowser(); });
  after(async () => { if (session) await session.close(); stopSpawnedServer(); });

  it('TR18.1: JSON corrompido de presets é preservado em cópia .bak antes de ser descartado', async () => {
    const r = await session.evaluate((key) => {
      localStorage.setItem(key, '{corrompido');
      const loaded = window.loadCustomBateriaPresets();
      return { loaded, bak: localStorage.getItem(key + '_bak') };
    }, PRESETS_KEY);
    assert.deepEqual(r.loaded, {});
    assert.equal(r.bak, '{corrompido');
    await session.evaluate((key) => localStorage.removeItem(key), PRESETS_KEY);
  });

  it('TR18.2: primeiro save pede armazenamento persistente e grava a versão do esquema', async () => {
    const r = await session.evaluate((key) => {
      window.__persistCalls = 0;
      try { navigator.storage.persist = async () => { window.__persistCalls++; return true; }; } catch (e) {}
      localStorage.removeItem('naumteria_schema_v');
      window.saveCustomBateriaPresetsToStorage({ x: { name: 'X', bpm: 100, measures: 4, gridData: {} } });
      return { persist: window.__persistCalls, schema: localStorage.getItem('naumteria_schema_v') };
    }, PRESETS_KEY);
    assert.equal(r.persist, 1);
    assert.equal(r.schema, '1');
  });

  it('TR18.3: exportar tudo e importar backup restaura breques e levadas', async () => {
    const r = await session.evaluate((pk, gk) => {
      localStorage.setItem(pk, JSON.stringify({ a: { name: 'A', bpm: 100, measures: 4, updatedAt: 5, gridData: {} } }));
      localStorage.setItem(gk, JSON.stringify({ surdo1: [{ id: 'g1', name: 'G1', pattern: [] }] }));
      const backup = window.buildBackupData();
      localStorage.removeItem(pk);
      localStorage.removeItem(gk);
      const res = window.importBackupData(JSON.parse(JSON.stringify(backup)));
      return {
        schema: backup.schema, hasPresets: Object.keys(backup.presets).length, res,
        presets: JSON.parse(localStorage.getItem(pk)), grooves: JSON.parse(localStorage.getItem(gk)),
      };
    }, PRESETS_KEY, GROOVES_KEY);
    assert.equal(r.schema, 1);
    assert.equal(r.hasPresets, 1);
    assert.equal(r.res.ok, true);
    assert.equal(r.presets.a.name, 'A');
    assert.equal(r.grooves.surdo1[0].id, 'g1');
  });

  it('TR18.4: importação mescla: mantém o breque mais novo quando o id coincide', async () => {
    const r = await session.evaluate((pk) => {
      localStorage.setItem(pk, JSON.stringify({ a: { name: 'Local novo', updatedAt: 100, gridData: {} } }));
      window.importBackupData({ schema: 1, presets: { a: { name: 'Antigo', updatedAt: 1, gridData: {} }, b: { name: 'B', updatedAt: 1, gridData: {} } }, grooves: {} });
      return JSON.parse(localStorage.getItem(pk));
    }, PRESETS_KEY);
    assert.equal(r.a.name, 'Local novo');
    assert.equal(r.b.name, 'B');
  });

  it('TR18.5: backup inválido é recusado sem alterar nada', async () => {
    const r = await session.evaluate((pk) => {
      const before = localStorage.getItem(pk);
      const res = [window.importBackupData(null), window.importBackupData({ foo: 1 }), window.importBackupData({ schema: 99, presets: {} })];
      return { res, same: before === localStorage.getItem(pk) };
    }, PRESETS_KEY);
    assert.ok(r.res.every(x => x.ok === false));
    assert.equal(r.same, true);
  });

  it('TR18.7: valor não-objeto no storage vira {} e preset sem nome é recusado na importação', async () => {
    const r = await session.evaluate((pk) => {
      localStorage.setItem(pk, 'null');
      const a = window.loadCustomBateriaPresets();
      localStorage.setItem(pk, '[]');
      const b = window.loadCustomBateriaPresets();
      localStorage.removeItem(pk);
      window.importBackupData({ schema: 1, presets: { ok: { name: 'Ok', gridData: {} }, ruim: { bpm: 1 }, ruim2: { name: 'X', gridData: 5 } }, grooves: {} });
      return { a, b, saved: Object.keys(JSON.parse(localStorage.getItem(pk))) };
    }, PRESETS_KEY);
    assert.deepEqual(r.a, {});
    assert.deepEqual(r.b, {});
    assert.deepEqual(r.saved, ['ok']);
  });

  it('TR18.6: botões "Exportar tudo" e "Importar backup" existem na Home', async () => {
    const r = await session.evaluate(() => ({ exp: !!document.getElementById('btnExportAllBreques'), imp: !!document.getElementById('btnImportBackup') }));
    assert.deepEqual(r, { exp: true, imp: true });
  });
});
