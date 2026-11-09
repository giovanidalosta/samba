const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

describe('Milestone 2 Adversarial Stress Suite (Challenger 2)', () => {
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

  // Helper to setup a track with media item
  async function setupTrackWithClip(offsetMs = 0, durationSec = 8.0, name = 'Faixa Teste') {
    return session.evaluate((offset, dur, trackName) => {
      const t = window.BeatboxStudio.addTrack(trackName);
      t.mediaUrl = 'blob:test-audio-clip-' + Math.random();
      t.duration = dur;
      t.offsetMs = offset;
      t.trimStart = 0;
      t.trimEnd = 0;
      t.waveformPeaks = [0.1, 0.4, 0.9, 0.7, 0.5, 0.8, 0.3, 0.6];
      window.BeatboxStudio.renderStudioViews();
      return { id: t.id, offsetMs: t.offsetMs, duration: t.duration };
    }, offsetMs, durationSec, name);
  }

  // =========================================================================
  // Challenge 1: High-Zoom (150%, 200%) Dragging Under Horizontal Scroll
  // =========================================================================
  describe('Challenge 1: High-Zoom (150%, 200%) Dragging Under Horizontal Scroll', () => {

    it('Stress 1.1: Dragging under 150% Zoom across varying scroll positions (100px, 250px, 450px)', async () => {
      const clip = await setupTrackWithClip(1000, 10.0, 'Zoom 150 Track');

      const testResults = await session.evaluate(async (trackId) => {
        const results = [];
        const scrollPositions = [100, 250, 450];
        const mainEl = document.getElementById('reaperDawMain');
        const scrollEl = document.getElementById('reaperDawScroll');
        const itemEl = document.getElementById(`media_item_${trackId}`);

        if (!mainEl || !scrollEl || !itemEl) {
          return { error: 'DOM elements not found' };
        }

        // Apply 150% Zoom
        mainEl.style.width = '150%';

        for (const scrollPos of scrollPositions) {
          scrollEl.scrollLeft = scrollPos;
          const actualScrollBefore = scrollEl.scrollLeft;

          // Drag right by 120px
          const rectBefore = itemEl.getBoundingClientRect();
          const startX = Math.round(rectBefore.left + Math.min(30, rectBefore.width / 2));
          const startY = Math.round(rectBefore.top + rectBefore.height / 2);

          const initialOffsetMs = parseInt(itemEl.querySelector('.item-sync-badge')?.textContent || '0', 10);

          const downEvt = new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true });
          itemEl.dispatchEvent(downEvt);

          const targetX = startX + 120;
          const moveEvt = new PointerEvent('pointermove', { clientX: targetX, clientY: startY, bubbles: true });
          window.dispatchEvent(moveEvt);

          const intermediateScroll = scrollEl.scrollLeft;

          const upEvt = new PointerEvent('pointerup', { clientX: targetX, clientY: startY, bubbles: true });
          window.dispatchEvent(upEvt);

          const actualScrollAfter = scrollEl.scrollLeft;
          const finalOffsetMs = parseInt(itemEl.querySelector('.item-sync-badge')?.textContent || '0', 10);

          results.push({
            scrollPos,
            actualScrollBefore,
            intermediateScroll,
            actualScrollAfter,
            scrollPreserved: actualScrollBefore === actualScrollAfter && actualScrollBefore === intermediateScroll,
            initialOffsetMs,
            finalOffsetMs,
            offsetIncreased: finalOffsetMs > initialOffsetMs
          });
        }

        return { success: true, results };
      }, clip.id);

      assert.ok(testResults.success, 'Evaluation should succeed');
      assert.equal(testResults.results.length, 3, 'Should test all 3 scroll positions');

      testResults.results.forEach((r) => {
        assert.ok(r.scrollPreserved, `At scrollLeft ${r.scrollPos}px, scroll must be strictly preserved during and after drag`);
        assert.ok(r.offsetIncreased, `At scrollLeft ${r.scrollPos}px, dragging right must increase timeline offset (before: ${r.initialOffsetMs}, after: ${r.finalOffsetMs})`);
      });
    });

    it('Stress 1.2: Dragging under 200% Zoom with extreme horizontal scroll (0px, 200px, 400px, maxScroll)', async () => {
      const clip = await setupTrackWithClip(2000, 16.0, 'Zoom 200 Track');

      const testResults = await session.evaluate(async (trackId) => {
        const results = [];
        const mainEl = document.getElementById('reaperDawMain');
        const scrollEl = document.getElementById('reaperDawScroll');
        const itemEl = document.getElementById(`media_item_${trackId}`);

        // Apply 200% Zoom
        mainEl.style.width = '200%';
        const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
        const scrollPositions = [0, 200, 400, Math.min(800, maxScroll)];

        for (const scrollPos of scrollPositions) {
          scrollEl.scrollLeft = scrollPos;
          const scrollBefore = scrollEl.scrollLeft;

          const rectBefore = itemEl.getBoundingClientRect();
          const startX = Math.round(rectBefore.left + Math.min(40, rectBefore.width / 2));
          const startY = Math.round(rectBefore.top + rectBefore.height / 2);

          const initialOffsetMs = parseInt(itemEl.querySelector('.item-sync-badge')?.textContent || '0', 10);

          // Drag by 150px rightwards
          itemEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + 150, clientY: startY, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + 150, clientY: startY, bubbles: true }));

          const scrollAfter = scrollEl.scrollLeft;
          const offsetAfter = parseInt(itemEl.querySelector('.item-sync-badge')?.textContent || '0', 10);

          results.push({
            scrollPos,
            scrollBefore,
            scrollAfter,
            scrollKept: scrollBefore === scrollAfter,
            initialOffsetMs,
            offsetAfter,
            validMath: offsetAfter > initialOffsetMs && isFinite(offsetAfter)
          });
        }

        return results;
      }, clip.id);

      testResults.forEach(r => {
        assert.ok(r.scrollKept, `At scroll ${r.scrollPos}px (200% zoom), scrollLeft must not jump`);
        assert.ok(r.validMath, `At scroll ${r.scrollPos}px (200% zoom), offset must increase cleanly without NaN`);
      });
    });

    it('Stress 1.3: Bidirectional dragging under 200% Zoom preserves 1:1 anchor synchronization', async () => {
      const clip = await setupTrackWithClip(3000, 12.0, 'Anchor Sync Track');

      const syncResult = await session.evaluate(async (trackId) => {
        const mainEl = document.getElementById('reaperDawMain');
        const scrollEl = document.getElementById('reaperDawScroll');
        const itemEl = document.getElementById(`media_item_${trackId}`);

        mainEl.style.width = '200%';
        scrollEl.scrollLeft = 300;

        const rectBefore = itemEl.getBoundingClientRect();
        const grabDistanceIntoClip = 50; // Grab 50px inside clip
        const startX = Math.round(rectBefore.left + grabDistanceIntoClip);
        const startY = Math.round(rectBefore.top + 20);

        // Start drag
        itemEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));

        // Move +100px right
        const move1X = startX + 100;
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: move1X, clientY: startY, bubbles: true }));
        const rectAfterMove1 = itemEl.getBoundingClientRect();
        const anchorError1 = Math.abs((move1X - rectAfterMove1.left) - grabDistanceIntoClip);

        // Move -160px left
        const move2X = startX - 60;
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: move2X, clientY: startY, bubbles: true }));
        const rectAfterMove2 = itemEl.getBoundingClientRect();
        const anchorError2 = Math.abs((move2X - rectAfterMove2.left) - grabDistanceIntoClip);

        window.dispatchEvent(new PointerEvent('pointerup', { clientX: move2X, clientY: startY, bubbles: true }));

        return {
          grabDistanceIntoClip,
          anchorError1,
          anchorError2,
          scrollLeftMaintained: scrollEl.scrollLeft === 300
        };
      }, clip.id);

      assert.ok(syncResult.scrollLeftMaintained, 'Container scrollLeft must remain 300px throughout');
      assert.ok(syncResult.anchorError1 < 30, `Grab anchor synchronization error rightwards must be tight, got ${syncResult.anchorError1}px`);
      assert.ok(syncResult.anchorError2 < 30, `Grab anchor synchronization error leftwards must be tight, got ${syncResult.anchorError2}px`);
    });
  });

  // =========================================================================
  // Challenge 2: Left Timeline Edge Clamping & Zero Dead-Zone Verification (t=0)
  // =========================================================================
  describe('Challenge 2: Left Timeline Edge Clamping & Zero Dead-Zone Verification', () => {

    it('Stress 2.1: Extreme overdrag past left boundary clamps strictly at 0ms without negative accumulation', async () => {
      const clip = await setupTrackWithClip(1000, 6.0, 'Left Overdrag Track');

      const clampResult = await session.evaluate((trackId) => {
        const itemEl = document.getElementById(`media_item_${trackId}`);
        const rect = itemEl.getBoundingClientRect();
        const startX = Math.round(rect.left + 20);
        const startY = Math.round(rect.top + 20);

        // Start drag
        itemEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));

        // Move far left to negative coordinates (-500px)
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: -500, clientY: startY, bubbles: true }));

        const leftStyleDuring = itemEl.style.left;
        const badgeDuring = itemEl.querySelector('.item-sync-badge')?.textContent;

        window.dispatchEvent(new PointerEvent('pointerup', { clientX: -500, clientY: startY, bubbles: true }));

        const badgeAfter = itemEl.querySelector('.item-sync-badge')?.textContent;
        const tcpValAfter = document.querySelector(`#reaper_row_${trackId} .tcp-sync-val, #reaper_row_${trackId} .tcp-sync-display`)?.textContent;

        return {
          leftStyleDuring,
          badgeDuring,
          badgeAfter,
          tcpValAfter
        };
      }, clip.id);

      assert.equal(clampResult.leftStyleDuring, '0%', 'Clip left style must clamp cleanly at 0% when dragged past left edge');
      assert.ok(clampResult.badgeDuring.includes('0ms'), `Clip badge must show 0ms, got ${clampResult.badgeDuring}`);
      assert.ok(clampResult.tcpValAfter.includes('0ms'), `TCP sync display must show 0ms, got ${clampResult.tcpValAfter}`);
      assert.ok(!clampResult.badgeDuring.includes('-'), `Badge must NEVER contain negative sign: ${clampResult.badgeDuring}`);
      assert.ok(!clampResult.tcpValAfter.includes('-'), `TCP sync display must NEVER contain negative sign: ${clampResult.tcpValAfter}`);
    });

    it('Stress 2.2: Zero Dead-Zone Immediate Response — reversing direction from t=0 moves immediately without 2000ms dead-zone lag', async () => {
      const clip = await setupTrackWithClip(500, 6.0, 'Dead Zone Challenger Track');

      const deadZoneTest = await session.evaluate((trackId) => {
        const itemEl = document.getElementById(`media_item_${trackId}`);
        const laneEl = itemEl.parentElement;
        const laneRect = laneEl.getBoundingClientRect();

        const startX = Math.round(laneRect.left + 50);
        const startY = Math.round(laneRect.top + 20);

        // Disable snap to measure continuous delta
        const snapBtn = document.getElementById('btnSnapToggle');
        const hadActiveSnap = snapBtn && snapBtn.classList.contains('active');
        if (hadActiveSnap && snapBtn) snapBtn.click();

        // 1. Pointer down at x = 50px into lane
        itemEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));

        // 2. Drag deep into negative space: 300px to the left of the lane boundary
        const deepNegativeX = laneRect.left - 300;
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: deepNegativeX, clientY: startY, bubbles: true }));

        // Verify clamped at 0%
        const leftWhileNegative = itemEl.style.left;

        // 3. Move pointer rightwards past the lane left edge by +40px
        const rightFromEdgeX = laneRect.left + 40;
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: rightFromEdgeX, clientY: startY, bubbles: true }));

        const leftAfterMicroRight = itemEl.style.left;
        const badgeAfterMicroRight = itemEl.querySelector('.item-sync-badge')?.textContent;

        window.dispatchEvent(new PointerEvent('pointerup', { clientX: rightFromEdgeX, clientY: startY, bubbles: true }));

        // Restore snap button if it was toggled
        if (hadActiveSnap && snapBtn) snapBtn.click();

        return {
          leftWhileNegative,
          leftAfterMicroRight,
          badgeAfterMicroRight,
          immediatelyResponded: parseFloat(leftAfterMicroRight) > 0
        };
      }, clip.id);

      assert.equal(deadZoneTest.leftWhileNegative, '0%', 'Should clamp at 0% when cursor is negative');
      assert.ok(
        deadZoneTest.immediatelyResponded,
        `Reversing from t=0ms must respond IMMEDIATELY with non-zero position; got left=${deadZoneTest.leftAfterMicroRight}`
      );
    });

    it('Stress 2.3: Micro-oscillations around the t=0 boundary do not cause coordinate drift or state corruption', async () => {
      const clip = await setupTrackWithClip(0, 8.0, 'Micro Oscillation Track');

      const oscillationResult = await session.evaluate((trackId) => {
        const itemEl = document.getElementById(`media_item_${trackId}`);
        const laneEl = itemEl.parentElement;
        const laneRect = laneEl.getBoundingClientRect();

        const startX = laneRect.left + 10;
        const startY = laneRect.top + 20;

        itemEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));

        // Alternate moves across the 0 boundary 20 times
        const offsets = [];
        for (let i = 0; i < 20; i++) {
          const delta = (i % 2 === 0) ? -60 : 30;
          const curX = laneRect.left + delta;
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: curX, clientY: startY, bubbles: true }));
          const styleLeft = parseFloat(itemEl.style.left) || 0;
          offsets.push(styleLeft);
        }

        window.dispatchEvent(new PointerEvent('pointerup', { clientX: laneRect.left + 30, clientY: startY, bubbles: true }));

        const allNonNegative = offsets.every(val => val >= 0 && !isNaN(val) && isFinite(val));
        const finalLeft = parseFloat(itemEl.style.left) || 0;

        return {
          allNonNegative,
          finalLeft,
          offsetsCount: offsets.length
        };
      }, clip.id);

      assert.ok(oscillationResult.allNonNegative, 'Every intermediate oscillation must remain >= 0% and finite');
      assert.equal(oscillationResult.offsetsCount, 20, 'All 20 oscillations executed');
    });
  });

  // =========================================================================
  // Challenge 3: Rapid Back-and-Forth Dragging Stress Test
  // =========================================================================
  describe('Challenge 3: Rapid Back-and-Forth Dragging Stress Test', () => {

    it('Stress 3.1: 100-cycle high-frequency rapid jitter drag maintains DOM-state consistency without NaN', async () => {
      const clip = await setupTrackWithClip(1000, 8.0, 'High Frequency Jitter Track');

      const jitterResult = await session.evaluate((trackId) => {
        const itemEl = document.getElementById(`media_item_${trackId}`);
        const laneEl = itemEl.parentElement;
        const laneRect = laneEl.getBoundingClientRect();

        const startX = Math.round(laneRect.left + 150);
        const startY = Math.round(laneRect.top + 25);

        itemEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));

        let nanDetected = false;
        let lastLeft = 0;

        // Perform 100 rapid oscillations
        for (let i = 1; i <= 100; i++) {
          const jitterDelta = (Math.sin(i * 0.7) * 120);
          const currentX = Math.round(startX + jitterDelta);

          window.dispatchEvent(new PointerEvent('pointermove', { clientX: currentX, clientY: startY, bubbles: true }));

          const leftStr = itemEl.style.left;
          if (leftStr.includes('NaN') || leftStr.includes('undefined')) {
            nanDetected = true;
          }
          lastLeft = parseFloat(leftStr) || 0;
        }

        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX, clientY: startY, bubbles: true }));

        const badgeText = itemEl.querySelector('.item-sync-badge')?.textContent || '';
        const durText = itemEl.querySelector('.item-dur-badge')?.textContent || '';
        const rowSync = document.querySelector(`#reaper_row_${trackId} .tcp-sync-val, #reaper_row_${trackId} .tcp-sync-display`)?.textContent || '';

        return {
          nanDetected,
          lastLeft,
          hasValidBadge: badgeText.includes('ms'),
          hasValidDur: durText.includes('s'),
          hasValidRowSync: rowSync.includes('ms')
        };
      }, clip.id);

      assert.equal(jitterResult.nanDetected, false, 'No NaN or undefined must ever appear in element styles during rapid jitter');
      assert.ok(jitterResult.hasValidBadge, 'Badge must maintain valid ms format');
      assert.ok(jitterResult.hasValidDur, 'Duration badge must maintain valid seconds format');
      assert.ok(jitterResult.hasValidRowSync, 'TCP sync display must maintain valid ms format');
    });

    it('Stress 3.2: Drag termination releases event listeners and prevents ghost movements', async () => {
      const clip = await setupTrackWithClip(500, 8.0, 'Ghost Movement Track');

      const ghostResult = await session.evaluate((trackId) => {
        const itemEl = document.getElementById(`media_item_${trackId}`);
        const rect = itemEl.getBoundingClientRect();
        const startX = Math.round(rect.left + 20);
        const startY = Math.round(rect.top + 20);

        // Start and finish a drag
        itemEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + 50, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + 50, clientY: startY, bubbles: true }));

        const offsetAfterDrop = itemEl.querySelector('.item-sync-badge')?.textContent;
        const leftAfterDrop = itemEl.style.left;

        // Attempt ghost moves after drop has completed
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 600, clientY: startY, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 600, clientY: startY, bubbles: true }));

        const offsetAfterGhost = itemEl.querySelector('.item-sync-badge')?.textContent;
        const leftAfterGhost = itemEl.style.left;

        return {
          offsetAfterDrop,
          leftAfterDrop,
          offsetAfterGhost,
          leftAfterGhost,
          noGhostMovement: offsetAfterDrop === offsetAfterGhost && leftAfterDrop === leftAfterGhost
        };
      }, clip.id);

      assert.ok(ghostResult.noGhostMovement, 'Subsequent mouse or pointer moves after drop must NOT move the clip');
    });

    it('Stress 3.3: Pointer cancel terminates drag gracefully without corrupting subsequent drags', async () => {
      const clip = await setupTrackWithClip(1000, 8.0, 'Cancel Recovery Track');

      const cancelRecoveryResult = await session.evaluate((trackId) => {
        const itemEl = document.getElementById(`media_item_${trackId}`);
        const rect1 = itemEl.getBoundingClientRect();
        const startX1 = Math.round(rect1.left + 20);
        const startY1 = Math.round(rect1.top + 20);

        // 1. Start drag and cancel it with pointercancel
        itemEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX1, clientY: startY1, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX1 + 60, clientY: startY1, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointercancel', { clientX: startX1 + 60, clientY: startY1, bubbles: true }));

        // 2. Perform a brand new drag
        const rect2 = itemEl.getBoundingClientRect();
        const startX2 = Math.round(rect2.left + 20);
        const startY2 = Math.round(rect2.top + 20);
        itemEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX2, clientY: startY2, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX2 + 80, clientY: startY2, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX2 + 80, clientY: startY2, bubbles: true }));

        const offsetFinal = parseInt(itemEl.querySelector('.item-sync-badge')?.textContent || '0', 10);

        return {
          offsetFinal,
          secondDragSucceeded: offsetFinal > 1000
        };
      }, clip.id);

      assert.ok(cancelRecoveryResult.secondDragSucceeded, 'Subsequent drag must work properly after a prior pointercancel event');
    });
  });

  // =========================================================================
  // Challenge 4: In-Place Drop Preserving scrollLeft & Zero Canvas Flicker
  // =========================================================================
  describe('Challenge 4: In-Place Drop Preserving scrollLeft & Zero Canvas Flicker', () => {

    it('Stress 4.1: Viewport scrollLeft is strictly preserved without jumps across repeated in-place drops', async () => {
      const clip1 = await setupTrackWithClip(500, 10.0, 'Scroll Track 1');
      const clip2 = await setupTrackWithClip(1500, 10.0, 'Scroll Track 2');

      const scrollJumpResult = await session.evaluate(async (id1, id2) => {
        const scrollEl = document.getElementById('reaperDawScroll');
        const mainEl = document.getElementById('reaperDawMain');
        mainEl.style.width = '150%';

        const scrollTarget = 300;
        scrollEl.scrollLeft = scrollTarget;

        const jumps = [];

        // Drag clip 1
        const item1 = document.getElementById(`media_item_${id1}`);
        const rect1 = item1.getBoundingClientRect();
        item1.dispatchEvent(new PointerEvent('pointerdown', { clientX: rect1.left + 20, clientY: rect1.top + 10, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: rect1.left + 70, clientY: rect1.top + 10, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: rect1.left + 70, clientY: rect1.top + 10, bubbles: true }));

        jumps.push(scrollEl.scrollLeft);

        // Drag clip 2
        const item2 = document.getElementById(`media_item_${id2}`);
        const rect2 = item2.getBoundingClientRect();
        item2.dispatchEvent(new PointerEvent('pointerdown', { clientX: rect2.left + 20, clientY: rect2.top + 10, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: rect2.left - 40, clientY: rect2.top + 10, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: rect2.left - 40, clientY: rect2.top + 10, bubbles: true }));

        jumps.push(scrollEl.scrollLeft);

        return {
          scrollTarget,
          jumps,
          strictlyPreserved: jumps.every(val => val === scrollTarget)
        };
      }, clip1.id, clip2.id);

      assert.ok(
        scrollJumpResult.strictlyPreserved,
        `ScrollLeft must remain exactly ${scrollJumpResult.scrollTarget}px; got ${JSON.stringify(scrollJumpResult.jumps)}`
      );
    });

    it('Stress 4.2: Zero DOM node re-creation (tracksStack innerHTML is NOT wiped, preserving canvases)', async () => {
      const clip1 = await setupTrackWithClip(0, 8.0, 'Anti Flicker 1');
      const clip2 = await setupTrackWithClip(2000, 8.0, 'Anti Flicker 2');

      const flickerResult = await session.evaluate((id1, id2) => {
        const row1Before = document.getElementById(`reaper_row_${id1}`);
        const row2Before = document.getElementById(`reaper_row_${id2}`);
        const item1Before = document.getElementById(`media_item_${id1}`);
        const item2Before = document.getElementById(`media_item_${id2}`);
        const canvas1Before = document.getElementById(`wf_${id1}`);
        const canvas2Before = document.getElementById(`wf_${id2}`);

        // Plant sentinel markers on DOM elements
        row1Before._challengerMarker = 'row1-alive';
        row2Before._challengerMarker = 'row2-alive';
        item1Before._challengerMarker = 'item1-alive';
        item2Before._challengerMarker = 'item2-alive';
        if (canvas1Before) canvas1Before._challengerMarker = 'cvs1-alive';
        if (canvas2Before) canvas2Before._challengerMarker = 'cvs2-alive';

        // Perform drag & drop on item 1
        const rect1 = item1Before.getBoundingClientRect();
        item1Before.dispatchEvent(new PointerEvent('pointerdown', { clientX: rect1.left + 20, clientY: rect1.top + 10, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: rect1.left + 80, clientY: rect1.top + 10, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: rect1.left + 80, clientY: rect1.top + 10, bubbles: true }));

        // Check whether DOM elements after drop are the EXACT same object instances
        const row1After = document.getElementById(`reaper_row_${id1}`);
        const row2After = document.getElementById(`reaper_row_${id2}`);
        const item1After = document.getElementById(`media_item_${id1}`);
        const item2After = document.getElementById(`media_item_${id2}`);
        const canvas1After = document.getElementById(`wf_${id1}`);
        const canvas2After = document.getElementById(`wf_${id2}`);

        return {
          row1Identical: row1Before === row1After && row1After._challengerMarker === 'row1-alive',
          row2Identical: row2Before === row2After && row2After._challengerMarker === 'row2-alive',
          item1Identical: item1Before === item1After && item1After._challengerMarker === 'item1-alive',
          item2Identical: item2Before === item2After && item2After._challengerMarker === 'item2-alive',
          canvas1Preserved: !canvas1Before || (canvas1Before === canvas1After && canvas1After._challengerMarker === 'cvs1-alive'),
          canvas2Preserved: !canvas2Before || (canvas2Before === canvas2After && canvas2After._challengerMarker === 'cvs2-alive')
        };
      }, clip1.id, clip2.id);

      assert.ok(flickerResult.row1Identical, 'Row 1 DOM node must be preserved in-place');
      assert.ok(flickerResult.row2Identical, 'Row 2 DOM node must be preserved in-place');
      assert.ok(flickerResult.item1Identical, 'Item 1 DOM node must be preserved in-place');
      assert.ok(flickerResult.item2Identical, 'Item 2 DOM node must be preserved in-place');
      assert.ok(flickerResult.canvas1Preserved, 'Track 1 waveform canvas must NOT be wiped or recreated');
      assert.ok(flickerResult.canvas2Preserved, 'Track 2 waveform canvas must NOT be wiped or recreated');
    });

    it('Stress 4.3: Timeline duration extension past current end dynamically appends ruler bars without stack wipe', async () => {
      const clip = await setupTrackWithClip(0, 4.0, 'Ruler Extend Track');

      const extendResult = await session.evaluate((trackId) => {
        const itemEl = document.getElementById(`media_item_${trackId}`);
        const rulerBarsBefore = document.querySelectorAll('.ruler-bar-item').length;
        const rowBefore = document.getElementById(`reaper_row_${trackId}`);
        rowBefore._extendMarker = 'preserved';

        // Drag clip far right to force timeline extension
        const rect = itemEl.getBoundingClientRect();
        const startX = Math.round(rect.left + 20);
        const startY = Math.round(rect.top + 10);

        itemEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + 500, clientY: startY, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + 500, clientY: startY, bubbles: true }));

        const rulerBarsAfter = document.querySelectorAll('.ruler-bar-item').length;
        const rowAfter = document.getElementById(`reaper_row_${trackId}`);

        return {
          rulerBarsBefore,
          rulerBarsAfter,
          barsExtendedOrMaintained: rulerBarsAfter >= rulerBarsBefore,
          rowPreserved: rowBefore === rowAfter && rowAfter._extendMarker === 'preserved'
        };
      }, clip.id);

      assert.ok(extendResult.barsExtendedOrMaintained, 'Ruler bars must not shrink');
      assert.ok(extendResult.rowPreserved, 'Track row must remain identical instance even during ruler update');
    });
  });

  // =========================================================================
  // Challenge 5: Musical Snap-to-Grid Precision Across Tempos and Meters
  // =========================================================================
  describe('Challenge 5: Musical Snap-to-Grid Precision Across Tempos and Meters', () => {

    it('Stress 5.1: Mathematical snap accuracy at BPM 60 (1 beat = 1000ms, 8th = 500ms, threshold = 80ms)', async () => {
      const snapData = await session.evaluate(() => {
        const snapFn = window.BeatboxStudio.snapTimeToGrid;
        const bpm = 60;
        const meter = '4/4';

        const cases = [
          { input: 0.040, expected: 0.000, desc: '40ms -> snap 0ms' },
          { input: 0.075, expected: 0.000, desc: '75ms -> snap 0ms' },
          { input: 0.150, expected: 0.150, desc: '150ms -> free placement (outside 80ms threshold)' },
          { input: 0.350, expected: 0.350, desc: '350ms -> free placement' },
          { input: 0.440, expected: 0.500, desc: '440ms -> snap 500ms (delta 60ms)' },
          { input: 0.490, expected: 0.500, desc: '490ms -> snap 500ms (delta 10ms)' },
          { input: 0.520, expected: 0.500, desc: '520ms -> snap 500ms (delta 20ms)' },
          { input: 0.570, expected: 0.500, desc: '570ms -> snap 500ms (delta 70ms)' },
          { input: 0.950, expected: 1.000, desc: '950ms -> snap 1000ms' },
          { input: 1.030, expected: 1.000, desc: '1030ms -> snap 1000ms' },
          { input: 1.480, expected: 1.500, desc: '1480ms -> snap 1500ms' }
        ];

        return cases.map(c => {
          const actual = snapFn(c.input, bpm, meter, true);
          return {
            ...c,
            actual,
            passed: Math.abs(actual - c.expected) < 0.0001
          };
        });
      });

      snapData.forEach(c => {
        assert.ok(c.passed, `At BPM 60: ${c.desc}; got ${c.actual}, expected ${c.expected}`);
      });
    });

    it('Stress 5.2: Mathematical snap accuracy at BPM 120 (1 beat = 500ms, 8th = 250ms, threshold = 80ms)', async () => {
      const snapData = await session.evaluate(() => {
        const snapFn = window.BeatboxStudio.snapTimeToGrid;
        const bpm = 120;
        const meter = '4/4';

        const cases = [
          { input: 0.230, expected: 0.250, desc: '230ms -> snap 250ms' },
          { input: 0.270, expected: 0.250, desc: '270ms -> snap 250ms' },
          { input: 0.470, expected: 0.500, desc: '470ms -> snap 500ms' },
          { input: 0.530, expected: 0.500, desc: '530ms -> snap 500ms' },
          { input: 0.720, expected: 0.750, desc: '720ms -> snap 750ms' },
          { input: 0.780, expected: 0.750, desc: '780ms -> snap 750ms' },
          { input: 0.375, expected: 0.375, desc: '375ms -> free placement (dead-center between 8th notes)' }
        ];

        return cases.map(c => {
          const actual = snapFn(c.input, bpm, meter, true);
          return {
            ...c,
            actual,
            passed: Math.abs(actual - c.expected) < 0.0001
          };
        });
      });

      snapData.forEach(c => {
        assert.ok(c.passed, `At BPM 120: ${c.desc}; got ${c.actual}, expected ${c.expected}`);
      });
    });

    it('Stress 5.3: Mathematical snap accuracy at fast tempo BPM 140 and BPM 180', async () => {
      const snapData = await session.evaluate(() => {
        const snapFn = window.BeatboxStudio.snapTimeToGrid;

        const bpm140Sub = 60 / 140 / 2;
        const bpm140Near = bpm140Sub + 0.030;
        const actual140 = snapFn(bpm140Near, 140, '4/4', true);

        const bpm180Sub = 60 / 180 / 2;
        const bpm180Near = bpm180Sub + 0.025;
        const actual180 = snapFn(bpm180Near, 180, '4/4', true);

        return {
          bpm140Passed: Math.abs(actual140 - bpm140Sub) < 0.0001,
          bpm180Passed: Math.abs(actual180 - bpm180Sub) < 0.0001,
          actual140,
          expected140: bpm140Sub,
          actual180,
          expected180: bpm180Sub
        };
      });

      assert.ok(snapData.bpm140Passed, `BPM 140 snap must quantize to exact 8th-note subdivision; got ${snapData.actual140}, expected ${snapData.expected140}`);
      assert.ok(snapData.bpm180Passed, `BPM 180 snap must quantize to exact 8th-note subdivision; got ${snapData.actual180}, expected ${snapData.expected180}`);
    });

    it('Stress 5.4: Meter variation (2/4 samba meter vs 4/4 meter)', async () => {
      const meterResult = await session.evaluate(() => {
        const snapFn = window.BeatboxStudio.snapTimeToGrid;
        const snap24 = snapFn(0.28, 100, '2/4', true);
        const expected24 = 0.3;

        const snap44 = snapFn(0.28, 100, '4/4', true);
        const expected44 = 0.3;

        return {
          snap24,
          snap44,
          passed24: Math.abs(snap24 - expected24) < 0.0001,
          passed44: Math.abs(snap44 - expected44) < 0.0001
        };
      });

      assert.ok(meterResult.passed24, `2/4 meter snap must match subdivision: got ${meterResult.snap24}`);
      assert.ok(meterResult.passed44, `4/4 meter snap must match subdivision: got ${meterResult.snap44}`);
    });

    it('Stress 5.5: Snap-to-Grid Disabled allows continuous free drag without subdivision clamping', async () => {
      const snapDisabledResult = await session.evaluate(() => {
        const snapFn = window.BeatboxStudio.snapTimeToGrid;
        const testTimes = [0.1234, 0.2499, 0.4999, 0.7488, 1.2345];
        return testTimes.map(t => {
          const res = snapFn(t, 120, '4/4', false);
          return {
            input: t,
            output: res,
            unmodified: Math.abs(t - res) < 0.000001
          };
        });
      });

      snapDisabledResult.forEach(c => {
        assert.ok(c.unmodified, `When snap is disabled, time must pass through freely; input ${c.input}, output ${c.output}`);
      });
    });
  });
});
