const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

describe('Global Menus, Responsive Viewports (390x844 & 1280x800) & Usability Suite', () => {
  let session;

  async function setViewport(width, height, mobile = false) {
    await session.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: mobile ? 2 : 1,
      mobile
    });
    await session.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await new Promise(r => setTimeout(r, 60));
  }

  before(async () => {
    session = await launchBrowser();
  });

  after(async () => {
    if (session) await session.close();
    stopSpawnedServer();
  });

  beforeEach(async () => {
    await setViewport(1280, 800, false);
    await session.resetStudioState();
  });

  describe('1. Home (#tab-home), Orientation Banner & New Breque Modal', () => {
    it('hides #mobileOrientHint on Home, Mosaic, and Record views on 390x844 portrait, showing only on timeline/grid views', async () => {
      await setViewport(390, 844, true);

      const states = await session.evaluate(() => {
        sessionStorage.removeItem('orient_hint_dismissed');
        switchTab('tab-home');
        const onHome = getComputedStyle(document.getElementById('mobileOrientHint')).display;

        switchTab('tab-sequencer');
        const onSequencer = getComputedStyle(document.getElementById('mobileOrientHint')).display;

        switchTab('tab-beatbox');
        window.BeatboxStudio.switchViewMode('timeline');
        const onTimeline = getComputedStyle(document.getElementById('mobileOrientHint')).display;

        window.BeatboxStudio.switchViewMode('mosaic');
        const onMosaic = getComputedStyle(document.getElementById('mobileOrientHint')).display;

        window.BeatboxStudio.switchViewMode('record');
        const onRecord = getComputedStyle(document.getElementById('mobileOrientHint')).display;

        switchTab('tab-home');
        const backOnHome = getComputedStyle(document.getElementById('mobileOrientHint')).display;

        return { onHome, onSequencer, onTimeline, onMosaic, onRecord, backOnHome };
      });

      assert.equal(states.onHome, 'none', 'Orient hint must NOT appear on Home');
      assert.equal(states.onSequencer, 'flex', 'Orient hint should appear on Pad Sequencer in portrait mobile');
      assert.equal(states.onTimeline, 'flex', 'Orient hint should appear on Multitrack Timeline in portrait mobile');
      assert.equal(states.onMosaic, 'none', 'Orient hint must hide on Mosaic view');
      assert.equal(states.onRecord, 'none', 'Orient hint must hide on Record cabin view');
      assert.equal(states.backOnHome, 'none', 'Orient hint must hide when returning to Home');
    });

    it('renders streamlined Home breque cards without redundant dual mode buttons and enforces 120 BPM modal defaults & dialog semantics', async () => {
      const check = await session.evaluate(() => {
        createNewBrequeProject({ name: 'Ideia Teste', bpm: 120, measures: 4, initialMode: 'studio' });
        switchTab('tab-home');
        const firstCard = document.querySelector('.home-breque-card');
        const padBtns = firstCard ? firstCard.querySelectorAll('.btn-card-pad').length : -1;
        const studioBtns = firstCard ? firstCard.querySelectorAll('.btn-card-multitrack').length : -1;

        openModalNewBreque();
        const modal = document.getElementById('modalNewBreque');
        const role = modal.getAttribute('role');
        const ariaModal = modal.getAttribute('aria-modal');
        const cardRecordTag = document.getElementById('cardChoiceRecord').tagName;
        const cardPadTag = document.getElementById('cardChoicePad').tagName;
        const recBpm = document.getElementById('inputRecordBpm').value;
        const padBpm = document.getElementById('inputNewBrequeBpm').value;
        closeModalNewBreque();

        return { padBtns, studioBtns, role, ariaModal, cardRecordTag, cardPadTag, recBpm, padBpm };
      });

      assert.equal(check.padBtns + check.studioBtns, 1, 'Card should show exactly 1 non-redundant alternate mode shortcut');
      assert.equal(check.role, 'dialog');
      assert.equal(check.ariaModal, 'true');
      assert.equal(check.cardRecordTag, 'BUTTON');
      assert.equal(check.cardPadTag, 'BUTTON');
      assert.equal(check.recBpm, '120');
      assert.equal(check.padBpm, '120');
    });
  });

  describe('2. Global Header (#appMainHeader) Layout & Non-Overlap', () => {
    it('prevents zone overlap, centers desktop mode switch, and prevents title crushing across 1280x800, 820x800, 390x844, 360x640, and 320x568', async () => {
      for (const vp of [
        { w: 1280, h: 800, mob: false, minTitleW: 110, checkCentered: true },
        { w: 820, h: 800, mob: false, minTitleW: 110, checkCentered: false },
        { w: 390, h: 844, mob: true, minTitleW: 130, checkCentered: false },
        { w: 360, h: 640, mob: true, minTitleW: 110, checkCentered: false },
        { w: 320, h: 568, mob: true, minTitleW: 88, checkCentered: false }
      ]) {
        await setViewport(vp.w, vp.h, vp.mob);
        const metrics = await session.evaluate((longTitle) => {
          createNewBrequeProject({ name: longTitle, bpm: 120, measures: 4, initialMode: 'studio' });
          switchTab('tab-beatbox');
          const left = document.querySelector('.header-left-zone').getBoundingClientRect();
          const center = document.querySelector('.header-center-zone').getBoundingClientRect();
          const right = document.querySelector('.header-right-zone').getBoundingClientRect();
          const titleBtn = document.getElementById('btnEditBrequeTitle').getBoundingClientRect();
          const newBtn = document.getElementById('btnHeaderNewBreque').getBoundingClientRect();

          // Also verify short default title ("Ideia 1") is never truncated with ellipsis
          createNewBrequeProject({ name: 'Ideia 1', bpm: 120, measures: 4, initialMode: 'studio' });
          switchTab('tab-beatbox');
          const nameEl = document.querySelector('#btnEditBrequeTitle .project-title-name');
          const shortFits = nameEl.scrollWidth <= Math.ceil(nameEl.getBoundingClientRect().width) + 1;

          return {
            leftRight: left.right,
            centerLeft: center.left,
            centerRight: center.right,
            centerMid: (center.left + center.right) / 2,
            rightLeft: right.left,
            titleWidth: titleBtn.width,
            newBtnVisible: newBtn.width >= 28 && newBtn.right <= window.innerWidth,
            shortFits
          };
        }, 'Samba Enredo Virada Especial da Bateria 2026');

        assert.ok(metrics.leftRight <= metrics.centerLeft + 1, `Left zone overlapped center zone at ${vp.w}px (${metrics.leftRight} > ${metrics.centerLeft})`);
        assert.ok(metrics.centerRight <= metrics.rightLeft + 1, `Center zone overlapped right zone at ${vp.w}px (${metrics.centerRight} > ${metrics.rightLeft})`);
        assert.ok(metrics.titleWidth >= vp.minTitleW, `Title pill too narrow (${metrics.titleWidth}px) at ${vp.w}px`);
        assert.ok(metrics.shortFits, `"Ideia 1" crushed with ellipsis at ${vp.w}px`);
        assert.ok(metrics.newBtnVisible, `+ Novo Breque button must be visible inside viewport at ${vp.w}px`);
        if (vp.checkCentered) {
          assert.ok(Math.abs(metrics.centerMid - vp.w / 2) <= 4, `Mode switch off-center on ${vp.w}px desktop (mid=${metrics.centerMid})`);
        }
      }
    });
  });

  describe('3. Estúdio Multitrack Menus, Z-Index, Mutual Exclusion, 1-Track Kebab & Mobile Usability', () => {
    it('exposes Faixas | Mosaico | Cabine without horizontal toolbar scroll on 390x844, enforces comfortable touch targets, and renders popovers unclipped', async () => {
      await setViewport(390, 844, true);

      const navMetrics = await session.evaluate(() => {
        switchTab('tab-beatbox');
        window.BeatboxStudio.addTrack('Surdo 1');
        window.BeatboxStudio.renderStudioViews();

        const toolbar = document.querySelector('#tab-beatbox .studio-toolbar');
        const btnFaixas = document.getElementById('btnViewTimeline').getBoundingClientRect();
        const btnMosaico = document.getElementById('btnViewMosaic').getBoundingClientRect();
        const btnCabine = document.getElementById('btnViewRecord');
        const cabineRect = btnCabine.getBoundingClientRect();
        const btnRecTransport = document.getElementById('btnStudioRecord');
        const metroH = document.getElementById('btnStudioMetronome').getBoundingClientRect().height;
        const tapH = document.getElementById('btnStudioTap').getBoundingClientRect().height;
        const moreR = document.querySelector('.tcp-btn-more').getBoundingClientRect();
        const muteR = document.querySelector('.tcp-btn-mute').getBoundingClientRect();

        return {
          scrollWidth: toolbar.scrollWidth,
          clientWidth: toolbar.clientWidth,
          faixasInView: btnFaixas.left >= 0 && btnFaixas.right <= 390,
          mosaicoInView: btnMosaico.left >= 0 && btnMosaico.right <= 390,
          cabineInView: cabineRect.left >= 0 && cabineRect.right <= 390,
          viewBtnHeight: btnFaixas.height,
          metroH,
          tapH,
          moreSize: [moreR.width, moreR.height],
          muteSize: [muteR.width, muteR.height],
          cabineText: btnCabine.textContent.trim(),
          recTransportText: btnRecTransport.textContent.trim()
        };
      });

      assert.ok(navMetrics.scrollWidth <= navMetrics.clientWidth + 1, `Mobile studio toolbar overflowed horizontally: ${navMetrics.scrollWidth} > ${navMetrics.clientWidth}`);
      assert.ok(navMetrics.faixasInView, 'Faixas button must be visible within 390px');
      assert.ok(navMetrics.mosaicoInView, 'Mosaico button must be visible within 390px');
      assert.ok(navMetrics.cabineInView, 'Cabine button must be visible within 390px');
      assert.ok(navMetrics.viewBtnHeight >= 26, `View switch touch target too short (${navMetrics.viewBtnHeight}px)`);
      assert.ok(navMetrics.metroH >= 26 && navMetrics.tapH >= 26, `Metronome/Tap touch targets too short (${navMetrics.metroH}px, ${navMetrics.tapH}px)`);
      assert.ok(navMetrics.moreSize[0] >= 28 && navMetrics.moreSize[1] >= 28, `Kebab button too small: ${navMetrics.moreSize}`);
      assert.ok(navMetrics.muteSize[0] >= 28 && navMetrics.muteSize[1] >= 28, `Mute button too small: ${navMetrics.muteSize}`);
      assert.ok(navMetrics.cabineText.includes('Cabine'), 'Recording view tab should be disambiguated as Cabine');
      assert.ok(navMetrics.recTransportText.includes('Gravar'), 'Master transport record button should keep Gravar');

      // Open Settings popover on mobile & hit-test
      await session.click('#btnToggleSettingsPopover');
      const settingsCheck = await session.evaluate(() => {
        const pop = document.getElementById('studioSettingsPopover');
        const r = pop.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2);
        const cy = Math.round(r.top + r.height / 2);
        const hit = document.elementFromPoint(cx, cy);
        const defaultMeasures = document.getElementById('studioMeasures')?.value;
        return {
          open: pop.classList.contains('open'),
          inViewport: r.width > 200 && r.left >= 0 && r.right <= 390 && r.top >= 0 && r.bottom <= 844,
          hitInside: !!(hit && pop.contains(hit)),
          defaultMeasures
        };
      });
      assert.ok(settingsCheck.open && settingsCheck.inViewport && settingsCheck.hitInside, `Mobile #studioSettingsPopover clipped or occluded: ${JSON.stringify(settingsCheck)}`);
      assert.equal(settingsCheck.defaultMeasures, '4', '#studioMeasures should default to 4 measures');

      // Open Project & Export popover on mobile & hit-test
      await session.click('#btnToggleProjectPopover');
      const projectCheck = await session.evaluate(() => {
        const pop = document.getElementById('studioProjectPopover');
        const r = pop.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2);
        const cy = Math.round(r.top + r.height / 2);
        const hit = document.elementFromPoint(cx, cy);
        return {
          open: pop.classList.contains('open'),
          inViewport: r.width > 200 && r.left >= 0 && r.right <= 390 && r.top >= 0 && r.bottom <= 844,
          hitInside: !!(hit && pop.contains(hit))
        };
      });
      assert.ok(projectCheck.open && projectCheck.inViewport && projectCheck.hitInside, `Mobile #studioProjectPopover clipped or occluded: ${JSON.stringify(projectCheck)}`);
      await session.dispatchKey('Escape', 'Escape');
    });

    it('keeps desktop 1280x800 toolbar single-row, clamps popovers on narrow/landscape viewports, enforces kebab/popover mutual exclusion, and never clips 1-track Delete', async () => {
      await setViewport(1280, 800, false);

      const singleRowTb = await session.evaluate(() => {
        switchTab('tab-beatbox');
        window.BeatboxStudio.addTrack('Faixa Única');
        window.BeatboxStudio.renderStudioViews();
        return document.querySelector('#tab-beatbox .studio-toolbar').getBoundingClientRect().height;
      });
      assert.ok(singleRowTb <= 60, `Desktop 1280x800 studio toolbar wrapped into multi-row bar (${singleRowTb}px)`);

      await session.click('#btnToggleSettingsPopover');
      const zCheck = await session.evaluate(() => {
        const pop = document.getElementById('studioSettingsPopover');
        const ruler = document.querySelector('.reaper-ruler-header');
        const pr = pop.getBoundingClientRect();
        const rr = ruler.getBoundingClientRect();
        const overlapTop = Math.max(pr.top + 4, rr.top + 2);
        const overlapBottom = Math.min(pr.bottom - 4, rr.bottom - 2);
        const testY = overlapBottom > overlapTop ? Math.round((overlapTop + overlapBottom) / 2) : Math.round(pr.top + 20);
        const testX = Math.round(pr.left + pr.width / 2);
        const hit = document.elementFromPoint(testX, testY);
        return {
          hitInsidePopover: !!(hit && pop.contains(hit)),
          hitTag: hit ? hit.className : null
        };
      });
      assert.ok(zCheck.hitInsidePopover, `Desktop #studioSettingsPopover was painted under ${zCheck.hitTag}`);

      // Verify bidirectional mutual exclusion between track kebab (⋯) and toolbar popovers
      await session.click('.tcp-btn-more');
      const afterKebab = await session.evaluate(() => ({
        kebabOpen: Array.from(document.querySelectorAll('.tcp-menu-dropdown')).some(d => d.style.display !== 'none'),
        settingsOpen: document.getElementById('studioSettingsPopover').classList.contains('open')
      }));
      assert.ok(afterKebab.kebabOpen && !afterKebab.settingsOpen, `Opening kebab must close toolbar popover: ${JSON.stringify(afterKebab)}`);

      await session.click('#btnToggleSettingsPopover');
      const afterSettings = await session.evaluate(() => ({
        kebabOpen: Array.from(document.querySelectorAll('.tcp-menu-dropdown')).some(d => d.style.display !== 'none'),
        settingsOpen: document.getElementById('studioSettingsPopover').classList.contains('open')
      }));
      assert.ok(!afterSettings.kebabOpen && afterSettings.settingsOpen, `Opening toolbar popover must close kebab: ${JSON.stringify(afterSettings)}`);

      // Verify Escape dismisses open toolbar popover
      await session.dispatchKey('Escape', 'Escape');
      const afterEsc = await session.evaluate(() => document.getElementById('studioSettingsPopover').classList.contains('open'));
      assert.equal(afterEsc, false, 'Escape key must dismiss #studioSettingsPopover');

      // Verify narrow desktop (770x800) & mobile landscape (844x390) clamping of #studioProjectPopover
      for (const vp of [{ w: 770, h: 800, mob: false }, { w: 844, h: 390, mob: true }]) {
        await setViewport(vp.w, vp.h, vp.mob);
        await session.click('#btnToggleProjectPopover');
        const bounds = await session.evaluate(() => {
          const r = document.getElementById('studioProjectPopover').getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: window.innerWidth, vh: window.innerHeight };
        });
        assert.ok(bounds.left >= 0 && bounds.right <= bounds.vw && bounds.top >= 0 && bounds.bottom <= bounds.vh, `#studioProjectPopover clipped at ${vp.w}x${vp.h}: ${JSON.stringify(bounds)}`);
        await session.dispatchKey('Escape', 'Escape');
      }

      // Open 1-track kebab menu across desktop (1280), mobile (390), and compact mobile (360)
      for (const vp of [{ w: 1280, h: 800, mob: false }, { w: 390, h: 844, mob: true }, { w: 360, h: 640, mob: true }]) {
        await setViewport(vp.w, vp.h, vp.mob);
        await session.click('.tcp-btn-more');
        const kebabCheck = await session.evaluate(() => {
          const delBtn = document.querySelector('.tcp-menu-dropdown .tcp-menu-delete');
          if (!delBtn) return { found: false };
          const r = delBtn.getBoundingClientRect();
          const cx = Math.round(r.left + r.width / 2);
          const cy = Math.round(r.top + r.height / 2);
          const hit = document.elementFromPoint(cx, cy);
          return {
            found: true,
            inViewport: r.width > 80 && r.height >= 20 && r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight,
            clickable: !!(hit && (hit === delBtn || delBtn.contains(hit)))
          };
        });
        assert.ok(kebabCheck.found && kebabCheck.inViewport && kebabCheck.clickable, `1-track kebab Delete clipped at ${vp.w}x${vp.h}: ${JSON.stringify(kebabCheck)}`);
        await session.dispatchKey('Escape', 'Escape');
      }
    });

    it('keeps TCP controls & add-track lane unclipped on 390x844 mobile and locks horizontal scroll during clip drag', async () => {
      await setViewport(390, 844, true);

      const mobileTimeline = await session.evaluate(async () => {
        switchTab('tab-beatbox');
        const t = window.BeatboxStudio.addTrack('Caixa');
        // Synthesize a short valid WAV blob to attach media clip
        const sr = 8000;
        const samples = sr; // 1s
        const buf = new ArrayBuffer(44 + samples * 2);
        const view = new DataView(buf);
        const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
        writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); writeStr(8, 'WAVE');
        writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        writeStr(36, 'data'); view.setUint32(40, samples * 2, true);
        await window.BeatboxStudio.importSequencerBounce(new Blob([buf], { type: 'audio/wav' }), 1.0, 120, '2/4', 4, 'Surdo Bounce');

        const tcp = document.querySelector('.reaper-tcp');
        const tcpRect = tcp.getBoundingClientRect();
        const pipDisplay = getComputedStyle(tcp.querySelector('.tcp-media-pip')).display;
        const soloRect = tcp.querySelector('.tcp-btn-solo').getBoundingClientRect();
        const addInnerRect = document.querySelector('.reaper-add-track-lane .add-lane-inner').getBoundingClientRect();

        const scroller = document.getElementById('reaperDawScroll');
        scroller.scrollLeft = 120;
        return {
          pipDisplay,
          soloFitsTcp: soloRect.right <= tcpRect.right + 1,
          addTrackVisible: addInnerRect.left >= 0 && addInnerRect.right <= 390,
          scrollBefore: scroller.scrollLeft
        };
      });

      assert.equal(mobileTimeline.pipDisplay, 'none', 'TCP media pip must hide on mobile so it never overflows into waveform');
      assert.ok(mobileTimeline.soloFitsTcp, 'Solo button must fit inside mobile TCP bounds');
      assert.ok(mobileTimeline.addTrackVisible, 'Add-track footer label must be visible within 390px viewport');

      await session.drag('.reaper-media-item', { dx: 60, dy: 0, steps: 8 });
      const afterDrag = await session.evaluate(() => {
        const scroller = document.getElementById('reaperDawScroll');
        return { scrollAfter: scroller.scrollLeft };
      });
      assert.equal(afterDrag.scrollAfter, mobileTimeline.scrollBefore, 'Horizontal scrollLeft must not jump when dragging audio clip on mobile');
    });
  });

  describe('4. Mosaic & Record Cabin Above-the-Fold & Mobile Clipping Fixes', () => {
    it('keeps Mosaic clear/delete buttons inside 390px, keeps 4-track Mosaic above 1280x800 fold, and keeps Record start button above fold on 1280x800, 390x844 & 844x390', async () => {
      await setViewport(390, 844, true);
      const mosaicMob = await session.evaluate(async () => {
        switchTab('tab-beatbox');
        const sr = 8000;
        const buf = new ArrayBuffer(44 + sr * 2);
        const view = new DataView(buf);
        const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
        writeStr(0, 'RIFF'); view.setUint32(4, 36 + sr * 2, true); writeStr(8, 'WAVE');
        writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        writeStr(36, 'data'); view.setUint32(40, sr * 2, true);
        await window.BeatboxStudio.importSequencerBounce(new Blob([buf], { type: 'audio/wav' }), 1.0, 120, '2/4', 4, 'Repique');
        for (let i = 2; i <= 4; i++) window.BeatboxStudio.addTrack('Faixa ' + i);
        await window.BeatboxStudio.switchViewMode('mosaic');
        const clearBtn = document.querySelector('.mosaic-workspace .btn-clear-media');
        const syncPill = document.querySelector('.mosaic-workspace .mosaic-sync-pill');
        const syncStep = document.querySelector('.mosaic-workspace .mosaic-sync-step').getBoundingClientRect();
        const r = clearBtn.getBoundingClientRect();
        return {
          hasSyncPill: !!syncPill,
          syncStepSize: [syncStep.width, syncStep.height],
          clearRight: r.right,
          clearWidth: r.width
        };
      });
      assert.ok(mosaicMob.hasSyncPill, 'Mosaic should use compact sync pill');
      assert.ok(mosaicMob.syncStepSize[0] >= 25 && mosaicMob.syncStepSize[1] >= 25, `Mosaic sync step too small: ${mosaicMob.syncStepSize}`);
      assert.ok(mosaicMob.clearWidth >= 28 && mosaicMob.clearRight <= 390, `Mosaic clear button clipped at 390px: right=${mosaicMob.clearRight}`);

      // Verify 4-track Mosaic fits above the 800px fold on 1280x800 desktop
      await setViewport(1280, 800, false);
      const mosaicDesktop = await session.evaluate(() => {
        const bottoms = Array.from(document.querySelectorAll('#mosaicGrid .track-card')).map(c => c.getBoundingClientRect().bottom);
        return { cardCount: bottoms.length, maxBottom: Math.max(...bottoms) };
      });
      assert.equal(mosaicDesktop.cardCount, 5, '4 tracks + Add Track card expected in Mosaic');
      assert.ok(mosaicDesktop.maxBottom <= 800, `4-track Mosaic cards pushed below 800px fold on 1280x800 (bottom=${mosaicDesktop.maxBottom})`);

      // Check Record Cabin #btnStartRecord above fold on 390x844, 1280x800, AND 844x390 landscape
      for (const vp of [
        { w: 390, h: 844, mob: true },
        { w: 1280, h: 800, mob: false },
        { w: 844, h: 390, mob: true }
      ]) {
        await setViewport(vp.w, vp.h, vp.mob);
        const recRect = await session.evaluate(async () => {
          await window.BeatboxStudio.switchViewMode('record');
          const btn = document.getElementById('btnStartRecord');
          const r = btn.getBoundingClientRect();
          const statMode = document.getElementById('statViewMode')?.textContent;
          return { top: r.top, bottom: r.bottom, height: r.height, vh: window.innerHeight, statMode };
        });
        assert.equal(recRect.statMode, 'Modo: Cabine', '#statViewMode should report Modo: Cabine in record view');
        assert.ok(recRect.height >= 28 && recRect.bottom <= recRect.vh, `#btnStartRecord pushed below fold at ${vp.w}x${vp.h}: bottom=${recRect.bottom} > ${recRect.vh}`);
      }
    });
  });

  describe('5. Pad Sequenciador (#tab-sequencer) Toolbar Popovers, Interactive Persistence & 8-Track Mobile Headers', () => {
    it('groups sequencer controls cleanly, keeps #seqSettingsPopover open when clicking internal controls, and renders all 8 mobile track headers & ruler aligned', async () => {
      await setViewport(1280, 800, false);
      const desktopSeq = await session.evaluate(() => {
        switchTab('tab-sequencer');
        const tb = document.querySelector('#tab-sequencer .seq-studio-toolbar');
        return { height: tb.getBoundingClientRect().height };
      });
      assert.ok(desktopSeq.height <= 68, `Desktop sequencer toolbar wrapped into tall multi-row bar (${desktopSeq.height}px)`);

      // Verify desktop hit-test AND interactive persistence inside #seqSettingsPopover (#btnPreRoll + #meterSelect)
      await session.click('#btnToggleSeqSettings');
      const preBefore = await session.evaluate(() => document.getElementById('btnPreRoll').textContent.trim());
      await session.click('#btnPreRoll');
      await session.click('#meterSelect');
      const seqDesktopInteract = await session.evaluate((beforeTxt) => {
        const pop = document.getElementById('seqSettingsPopover');
        const r = pop.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + 30));
        return {
          stillOpen: pop.classList.contains('open'),
          preRollToggled: document.getElementById('btnPreRoll').textContent.trim() !== beforeTxt,
          hitInside: !!(hit && pop.contains(hit))
        };
      }, preBefore);
      assert.ok(seqDesktopInteract.stillOpen && seqDesktopInteract.preRollToggled && seqDesktopInteract.hitInside, `#seqSettingsPopover closed prematurely or occluded on desktop: ${JSON.stringify(seqDesktopInteract)}`);
      await session.dispatchKey('Escape', 'Escape');

      await setViewport(390, 844, true);
      const mobileSeq = await session.evaluate(() => {
        switchTab('tab-sequencer');
        const tb = document.querySelector('#tab-sequencer .seq-studio-toolbar');
        const headers = Array.from(document.querySelectorAll('#tracksWrapper .track-header'));
        const rulerLeft = document.querySelector('#rulerRow .measure-group').getBoundingClientRect().left;
        const firstCellLeft = document.querySelector('#tracksWrapper .step-cell').getBoundingClientRect().left;
        const headerMetrics = headers.map(h => {
          const hr = h.getBoundingClientRect();
          const nameRect = h.querySelector('.track-name').getBoundingClientRect();
          const grooveRect = h.querySelector('.inst-groove-select').getBoundingClientRect();
          const sliderRect = h.querySelector('.inst-vol-slider').getBoundingClientRect();
          return {
            name: h.querySelector('.track-name').textContent.trim(),
            nameWidth: nameRect.width,
            grooveWidth: grooveRect.width,
            sliderOverflow: sliderRect.right - hr.right
          };
        });
        return {
          tbScrollW: tb.scrollWidth,
          tbClientW: tb.clientWidth,
          trackCount: headers.length,
          rulerDelta: Math.abs(rulerLeft - firstCellLeft),
          headerMetrics
        };
      });

      assert.ok(mobileSeq.tbScrollW <= mobileSeq.tbClientW + 1, `Mobile sequencer toolbar overflowed horizontally: ${mobileSeq.tbScrollW} > ${mobileSeq.tbClientW}`);
      assert.equal(mobileSeq.trackCount, 8, 'Expected all 8 Samba instrument tracks');
      assert.ok(mobileSeq.rulerDelta <= 1.5, `Pad mobile ruler misaligned with step cells by ${mobileSeq.rulerDelta}px`);
      for (const m of mobileSeq.headerMetrics) {
        assert.ok(m.nameWidth >= 55, `Track "${m.name}" collapsed on mobile (${m.nameWidth}px)`);
        // Task 12: levada e volume saem do cabeçalho (≤600px) e vivem no bottom sheet; ver TR12.* em review_pad_ux.test.js
        assert.ok(m.sliderOverflow <= 1, `Volume slider overflowed track header on "${m.name}" by ${m.sliderOverflow}px`);
      }

      // Open #seqSettingsPopover and #seqActionsPopover on mobile and verify unclipped bottom sheet + mutual exclusion
      await session.click('#btnToggleSeqSettings');
      const seqPop1 = await session.evaluate(() => {
        const p1 = document.getElementById('seqSettingsPopover');
        const r = p1.getBoundingClientRect();
        return {
          open: p1.classList.contains('open'),
          inView: r.left >= 0 && r.right <= 390 && r.top >= 0 && r.bottom <= 844,
          hasControls: !!p1.querySelector('#meterSelect') && !!p1.querySelector('#subdivSelect') && !!p1.querySelector('#btnPreRoll') && !!p1.querySelector('#btnClear')
        };
      });
      assert.ok(seqPop1.open && seqPop1.inView && seqPop1.hasControls, `Mobile #seqSettingsPopover invalid: ${JSON.stringify(seqPop1)}`);

      await session.click('#btnToggleSeqActions');
      const seqPop2 = await session.evaluate(() => {
        const p1 = document.getElementById('seqSettingsPopover');
        const p2 = document.getElementById('seqActionsPopover');
        const r = p2.getBoundingClientRect();
        return {
          p1Closed: !p1.classList.contains('open'),
          p2Open: p2.classList.contains('open'),
          inView: r.left >= 0 && r.right <= 390 && r.top >= 0 && r.bottom <= 844,
          hasActions: !!p2.querySelector('#btnSaveToMyBreques') && !!p2.querySelector('#btnShareLink') && !!p2.querySelector('#btnExportJSON') && !!p2.querySelector('#btnImportJSON')
        };
      });
      assert.ok(seqPop2.p1Closed && seqPop2.p2Open && seqPop2.inView && seqPop2.hasActions, `Mobile #seqActionsPopover invalid: ${JSON.stringify(seqPop2)}`);
    });
  });
});
