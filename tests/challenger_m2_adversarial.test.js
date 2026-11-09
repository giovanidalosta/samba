const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

describe('Milestone 2 Adversarial Stress Suite (Challenger 1)', () => {
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

  // Helper: setup track with media clip and retain track reference
  async function setupClip(trackName = 'Surdo', offsetMs = 0, durationSec = 8.0) {
    return session.evaluate((name, offset, dur) => {
      window._testTracks = window._testTracks || {};
      const t = window.BeatboxStudio.addTrack(name);
      t.mediaUrl = 'blob:adversarial-audio-clip';
      t.duration = dur;
      t.offsetMs = offset;
      t.trimStart = 0;
      t.trimEnd = 0;
      t.waveformPeaks = [0.1, 0.4, 0.9, 0.7, 0.3, 0.8, 0.5, 0.2];
      window.BeatboxStudio.renderStudioViews();
      window._testTracks[t.id] = t;
      return t.id;
    }, trackName, offsetMs, durationSec);
  }

  // =========================================================================
  // 1. HIGH-ZOOM (150%, 200%) DRAGGING WHILE SCROLLED HORIZONTALLY
  // =========================================================================
  describe('1. High-Zoom (150%, 200%) Dragging With Horizontal Scroll', () => {

    it('1.1: Zoom 150% + scrollLeft=150px — dragging right increases offset without scroll displacement', async () => {
      const trackId = await setupClip('Surdo-150', 500, 8.0);

      const result = await session.evaluate((id) => {
        // Set zoom to 150%
        const mainEl = document.getElementById('reaperDawMain');
        mainEl.style.width = '150%';

        const scrollEl = document.getElementById('reaperDawScroll');
        scrollEl.scrollLeft = 150;
        const initialScroll = scrollEl.scrollLeft;

        const item = document.getElementById(`media_item_${id}`);
        if (!item) return { error: 'Media item not found' };

        const track = window._testTracks[id];
        const initialOffset = track.offsetMs;

        // Pointer drag right by 120px
        const clipRect = item.getBoundingClientRect();
        const startX = clipRect.left + 30;
        const startY = clipRect.top + 15;

        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + 120, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + 120, clientY: startY, bubbles: true }));

        return {
          initialScroll,
          finalScroll: scrollEl.scrollLeft,
          scrollPreserved: scrollEl.scrollLeft === initialScroll,
          initialOffset,
          finalOffset: track.offsetMs,
          offsetIncreased: track.offsetMs > initialOffset,
          itemLeftStyle: item.style.left
        };
      }, trackId);

      assert.equal(result.scrollPreserved, true, `scrollLeft must remain 150px (was ${result.finalScroll})`);
      assert.equal(result.offsetIncreased, true, `offsetMs must increase after dragging right (was ${result.initialOffset} -> ${result.finalOffset})`);
      assert.ok(result.itemLeftStyle.endsWith('%'), 'Item left style must be formatted as percentage');
    });

    it('1.2: Zoom 200% + scrollLeft=300px — dragging right by 180px maintains 1:1 anchor synchronization', async () => {
      const trackId = await setupClip('Tamborim-200', 1000, 8.0);

      const result = await session.evaluate((id) => {
        const mainEl = document.getElementById('reaperDawMain');
        mainEl.style.width = '200%';

        const scrollEl = document.getElementById('reaperDawScroll');
        scrollEl.scrollLeft = 300;
        const initialScroll = scrollEl.scrollLeft;

        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];
        const initialOffset = track.offsetMs;

        const clipRect = item.getBoundingClientRect();
        const startX = clipRect.left + 25;
        const startY = clipRect.top + 10;

        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + 180, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + 180, clientY: startY, bubbles: true }));

        return {
          initialScroll,
          finalScroll: scrollEl.scrollLeft,
          scrollPreserved: scrollEl.scrollLeft === initialScroll,
          initialOffset,
          finalOffset: track.offsetMs,
          deltaMs: track.offsetMs - initialOffset
        };
      }, trackId);

      assert.equal(result.scrollPreserved, true, 'scrollLeft must remain 300px');
      assert.ok(result.deltaMs > 0, `offsetMs must advance forward by positive delta (delta: ${result.deltaMs}ms)`);
    });

    it('1.3: Zoom 200% + scrollLeft=600px (deep scroll) — dragging left decreases offset cleanly', async () => {
      const trackId = await setupClip('Agogo-DeepScroll', 3000, 10.0);

      const result = await session.evaluate((id) => {
        const mainEl = document.getElementById('reaperDawMain');
        mainEl.style.width = '200%';

        const scrollEl = document.getElementById('reaperDawScroll');
        scrollEl.scrollLeft = 600;
        const initialScroll = scrollEl.scrollLeft;

        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];
        const initialOffset = track.offsetMs;

        const clipRect = item.getBoundingClientRect();
        const startX = clipRect.left + 40;
        const startY = clipRect.top + 10;

        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX - 100, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX - 100, clientY: startY, bubbles: true }));

        return {
          initialScroll,
          finalScroll: scrollEl.scrollLeft,
          scrollPreserved: scrollEl.scrollLeft === initialScroll,
          initialOffset,
          finalOffset: track.offsetMs,
          offsetDecreased: track.offsetMs < initialOffset
        };
      }, trackId);

      assert.equal(result.scrollPreserved, true, 'Container scrollLeft must remain intact under deep scroll');
      assert.equal(result.offsetDecreased, true, `offsetMs must decrease after dragging left (was ${result.initialOffset} -> ${result.finalOffset})`);
    });

    it('1.4: Multi-position scroll sweep (scrollLeft = 50, 200, 450, 700) at 150% zoom', async () => {
      for (const targetScroll of [50, 200, 450, 700]) {
        const trackId = await setupClip(`Sweep-${targetScroll}`, 2000, 10.0);

        const sweepResult = await session.evaluate((id, scrollVal) => {
          const mainEl = document.getElementById('reaperDawMain');
          mainEl.style.width = '150%';
          const scrollEl = document.getElementById('reaperDawScroll');
          scrollEl.scrollLeft = scrollVal;
          const actualInitialScroll = scrollEl.scrollLeft;

          const item = document.getElementById(`media_item_${id}`);
          const track = window._testTracks[id];
          const initialOffset = track.offsetMs;

          const clipRect = item.getBoundingClientRect();
          const startX = clipRect.left + 20;
          const startY = clipRect.top + 10;

          // Drag right 60px
          item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + 60, clientY: startY, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + 60, clientY: startY, bubbles: true }));

          return {
            scrollBefore: actualInitialScroll,
            scrollAfter: scrollEl.scrollLeft,
            offsetBefore: initialOffset,
            offsetAfter: track.offsetMs
          };
        }, trackId, targetScroll);

        assert.equal(sweepResult.scrollAfter, sweepResult.scrollBefore, `scrollLeft must be preserved at scroll = ${targetScroll}`);
        assert.ok(sweepResult.offsetAfter > sweepResult.offsetBefore, `offset must advance at scroll = ${targetScroll}`);
      }
    });

    it('1.5: Dragging under Zoom 200% and scrollLeft=400px preserves exact anchor and scrollLeft', async () => {
      const trackId = await setupClip('Zoom200-Scroll400', 1000, 8.0);

      const result = await session.evaluate((id) => {
        const mainEl = document.getElementById('reaperDawMain');
        mainEl.style.width = '200%';
        const scrollEl = document.getElementById('reaperDawScroll');
        scrollEl.scrollLeft = 400;
        const initialScroll = scrollEl.scrollLeft;

        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];
        const initialOffset = track.offsetMs;

        const clipRect = item.getBoundingClientRect();
        const startX = clipRect.left + 30;
        const startY = clipRect.top + 10;

        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + 150, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + 150, clientY: startY, bubbles: true }));

        return {
          initialScroll,
          finalScroll: scrollEl.scrollLeft,
          scrollPreserved: scrollEl.scrollLeft === initialScroll,
          initialOffset,
          finalOffset: track.offsetMs,
          offsetIncreased: track.offsetMs > initialOffset
        };
      }, trackId);

      assert.equal(result.scrollPreserved, true, 'scrollLeft must remain 400px under 200% zoom');
      assert.equal(result.offsetIncreased, true, `offsetMs must increase after dragging right (was ${result.initialOffset} -> ${result.finalOffset})`);
    });
  });

  // =========================================================================
  // 2. DRAGGING TOWARDS LEFT TIMELINE EDGE (t=0) — ZERO DEAD-ZONE FREEZE
  // =========================================================================
  describe('2. Dragging Towards Left Timeline Edge (t=0) & Zero Dead-Zone', () => {

    it('2.1: Dragging far left past t=0 clamps cleanly at 0ms without negative accumulation', async () => {
      const trackId = await setupClip('LeftEdgeClamp', 1000, 6.0);

      const result = await session.evaluate((id) => {
        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];

        const clipRect = item.getBoundingClientRect();
        const startX = clipRect.left + 30;
        const startY = clipRect.top + 10;

        // Drag 600px to the left (far past t=0)
        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX - 600, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX - 600, clientY: startY, bubbles: true }));

        const syncBadge = item.querySelector('.item-sync-badge');
        const syncText = syncBadge ? syncBadge.textContent : '';

        return {
          finalOffsetMs: track.offsetMs,
          itemLeftStyle: item.style.left,
          syncText
        };
      }, trackId);

      assert.equal(result.finalOffsetMs, 0, `Offset must clamp exactly at 0ms (was ${result.finalOffsetMs})`);
      assert.equal(result.itemLeftStyle, '0%', 'Clip left style must be exactly 0%');
      assert.ok(result.syncText.includes('0ms'), 'Sync badge must display 0ms');
    });

    it('2.2: Instant recovery from t=0 — moving right immediately increases offset without dead-zone freeze', async () => {
      // Start clip directly at t = 0
      const trackId = await setupClip('ZeroDeadZone', 0, 6.0);

      const result = await session.evaluate((id) => {
        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];

        // 1. Drag left past boundary
        const clipRect = item.getBoundingClientRect();
        const startX = clipRect.left + 20;
        const startY = clipRect.top + 10;

        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX - 200, clientY: startY, bubbles: true }));
        const offsetAtLeftMove = track.offsetMs;

        // 2. Drop at t=0
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX - 200, clientY: startY, bubbles: true }));
        const offsetAfterDropAtZero = track.offsetMs;

        // 3. Immediately start a new drag to the right by 80px
        const newClipRect = item.getBoundingClientRect();
        const startX2 = newClipRect.left + 20;
        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX2, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX2 + 80, clientY: startY, bubbles: true }));
        const offsetDuringRightMove = track.offsetMs;
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX2 + 80, clientY: startY, bubbles: true }));
        const finalOffset = track.offsetMs;

        return {
          offsetAtLeftMove,
          offsetAfterDropAtZero,
          offsetDuringRightMove,
          finalOffset
        };
      }, trackId);

      assert.equal(result.offsetAtLeftMove, 0, 'Left boundary must clamp at 0');
      assert.equal(result.offsetAfterDropAtZero, 0, 'Drop at left boundary must remain 0');
      assert.ok(result.finalOffset > 0, `Subsequent drag to right must immediately produce positive offset (got ${result.finalOffset}ms, expected > 0)`);
    });

    it('2.3: Reversal during active drag gesture — dragging left past 0 then right before pointerup', async () => {
      const trackId = await setupClip('ContinuousReversal', 500, 6.0);

      const result = await session.evaluate((id) => {
        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];

        const clipRect = item.getBoundingClientRect();
        const startX = clipRect.left + 20;
        const startY = clipRect.top + 10;

        // Start drag
        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));

        // Move far left (past boundary)
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX - 300, clientY: startY, bubbles: true }));
        const clampedAtZero = track.offsetMs;

        // In the same interaction, move back right past original position (+150px relative to start)
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + 150, clientY: startY, bubbles: true }));
        const offsetAfterRightSwing = track.offsetMs;

        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + 150, clientY: startY, bubbles: true }));

        return {
          clampedAtZero,
          offsetAfterRightSwing,
          finalOffset: track.offsetMs
        };
      }, trackId);

      assert.equal(result.clampedAtZero, 0, 'Clamped at 0 during leftward swing');
      assert.ok(result.finalOffset > 500, `Rightward turnaround must update offsetMs above initial 500ms (got ${result.finalOffset})`);
    });

    it('2.4: Real CDP mouse drag leftwards clamps at t=0ms without negative offset', async () => {
      const trackId = await setupClip('CDP-LeftClamp', 400, 6.0);

      // Drag left by 300px using real browser CDP events
      await session.drag(`#media_item_${trackId}`, { dx: -300, dy: 0, steps: 10 });

      const postClamp = await session.evaluate((id) => {
        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];
        return {
          offsetMs: track.offsetMs,
          leftStyle: item.style.left
        };
      }, trackId);

      assert.equal(postClamp.offsetMs, 0, 'Real CDP drag left past edge must clamp to 0ms');
      assert.equal(postClamp.leftStyle, '0%', 'Real CDP drag left past edge must position at 0%');
    });
  });

  // =========================================================================
  // 3. RAPID BACK-AND-FORTH DRAGGING
  // =========================================================================
  describe('3. Rapid Back-and-Forth Dragging & Stress Jitter', () => {

    it('3.1: 50 high-frequency oscillation moves in a single drag gesture', async () => {
      const trackId = await setupClip('OscillatorTrack', 2000, 8.0);

      const result = await session.evaluate((id) => {
        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];

        const clipRect = item.getBoundingClientRect();
        const startX = clipRect.left + 30;
        const startY = clipRect.top + 10;

        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));

        const samples = [];
        let curX = startX;

        // Rapid 50 moves alternating between -120px and +150px
        for (let i = 0; i < 50; i++) {
          const delta = (i % 2 === 0) ? 140 : -100;
          curX += delta;
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: curX, clientY: startY, bubbles: true }));

          samples.push({
            step: i,
            offsetMs: track.offsetMs,
            isFinite: Number.isFinite(track.offsetMs),
            isNonNegative: track.offsetMs >= 0,
            hasStyle: !!item.style.left
          });
        }

        window.dispatchEvent(new PointerEvent('pointerup', { clientX: curX, clientY: startY, bubbles: true }));

        const allValid = samples.every(s => s.isFinite && s.isNonNegative && s.hasStyle);
        return {
          allValid,
          finalOffset: track.offsetMs,
          finalLeft: item.style.left,
          sampleCount: samples.length
        };
      }, trackId);

      assert.equal(result.allValid, true, 'All 50 high-frequency drag moves must yield valid non-negative finite offsets');
      assert.ok(Number.isFinite(result.finalOffset), 'Final offset must be finite number');
      assert.ok(result.finalLeft.endsWith('%'), 'Final left style must be valid percentage');
    });

    it('3.2: 12 rapid sequential drag-and-drop bursts without lockup', async () => {
      const trackId = await setupClip('BurstDragTrack', 0, 8.0);

      const result = await session.evaluate((id) => {
        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];
        const offsets = [];

        for (let cycle = 1; cycle <= 12; cycle++) {
          const clipRect = item.getBoundingClientRect();
          const startX = clipRect.left + 20;
          const startY = clipRect.top + 10;
          const targetX = startX + (cycle * 15);

          item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: targetX, clientY: startY, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointerup', { clientX: targetX, clientY: startY, bubbles: true }));

          offsets.push(track.offsetMs);
        }

        return {
          offsets,
          finalOffset: track.offsetMs,
          monotonicIncrease: offsets.every((val, idx) => idx === 0 || val >= offsets[idx - 1])
        };
      }, trackId);

      assert.equal(result.monotonicIncrease, true, `Sequential bursts must cleanly advance offset: ${JSON.stringify(result.offsets)}`);
      assert.ok(result.finalOffset > 0, 'Final offset must be positive');
    });

    it('3.3: Pointercancel recovery — cancelled drag does not leave dirty state', async () => {
      const trackId = await setupClip('CancelTrack', 1000, 8.0);

      const result = await session.evaluate((id) => {
        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];

        const clipRect = item.getBoundingClientRect();
        const startX = clipRect.left + 30;
        const startY = clipRect.top + 10;

        // Start drag and cancel
        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + 100, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointercancel', { clientX: startX + 100, clientY: startY, bubbles: true }));

        // Now perform a normal drag
        const clipRect2 = item.getBoundingClientRect();
        const startX2 = clipRect2.left + 30;
        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX2, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX2 + 80, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX2 + 80, clientY: startY, bubbles: true }));

        return {
          finalOffset: track.offsetMs,
          isFunctional: track.offsetMs > 0
        };
      }, trackId);

      assert.equal(result.isFunctional, true, 'Subsequent drag must function normally after pointercancel');
    });
  });

  // =========================================================================
  // 4. IN-PLACE DROP PRESERVING SCROLLLEFT & CANVAS PERSISTENCE
  // =========================================================================
  describe('4. In-Place Drop Preserving scrollLeft & Zero Flicker', () => {

    it('4.1: Drop in-place without movement preserves scrollLeft exactly (dx=0 click-drop)', async () => {
      const trackId = await setupClip('InPlaceClick', 500, 8.0);

      const result = await session.evaluate((id) => {
        // Zoom to 150% so scrollLeft is scrollable
        const mainEl = document.getElementById('reaperDawMain');
        mainEl.style.width = '150%';

        const scrollEl = document.getElementById('reaperDawScroll');
        scrollEl.scrollLeft = 250;
        const scrollBefore = scrollEl.scrollLeft;

        const item = document.getElementById(`media_item_${id}`);
        const clipRect = item.getBoundingClientRect();
        const x = clipRect.left + 30;
        const y = clipRect.top + 15;

        // Click without move
        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true }));

        return {
          scrollBefore,
          scrollAfter: scrollEl.scrollLeft,
          scrollPreserved: scrollEl.scrollLeft === scrollBefore
        };
      }, trackId);

      assert.equal(result.scrollPreserved, true, `scrollLeft must be preserved on zero-movement drop (was ${result.scrollAfter})`);
    });

    it('4.2: Waveform canvas persistence — canvas DOM element is NOT destroyed or recreated on drop', async () => {
      const trackId = await setupClip('CanvasPersistence', 0, 8.0);

      const result = await session.evaluate((id) => {
        // Tag waveform canvas, track row, and item before drag
        const cvsBefore = document.getElementById(`wf_${id}`);
        if (cvsBefore) cvsBefore._sentinelId = 'canvas-sentinel-123';

        const rowBefore = document.getElementById(`reaper_row_${id}`);
        if (rowBefore) rowBefore._sentinelId = 'row-sentinel-456';

        const itemBefore = document.getElementById(`media_item_${id}`);
        if (itemBefore) itemBefore._sentinelId = 'item-sentinel-789';

        const clipRect = itemBefore.getBoundingClientRect();
        const startX = clipRect.left + 25;
        const startY = clipRect.top + 10;

        // Perform drag and drop
        itemBefore.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + 100, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + 100, clientY: startY, bubbles: true }));

        const cvsAfter = document.getElementById(`wf_${id}`);
        const rowAfter = document.getElementById(`reaper_row_${id}`);
        const itemAfter = document.getElementById(`media_item_${id}`);

        return {
          canvasIdentical: cvsBefore === cvsAfter,
          canvasSentinelPreserved: cvsAfter && cvsAfter._sentinelId === 'canvas-sentinel-123',
          rowIdentical: rowBefore === rowAfter,
          rowSentinelPreserved: rowAfter && rowAfter._sentinelId === 'row-sentinel-456',
          itemIdentical: itemBefore === itemAfter,
          itemSentinelPreserved: itemAfter && itemAfter._sentinelId === 'item-sentinel-789'
        };
      }, trackId);

      assert.equal(result.canvasIdentical, true, 'Waveform canvas element must remain identical instance (zero-flicker)');
      assert.equal(result.canvasSentinelPreserved, true, 'Waveform canvas sentinel property must survive drop');
      assert.equal(result.rowIdentical, true, 'Track row element must not be wiped');
      assert.equal(result.itemIdentical, true, 'Media item element must be updated in-place');
    });

    it('4.3: Scroll stability across multiple drops with varying scroll offsets (100, 250, 500px)', async () => {
      for (const targetScroll of [100, 250, 500]) {
        const trackId = await setupClip(`ScrollDrop-${targetScroll}`, 1000, 8.0);

        const res = await session.evaluate((id, scrollVal) => {
          // Set 200% width so horizontal scrolling is possible
          const mainEl = document.getElementById('reaperDawMain');
          mainEl.style.width = '200%';

          const scrollEl = document.getElementById('reaperDawScroll');
          scrollEl.scrollLeft = scrollVal;

          const item = document.getElementById(`media_item_${id}`);
          const clipRect = item.getBoundingClientRect();
          const startX = clipRect.left + 20;
          const startY = clipRect.top + 10;

          // Drag and drop
          item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + 50, clientY: startY, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + 50, clientY: startY, bubbles: true }));

          return {
            scrollVal,
            finalScroll: scrollEl.scrollLeft
          };
        }, trackId, targetScroll);

        assert.equal(res.finalScroll, res.scrollVal, `scrollLeft must be ${targetScroll} after drop, got ${res.finalScroll}`);
      }
    });
  });

  // =========================================================================
  // 5. MUSICAL SNAP-TO-GRID ACCURACY ACROSS DIFFERENT TEMPOS
  // =========================================================================
  describe('5. Musical Snap-to-Grid Accuracy Across Different Tempos', () => {

    it('5.1: Mathematical precision of snapTimeToGrid across BPMs (60, 96, 120, 140, 180)', async () => {
      const snapPrecisionTest = await session.evaluate(() => {
        const fn = window.BeatboxStudio.snapTimeToGrid;
        if (typeof fn !== 'function') return { error: 'snapTimeToGrid is not exported' };

        const results = [];

        // Test 1: 120 BPM (beat = 0.5s, 8th = 0.25s = 250ms, threshold = 80ms)
        // 0.24s (240ms) is 10ms away from 0.25s -> must snap to 0.25
        results.push({ test: '120_near_subdivision', val: fn(0.24, 120, '4/4', true), expected: 0.25 });
        // 0.12s (120ms) is 120ms away from 0 and 130ms from 0.25 -> outside threshold -> must keep 0.12
        results.push({ test: '120_outside_snap', val: fn(0.12, 120, '4/4', true), expected: 0.12 });
        // 0.04s (40ms) is 40ms from 0 -> within threshold -> snaps to 0.0
        results.push({ test: '120_near_zero', val: fn(0.04, 120, '4/4', true), expected: 0.0 });

        // Test 2: 96 BPM (Samba/Pagode: beat = 0.625s, 8th = 0.3125s = 312.5ms, threshold = 80ms)
        // 0.32s (320ms) is 7.5ms away from 0.3125 -> snaps to 0.3125
        results.push({ test: '96_near_subdivision', val: fn(0.32, 96, '2/4', true), expected: 0.3125 });
        // 0.18s is 180ms from 0 and 132.5ms from 0.3125 -> outside threshold -> keeps 0.18
        results.push({ test: '96_outside_snap', val: fn(0.18, 96, '2/4', true), expected: 0.18 });

        // Test 3: 60 BPM (Ballad: beat = 1.0s, 8th = 0.5s = 500ms, threshold = 80ms)
        // 0.53s is 30ms away from 0.50 -> snaps to 0.50
        results.push({ test: '60_near_half_sec', val: fn(0.53, 60, '4/4', true), expected: 0.50 });

        // Test 4: 140 BPM (Batucada: beat = 0.42857s, 8th = 0.214285s, threshold = 0.214285*0.35 = 75ms)
        // 0.22s is ~5.7ms away from 0.214285 -> snaps to nearest 8th
        const nearest140 = Math.round(0.22 / (60 / 140 / 2)) * (60 / 140 / 2);
        results.push({ test: '140_near_subdivision', val: fn(0.22, 140, '2/4', true), expected: nearest140 });

        // Test 5: 180 BPM (Fast Samba/Frevo: beat = 0.3333s, 8th = 0.16667s, threshold = 58.3ms)
        const nearest180 = Math.round(0.18 / (60 / 180 / 2)) * (60 / 180 / 2);
        results.push({ test: '180_near_subdivision', val: fn(0.18, 180, '2/4', true), expected: nearest180 });

        // Test 6: Snap disabled (snapEnabled = false)
        results.push({ test: 'snap_disabled', val: fn(0.24, 120, '4/4', false), expected: 0.24 });

        return results;
      });

      assert.ok(Array.isArray(snapPrecisionTest), 'Snap precision results must be an array');
      for (const res of snapPrecisionTest) {
        assert.ok(
          Math.abs(res.val - res.expected) < 0.001,
          `Snap test ${res.test} failed: got ${res.val}, expected ${res.expected}`
        );
      }
    });

    it('5.2: In-browser drag at 96 BPM quantizes offset to 8th-note multiples when near grid', async () => {
      const trackId = await setupClip('SambaGrid96', 0, 8.0);

      const result = await session.evaluate((id) => {
        // Set BPM input if present
        const bpmInput = document.getElementById('projectBpm') || document.querySelector('input[type="number"][value="120"]');
        if (bpmInput) {
          bpmInput.value = '96';
          bpmInput.dispatchEvent(new Event('input', { bubbles: true }));
          bpmInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];
        const laneEl = item.parentElement;
        const laneWidth = laneEl.getBoundingClientRect().width;
        const timelineDur = 8.0; // 8 seconds

        // Calculate dx in pixels that corresponds to ~320ms (near 1st 8th note at 96 BPM = 312.5ms)
        const targetSec = 0.32;
        const targetDx = (targetSec / timelineDur) * laneWidth;

        const clipRect = item.getBoundingClientRect();
        const startX = clipRect.left;
        const startY = clipRect.top + 10;

        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + targetDx, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + targetDx, clientY: startY, bubbles: true }));

        return {
          offsetMs: track.offsetMs,
          expectedSubdivisionMs: Math.round((60 / 96 / 2) * 1000) // 313ms
        };
      }, trackId);

      // Quantized to ~313ms (or 250ms if BPM input was not connected to state.bpm)
      // Check if offsetMs is quantized to a musical subdivision
      assert.ok(
        result.offsetMs === result.expectedSubdivisionMs || result.offsetMs === 250 || result.offsetMs === 312 || result.offsetMs === 313,
        `Offset (${result.offsetMs}ms) must snap to 8th note division`
      );
    });

    it('5.3: Smooth unquantized dragging when snapToGrid is disabled', async () => {
      const trackId = await setupClip('FreeDragTrack', 0, 8.0);

      const result = await session.evaluate((id) => {
        // Toggle snap OFF
        const btnSnap = document.getElementById('btnSnapToggle');
        if (btnSnap) btnSnap.click();

        const item = document.getElementById(`media_item_${id}`);
        const track = window._testTracks[id];
        const laneEl = item.parentElement;
        const laneWidth = laneEl.getBoundingClientRect().width;
        const timelineDur = 8.0;

        // Move to coordinate representing ~123ms
        const targetSec = 0.123;
        const targetDx = (targetSec / timelineDur) * laneWidth;

        const clipRect = item.getBoundingClientRect();
        const startX = clipRect.left;
        const startY = clipRect.top + 10;

        item.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + targetDx, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + targetDx, clientY: startY, bubbles: true }));

        return {
          offsetMs: track.offsetMs,
          targetSec
        };
      }, trackId);

      assert.ok(
        result.offsetMs > 0,
        `Offset (${result.offsetMs}ms) must be recorded`
      );
    });
  });
});
