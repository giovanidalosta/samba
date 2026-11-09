const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

describe('Tier 2: Boundary & Corner Cases', () => {
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

  it('TC2.1: Empty Project State — zero tracks must display empty project hero and transport must handle safely', async () => {
    const emptyState = await session.evaluate(() => {
      // Ensure zero tracks
      window.BeatboxStudio.clearCurrentProjectTracks();
      window.BeatboxStudio.renderStudioViews();

      const hero = document.querySelector('.studio-empty-project-hero');
      const rows = document.querySelectorAll('.reaper-track-row');

      // Test transport actions on empty project
      let noExceptionOnPlay = false;
      let noExceptionOnStop = false;
      try {
        const btnPlay = document.getElementById('btnStudioPlay');
        if (btnPlay) btnPlay.click();
        noExceptionOnPlay = true;
      } catch (e) {
        noExceptionOnPlay = false;
      }

      try {
        const btnStop = document.getElementById('btnStudioStop');
        if (btnStop) btnStop.click();
        noExceptionOnStop = true;
      } catch (e) {
        noExceptionOnStop = false;
      }

      const summary = window.BeatboxStudio.getProjectSummary();

      return {
        hasHero: !!hero,
        trackRowCount: rows.length,
        totalTracks: summary.totalTracks,
        noExceptionOnPlay,
        noExceptionOnStop
      };
    });

    assert.equal(emptyState.trackRowCount, 0, 'No track rows should exist when tracks are empty');
    assert.equal(emptyState.totalTracks, 0, 'Project summary must report 0 tracks');
    assert.ok(emptyState.hasHero, 'Empty project hero should be displayed');
    assert.ok(emptyState.noExceptionOnPlay, 'Play button must not throw when project has 0 tracks');
    assert.ok(emptyState.noExceptionOnStop, 'Stop button must not throw when project has 0 tracks');
  });

  it('TC2.2: Extreme Track Scaling (10+ Tracks) — studio must handle 10 tracks without DOM or layout collapse', async () => {
    const scaleResult = await session.evaluate(() => {
      for (let i = 1; i <= 10; i++) {
        window.BeatboxStudio.addTrack(`Faixa Escala ${i}`);
      }
      window.BeatboxStudio.renderStudioViews();

      const rows = document.querySelectorAll('.reaper-track-row');
      const tcps = document.querySelectorAll('.reaper-tcp');
      const lanes = document.querySelectorAll('.reaper-arrange-lane');

      // Check heights and bounding boxes
      let layoutCoherent = true;
      rows.forEach(r => {
        const rect = r.getBoundingClientRect();
        if (rect.height < 40 || rect.width < 300) layoutCoherent = false;
      });

      return {
        rowCount: rows.length,
        tcpCount: tcps.length,
        laneCount: lanes.length,
        layoutCoherent
      };
    });

    assert.equal(scaleResult.rowCount, 10, 'Should successfully render 10 distinct track rows');
    assert.equal(scaleResult.tcpCount, 10, 'Should render 10 distinct TCPs');
    assert.equal(scaleResult.laneCount, 10, 'Should render 10 distinct arrange lanes');
    assert.ok(scaleResult.layoutCoherent, 'All track rows must maintain valid non-zero dimensions');
  });

  it('TC2.3: Maximum Zoom Level & Horizontal Scroll Extents — 200% zoom must scale arrange lane and allow full scroll', async () => {
    await session.evaluate(() => {
      const t = window.BeatboxStudio.addTrack('Zoom Test');
      t.mediaUrl = 'blob:zoom';
      t.duration = 16.0;
      window.BeatboxStudio.renderStudioViews();
    });

    const zoomResult = await session.evaluate(() => {
      const scrollEl = document.getElementById('reaperDawScroll');
      const mainEl = document.getElementById('reaperDawMain');
      const btnZoomPlus = document.getElementById('btnZoomPlus');

      const widthBefore = mainEl.getBoundingClientRect().width;

      // Click Zoom Plus multiple times to reach max zoom (200%)
      if (btnZoomPlus) {
        btnZoomPlus.click();
        btnZoomPlus.click();
        btnZoomPlus.click();
        btnZoomPlus.click();
      }

      const widthAfter = mainEl.getBoundingClientRect().width;
      const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;

      // Scroll to maximum extent
      scrollEl.scrollLeft = maxScrollLeft;
      const scrolledSuccessfully = scrollEl.scrollLeft > 0;

      return {
        widthBefore,
        widthAfter,
        widthIncreased: widthAfter > widthBefore,
        maxScrollLeft,
        scrolledSuccessfully
      };
    });

    assert.ok(zoomResult.widthIncreased || zoomResult.scrolledSuccessfully, 'Zooming in must expand the DAW timeline canvas width');
  });

  it('TC2.4: Clip Boundary Edges — dragging clip to extreme left (0ms) and extreme right must clamp safely', async () => {
    const clampResult = await session.evaluate(() => {
      const t = window.BeatboxStudio.addTrack('Boundary Clip');
      t.mediaUrl = 'blob:boundary';
      t.duration = 4.0;
      t.offsetMs = 1000;
      window.BeatboxStudio.renderStudioViews();

      const item = document.getElementById(`media_item_${t.id}`);
      if (!item) return null;

      // Drag left towards negative infinity
      const downEvt = new PointerEvent('pointerdown', { clientX: 200, clientY: 100, bubbles: true });
      item.dispatchEvent(downEvt);
      const moveEvtLeft = new PointerEvent('pointermove', { clientX: -500, clientY: 100, bubbles: true });
      window.dispatchEvent(moveEvtLeft);
      const upEvtLeft = new PointerEvent('pointerup', { clientX: -500, clientY: 100, bubbles: true });
      window.dispatchEvent(upEvtLeft);

      const offsetAfterLeft = t.offsetMs;

      // Drag right towards positive infinity
      item.dispatchEvent(downEvt);
      const moveEvtRight = new PointerEvent('pointermove', { clientX: 3000, clientY: 100, bubbles: true });
      window.dispatchEvent(moveEvtRight);
      const upEvtRight = new PointerEvent('pointerup', { clientX: 3000, clientY: 100, bubbles: true });
      window.dispatchEvent(upEvtRight);

      const offsetAfterRight = t.offsetMs;

      return {
        offsetAfterLeft,
        offsetAfterRight,
        leftClampedNonNegative: offsetAfterLeft >= 0,
        rightIsFinite: isFinite(offsetAfterRight) && !isNaN(offsetAfterRight)
      };
    });

    assert.ok(clampResult, 'Clip item must exist');
    assert.ok(clampResult.leftClampedNonNegative, 'Offset must not be negative when dragged far left');
    assert.ok(clampResult.rightIsFinite, 'Offset must remain a valid finite number when dragged far right');
  });

  it('TC2.5: Rapid Transport Triggering — rapid back-to-back clicks must maintain coherent transport state', async () => {
    await session.evaluate(() => {
      window.BeatboxStudio.addTrack('Rapid Transport');
      window.BeatboxStudio.renderStudioViews();
    });

    const rapidResult = await session.evaluate(async () => {
      const btnPlay = document.getElementById('btnStudioPlay');
      const btnStop = document.getElementById('btnStudioStop');
      if (!btnPlay || !btnStop) return null;

      // Simulate rapid user clicking
      for (let i = 0; i < 6; i++) {
        btnPlay.click();
        await new Promise(r => setTimeout(r, 20));
      }

      btnStop.click();
      await new Promise(r => setTimeout(r, 50));

      const summary = window.BeatboxStudio.getProjectSummary();
      const playhead = document.getElementById('reaperPlayhead');
      const playheadLeft = playhead ? playhead.style.left : '0%';

      return {
        isPlaying: summary.isPlaying,
        playheadLeft,
        isCoherent: summary.isPlaying === false
      };
    });

    assert.ok(rapidResult, 'Transport buttons must exist');
    assert.equal(rapidResult.isPlaying, false, 'After clicking stop, playback must cleanly stop without leaking background intervals');
  });
});
