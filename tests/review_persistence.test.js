const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

const PRESETS_KEY = 'naumteria_custom_bateria_presets_v1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

describe('Revisão 2026-11-10: persistência do Pad e link compartilhado', () => {
  let session;

  before(async () => {
    session = await launchBrowser();
  });

  after(async () => {
    if (session) await session.close();
    stopSpawnedServer();
  });

  async function openFreshPadBreque() {
    await session.evaluate(async () => {
      window.switchTab('tab-home');
      document.getElementById('btnHomePadBreque').click();
      for (let i = 0; i < 50 && !document.querySelector('#tracksWrapper .step-cell'); i++) {
        await new Promise(r => setTimeout(r, 50));
      }
    });
    await sleep(150);
  }

  async function clickCell(index) {
    await session.evaluate((i) => {
      document.querySelectorAll('[data-test-cell]').forEach(el => el.removeAttribute('data-test-cell'));
      const cell = document.querySelectorAll('#tracksWrapper .step-cell')[i];
      cell.scrollIntoView({ block: 'center', inline: 'center' });
      cell.setAttribute('data-test-cell', '1');
    }, index);
    await session.click('[data-test-cell="1"]');
  }

  function readActiveStored() {
    return session.evaluate((key) => {
      const all = JSON.parse(localStorage.getItem(key) || '{}');
      const title = document.getElementById('activeBrequeTitleText')?.textContent
        || document.querySelector('#projectHeaderBar')?.innerText || '';
      const entry = Object.values(all).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
      return { entry, all, title };
    }, PRESETS_KEY);
  }

  it('TR1.1: nota marcada é salva ao disparar pagehide (fechar/recarregar)', async () => {
    await openFreshPadBreque();
    await clickCell(4);
    await session.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const { entry } = await readActiveStored();
    assert.ok(entry, 'breque criado deve existir no storage');
    assert.ok((entry.gridData.surdo1 || [])[4], 'nota no passo 4 do Surdo de 1ª deve estar salva após pagehide');
  });

  it('TR1.2: nota marcada é salva automaticamente após o debounce, sem trocar de aba', async () => {
    await openFreshPadBreque();
    await clickCell(8);
    await sleep(900);
    const { entry } = await readActiveStored();
    assert.ok((entry.gridData.surdo1 || [])[8], 'nota no passo 8 deve estar salva pelo autosave');
  });

  it('TR2.1: link compartilhado não sobrescreve o breque aberto', async () => {
    await openFreshPadBreque();
    await clickCell(2);
    await session.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const before = await readActiveStored();
    const ownKey = Object.keys(before.all).find(k => before.all[k] === before.entry
      || before.all[k].updatedAt === before.entry.updatedAt);

    await session.evaluate(async () => {
      const payload = { b: 99, m: '2/4', s: 'semicolcheia', c: 4, g: { caixa: Array(64).fill('ft') } };
      location.hash = 'breque=' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      await new Promise(r => setTimeout(r, 400));
      window.switchTab('tab-home');
    });

    const after = await session.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), PRESETS_KEY);
    const own = after[ownKey];
    assert.ok(own, 'breque original deve continuar existindo');
    assert.notEqual(own.bpm, 99, 'BPM do link não pode ser gravado no breque do usuário');
    assert.ok((own.gridData.surdo1 || [])[2], 'nota original do usuário deve continuar salva');
  });

  it('TR2.2: link com base64 inválido é ignorado sem quebrar o breque aberto', async () => {
    await openFreshPadBreque();
    const res = await session.evaluate(async () => {
      const titleBefore = document.getElementById('activeBrequeTitleText')?.textContent;
      const bpmBefore = document.getElementById('bpmDisplay')?.textContent;
      location.hash = 'breque=%%%nao-e-base64';
      await new Promise(r => setTimeout(r, 300));
      return {
        titleBefore, bpmBefore,
        titleAfter: document.getElementById('activeBrequeTitleText')?.textContent,
        bpmAfter: document.getElementById('bpmDisplay')?.textContent
      };
    });
    assert.equal(res.titleAfter, res.titleBefore);
    assert.equal(res.bpmAfter, res.bpmBefore);
  });

  it('TR2.3: valores do link são limitados à faixa do slider de BPM', async () => {
    const res = await session.evaluate(async () => {
      const payload = { b: 9999, m: '2/4', s: 'semicolcheia', c: 0, g: { surdo1: Array(64).fill(null) } };
      location.hash = 'breque=' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      await new Promise(r => setTimeout(r, 400));
      const slider = document.getElementById('bpmSlider');
      return {
        bpm: Number(document.getElementById('bpmDisplay')?.textContent),
        sliderVal: Number(slider.value), max: Number(slider.max),
        measuresText: document.getElementById('measureCountDisplay')?.textContent,
        title: document.getElementById('activeBrequeTitleText')?.textContent
      };
    });
    assert.equal(res.bpm, res.max, `BPM limitado ao máximo do slider (${res.max}), recebido ${res.bpm}`);
    assert.equal(res.sliderVal, res.bpm, 'slider e estado concordam');
    assert.match(res.measuresText, /^[1-9]\d* Compassos?$/);
    assert.equal(res.title, 'Breque compartilhado');
  });

  it('TR2.4: hash do link permanece (reload reabre o compartilhado) e some ao abrir outro breque', async () => {
    const kept = await session.evaluate(() => location.hash);
    assert.match(kept, /^#breque=/);
    await openFreshPadBreque();
    const cleared = await session.evaluate(() => location.hash);
    assert.equal(cleared, '');
  });

  it('TR2.5: dados do breque anterior (stepMeta/loop) não vazam para o compartilhado', async () => {
    const res = await session.evaluate(async () => {
      const payload = { b: 120, g: { surdo1: Array(64).fill(null) } };
      location.hash = 'breque=' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      await new Promise(r => setTimeout(r, 400));
      return true;
    });
    assert.ok(res);
    // Salvar o compartilhado: o registro novo não pode conter stepMeta/loop herdados
    const saved = await session.evaluate(async (key) => {
      window.appPrompt = async () => 'Compartilhado Salvo';
      document.getElementById('btnSaveToMyBreques').click();
      await new Promise(r => setTimeout(r, 200));
      const all = JSON.parse(localStorage.getItem(key) || '{}');
      return Object.values(all).find(b => b.name === 'Compartilhado Salvo') || null;
    }, PRESETS_KEY);
    assert.ok(saved, 'breque compartilhado salvo');
    const metaCount = Object.values(saved.stepMeta || {}).flat().filter(Boolean).length;
    assert.equal(metaCount, 0);
    assert.deepEqual(saved.loopGridData || {}, {});
  });

  it('TR1.3: apenas visualizar (sem editar) não regrava o breque no pagehide', async () => {
    await openFreshPadBreque();
    await session.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const before = await readActiveStored();
    await sleep(30);
    await session.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const after = await readActiveStored();
    assert.equal(after.entry.updatedAt, before.entry.updatedAt);
  });
});
