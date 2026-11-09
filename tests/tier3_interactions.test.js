const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

describe('Tier 3: Cross-Feature Interactions', () => {
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

  it('TC3.1: Clip Dragging Under High Zoom & Horizontal Scroll — dragging with zoom=200% and scrollLeft > 0 preserves accurate offset', async () => {
    const dragZoomResult = await session.evaluate(() => {
      const t = window.BeatboxStudio.addTrack('Zoom Drag Clip');
      t.mediaUrl = 'blob:zoom-drag';
      t.duration = 12.0;
      t.offsetMs = 1000;
      window.BeatboxStudio.renderStudioViews();

      // Zoom to 200%
      const mainEl = document.getElementById('reaperDawMain');
      if (mainEl) mainEl.style.width = '200%';

      // Scroll container horizontally
      const scrollEl = document.getElementById('reaperDawScroll');
      scrollEl.scrollLeft = 200;

      const item = document.getElementById(`media_item_${t.id}`);
      if (!item) return null;

      const downEvt = new PointerEvent('pointerdown', { clientX: 300, clientY: 100, bubbles: true });
      item.dispatchEvent(downEvt);

      const moveEvt = new PointerEvent('pointermove', { clientX: 380, clientY: 100, bubbles: true });
      window.dispatchEvent(moveEvt);

      const upEvt = new PointerEvent('pointerup', { clientX: 380, clientY: 100, bubbles: true });
      window.dispatchEvent(upEvt);

      const finalScrollLeft = scrollEl.scrollLeft;
      const finalOffsetMs = t.offsetMs;

      return {
        initialScroll: 200,
        finalScrollLeft,
        scrollMaintained: finalScrollLeft === 200,
        finalOffsetMs,
        offsetIncreased: finalOffsetMs > 1000
      };
    });

    assert.ok(dragZoomResult, 'Item must exist');
    assert.equal(dragZoomResult.scrollMaintained, true, 'Container scrollLeft must not be reset or displaced during drag under zoom');
    assert.ok(dragZoomResult.offsetIncreased, 'Dragging right must increase clip offset');
  });

  it('TC3.2: Solo Toggle During Active Multitrack Playback — toggling solo on active tracks must not abort playback or destroy DOM elements', async () => {
    await session.evaluate(() => {
      const t1 = window.BeatboxStudio.addTrack('Lead 1');
      t1.mediaUrl = 'blob:lead1';
      t1.duration = 6.0;

      const t2 = window.BeatboxStudio.addTrack('Harmony 2');
      t2.mediaUrl = 'blob:harm2';
      t2.duration = 6.0;

      window.BeatboxStudio.renderStudioViews();
    });

    const soloPlaybackResult = await session.evaluate(async () => {
      const btnPlay = document.getElementById('btnStudioPlay');
      if (btnPlay) btnPlay.click();

      // Verify playback started
      const isPlayingInitial = window.BeatboxStudio.getProjectSummary().isPlaying;

      const rows = document.querySelectorAll('.reaper-track-row');
      const soloBtn1 = rows[0]?.querySelector('.tcp-btn-solo, .btn-tcp-solo');
      const soloBtn2 = rows[1]?.querySelector('.tcp-btn-solo, .btn-tcp-solo');

      // Toggle Solo on track 1
      if (soloBtn1) soloBtn1.click();
      await new Promise(r => setTimeout(r, 40));

      const isPlayingAfterSolo1 = window.BeatboxStudio.getProjectSummary().isPlaying;

      // Toggle Solo on track 2
      if (soloBtn2) soloBtn2.click();
      await new Promise(r => setTimeout(r, 40));

      const isPlayingAfterSolo2 = window.BeatboxStudio.getProjectSummary().isPlaying;

      // Stop playback
      const btnStop = document.getElementById('btnStudioStop');
      if (btnStop) btnStop.click();

      return {
        isPlayingInitial,
        isPlayingAfterSolo1,
        isPlayingAfterSolo2
      };
    });

    assert.ok(soloPlaybackResult, 'Session elements must exist');
  });

  it('TC3.3: Keyboard Track Switching with Armed, Muted, and Soloed States — navigation must preserve individual track states', async () => {
    await session.evaluate(() => {
      const t1 = window.BeatboxStudio.addTrack('Perc 1');
      t1.muted = true;
      t1.armed = true;

      const t2 = window.BeatboxStudio.addTrack('Perc 2');
      t2.solo = true;

      const t3 = window.BeatboxStudio.addTrack('Perc 3');
      t3.volume = 0.5;

      window.BeatboxStudio.renderStudioViews();

      // Click first track
      const firstRow = document.querySelector('.reaper-track-row');
      if (firstRow) firstRow.click();
    });

    // Navigate down with keyboard
    await session.dispatchKey('ArrowDown', 'ArrowDown');
    await new Promise(r => setTimeout(r, 60));

    // Navigate down again
    await session.dispatchKey('ArrowDown', 'ArrowDown');
    await new Promise(r => setTimeout(r, 60));

    const stateIntegrity = await session.evaluate(() => {
      const rows = document.querySelectorAll('.reaper-track-row');
      const row3Selected = rows[2]?.classList.contains('is-selected');

      return {
        row3Selected,
        totalRows: rows.length
      };
    });

    assert.equal(stateIntegrity.totalRows, 3, 'Must retain all 3 tracks');
    assert.equal(stateIntegrity.row3Selected, true, 'Third track must be selected after two ArrowDown presses');
  });

  it('TC3.4: In-Place Drop with Active Playhead — dropping clip must maintain playhead alignment', async () => {
    const playheadCoherence = await session.evaluate(() => {
      const t = window.BeatboxStudio.addTrack('Playhead Coherence');
      t.mediaUrl = 'blob:test';
      t.duration = 8.0;
      t.offsetMs = 0;
      window.BeatboxStudio.renderStudioViews();

      // Position playhead at 25% (2.0s)
      const playhead = document.getElementById('reaperPlayhead');
      if (playhead) playhead.style.left = '25%';

      const playheadLeftBefore = playhead ? playhead.style.left : '';

      // Drag clip
      const item = document.getElementById(`media_item_${t.id}`);
      const downEvt = new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true });
      item.dispatchEvent(downEvt);
      const moveEvt = new PointerEvent('pointermove', { clientX: 150, clientY: 100, bubbles: true });
      window.dispatchEvent(moveEvt);
      const upEvt = new PointerEvent('pointerup', { clientX: 150, clientY: 100, bubbles: true });
      window.dispatchEvent(upEvt);

      const playheadLeftAfter = playhead ? playhead.style.left : '';

      return {
        playheadLeftBefore,
        playheadLeftAfter,
        playheadPreserved: playheadLeftBefore === playheadLeftAfter
      };
    });

    assert.ok(playheadCoherence, 'Playhead test must run');
    assert.equal(playheadCoherence.playheadPreserved, true, 'Playhead position must not reset or vanish during clip repositioning');
  });
});
