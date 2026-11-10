const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

describe('Revisão 2026-11-10: gravação de takes no Estúdio (U4)', () => {
  let session;

  before(async () => { session = await launchBrowser(); });
  after(async () => {
    if (session) await session.close();
    stopSpawnedServer();
  });

  // Cria um estúdio limpo com uma faixa já gravada ("Gravada") selecionada.
  async function setupRecordedTrack() {
    return session.evaluate(async () => {
      window.switchTab('tab-home');
      document.getElementById('btnHomePadBreque').click();
      for (let i = 0; i < 50 && !document.querySelector('#tracksWrapper .step-cell'); i++) await new Promise(r => setTimeout(r, 50));
      await new Promise(r => setTimeout(r, 600)); // deixa o loadBrequeProject assíncrono terminar
      window.switchTab('tab-beatbox');
      const S = window.BeatboxStudio;
      S.clearCurrentProjectTracks && await S.clearCurrentProjectTracks(true);
      for (const t of [...S.__test.getTracks()]) S.removeTrack && S.removeTrack(t.id, true);
      const t = S.addTrack('Gravada');
      t.mediaUrl = 'blob:antigo';
      t.mediaBlob = new Blob(['antigo']);
      S.selectTrack(t.id);
      return t.id;
    });
  }

  it('TR9.1: Gravar com a faixa selecionada já gravada arma uma faixa vazia, não a gravada', async () => {
    const recordedId = await setupRecordedTrack();
    const res = await session.evaluate(() => {
      window.BeatboxStudio.triggerMasterRecord();
      const tracks = window.BeatboxStudio.__test.getTracks();
      return { armed: tracks.filter(t => t.armed).map(t => ({ id: t.id, hasMedia: !!(t.mediaUrl || t.mediaBlob) })) };
    });
    assert.equal(res.armed.length, 1);
    assert.notEqual(res.armed[0].id, recordedId);
    assert.equal(res.armed[0].hasMedia, false);
  });

  // O harness troca appConfirm por um stub que sempre confirma; aqui ele é substituído por um stub que registra a chamada.
  async function pendingTakeOn(trackId, answer) {
    return session.evaluate(async (id, ans) => {
      window.__confirmCalls = [];
      window.appConfirm = async (msg, title, opts) => { window.__confirmCalls.push({ msg, title, opts }); return ans; };
      const ctx = window.BeatboxStudio.__test.recordingContext;
      ctx.activeTrackId = id;
      ctx.lastRecordedBlob = new Blob(['novo']);
      ctx.captureMode = 'audio';
      await window.BeatboxStudio.__test.keepCurrentTake();
      const tracks = window.BeatboxStudio.__test.getTracks();
      const t = tracks.find(x => x.id === id);
      return { calls: window.__confirmCalls, count: tracks.length, url: t ? t.mediaUrl : null };
    }, trackId, answer);
  }

  it('TR9.2: take sobre faixa gravada pergunta; "Salvar como nova faixa" preserva o take antigo', async () => {
    const recordedId = await setupRecordedTrack();
    const before = await session.evaluate(() => window.BeatboxStudio.__test.getTracks().length);
    const r = await pendingTakeOn(recordedId, false);
    assert.equal(r.calls.length, 1, 'deve perguntar antes de substituir');
    assert.equal(r.calls[0].opts.cancelText, 'Salvar como nova faixa');
    assert.equal(r.count, before + 1);
    assert.equal(r.url, 'blob:antigo');
  });

  it('TR9.3: escolher "Substituir" troca a gravação da faixa sem criar outra', async () => {
    const recordedId = await setupRecordedTrack();
    const before = await session.evaluate(() => window.BeatboxStudio.__test.getTracks().length);
    const r = await pendingTakeOn(recordedId, true);
    assert.equal(r.calls.length, 1);
    assert.equal(r.count, before);
    assert.notEqual(r.url, 'blob:antigo');
  });

  it('TR9.4: faixa vazia recebe o take sem perguntar', async () => {
    await setupRecordedTrack();
    const emptyId = await session.evaluate(() => window.BeatboxStudio.addTrack('Vazia').id);
    const r = await pendingTakeOn(emptyId, true);
    assert.equal(r.calls.length, 0);
    assert.ok(r.url, 'a faixa vazia deve ter recebido o take');
  });
});
