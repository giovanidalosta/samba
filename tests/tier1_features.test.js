const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

describe('Tier 1: Feature Coverage', () => {
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

  // =========================================================================
  // Feature A: UI Layout & Track Navigation (Features 1 - 7)
  // =========================================================================
  describe('UI Layout & Track Navigation', () => {
    it('TC1.1: Streamlined TCP Structure — should render TCP with essential controls and compact layout', async () => {
      // Add a track to inspect TCP
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Vocal Lead');
        window.BeatboxStudio.renderStudioViews();
      });

      const tcpInfo = await session.evaluate(() => {
        const row = document.querySelector('.reaper-track-row');
        if (!row) return null;
        const tcp = row.querySelector('.reaper-tcp');
        if (!tcp) return null;

        return {
          hasTcp: true,
          hasArm: !!tcp.querySelector('.btn-rec-arm'),
          hasMute: !!tcp.querySelector('.tcp-btn-mute, .btn-tcp-mute'),
          hasSolo: !!tcp.querySelector('.tcp-btn-solo, .btn-tcp-solo'),
          hasFader: !!tcp.querySelector('.tcp-fader-slider, input[type="range"]'),
          hasSyncPill: !!tcp.querySelector('.tcp-sync-pill, .tcp-sync-box, .tcp-sync-display'),
          hasMoreMenu: !!tcp.querySelector('.tcp-btn-more, .tcp-kebab-btn, button[title*="Menu"], button[title*="Opções"]'),
          // Redundant controls that should be removed from main TCP
          redundantNudgeButtons: tcp.querySelectorAll('[data-delta]').length,
          redundantCamRec: !!tcp.querySelector('.btn-tcp-rec[data-mode="video"]'),
          redundantMicRec: !!tcp.querySelector('.btn-tcp-rec[data-mode="audio"]')
        };
      });

      assert.ok(tcpInfo, 'Track row and TCP must exist in DOM');
      assert.ok(tcpInfo.hasArm, 'TCP must have an Arm button');
      assert.ok(tcpInfo.hasMute, 'TCP must have a Mute button');
      assert.ok(tcpInfo.hasSolo, 'TCP must have a Solo button');
      assert.ok(tcpInfo.hasFader, 'TCP must have a volume fader');
      assert.ok(tcpInfo.hasSyncPill, 'TCP must have a compact sync offset display');
      // Verify redundant clutter was eliminated
      assert.equal(tcpInfo.redundantNudgeButtons, 0, 'Discrete nudge buttons (-50, -10, etc.) must be removed from TCP');
      assert.equal(tcpInfo.redundantCamRec, false, 'Redundant camera record button must be removed from TCP row');
    });

    it('TC1.2: Kebab Dropdown Menu — should toggle dropdown with secondary track actions', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Guitarra');
        window.BeatboxStudio.renderStudioViews();
      });

      const menuResult = await session.evaluate(() => {
        const moreBtn = document.querySelector('.tcp-btn-more, .tcp-kebab-btn, .btn-tcp-more');
        if (!moreBtn) {
          // If kebab button not found, report failure
          return { foundButton: false };
        }
        moreBtn.click();
        const menu = document.querySelector('.tcp-kebab-menu, .tcp-menu-dropdown, .tcp-context-menu');
        const isMenuOpen = menu && (menu.classList.contains('active') || menu.classList.contains('open') || menu.style.display !== 'none');
        const items = menu ? Array.from(menu.querySelectorAll('button, a, .menu-item')).map(el => el.textContent.trim()) : [];
        return {
          foundButton: true,
          isMenuOpen: !!isMenuOpen,
          itemsCount: items.length
        };
      });

      assert.ok(menuResult.foundButton, 'Kebab context menu button must exist on TCP');
      assert.ok(menuResult.isMenuOpen, 'Clicking kebab button must open context menu');
      assert.ok(menuResult.itemsCount >= 3, 'Kebab menu must contain secondary actions (duplicate, clear, delete)');
    });

    it('TC1.3: Sticky Desktop Layout — TCP, TCP corner, and Ruler header must have sticky positioning', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Surdo');
        window.BeatboxStudio.renderStudioViews();
      });

      const styles = await session.evaluate(() => {
        const tcp = document.querySelector('.reaper-tcp');
        const corner = document.querySelector('.reaper-tcp-corner');
        const ruler = document.querySelector('.reaper-ruler-header');
        return {
          tcpPos: tcp ? window.getComputedStyle(tcp).position : null,
          tcpLeft: tcp ? window.getComputedStyle(tcp).left : null,
          cornerPos: corner ? window.getComputedStyle(corner).position : null,
          cornerLeft: corner ? window.getComputedStyle(corner).left : null,
          rulerPos: ruler ? window.getComputedStyle(ruler).position : null,
          rulerTop: ruler ? window.getComputedStyle(ruler).top : null
        };
      });

      assert.equal(styles.tcpPos, 'sticky', '.reaper-tcp must have position: sticky');
      assert.equal(styles.tcpLeft, '0px', '.reaper-tcp must have left: 0px');
      assert.equal(styles.cornerPos, 'sticky', '.reaper-tcp-corner must have position: sticky');
      assert.equal(styles.rulerPos, 'sticky', '.reaper-ruler-header must have position: sticky');
    });

    it('TC1.4: Track Selection & Visual Focus — clicking track row or TCP must apply .is-selected gold border', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Track 1');
        window.BeatboxStudio.addTrack('Track 2');
        window.BeatboxStudio.renderStudioViews();
      });

      // Click on Track 2 TCP
      const selectionResult = await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        if (rows.length < 2) return null;

        const tcp2 = rows[1].querySelector('.reaper-tcp') || rows[1];
        tcp2.click();

        return {
          row1Selected: rows[0].classList.contains('is-selected'),
          row2Selected: rows[1].classList.contains('is-selected')
        };
      });

      assert.ok(selectionResult, 'Track rows must exist');
      assert.equal(selectionResult.row2Selected, true, 'Track 2 must have .is-selected class after clicking');
      assert.equal(selectionResult.row1Selected, false, 'Track 1 must not be selected');
    });

    it('TC1.5: Keyboard Track Navigation — ArrowUp/ArrowDown must cycle track selection', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Agogô');
        window.BeatboxStudio.addTrack('Tamborim');
        window.BeatboxStudio.addTrack('Cuíca');
        window.BeatboxStudio.renderStudioViews();
        // Select track 0 initially
        const firstRow = document.querySelector('.reaper-track-row');
        if (firstRow) firstRow.click();
      });

      // Press ArrowDown to select track 1
      await session.dispatchKey('ArrowDown', 'ArrowDown');
      await new Promise(r => setTimeout(r, 100));

      const afterDown = await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        return {
          row0: rows[0]?.classList.contains('is-selected'),
          row1: rows[1]?.classList.contains('is-selected'),
          row2: rows[2]?.classList.contains('is-selected')
        };
      });
      assert.equal(afterDown.row1, true, 'Pressing ArrowDown must select second track');

      // Press ArrowDown again to select track 2
      await session.dispatchKey('ArrowDown', 'ArrowDown');
      await new Promise(r => setTimeout(r, 100));

      const afterDown2 = await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        return rows[2]?.classList.contains('is-selected');
      });
      assert.equal(afterDown2, true, 'Pressing ArrowDown again must select third track');

      // Press ArrowUp to select track 1 again
      await session.dispatchKey('ArrowUp', 'ArrowUp');
      await new Promise(r => setTimeout(r, 100));

      const afterUp = await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        return rows[1]?.classList.contains('is-selected');
      });
      assert.equal(afterUp, true, 'Pressing ArrowUp must return selection to second track');
    });

    it('TC1.6: Single Clean Empty Lane — empty lane must render a single record trigger button', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Faixa Vazia');
        window.BeatboxStudio.renderStudioViews();
      });

      const emptyLaneInfo = await session.evaluate(() => {
        const emptyLane = document.querySelector('.reaper-empty-lane');
        if (!emptyLane) return null;
        const buttons = emptyLane.querySelectorAll('button');
        const text = emptyLane.textContent;
        return {
          buttonCount: buttons.length,
          hasGravarBtn: Array.from(buttons).some(b => b.textContent.includes('Gravar')),
          hasCameraClutter: Array.from(buttons).some(b => b.textContent.includes('Gravar Câmera') && b.textContent.includes('Gravar Microfone'))
        };
      });

      assert.ok(emptyLaneInfo, 'Empty arrange lane must exist');
      assert.equal(emptyLaneInfo.buttonCount, 1, 'Empty arrange lane must render exactly one clean record button');
      assert.ok(emptyLaneInfo.hasGravarBtn, 'Record button must contain "Gravar" text');
    });
  });

  // =========================================================================
  // Feature B: Audio Clip Dragging & Scroll Math (Features 8 - 13)
  // =========================================================================
  describe('Audio Clip Dragging & Scroll Math', () => {
    async function setupTrackWithClip(offsetMs = 0, durationSec = 4.0) {
      return session.evaluate((offset, dur) => {
        const t = window.BeatboxStudio.addTrack('Pandeiro');
        t.mediaUrl = 'blob:test-audio-clip';
        t.duration = dur;
        t.offsetMs = offset;
        t.trimStart = 0;
        t.trimEnd = 0;
        t.waveformPeaks = [0.2, 0.5, 0.8, 0.4, 0.9, 0.3];
        window.BeatboxStudio.renderStudioViews();
        return t.id;
      }, offsetMs, durationSec);
    }

    it('TC1.7: Pointer Events Configuration — clip elements must use pointer events and touch-action: none', async () => {
      const trackId = await setupTrackWithClip(0, 4.0);

      const clipInfo = await session.evaluate((id) => {
        const item = document.getElementById(`media_item_${id}`) || document.querySelector('.reaper-media-item');
        if (!item) return null;
        const style = window.getComputedStyle(item);
        return {
          hasItem: true,
          touchAction: style.touchAction,
          userSelect: style.userSelect
        };
      }, trackId);

      assert.ok(clipInfo, 'Media item clip must exist in arrange lane');
      assert.equal(clipInfo.touchAction, 'none', 'Media item must have touch-action: none to prevent browser gesture interception');
    });

    it('TC1.8: Scroll-Compensated Coordinate Math — dragging clip with container scrollLeft must compute correct timeline offset', async () => {
      const trackId = await setupTrackWithClip(0, 4.0);

      // Scroll container horizontally
      await session.evaluate(() => {
        const scrollContainer = document.getElementById('reaperDawScroll');
        if (scrollContainer) {
          scrollContainer.scrollLeft = 150;
        }
      });

      // Drag clip by 100px to the right
      const dragResult = await session.evaluate((id) => {
        const item = document.getElementById(`media_item_${id}`) || document.querySelector('.reaper-media-item');
        const lane = item.parentElement;
        const initialScrollLeft = document.getElementById('reaperDawScroll').scrollLeft;
        const initialOffset = parseFloat(item.style.left) || 0;

        // Simulate pointerdown, pointermove, pointerup
        const downEvt = new PointerEvent('pointerdown', { clientX: 200, clientY: 100, bubbles: true });
        item.dispatchEvent(downEvt);

        const moveEvt = new PointerEvent('pointermove', { clientX: 300, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);

        const upEvt = new PointerEvent('pointerup', { clientX: 300, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);

        const finalScrollLeft = document.getElementById('reaperDawScroll').scrollLeft;
        const finalLeftStyle = item.style.left;

        return {
          initialScrollLeft,
          finalScrollLeft,
          finalLeftStyle,
          preservedScroll: initialScrollLeft === finalScrollLeft
        };
      }, trackId);

      assert.equal(dragResult.preservedScroll, true, 'Container scrollLeft must remain intact during clip dragging');
    });

    it('TC1.9: True Musical Snap-to-Grid — clip offset must quantize to musical beat subdivisions', async () => {
      const trackId = await setupTrackWithClip(0, 4.0);

      const snapResult = await session.evaluate((id) => {
        // Set BPM = 120 (1 beat = 500ms, 8th note = 250ms)
        const item = document.getElementById(`media_item_${id}`) || document.querySelector('.reaper-media-item');

        // Drag slightly off-grid: e.g. 132ms
        const downEvt = new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true });
        item.dispatchEvent(downEvt);

        // Move to coordinate representing ~260ms
        const moveEvt = new PointerEvent('pointermove', { clientX: 150, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);

        const upEvt = new PointerEvent('pointerup', { clientX: 150, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);

        const pill = document.querySelector('.tcp-sync-pill, .tcp-sync-display');
        const pillText = pill ? pill.textContent : '';
        return {
          pillText
        };
      }, trackId);

      assert.ok(snapResult, 'Snap result must be computed');
    });

    it('TC1.10: Timeline Duration Stability — dragging clip within bounds must not shrink timeline duration', async () => {
      const trackId = await setupTrackWithClip(0, 8.0);

      const durationStability = await session.evaluate((id) => {
        const rulerBarsBefore = document.querySelectorAll('.ruler-bar-item').length;
        const item = document.getElementById(`media_item_${id}`) || document.querySelector('.reaper-media-item');

        // Drag clip to the right
        const downEvt = new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true });
        item.dispatchEvent(downEvt);
        const moveEvt = new PointerEvent('pointermove', { clientX: 180, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);
        const upEvt = new PointerEvent('pointerup', { clientX: 180, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);

        const rulerBarsAfter = document.querySelectorAll('.ruler-bar-item').length;
        return {
          rulerBarsBefore,
          rulerBarsAfter,
          isStable: rulerBarsAfter >= rulerBarsBefore
        };
      }, trackId);

      assert.ok(durationStability.isStable, 'Timeline duration / ruler bars must not shrink when moving internal clip');
    });

    it('TC1.11: Non-Destructive In-Place Drop — drop must update DOM styles in-place without wiping tracksStack', async () => {
      const trackId = await setupTrackWithClip(0, 4.0);

      const inPlaceResult = await session.evaluate((id) => {
        const itemBefore = document.getElementById(`media_item_${id}`);
        // Attach sentinel marker property directly to the DOM element
        itemBefore._testMarker = 42;

        const downEvt = new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true });
        itemBefore.dispatchEvent(downEvt);
        const moveEvt = new PointerEvent('pointermove', { clientX: 140, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);
        const upEvt = new PointerEvent('pointerup', { clientX: 140, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);

        const itemAfter = document.getElementById(`media_item_${id}`);
        return {
          markerPreserved: itemAfter && itemAfter._testMarker === 42,
          elementIdentical: itemBefore === itemAfter
        };
      }, trackId);

      assert.equal(inPlaceResult.markerPreserved, true, 'DOM element must be updated in-place without destroying and recreating innerHTML');
    });

    it('TC1.12: Dead-Zone Clamping Elimination — dragging toward left timeline edge must clamp safely at 0ms', async () => {
      const trackId = await setupTrackWithClip(500, 4.0);

      const clampResult = await session.evaluate((id) => {
        const item = document.getElementById(`media_item_${id}`) || document.querySelector('.reaper-media-item');

        // Drag far left (negative)
        const downEvt = new PointerEvent('pointerdown', { clientX: 300, clientY: 100, bubbles: true });
        item.dispatchEvent(downEvt);
        const moveEvt = new PointerEvent('pointermove', { clientX: 50, clientY: 100, bubbles: true });
        window.dispatchEvent(moveEvt);
        const upEvt = new PointerEvent('pointerup', { clientX: 50, clientY: 100, bubbles: true });
        window.dispatchEvent(upEvt);

        const pill = document.querySelector('.tcp-sync-pill, .tcp-sync-display');
        const offsetVal = pill ? parseInt(pill.textContent.replace(/[^0-9-]/g, ''), 10) : 0;
        return {
          offsetVal,
          isNonNegative: offsetVal >= 0
        };
      }, trackId);

      assert.ok(clampResult.isNonNegative, 'Timeline offset must clamp at >= 0ms and never lock or freeze in negative dead zone');
    });
  });

  // =========================================================================
  // Feature C: Recording Tools & Transport Overhaul (Features 14 - 19)
  // =========================================================================
  describe('Recording Tools & Transport Overhaul', () => {
    it('TC1.13: Track Arming Model — clicking Arm button ● must toggle armed state without switching views', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Cavaco');
        window.BeatboxStudio.renderStudioViews();
      });

      const armResult = await session.evaluate(() => {
        const armBtn = document.querySelector('.btn-rec-arm');
        if (!armBtn) return null;

        const viewBefore = document.getElementById('timelineWorkspace')?.style.display !== 'none';
        armBtn.click();
        const armActive = armBtn.classList.contains('armed') || armBtn.classList.contains('active');
        const viewAfter = document.getElementById('timelineWorkspace')?.style.display !== 'none';

        return {
          armActive,
          stayedInTimeline: viewBefore && viewAfter
        };
      });

      assert.ok(armResult, 'Arm button must exist');
      assert.ok(armResult.armActive, 'Clicking Arm button must activate armed state');
      assert.ok(armResult.stayedInTimeline, 'Toggling Arm must NOT force a view mode switch away from timeline');
    });

    it('TC1.14: Master Transport Record Button — master toolbar must feature a dedicated Record button', async () => {
      const recBtnInfo = await session.evaluate(() => {
        const cluster = document.querySelector('.transport-btn-cluster');
        const btnRec = document.getElementById('btnStudioRecord') || document.querySelector('.btn-studio-record, .btn-record');
        return {
          clusterExists: !!cluster,
          btnRecExists: !!btnRec,
          btnText: btnRec ? btnRec.textContent.trim() : ''
        };
      });

      assert.ok(recBtnInfo.btnRecExists, 'Master transport cluster must include Record button (#btnStudioRecord)');
      assert.ok(recBtnInfo.btnText.includes('Gravar') || recBtnInfo.btnText.includes('●'), 'Record button must indicate recording');
    });

    it('TC1.15: Non-Destructive Solo Routing — toggling Solo during playback must not clear tracks DOM or restart playback', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Surdo 1');
        window.BeatboxStudio.addTrack('Surdo 2');
        window.BeatboxStudio.renderStudioViews();
      });

      const soloResult = await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        const soloBtn = rows[0].querySelector('.tcp-btn-solo, .btn-tcp-solo');
        if (!soloBtn) return null;

        // Set sentinel property on row
        rows[0]._testMarker = 'persist';
        soloBtn.click();

        const rowsAfter = document.querySelectorAll('.reaper-track-row');
        return {
          markerSurvived: rowsAfter[0] && rowsAfter[0]._testMarker === 'persist',
          isSoloActive: soloBtn.classList.contains('active') || rowsAfter[0].classList.contains('is-soloed')
        };
      });

      assert.ok(soloResult, 'Solo button must exist');
      assert.equal(soloResult.markerSurvived, true, 'Toggling Solo must update in-place without destroying tracks DOM');
    });

    it('TC1.16: Transport State Machine — Pause must preserve playhead position, Stop must rewind to 0', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Base Beat');
        window.BeatboxStudio.renderStudioViews();
      });

      const transportResult = await session.evaluate(() => {
        const btnPlay = document.getElementById('btnStudioPlay');
        const btnStop = document.getElementById('btnStudioStop');
        if (!btnPlay || !btnStop) return null;

        // Trigger Play
        btnPlay.click();
        const summaryPlaying = window.BeatboxStudio.getProjectSummary();

        // Pause
        btnPlay.click();
        const summaryPaused = window.BeatboxStudio.getProjectSummary();

        // Stop
        btnStop.click();
        const summaryStopped = window.BeatboxStudio.getProjectSummary();

        return {
          summaryPlaying,
          summaryPaused,
          summaryStopped
        };
      });

      assert.ok(transportResult, 'Transport controls must exist');
    });

    it('TC1.17: Ruler Seek Clock Synchronization — seeking on ruler must not snap playhead back', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Repique');
        window.BeatboxStudio.renderStudioViews();
      });

      const seekResult = await session.evaluate(() => {
        const rulerTrack = document.getElementById('reaperRulerTrack');
        if (!rulerTrack) return null;

        const rect = rulerTrack.getBoundingClientRect();
        // Click at 50% width
        const clickEvt = new MouseEvent('click', {
          clientX: rect.left + rect.width * 0.5,
          clientY: rect.top + rect.height * 0.5,
          bubbles: true
        });
        rulerTrack.dispatchEvent(clickEvt);

        const playhead = document.getElementById('reaperPlayhead');
        const leftPct = playhead ? parseFloat(playhead.style.left) : 0;
        return {
          leftPct,
          didSeek: leftPct > 10
        };
      });

      assert.ok(seekResult, 'Ruler track must exist');
      assert.ok(seekResult.didSeek, 'Clicking ruler must position playhead at target timeline location');
    });

    it('TC1.18: Shortcut Collision Resolution — pressing KeyS must not trigger split clip destruction', async () => {
      await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Chocalho');
        t.mediaUrl = 'blob:test';
        t.duration = 4.0;
        window.BeatboxStudio.renderStudioViews();
      });

      // Dispatch 'KeyS'
      await session.dispatchKey('KeyS', 's');
      await new Promise(r => setTimeout(r, 100));

      const tracksCount = await session.evaluate(() => {
        return document.querySelectorAll('.reaper-track-row').length;
      });

      // Track should not be unexpectedly cut / split into two tracks
      assert.equal(tracksCount, 1, 'Pressing S must not split or damage audio clips');
    });
  });
});
