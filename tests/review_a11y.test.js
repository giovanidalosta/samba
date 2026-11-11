const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

describe('Revisão 2026-11-10: acessibilidade, toast e rótulos', () => {
  let session;

  before(async () => {
    session = await launchBrowser();
  });

  after(async () => {
    if (session) await session.close();
    stopSpawnedServer();
  });

  beforeEach(async () => {
    await session.resetStudioState();
  });

  it('TR3.1: foco por teclado mostra anel dourado visível', async () => {
    await session.evaluate(() => window.switchTab('tab-home'));
    await session.dispatchKey('Tab', 'Tab');
    const res = await session.evaluate(() => {
      const btn = document.getElementById('btnHeaderNewBreque');
      btn.focus();
      const cs = getComputedStyle(btn);
      return { fv: btn.matches(':focus-visible'), style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor };
    });
    assert.ok(res.fv, 'botão deve estar em :focus-visible');
    assert.equal(res.style, 'solid');
    assert.ok(res.width >= 2, `outline >= 2px, recebido ${res.width}`);
    assert.equal(res.color, 'rgb(232, 195, 27)');
  });

  it('TR3.2: logo tem texto alternativo correto', async () => {
    const alt = await session.evaluate(() => document.querySelector('img.brand-logo')?.alt);
    assert.equal(alt, 'Naumteria Studio');
  });

  it('TR3.3: botões visíveis da Home têm nome acessível com palavras', async () => {
    const bad = await session.evaluate(() => {
      window.switchTab('tab-home');
      return [...document.querySelectorAll('button')]
        .filter(b => b.offsetParent !== null)
        .map(b => (b.getAttribute('aria-label') || b.textContent || b.title || '').trim())
        .filter(name => !/[A-Za-zÀ-ú]{3,}/.test(name));
    });
    assert.deepEqual(bad, [], `botões sem nome legível: ${JSON.stringify(bad)}`);
  });

  it('TR3.4: prefers-reduced-motion zera transições', async () => {
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const dur = await session.evaluate(() => getComputedStyle(document.getElementById('btnHeaderNewBreque')).transitionDuration);
    await session.send('Emulation.setEmulatedMedia', { features: [] });
    assert.ok(dur.split(',').every(d => parseFloat(d) <= 0.01), `transição deveria ser ~0, recebido ${dur}`);
  });

  it('TR4.1: appToast trata a mensagem como texto', async () => {
    const res = await session.evaluate(async () => {
      window.__xss = undefined;
      window.appToast('<img src=x onerror="window.__xss=1">', 'info');
      await new Promise(r => setTimeout(r, 100));
      const toasts = [...document.querySelectorAll('body *')].filter(el => el.textContent.includes('<img src=x'));
      return { xss: window.__xss, imgInjected: !!document.querySelector('img[src="x"]'), shownAsText: toasts.length > 0 };
    });
    assert.equal(res.xss, undefined);
    assert.equal(res.imgInjected, false);
    assert.ok(res.shownAsText, 'mensagem deve aparecer literalmente');
  });

  it('TR5.1 / TR5.2: régua usa "Comp." e Mosaico não diz "Boca"', async () => {
    const res = await session.evaluate(async () => {
      window.BeatboxStudio.addTrack('Teste');
      window.BeatboxStudio.renderStudioViews();
      const ruler = [...document.querySelectorAll('.ruler-bar-item')].map(e => e.textContent).join(' ');
      return { ruler };
    });
    assert.doesNotMatch(res.ruler, /\bBar\b/);
    assert.match(res.ruler, /Comp\. 1/);
    const src = await session.evaluate(() => fetch('beatbox_studio.js').then(r => r.text()));
    assert.ok(!src.includes('(Boca)'), 'rótulo "(Boca)" removido');
  });

  it('TR5.3: badge de sync some com 0ms e aparece com offset', async () => {
    const r = await session.evaluate(() => {
      const el = document.createElement('span');
      el.className = 'item-meta-tag item-sync-badge';
      document.body.appendChild(el);
      window.BeatboxStudio.setSyncBadge(el, 0);
      const zero = { cls: el.classList.contains('is-zero'), display: getComputedStyle(el).display, text: el.textContent };
      window.BeatboxStudio.setSyncBadge(el, 20);
      const twenty = { cls: el.classList.contains('is-zero'), display: getComputedStyle(el).display, text: el.textContent };
      el.remove();
      return { zero, twenty };
    });
    assert.equal(r.zero.cls, true);
    assert.equal(r.zero.display, 'none');
    assert.equal(r.zero.text, '+0ms');
    assert.equal(r.twenty.cls, false);
    assert.equal(r.twenty.text, '+20ms');
  });
});
