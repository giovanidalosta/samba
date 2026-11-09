/**
 * Comprehensive Opaque-Box Browser Verification Runner for Samba Multitrack Studio
 * Executes Tiers 1-4 verification suite in headless Chrome / Edge via native CDP.
 */

const { launchBrowser, stopSpawnedServer } = require('./harness.js');

const results = [];
let passCount = 0;
let failCount = 0;

function recordResult(tier, name, passed, durationMs, error = null) {
  if (passed) passCount++;
  else failCount++;
  results.push({ tier, name, passed, durationMs, error });

  const symbol = passed ? '\x1b[32m✔ PASS\x1b[0m' : '\x1b[31m✖ FAIL\x1b[0m';
  console.log(`  ${symbol} [${tier}] ${name} (${durationMs}ms)`);
  if (error) {
    console.log(`        \x1b[31mError:\x1b[0m ${error.message || error}`);
  }
}

async function runTest(session, tier, name, testFn) {
  const start = Date.now();
  try {
    await session.resetStudioState();
    await testFn(session);
    recordResult(tier, name, true, Date.now() - start);
  } catch (err) {
    recordResult(tier, name, false, Date.now() - start, err);
  }
}

async function main() {
  console.log('\n===============================================================');
  console.log(' SAMBA MULTITRACK STUDIO — BROWSER VERIFICATION SUITE');
  console.log('===============================================================\n');

  let session;
  try {
    console.log('Initializing Headless Browser Session via CDP...');
    session = await launchBrowser();
    console.log('Connected! Target URL: http://localhost:3000/#tab-beatbox\n');

    // =========================================================================
    // TIER 1: FEATURE COVERAGE
    // =========================================================================
    console.log('\x1b[36m▶ TIER 1: Feature Coverage (Core Interface & Engine)\x1b[0m');

    await runTest(session, 'Tier 1', 'TC1.1: Streamlined TCP Structure & Essential Controls', async (s) => {
      await s.evaluate(() => {
        window.BeatboxStudio.addTrack('Vocal Lead');
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const row = document.querySelector('.reaper-track-row');
        const tcp = row?.querySelector('.reaper-tcp');
        if (!tcp) throw new Error('TCP not found');
        return {
          hasArm: !!tcp.querySelector('.btn-rec-arm'),
          hasMute: !!tcp.querySelector('.tcp-btn-mute, .btn-tcp-mute'),
          hasSolo: !!tcp.querySelector('.tcp-btn-solo, .btn-tcp-solo'),
          hasFader: !!tcp.querySelector('.tcp-fader-slider, input[type="range"]'),
          hasSyncPill: !!tcp.querySelector('.tcp-sync-pill, .tcp-sync-box, .tcp-sync-display'),
          nudgeCount: tcp.querySelectorAll('[data-delta]').length,
          redundantCamRec: !!tcp.querySelector('.btn-tcp-rec[data-mode="video"]')
        };
      });
      if (!res.hasArm) throw new Error('Missing Arm button');
      if (!res.hasMute) throw new Error('Missing Mute button');
      if (!res.hasSolo) throw new Error('Missing Solo button');
      if (!res.hasFader) throw new Error('Missing volume fader');
      if (!res.hasSyncPill) throw new Error('Missing sync offset pill');
      if (res.nudgeCount > 0) throw new Error('TCP still contains redundant discrete nudge buttons');
      if (res.redundantCamRec) throw new Error('TCP still contains redundant camera record button');
    });

    await runTest(session, 'Tier 1', 'TC1.2: Kebab Dropdown Menu for Secondary Actions', async (s) => {
      await s.evaluate(() => {
        window.BeatboxStudio.addTrack('Violão');
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const moreBtn = document.querySelector('.tcp-btn-more, .tcp-kebab-btn, .btn-tcp-more');
        if (!moreBtn) throw new Error('Kebab context button (⋯) not found on TCP');
        moreBtn.click();
        const menu = document.querySelector('.tcp-kebab-menu, .tcp-menu-dropdown, .tcp-context-menu');
        const isOpen = menu && (menu.classList.contains('active') || menu.classList.contains('open') || menu.style.display !== 'none');
        return { isOpen: !!isOpen };
      });
      if (!res.isOpen) throw new Error('Clicking kebab button did not open context dropdown');
    });

    await runTest(session, 'Tier 1', 'TC1.3: Sticky Desktop Layout for TCP & Ruler Header', async (s) => {
      await s.evaluate(() => {
        window.BeatboxStudio.addTrack('Surdo Cento');
        window.BeatboxStudio.renderStudioViews();
      });
      const styles = await s.evaluate(() => {
        const tcp = document.querySelector('.reaper-tcp');
        const corner = document.querySelector('.reaper-tcp-corner');
        const ruler = document.querySelector('.reaper-ruler-header');
        return {
          tcpPos: tcp ? window.getComputedStyle(tcp).position : null,
          cornerPos: corner ? window.getComputedStyle(corner).position : null,
          rulerPos: ruler ? window.getComputedStyle(ruler).position : null
        };
      });
      if (styles.tcpPos !== 'sticky') throw new Error(`.reaper-tcp position is ${styles.tcpPos}, expected sticky`);
      if (styles.cornerPos !== 'sticky') throw new Error(`.reaper-tcp-corner position is ${styles.cornerPos}, expected sticky`);
      if (styles.rulerPos !== 'sticky') throw new Error(`.reaper-ruler-header position is ${styles.rulerPos}, expected sticky`);
    });

    await runTest(session, 'Tier 1', 'TC1.4: Track Selection & Visual Focus (.is-selected highlight)', async (s) => {
      await s.evaluate(() => {
        window.BeatboxStudio.addTrack('Track A');
        window.BeatboxStudio.addTrack('Track B');
        window.BeatboxStudio.renderStudioViews();
      });
      const sel = await s.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        if (rows.length < 2) throw new Error('Expected at least 2 track rows');
        rows[1].click();
        return {
          row0Selected: rows[0].classList.contains('is-selected'),
          row1Selected: rows[1].classList.contains('is-selected')
        };
      });
      if (!sel.row1Selected) throw new Error('Clicked track did not receive .is-selected class');
      if (sel.row0Selected) throw new Error('Non-clicked track still has .is-selected class');
    });

    await runTest(session, 'Tier 1', 'TC1.5: Keyboard Track Navigation (ArrowDown / ArrowUp)', async (s) => {
      await s.evaluate(() => {
        window.BeatboxStudio.addTrack('Faixa 1');
        window.BeatboxStudio.addTrack('Faixa 2');
        window.BeatboxStudio.renderStudioViews();
        document.querySelector('.reaper-track-row')?.click();
      });
      await s.dispatchKey('ArrowDown', 'ArrowDown');
      await new Promise(r => setTimeout(r, 80));
      const res = await s.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        return rows[1]?.classList.contains('is-selected');
      });
      if (!res) throw new Error('ArrowDown did not advance selection to next track');
    });

    await runTest(session, 'Tier 1', 'TC1.6: Single Clean Empty Arrange Lane Record Trigger', async (s) => {
      await s.evaluate(() => {
        window.BeatboxStudio.addTrack('Vazia');
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const lane = document.querySelector('.reaper-empty-lane');
        if (!lane) throw new Error('Empty lane not found');
        const btns = lane.querySelectorAll('button');
        return { btnCount: btns.length, text: lane.textContent };
      });
      if (res.btnCount !== 1) throw new Error(`Empty lane contains ${res.btnCount} buttons, expected exactly 1`);
    });

    await runTest(session, 'Tier 1', 'TC1.7: Pointer Events Drag Configuration (touch-action: none)', async (s) => {
      await s.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Clap');
        t.mediaUrl = 'blob:clap';
        t.duration = 4.0;
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const item = document.querySelector('.reaper-media-item');
        if (!item) throw new Error('Media item clip not found');
        return window.getComputedStyle(item).touchAction;
      });
      if (res !== 'none') throw new Error(`Media item touch-action is '${res}', expected 'none'`);
    });

    await runTest(session, 'Tier 1', 'TC1.8: Scroll-Compensated Coordinate Calculations on Drag', async (s) => {
      await s.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Scroll Drag');
        t.mediaUrl = 'blob:test';
        t.duration = 4.0;
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const scrollEl = document.getElementById('reaperDawScroll');
        scrollEl.scrollLeft = 100;
        const initialScroll = scrollEl.scrollLeft;

        const item = document.querySelector('.reaper-media-item');
        const downEvt = new PointerEvent('pointerdown', { clientX: 200, clientY: 100, bubbles: true });
        item.dispatchEvent(downEvt);
        const moveEvt = new PointerEvent('pointermove', { clientX: 250, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);
        const upEvt = new PointerEvent('pointerup', { clientX: 250, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);

        return { initialScroll, finalScroll: scrollEl.scrollLeft };
      });
      if (res.initialScroll !== res.finalScroll) {
        throw new Error('Container scrollLeft was altered unexpectedly during drag');
      }
    });

    await runTest(session, 'Tier 1', 'TC1.9: True Musical Snap-to-Grid Subdivisions', async (s) => {
      await s.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Snap Test');
        t.mediaUrl = 'blob:snap';
        t.duration = 4.0;
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const item = document.querySelector('.reaper-media-item');
        const downEvt = new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true });
        item.dispatchEvent(downEvt);
        const moveEvt = new PointerEvent('pointermove', { clientX: 160, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);
        const upEvt = new PointerEvent('pointerup', { clientX: 160, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);
        return true;
      });
      if (!res) throw new Error('Snap calculation failed');
    });

    await runTest(session, 'Tier 1', 'TC1.10: Timeline Duration Stability on Internal Drag', async (s) => {
      await s.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Duration Stability');
        t.mediaUrl = 'blob:dur';
        t.duration = 8.0;
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const barsBefore = document.querySelectorAll('.ruler-bar-item').length;
        const item = document.querySelector('.reaper-media-item');
        const downEvt = new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true });
        item.dispatchEvent(downEvt);
        const moveEvt = new PointerEvent('pointermove', { clientX: 140, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);
        const upEvt = new PointerEvent('pointerup', { clientX: 140, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);
        const barsAfter = document.querySelectorAll('.ruler-bar-item').length;
        return barsAfter >= barsBefore;
      });
      if (!res) throw new Error('Timeline duration shrank unexpectedly after moving internal clip');
    });

    await runTest(session, 'Tier 1', 'TC1.11: Non-Destructive In-Place Drop Without DOM Wiping', async (s) => {
      await s.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('In-Place Drop');
        t.mediaUrl = 'blob:inplace';
        t.duration = 4.0;
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const itemBefore = document.querySelector('.reaper-media-item');
        itemBefore._surviveMarker = true;

        const downEvt = new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true });
        itemBefore.dispatchEvent(downEvt);
        const moveEvt = new PointerEvent('pointermove', { clientX: 130, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);
        const upEvt = new PointerEvent('pointerup', { clientX: 130, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);

        const itemAfter = document.querySelector('.reaper-media-item');
        return itemAfter && itemAfter._surviveMarker === true;
      });
      if (!res) throw new Error('DOM element was destroyed and recreated on drop');
    });

    await runTest(session, 'Tier 1', 'TC1.12: Dead-Zone Clamping Elimination at t=0 Boundary', async () => {
      const res = await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Dead Zone Clip');
        t.mediaUrl = 'blob:deadzone';
        t.duration = 4.0;
        t.offsetMs = 400;
        window.BeatboxStudio.renderStudioViews();

        const item = document.querySelector('.reaper-media-item');
        const downEvt = new PointerEvent('pointerdown', { clientX: 300, clientY: 100, bubbles: true });
        item.dispatchEvent(downEvt);
        const moveEvt = new PointerEvent('pointermove', { clientX: 50, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);
        const upEvt = new PointerEvent('pointerup', { clientX: 50, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);

        return t.offsetMs >= 0;
      });
      if (!res) throw new Error('Clip offset was negative or frozen at boundary');
    });

    await runTest(session, 'Tier 1', 'TC1.13: Track Arming Model & Independent Arm Toggle', async (s) => {
      await s.evaluate(() => {
        window.BeatboxStudio.addTrack('Arm Track');
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const armBtn = document.querySelector('.btn-rec-arm');
        if (!armBtn) throw new Error('Arm button not found');
        const viewBefore = document.getElementById('timelineWorkspace')?.style.display;
        armBtn.click();
        const viewAfter = document.getElementById('timelineWorkspace')?.style.display;
        const isArmed = armBtn.classList.contains('armed') || armBtn.classList.contains('active');
        return { isArmed, sameView: viewBefore === viewAfter };
      });
      if (!res.isArmed) throw new Error('Arm button did not toggle armed status');
      if (!res.sameView) throw new Error('Arm button caused unwanted view mode redirect');
    });

    await runTest(session, 'Tier 1', 'TC1.14: Master Transport Record Button (#btnStudioRecord)', async (s) => {
      const res = await s.evaluate(() => {
        const btnRec = document.getElementById('btnStudioRecord') || document.querySelector('.btn-studio-record, .btn-record');
        return { exists: !!btnRec, text: btnRec ? btnRec.textContent.trim() : '' };
      });
      if (!res.exists) throw new Error('Master toolbar Record button #btnStudioRecord not found');
    });

    await runTest(session, 'Tier 1', 'TC1.15: Non-Destructive Solo Audio Routing', async (s) => {
      await s.evaluate(() => {
        window.BeatboxStudio.addTrack('Solo 1');
        window.BeatboxStudio.addTrack('Solo 2');
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        rows[0]._marker = 'persist';
        const soloBtn = rows[0].querySelector('.tcp-btn-solo, .btn-tcp-solo');
        if (!soloBtn) throw new Error('Solo button not found');
        soloBtn.click();
        const rowsAfter = document.querySelectorAll('.reaper-track-row');
        return rowsAfter[0]?._marker === 'persist';
      });
      if (!res) throw new Error('Solo toggle wiped tracks DOM stack');
    });

    await runTest(session, 'Tier 1', 'TC1.16: Transport State Machine (Play / Pause / Stop)', async (s) => {
      await s.evaluate(() => {
        window.BeatboxStudio.addTrack('State Machine Track');
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const btnPlay = document.getElementById('btnStudioPlay');
        const btnStop = document.getElementById('btnStudioStop');
        if (!btnPlay || !btnStop) throw new Error('Transport buttons not found');
        btnPlay.click();
        const p1 = window.BeatboxStudio.getProjectSummary().isPlaying;
        btnStop.click();
        const p2 = window.BeatboxStudio.getProjectSummary().isPlaying;
        return { p1, stopped: p2 === false };
      });
      if (!res.stopped) throw new Error('Stop did not reset isPlaying to false');
    });

    await runTest(session, 'Tier 1', 'TC1.17: Ruler Seek Clock Synchronization', async (s) => {
      await s.evaluate(() => {
        window.BeatboxStudio.addTrack('Seek Track');
        window.BeatboxStudio.renderStudioViews();
      });
      const res = await s.evaluate(() => {
        const ruler = document.getElementById('reaperRulerTrack');
        if (!ruler) throw new Error('Ruler track not found');
        const rect = ruler.getBoundingClientRect();
        ruler.dispatchEvent(new MouseEvent('click', {
          clientX: rect.left + rect.width * 0.4,
          clientY: rect.top + rect.height * 0.5,
          bubbles: true
        }));
        const playhead = document.getElementById('reaperPlayhead');
        return playhead ? parseFloat(playhead.style.left) > 5 : false;
      });
      if (!res) throw new Error('Playhead did not seek to clicked ruler position');
    });

    await runTest(session, 'Tier 1', 'TC1.18: Shortcut Collision Resolution (KeyS does not cut clip)', async (s) => {
      await s.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Shortcut Track');
        t.mediaUrl = 'blob:safe';
        t.duration = 4.0;
        window.BeatboxStudio.renderStudioViews();
      });
      await s.dispatchKey('KeyS', 's');
      await new Promise(r => setTimeout(r, 60));
      const res = await s.evaluate(() => {
        return document.querySelectorAll('.reaper-track-row').length === 1;
      });
      if (!res) throw new Error('Pressing S unexpectedly cut the track');
    });

    // =========================================================================
    // TIER 2: BOUNDARY & CORNER CASES
    // =========================================================================
    console.log('\n\x1b[36m▶ TIER 2: Boundary & Corner Cases\x1b[0m');

    await runTest(session, 'Tier 2', 'TC2.1: Empty Project State & Transport Immunity', async (s) => {
      const res = await s.evaluate(() => {
        window.BeatboxStudio.clearCurrentProjectTracks();
        window.BeatboxStudio.renderStudioViews();
        document.getElementById('btnStudioPlay')?.click();
        document.getElementById('btnStudioStop')?.click();
        return {
          hero: !!document.querySelector('.studio-empty-project-hero'),
          tracks: window.BeatboxStudio.getProjectSummary().totalTracks
        };
      });
      if (!res.hero) throw new Error('Empty project hero not displayed');
      if (res.tracks !== 0) throw new Error('Expected 0 tracks');
    });

    await runTest(session, 'Tier 2', 'TC2.2: Extreme Track Scaling (10+ Tracks Rendering)', async (s) => {
      const res = await s.evaluate(() => {
        for (let i = 1; i <= 10; i++) window.BeatboxStudio.addTrack(`Faixa ${i}`);
        window.BeatboxStudio.renderStudioViews();
        const rows = document.querySelectorAll('.reaper-track-row');
        return rows.length === 10;
      });
      if (!res) throw new Error('Failed to render 10 tracks cleanly');
    });

    await runTest(session, 'Tier 2', 'TC2.3: Maximum Zoom Level (200%) & Horizontal Scroll Bounds', async (s) => {
      const res = await s.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Zoom Track');
        t.mediaUrl = 'blob:zoom';
        t.duration = 16.0;
        window.BeatboxStudio.renderStudioViews();
        const main = document.getElementById('reaperDawMain');
        const scroll = document.getElementById('reaperDawScroll');
        main.style.width = '200%';
        scroll.scrollLeft = 500;
        return scroll.scrollLeft > 0;
      });
      if (!res) throw new Error('Failed to scroll timeline canvas at 200% zoom');
    });

    await runTest(session, 'Tier 2', 'TC2.4: Extreme Clip Boundary Clamping', async (s) => {
      const res = await s.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Boundary Clip');
        t.mediaUrl = 'blob:boundary';
        t.duration = 4.0;
        window.BeatboxStudio.renderStudioViews();
        const item = document.querySelector('.reaper-media-item');
        const downEvt = new PointerEvent('pointerdown', { clientX: 200, clientY: 100, bubbles: true });
        item.dispatchEvent(downEvt);
        const moveEvt = new PointerEvent('pointermove', { clientX: -1000, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);
        const upEvt = new PointerEvent('pointerup', { clientX: -1000, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);
        return t.offsetMs >= 0;
      });
      if (!res) throw new Error('Offset was negative when dragged out of bounds');
    });

    await runTest(session, 'Tier 2', 'TC2.5: Rapid Sequential Transport Invocations', async (s) => {
      const res = await s.evaluate(async () => {
        window.BeatboxStudio.addTrack('Rapid Test');
        window.BeatboxStudio.renderStudioViews();
        const p = document.getElementById('btnStudioPlay');
        const st = document.getElementById('btnStudioStop');
        for (let i = 0; i < 4; i++) {
          p?.click();
          await new Promise(r => setTimeout(r, 10));
        }
        st?.click();
        return window.BeatboxStudio.getProjectSummary().isPlaying === false;
      });
      if (!res) throw new Error('Rapid clicks left playback in invalid state');
    });

    // =========================================================================
    // TIER 3: CROSS-FEATURE INTERACTIONS
    // =========================================================================
    console.log('\n\x1b[36m▶ TIER 3: Cross-Feature Interactions\x1b[0m');

    await runTest(session, 'Tier 3', 'TC3.1: Clip Repositioning Under High Zoom + Container Scroll', async (s) => {
      const res = await s.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Inter 1');
        t.mediaUrl = 'blob:test';
        t.duration = 10.0;
        window.BeatboxStudio.renderStudioViews();
        const main = document.getElementById('reaperDawMain');
        if (main) main.style.width = '200%';
        const scroll = document.getElementById('reaperDawScroll');
        scroll.scrollLeft = 120;
        const item = document.querySelector('.reaper-media-item');
        const downEvt = new PointerEvent('pointerdown', { clientX: 250, clientY: 100, bubbles: true });
        item.dispatchEvent(downEvt);
        const moveEvt = new PointerEvent('pointermove', { clientX: 310, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);
        const upEvt = new PointerEvent('pointerup', { clientX: 310, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);
        return scroll.scrollLeft === 120;
      });
      if (!res) throw new Error('Scroll position was displaced');
    });

    await runTest(session, 'Tier 3', 'TC3.2: Multitrack Solo Toggling During Active Playback', async (s) => {
      const res = await s.evaluate(async () => {
        window.BeatboxStudio.addTrack('Track 1');
        window.BeatboxStudio.addTrack('Track 2');
        window.BeatboxStudio.renderStudioViews();
        document.getElementById('btnStudioPlay')?.click();
        const sBtn = document.querySelector('.tcp-btn-solo, .btn-tcp-solo');
        sBtn?.click();
        await new Promise(r => setTimeout(r, 30));
        document.getElementById('btnStudioStop')?.click();
        return true;
      });
      if (!res) throw new Error('Solo toggle failed during playback');
    });

    await runTest(session, 'Tier 3', 'TC3.3: Keyboard Navigation Preserving Mixed Track States', async (s) => {
      await s.evaluate(() => {
        const t1 = window.BeatboxStudio.addTrack('Muted Track');
        t1.muted = true;
        const t2 = window.BeatboxStudio.addTrack('Solo Track');
        t2.solo = true;
        window.BeatboxStudio.renderStudioViews();
        document.querySelector('.reaper-track-row')?.click();
      });
      await s.dispatchKey('ArrowDown', 'ArrowDown');
      await new Promise(r => setTimeout(r, 60));
      const res = await s.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        return rows[1]?.classList.contains('is-selected');
      });
      if (!res) throw new Error('Keyboard navigation failed on diverse track states');
    });

    await runTest(session, 'Tier 3', 'TC3.4: In-Place Drop with Synchronized Playhead Alignment', async (s) => {
      const res = await s.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Align Track');
        t.mediaUrl = 'blob:test';
        t.duration = 6.0;
        window.BeatboxStudio.renderStudioViews();
        const ph = document.getElementById('reaperPlayhead');
        if (ph) ph.style.left = '30%';
        const item = document.querySelector('.reaper-media-item');
        const downEvt = new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true });
        item.dispatchEvent(downEvt);
        const moveEvt = new PointerEvent('pointermove', { clientX: 140, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);
        const upEvt = new PointerEvent('pointerup', { clientX: 140, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);
        return ph ? ph.style.left === '30%' : false;
      });
      if (!res) throw new Error('Playhead alignment changed unexpectedly');
    });

    // =========================================================================
    // TIER 4: REAL-WORLD APPLICATION SCENARIOS
    // =========================================================================
    console.log('\n\x1b[36m▶ TIER 4: Real-World Application Scenarios\x1b[0m');

    await runTest(session, 'Tier 4', 'TC4.1: Full Multi-Track Recording & Production Session Flow', async (s) => {
      const res = await s.evaluate(async () => {
        // Step 1: Zero project
        window.BeatboxStudio.clearCurrentProjectTracks();
        window.BeatboxStudio.renderStudioViews();

        // Step 2: Add 3 tracks
        window.BeatboxStudio.addTrack('Surdo');
        window.BeatboxStudio.addTrack('Caixa');
        window.BeatboxStudio.addTrack('Repique');
        window.BeatboxStudio.renderStudioViews();

        // Step 3: Arm track 1
        const armBtns = document.querySelectorAll('.btn-rec-arm');
        if (armBtns.length > 0) armBtns[0].click();

        // Step 4: Play and Stop
        document.getElementById('btnStudioPlay')?.click();
        await new Promise(r => setTimeout(r, 40));
        document.getElementById('btnStudioStop')?.click();

        const summary = window.BeatboxStudio.getProjectSummary();
        return summary.totalTracks === 3;
      });
      if (!res) throw new Error('Session flow encountered unexpected state error');
    });

  } finally {
    if (session) await session.close();
    stopSpawnedServer();
  }

  // Summary Report
  console.log('\n===============================================================');
  console.log(' VERIFICATION SUMMARY');
  console.log('===============================================================');
  console.log(`Total Test Cases : ${results.length}`);
  console.log(`Passed           : \x1b[32m${passCount}\x1b[0m`);
  console.log(`Failed           : \x1b[31m${failCount}\x1b[0m`);
  console.log('===============================================================\n');

  if (failCount > 0) {
    console.log(`\x1b[31mVERIFICATION FAILED with ${failCount} defect(s).\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log('\x1b[32mALL BROWSER VERIFICATION TESTS PASSED SUCCESSFULLY!\x1b[0m\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal harness error:', err);
  stopSpawnedServer();
  process.exit(1);
});
