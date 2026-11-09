const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

describe('Milestone 3 Adversarial Empirical Challenge Suite', () => {
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
    await session.evaluate(() => {
      window._testTracks = {};
    });
  });

  // Helper: setup track with mock media element and timeline duration
  async function setupTrackWithMedia(name, offsetMs = 0, durationSec = 8.0) {
    return session.evaluate((trackName, offset, dur) => {
      window._testTracks = window._testTracks || {};
      const t = window.BeatboxStudio.addTrack(trackName);
      t.mediaUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      t.duration = dur;
      t.offsetMs = offset;
      t.trimStart = 0;
      t.trimEnd = 0;
      t.waveformPeaks = [0.2, 0.5, 0.8, 0.4, 0.9, 0.3, 0.7, 0.2];
      window.BeatboxStudio.renderStudioViews();
      window._testTracks[t.id] = t;
      return { id: t.id, name: t.name, duration: t.duration };
    }, name, offsetMs, durationSec);
  }

  // =========================================================================
  // Challenge 1: Track Arming Model & Toggle Mechanics (Feature 14)
  // =========================================================================
  describe('Challenge 1: Track Arming Model & Toggle Mechanics', () => {

    it('Stress 1.1: Multi-Track Arming Concurrency — independent arming of multiple tracks simultaneously', async () => {
      const result = await session.evaluate(() => {
        window._tracks = [];
        for (let i = 1; i <= 4; i++) {
          const t = window.BeatboxStudio.addTrack(`Faixa ${i}`);
          window._tracks.push(t);
        }
        window.BeatboxStudio.renderStudioViews();

        const armBtns = document.querySelectorAll('.btn-rec-arm');
        if (armBtns.length !== 4) return { error: `Expected 4 arm buttons, got ${armBtns.length}` };

        // Arm tracks 0, 1, and 3 (leaving track 2 unarmed)
        armBtns[0].click();
        armBtns[1].click();
        armBtns[3].click();

        const domArmed = Array.from(armBtns).map(btn => ({
          id: btn.getAttribute('data-id'),
          hasArmedClass: btn.classList.contains('armed'),
          hasActiveClass: btn.classList.contains('active')
        }));

        const stateArmed = window._tracks.map(t => ({
          id: t.id,
          name: t.name,
          armed: !!t.armed
        }));

        return {
          domArmed,
          stateArmed
        };
      });

      assert.ifError(result.error);
      // State verification
      assert.equal(result.stateArmed[0].armed, true, 'Track 1 must be armed in state');
      assert.equal(result.stateArmed[1].armed, true, 'Track 2 must be armed in state');
      assert.equal(result.stateArmed[2].armed, false, 'Track 3 must remain unarmed in state');
      assert.equal(result.stateArmed[3].armed, true, 'Track 4 must be armed in state');

      // DOM verification
      assert.equal(result.domArmed[0].hasArmedClass && result.domArmed[0].hasActiveClass, true, 'DOM button 1 must have armed active classes');
      assert.equal(result.domArmed[1].hasArmedClass && result.domArmed[1].hasActiveClass, true, 'DOM button 2 must have armed active classes');
      assert.equal(result.domArmed[2].hasArmedClass || result.domArmed[2].hasActiveClass, false, 'DOM button 3 must NOT have armed/active classes');
      assert.equal(result.domArmed[3].hasArmedClass && result.domArmed[3].hasActiveClass, true, 'DOM button 4 must have armed active classes');
    });

    it('Stress 1.2: Rapid 50-Cycle Arm/Disarm Jitter — state and DOM must remain strictly synchronized', async () => {
      const result = await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Jitter Track');
        window.BeatboxStudio.renderStudioViews();

        const armBtn = document.querySelector(`.btn-rec-arm[data-id="${t.id}"]`);
        if (!armBtn) return { error: 'Arm button not found' };

        // 50 rapid toggle clicks
        for (let i = 0; i < 50; i++) {
          armBtn.click();
        }

        const stateAfter50 = t.armed;
        const domAfter50 = armBtn.classList.contains('armed');

        // 51st click (odd)
        armBtn.click();
        const stateAfter51 = t.armed;
        const domAfter51 = armBtn.classList.contains('armed') && armBtn.classList.contains('active');

        return {
          stateAfter50,
          domAfter50,
          stateAfter51,
          domAfter51
        };
      });

      assert.ifError(result.error);
      assert.equal(result.stateAfter50, false, 'After 50 clicks (even), track.armed must be false');
      assert.equal(result.domAfter50, false, 'After 50 clicks (even), DOM arm button must not be armed');
      assert.equal(result.stateAfter51, true, 'After 51 clicks (odd), track.armed must be true');
      assert.equal(result.domAfter51, true, 'After 51 clicks (odd), DOM arm button must have .armed.active');
    });

    it('Stress 1.3: Timeline Viewport Immobility & View Integrity During Arming', async () => {
      const result = await session.evaluate(() => {
        const t1 = window.BeatboxStudio.addTrack('Faixa A');
        const t2 = window.BeatboxStudio.addTrack('Faixa B');
        window.BeatboxStudio.renderStudioViews();

        const timelineWorkspace = document.getElementById('timelineWorkspace');
        const recordWorkspace = document.getElementById('recordWorkspace');

        const initialViewTimeline = timelineWorkspace?.style.display !== 'none';
        const initialViewRecord = recordWorkspace?.style.display !== 'none';

        const armBtns = document.querySelectorAll('.btn-rec-arm');
        armBtns[0].click();
        armBtns[1].click();

        const afterViewTimeline = timelineWorkspace?.style.display !== 'none';
        const afterViewRecord = recordWorkspace?.style.display !== 'none';

        return {
          initialViewTimeline,
          initialViewRecord,
          afterViewTimeline,
          afterViewRecord,
          t1Armed: t1.armed,
          t2Armed: t2.armed
        };
      });

      assert.equal(result.initialViewTimeline, true, 'Timeline workspace must initially be visible');
      assert.equal(result.afterViewTimeline, true, 'Timeline workspace must REMAIN visible after arming');
      assert.equal(result.afterViewRecord, false, 'Record workspace must NOT be triggered by Arm button');
      assert.equal(result.t1Armed && result.t2Armed, true, 'Both tracks must be armed in memory');
    });

    it('Stress 1.4: Track Deletion & Re-Indexing with Armed Tracks', async () => {
      const result = await session.evaluate(() => {
        const t1 = window.BeatboxStudio.addTrack('T1');
        const t2 = window.BeatboxStudio.addTrack('T2');
        const t3 = window.BeatboxStudio.addTrack('T3');
        window.BeatboxStudio.renderStudioViews();

        const armBtns = document.querySelectorAll('.btn-rec-arm');
        armBtns[1].click(); // Arm T2
        armBtns[2].click(); // Arm T3

        // Delete T2 (middle armed track)
        window.BeatboxStudio.removeTrack(t2.id);
        window.BeatboxStudio.renderStudioViews();

        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        const remainingArmBtns = document.querySelectorAll('.btn-rec-arm');

        return {
          rowCount: rows.length,
          t1Armed: t1.armed,
          t3Armed: t3.armed,
          btn0Armed: remainingArmBtns[0]?.classList.contains('armed'),
          btn1Armed: remainingArmBtns[1]?.classList.contains('armed'),
          trackNumbers: rows.map(r => r.querySelector('.tcp-track-number')?.textContent?.trim())
        };
      });

      assert.equal(result.rowCount, 2, 'Project must contain 2 tracks after deletion');
      assert.equal(result.t1Armed, false, 'Track 1 must remain unarmed');
      assert.equal(result.t3Armed, true, 'Track 3 must retain armed status');
      assert.equal(result.btn0Armed, false, 'Row 1 button must not be armed');
      assert.equal(result.btn1Armed, true, 'Row 2 button must remain armed');
      assert.deepEqual(result.trackNumbers, ['01', '02'], 'Track numbers must re-index smoothly to 01 and 02');
    });

    it('Stress 1.5: Arming Under 200% Zoom and Scrolled Viewport', async () => {
      const result = await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Zoom Arm Track');
        window.BeatboxStudio.renderStudioViews();

        const dawMain = document.getElementById('reaperDawMain');
        if (dawMain) dawMain.style.width = '200%';

        const scrollEl = document.getElementById('reaperDawScroll');
        if (scrollEl) scrollEl.scrollLeft = 200;

        const scrollBefore = scrollEl ? scrollEl.scrollLeft : 0;
        const armBtn = document.querySelector('.btn-rec-arm');
        armBtn.click();
        const scrollAfter = scrollEl ? scrollEl.scrollLeft : 0;

        return {
          scrollBefore,
          scrollAfter,
          isArmed: t.armed,
          btnArmed: armBtn.classList.contains('armed')
        };
      });

      assert.equal(result.isArmed, true, 'Track must be armed');
      assert.equal(result.btnArmed, true, 'Arm button must have .armed class');
      assert.equal(result.scrollAfter, result.scrollBefore, 'Arm button click must not alter horizontal scrollLeft');
    });
  });

  // =========================================================================
  // Challenge 2: Master Record Triggers & Priority Cascade (Feature 15)
  // =========================================================================
  describe('Challenge 2: Master Record Triggers & Priority Cascade', () => {

    it('Stress 2.1: Priority Cascade Tier A — explicit armed track takes highest priority', async () => {
      const result = await session.evaluate(() => {
        const t1 = window.BeatboxStudio.addTrack('Track 1');
        const t2 = window.BeatboxStudio.addTrack('Track 2 Armed');
        const t3 = window.BeatboxStudio.addTrack('Track 3');
        window.BeatboxStudio.renderStudioViews();

        // Select Track 1, but arm Track 2
        window.BeatboxStudio.selectTrack(t1.id);
        const armBtn2 = document.querySelector(`.btn-rec-arm[data-id="${t2.id}"]`);
        armBtn2.click();

        // Trigger master record
        window.BeatboxStudio.triggerMasterRecord();

        const viewMode = document.getElementById('recordWorkspace')?.style.display !== 'none' ? 'record' : 'other';
        const recTrackSelect = document.getElementById('recTrackSelect');
        const selectedOptionVal = recTrackSelect ? recTrackSelect.value : null;

        return {
          viewMode,
          targetTrackId: t2.id,
          selectedOptionVal,
          t2Armed: t2.armed
        };
      });

      assert.equal(result.viewMode, 'record', 'Master record trigger must open record workspace');
      assert.equal(result.selectedOptionVal, result.targetTrackId, 'Master record must route to explicitly armed Track 2');
      assert.equal(result.t2Armed, true, 'Track 2 must remain armed');
    });

    it('Stress 2.2: Priority Cascade Tier B — auto-arms selected track when no track is armed', async () => {
      const result = await session.evaluate(() => {
        const t1 = window.BeatboxStudio.addTrack('Track 1');
        const t2 = window.BeatboxStudio.addTrack('Track 2 Selected');
        const t3 = window.BeatboxStudio.addTrack('Track 3');
        window.BeatboxStudio.renderStudioViews();

        // None armed, but Track 2 selected
        window.BeatboxStudio.selectTrack(t2.id);

        window.BeatboxStudio.triggerMasterRecord();

        const viewMode = document.getElementById('recordWorkspace')?.style.display !== 'none' ? 'record' : 'other';
        const recTrackSelect = document.getElementById('recTrackSelect');
        const selectedOptionVal = recTrackSelect ? recTrackSelect.value : null;

        return {
          viewMode,
          targetTrackId: t2.id,
          selectedOptionVal,
          t2Armed: t2.armed
        };
      });

      assert.equal(result.viewMode, 'record', 'Must transition to record view');
      assert.equal(result.t2Armed, true, 'Selected track must be automatically armed');
      assert.equal(result.selectedOptionVal, result.targetTrackId, 'Recording target must be the selected track');
    });

    it('Stress 2.3: Priority Cascade Tier C — auto-arms Track 1 when no track is armed or selected', async () => {
      const result = await session.evaluate(() => {
        const t1 = window.BeatboxStudio.addTrack('Track 1');
        const t2 = window.BeatboxStudio.addTrack('Track 2');
        window.BeatboxStudio.renderStudioViews();

        // Clear selection and arm states
        window.BeatboxStudio.selectTrack(null);
        t1.armed = false;
        t2.armed = false;

        window.BeatboxStudio.triggerMasterRecord();

        const recTrackSelect = document.getElementById('recTrackSelect');
        const selectedOptionVal = recTrackSelect ? recTrackSelect.value : null;

        return {
          t1Armed: t1.armed,
          t1Id: t1.id,
          selectedOptionVal
        };
      });

      assert.equal(result.t1Armed, true, 'Track 1 must be auto-armed when no track armed or selected');
      assert.equal(result.selectedOptionVal, result.t1Id, 'Recording target must be Track 1');
    });

    it('Stress 2.4: Priority Cascade Tier D — auto-creates Track 1 on zero-track empty project', async () => {
      const result = await session.evaluate(async () => {
        await window.BeatboxStudio.clearCurrentProjectTracks();
        window.BeatboxStudio.renderStudioViews();

        const countBefore = window.BeatboxStudio.getProjectSummary().totalTracks;

        // Trigger master record on empty project
        window.BeatboxStudio.triggerMasterRecord();

        const countAfter = window.BeatboxStudio.getProjectSummary().totalTracks;
        const viewMode = document.getElementById('recordWorkspace')?.style.display !== 'none' ? 'record' : 'other';

        return {
          countBefore,
          countAfter,
          viewMode
        };
      });

      assert.equal(result.countBefore, 0, 'Project must start with 0 tracks');
      assert.equal(result.countAfter, 1, 'Master record trigger must auto-create 1 track');
      assert.equal(result.viewMode, 'record', 'Workspace must switch to record mode');
    });

    it('Stress 2.5: KeyR Shortcut Verification & Input Typing Immunity', async () => {
      // Step A: Dispatch KeyR globally -> must open record workspace
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Shortcut Track');
        window.BeatboxStudio.renderStudioViews();
        window.BeatboxStudio.switchViewMode('timeline');
      });

      await session.dispatchKey('KeyR', 'r');
      await new Promise(r => setTimeout(r, 60));

      const triggeredGlobal = await session.evaluate(() => {
        return document.getElementById('recordWorkspace')?.style.display !== 'none';
      });
      assert.equal(triggeredGlobal, true, 'Global KeyR must trigger master record');

      // Step B: Return to timeline, focus an input field, type 'r' -> must NOT trigger record
      await session.evaluate(() => {
        window.BeatboxStudio.switchViewMode('timeline');
        const nameInput = document.querySelector('.tcp-name-input');
        if (nameInput) {
          nameInput.focus();
        }
      });

      // Dispatch 'KeyR' while input is focused
      await session.dispatchKey('KeyR', 'r');
      await new Promise(r => setTimeout(r, 60));

      const triggeredWhileTyping = await session.evaluate(() => {
        const inRecordMode = document.getElementById('recordWorkspace')?.style.display !== 'none';
        const inTimelineMode = document.getElementById('timelineWorkspace')?.style.display !== 'none';
        return { inRecordMode, inTimelineMode };
      });

      assert.equal(triggeredWhileTyping.inRecordMode, false, 'KeyR inside input field must NOT switch to record mode');
      assert.equal(triggeredWhileTyping.inTimelineMode, true, 'Timeline mode must remain active');

      // Step C: Ctrl+KeyR and Alt+KeyR modifier immunity
      await session.evaluate(() => {
        document.activeElement?.blur();
        window.BeatboxStudio.switchViewMode('timeline');
      });

      // Modifier 2 = Control
      await session.dispatchKey('KeyR', 'r', 2);
      await new Promise(r => setTimeout(r, 60));

      const triggeredOnCtrl = await session.evaluate(() => {
        return document.getElementById('recordWorkspace')?.style.display !== 'none';
      });
      assert.equal(triggeredOnCtrl, false, 'Ctrl+KeyR must NOT trigger master record');
    });

    it('Stress 2.6: Active Playback Auto-Halt on Master Record Trigger', async () => {
      await setupTrackWithMedia('Playback Halter', 0, 6.0);

      const haltResult = await session.evaluate(() => {
        window.BeatboxStudio.startStudioPlayback();
        const isPlayingBefore = window.BeatboxStudio.getProjectSummary().isPlaying;

        window.BeatboxStudio.triggerMasterRecord();
        const isPlayingAfter = window.BeatboxStudio.getProjectSummary().isPlaying;
        const viewMode = document.getElementById('recordWorkspace')?.style.display !== 'none' ? 'record' : 'other';

        return {
          isPlayingBefore,
          isPlayingAfter,
          viewMode
        };
      });

      assert.equal(haltResult.isPlayingBefore, true, 'Playback must be active prior to trigger');
      assert.equal(haltResult.isPlayingAfter, false, 'Playback must immediately stop on master record trigger');
      assert.equal(haltResult.viewMode, 'record', 'Record workspace must open');
    });

    it('Stress 2.7: Rapid Master Record Idempotency under 10 Back-to-Back Clicks', async () => {
      const result = await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Track Solo');
        window.BeatboxStudio.renderStudioViews();

        const btnRec = document.getElementById('btnStudioRecord');
        if (!btnRec) return { error: '#btnStudioRecord not found' };

        // Click 10 times in tight loop
        for (let i = 0; i < 10; i++) {
          btnRec.click();
        }

        const summary = window.BeatboxStudio.getProjectSummary();
        const viewMode = document.getElementById('recordWorkspace')?.style.display !== 'none' ? 'record' : 'other';

        return {
          totalTracks: summary.totalTracks,
          viewMode
        };
      });

      assert.ifError(result.error);
      assert.equal(result.totalTracks, 1, 'Rapid clicking must not create duplicate tracks');
      assert.equal(result.viewMode, 'record', 'Record workspace must remain open and coherent');
    });
  });

  // =========================================================================
  // Challenge 3: Solo Element Continuity & Audio Routing Fidelity (Feature 16)
  // =========================================================================
  describe('Challenge 3: Solo Element Continuity & Audio Routing Fidelity', () => {

    it('Stress 3.1: DOM Non-Destructive Invariant — elements survive solo toggles without re-creation', async () => {
      await setupTrackWithMedia('Surdo 1', 0, 4.0);
      await setupTrackWithMedia('Surdo 2', 0, 4.0);
      await setupTrackWithMedia('Surdo 3', 0, 4.0);

      const result = await session.evaluate(() => {
        const rowsBefore = Array.from(document.querySelectorAll('.reaper-track-row'));
        const mediaItemsBefore = Array.from(document.querySelectorAll('.reaper-media-item'));

        // Attach random sentinel properties directly to DOM elements
        rowsBefore.forEach((row, i) => { row._sentinelTestMarker = `row-${i}-${Math.random()}`; });
        mediaItemsBefore.forEach((item, i) => { item._sentinelTestMarker = `item-${i}-${Math.random()}`; });

        const tracks = window._testTracks ? Object.values(window._testTracks) : [];

        // Toggle Solo on Track 1
        window.BeatboxStudio.toggleTrackSolo(tracks[0].id);
        // Toggle Solo on Track 2
        window.BeatboxStudio.toggleTrackSolo(tracks[1].id);
        // Untoggle Solo on Track 1
        window.BeatboxStudio.toggleTrackSolo(tracks[0].id);
        // Untoggle Solo on Track 2
        window.BeatboxStudio.toggleTrackSolo(tracks[1].id);

        const rowsAfter = Array.from(document.querySelectorAll('.reaper-track-row'));
        const mediaItemsAfter = Array.from(document.querySelectorAll('.reaper-media-item'));

        const rowsSurviving = rowsBefore.every((r, idx) => r === rowsAfter[idx] && r._sentinelTestMarker === rowsAfter[idx]._sentinelTestMarker);
        const itemsSurviving = mediaItemsBefore.every((item, idx) => item === mediaItemsAfter[idx] && item._sentinelTestMarker === mediaItemsAfter[idx]._sentinelTestMarker);

        return {
          rowCount: rowsAfter.length,
          itemCount: mediaItemsAfter.length,
          rowsSurviving,
          itemsSurviving
        };
      });

      assert.equal(result.rowCount, 3, 'Must render 3 rows');
      assert.equal(result.itemCount, 3, 'Must render 3 media items');
      assert.equal(result.rowsSurviving, true, 'Track rows must maintain object reference identity (not recreated)');
      assert.equal(result.itemsSurviving, true, 'Media items must maintain object reference identity');
    });

    it('Stress 3.2: Multitrack Audio Routing Matrix — effective track volumes under Solo and Mute combinations', async () => {
      const tA = await setupTrackWithMedia('Track A', 0, 6.0);
      const tB = await setupTrackWithMedia('Track B', 0, 6.0);
      const tC = await setupTrackWithMedia('Track C', 0, 6.0);

      const routingMatrix = await session.evaluate((idA, idB, idC) => {
        const tA = window._testTracks[idA];
        const tB = window._testTracks[idB];
        const tC = window._testTracks[idC];

        function getVolumes() {
          return [tA.videoElement.volume, tB.videoElement.volume, tC.videoElement.volume];
        }

        // Case 1: Initial state (all unmuted, no solo)
        const vInitial = getVolumes();

        // Case 2: Solo Track A
        window.BeatboxStudio.toggleTrackSolo(idA);
        const vSoloA = getVolumes();

        // Case 3: Multi-solo Track A + Track B
        window.BeatboxStudio.toggleTrackSolo(idB);
        const vSoloAB = getVolumes();

        // Case 4: Mute Track A while it is Soloed
        tA.muted = true;
        // updateAudioMixRouting via solo toggle on/off or directly
        window.BeatboxStudio.toggleTrackSolo(idA); // un-solo A
        window.BeatboxStudio.toggleTrackSolo(idA); // re-solo A (now solo + muted)
        const vSoloAMuted = getVolumes();

        // Case 5: Untoggle all solos, unmute A
        tA.muted = false;
        window.BeatboxStudio.toggleTrackSolo(idA); // un-solo A
        window.BeatboxStudio.toggleTrackSolo(idB); // un-solo B
        const vRestored = getVolumes();

        return {
          vInitial,
          vSoloA,
          vSoloAB,
          vSoloAMuted,
          vRestored
        };
      }, tA.id, tB.id, tC.id);

      // Case 1: Initial all at 1.0
      assert.deepEqual(routingMatrix.vInitial, [1.0, 1.0, 1.0], 'Initial volumes must all be 1.0');

      // Case 2: Solo A -> A=1.0, B=0, C=0
      assert.equal(routingMatrix.vSoloA[0], 1.0, 'Soloed Track A must have volume 1.0');
      assert.equal(routingMatrix.vSoloA[1], 0, 'Unsoloed Track B must be muted (vol 0)');
      assert.equal(routingMatrix.vSoloA[2], 0, 'Unsoloed Track C must be muted (vol 0)');

      // Case 3: Solo A + B -> A=1.0, B=1.0, C=0
      assert.equal(routingMatrix.vSoloAB[0], 1.0, 'Soloed Track A must have volume 1.0');
      assert.equal(routingMatrix.vSoloAB[1], 1.0, 'Soloed Track B must have volume 1.0');
      assert.equal(routingMatrix.vSoloAB[2], 0, 'Unsoloed Track C must be muted (vol 0)');

      // Case 4: Muted Track A while soloed -> A=0
      assert.equal(routingMatrix.vSoloAMuted[0], 0, 'Muted Track A must have volume 0 even when soloed');

      // Case 5: Restored all un-soloed
      assert.deepEqual(routingMatrix.vRestored, [1.0, 1.0, 1.0], 'Restored volumes must return to 1.0');
    });

    it('Stress 3.3: Solo Toggle During Active Multitrack Playback — zero interruption or reset', async () => {
      await setupTrackWithMedia('Lead Vocal', 0, 8.0);
      await setupTrackWithMedia('Backing Vocal', 0, 8.0);

      const playbackSoloResult = await session.evaluate(async () => {
        window.BeatboxStudio.startStudioPlayback();
        const tracks = Object.values(window._testTracks);

        const playingBefore = window.BeatboxStudio.getProjectSummary().isPlaying;

        // Toggle solo on track 0 while playback timer is actively running
        window.BeatboxStudio.toggleTrackSolo(tracks[0].id);

        // Wait 100ms
        await new Promise(r => setTimeout(r, 100));

        const playingDuring = window.BeatboxStudio.getProjectSummary().isPlaying;
        const playheadDuring = window.BeatboxStudio.getProjectSummary().playheadPosSec;

        // Toggle solo off
        window.BeatboxStudio.toggleTrackSolo(tracks[0].id);
        const playingAfter = window.BeatboxStudio.getProjectSummary().isPlaying;

        window.BeatboxStudio.stopStudioPlayback();

        return {
          playingBefore,
          playingDuring,
          playheadDuring,
          playingAfter
        };
      });

      assert.equal(playbackSoloResult.playingBefore, true, 'Playback must start');
      assert.equal(playbackSoloResult.playingDuring, true, 'Playback must remain active during solo toggle');
      assert.ok(playbackSoloResult.playheadDuring > 0.05, 'Playhead must continue progressing forward');
      assert.equal(playbackSoloResult.playingAfter, true, 'Playback must remain active after solo untoggle');
    });

    it('Stress 3.4: Rapid 50-Cycle Solo Jitter Stress — class integrity and state coherence', async () => {
      const tA = await setupTrackWithMedia('Jitter A', 0, 4.0);
      const tB = await setupTrackWithMedia('Jitter B', 0, 4.0);

      const result = await session.evaluate((idA, idB) => {
        const tA = window._testTracks[idA];
        const tB = window._testTracks[idB];
        const rowA = document.getElementById(`reaper_row_${idA}`);
        const rowB = document.getElementById(`reaper_row_${idB}`);
        const soloBtnA = rowA.querySelector('.tcp-btn-solo');
        const soloBtnB = rowB.querySelector('.tcp-btn-solo');

        for (let i = 0; i < 50; i++) {
          if (i % 2 === 0) soloBtnA.click();
          else soloBtnB.click();
        }

        // 50 iterations: 25 clicks on A (odd -> solo true), 25 clicks on B (odd -> solo true)
        return {
          tASolo: tA.solo,
          tBSolo: tB.solo,
          btnAActive: soloBtnA.classList.contains('active'),
          btnBActive: soloBtnB.classList.contains('active'),
          rowASoloed: rowA.classList.contains('is-soloed'),
          rowBSoloed: rowB.classList.contains('is-soloed')
        };
      }, tA.id, tB.id);

      assert.equal(result.tASolo, true, 'Track A solo must be true after 25 clicks');
      assert.equal(result.tBSolo, true, 'Track B solo must be true after 25 clicks');
      assert.equal(result.btnAActive, true, 'Button A must be active');
      assert.equal(result.btnBActive, true, 'Button B must be active');
      assert.equal(result.rowASoloed, true, 'Row A must be is-soloed');
      assert.equal(result.rowBSoloed, true, 'Row B must be is-soloed');
    });
  });

  // =========================================================================
  // Challenge 4: Transport Pause/Resume Monotonicity (Feature 17)
  // =========================================================================
  describe('Challenge 4: Transport Pause/Resume Monotonicity', () => {

    it('Stress 4.1: Continuous Forward Playback Monotonicity across high-rate samples', async () => {
      await setupTrackWithMedia('Monotonic Track', 0, 10.0);

      const samples = await session.evaluate(async () => {
        window.BeatboxStudio.startStudioPlayback();
        const collected = [];

        for (let i = 0; i < 8; i++) {
          await new Promise(r => setTimeout(r, 35));
          collected.push(window.BeatboxStudio.getProjectSummary().playheadPosSec);
        }

        window.BeatboxStudio.stopStudioPlayback();
        return collected;
      });

      assert.equal(samples.length, 8, 'Must collect 8 samples');
      for (let i = 1; i < samples.length; i++) {
        assert.ok(
          samples[i] >= samples[i - 1],
          `Sample ${i} (${samples[i]}s) must be >= Sample ${i - 1} (${samples[i - 1]}s)`
        );
      }
      assert.ok(samples[7] > samples[0] + 0.15, 'Playhead must advance continuously');
    });

    it('Stress 4.2: Pause State Machine & Position Retention — does not rewind to 0', async () => {
      await setupTrackWithMedia('Pause Retention Track', 0, 10.0);

      const pauseResult = await session.evaluate(async () => {
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 120));

        // Call pause
        window.BeatboxStudio.pauseStudioPlayback();
        const summaryAtPause = window.BeatboxStudio.getProjectSummary();

        const playheadEl = document.getElementById('reaperPlayhead');
        const domLeftAtPause = playheadEl ? playheadEl.style.left : '0%';

        // Wait another 80ms while paused — ensure it does not move or drift
        await new Promise(r => setTimeout(r, 80));
        const summaryAfterWait = window.BeatboxStudio.getProjectSummary();

        const track = Object.values(window._testTracks)[0];
        const mediaPaused = track.videoElement.paused;
        const mediaCurrentTime = track.videoElement.currentTime;

        return {
          isPlaying: summaryAtPause.isPlaying,
          isPaused: summaryAtPause.isPaused,
          posAtPause: summaryAtPause.playheadPosSec,
          posAfterWait: summaryAfterWait.playheadPosSec,
          domLeftAtPause,
          mediaPaused,
          mediaCurrentTime
        };
      });

      assert.equal(pauseResult.isPlaying, false, 'isPlaying must be false when paused');
      assert.equal(pauseResult.isPaused, true, 'isPaused must be true');
      assert.ok(pauseResult.posAtPause > 0.05, `Playhead position must be > 0.05s (was ${pauseResult.posAtPause})`);
      assert.equal(pauseResult.posAfterWait, pauseResult.posAtPause, 'Playhead must freeze during pause');
      assert.ok(parseFloat(pauseResult.domLeftAtPause) > 0.5, 'Playhead DOM style.left must be > 0.5%');
      assert.equal(pauseResult.mediaPaused, true, 'Media element must be paused');
    });

    it('Stress 4.3: Resume From Pause Monotonicity & No Snapback', async () => {
      await setupTrackWithMedia('Resume Monotonicity Track', 0, 10.0);

      const resumeSamples = await session.evaluate(async () => {
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 100));

        window.BeatboxStudio.pauseStudioPlayback();
        const pausePos = window.BeatboxStudio.getProjectSummary().playheadPosSec;

        // Resume playback
        window.BeatboxStudio.startStudioPlayback();

        const ticks = [];
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 35));
          ticks.push(window.BeatboxStudio.getProjectSummary().playheadPosSec);
        }

        window.BeatboxStudio.stopStudioPlayback();

        return {
          pausePos,
          ticks
        };
      });

      assert.ok(resumeSamples.pausePos > 0.05, 'Pause position must be non-zero');
      assert.ok(
        resumeSamples.ticks[0] >= resumeSamples.pausePos,
        `Tick 0 (${resumeSamples.ticks[0]}s) must be >= pause position (${resumeSamples.pausePos}s) — no snapback!`
      );
      for (let i = 1; i < resumeSamples.ticks.length; i++) {
        assert.ok(
          resumeSamples.ticks[i] >= resumeSamples.ticks[i - 1],
          `Resume Tick ${i} (${resumeSamples.ticks[i]}s) must be >= Tick ${i - 1} (${resumeSamples.ticks[i - 1]}s)`
        );
      }
    });

    it('Stress 4.4: Stop vs Pause Strict Architectural Contract', async () => {
      await setupTrackWithMedia('Contract Track', 0, 8.0);

      const contractResult = await session.evaluate(async () => {
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 100));

        // Test Pause
        window.BeatboxStudio.pauseStudioPlayback();
        const pauseSummary = window.BeatboxStudio.getProjectSummary();
        const pausePlayheadLeft = document.getElementById('reaperPlayhead')?.style.left;

        // Test Stop
        window.BeatboxStudio.stopStudioPlayback();
        const stopSummary = window.BeatboxStudio.getProjectSummary();
        const stopPlayheadLeft = document.getElementById('reaperPlayhead')?.style.left;

        const track = Object.values(window._testTracks)[0];
        const stopMediaCurrentTime = track.videoElement ? track.videoElement.currentTime : 0;

        return {
          pausePos: pauseSummary.playheadPosSec,
          pauseIsPaused: pauseSummary.isPaused,
          pausePlayheadLeft,
          stopPos: stopSummary.playheadPosSec,
          stopIsPaused: stopSummary.isPaused,
          stopPlayheadLeft,
          stopMediaCurrentTime
        };
      });

      // Pause invariant
      assert.ok(contractResult.pausePos > 0.05, 'Pause must retain positive playhead position');
      assert.equal(contractResult.pauseIsPaused, true, 'Pause must set isPaused = true');
      assert.ok(parseFloat(contractResult.pausePlayheadLeft) > 0, 'Playhead cursor must remain at paused position');

      // Stop invariant
      assert.equal(contractResult.stopPos, 0, 'Stop must strictly reset playheadPosSec to 0');
      assert.equal(contractResult.stopIsPaused, false, 'Stop must set isPaused = false');
      assert.equal(contractResult.stopPlayheadLeft, '0%', 'Stop must strictly reset cursor to 0%');
      assert.equal(contractResult.stopMediaCurrentTime, 0, 'Stop must rewind media element currentTime to 0');
    });

    it('Stress 4.5: 20-Cycle High-Frequency Play/Pause Jitter Stress', async () => {
      await setupTrackWithMedia('Jitter Transport', 0, 10.0);

      const result = await session.evaluate(async () => {
        const btnPlay = document.getElementById('btnStudioPlay');
        if (!btnPlay) return { error: '#btnStudioPlay not found' };

        for (let i = 0; i < 20; i++) {
          btnPlay.click();
          await new Promise(r => setTimeout(r, 15));
        }

        const summary = window.BeatboxStudio.getProjectSummary();
        window.BeatboxStudio.stopStudioPlayback();

        return {
          playheadPosSec: summary.playheadPosSec,
          isPaused: summary.isPaused,
          isPlaying: summary.isPlaying
        };
      });

      assert.ifError(result.error);
      assert.ok(!isNaN(result.playheadPosSec), 'Playhead position must be a valid number (not NaN)');
      assert.ok(result.playheadPosSec >= 0, 'Playhead position must be non-negative');
    });
  });

  // =========================================================================
  // Challenge 5: Ruler Seek Clock Synchronization (Feature 18)
  // =========================================================================
  describe('Challenge 5: Ruler Seek Clock Synchronization', () => {

    it('Stress 5.1: Seek During Active Playback — zero snapback verification', async () => {
      await setupTrackWithMedia('Seek Track', 0, 10.0);

      const seekResult = await session.evaluate(async () => {
        window.BeatboxStudio.startStudioPlayback();
        // Play for 80ms (around 0.08s)
        await new Promise(r => setTimeout(r, 80));

        // Click ruler at 40% (4.0 seconds)
        const ruler = document.getElementById('reaperRulerTrack');
        const rect = ruler.getBoundingClientRect();
        const clickX = rect.left + rect.width * 0.40;
        const clickY = rect.top + rect.height * 0.5;

        ruler.dispatchEvent(new MouseEvent('click', {
          clientX: clickX,
          clientY: clickY,
          bubbles: true
        }));

        const posImmediatelyAfterSeek = window.BeatboxStudio.getProjectSummary().playheadPosSec;

        // Sample next 5 ticks (spaced 30ms apart)
        const postSeekTicks = [];
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 30));
          postSeekTicks.push(window.BeatboxStudio.getProjectSummary().playheadPosSec);
        }

        window.BeatboxStudio.stopStudioPlayback();

        return {
          posImmediatelyAfterSeek,
          postSeekTicks
        };
      });

      assert.ok(
        seekResult.posImmediatelyAfterSeek >= 3.8 && seekResult.posImmediatelyAfterSeek <= 4.2,
        `Immediately after seek to 40%, playhead must be ~4.0s (was ${seekResult.posImmediatelyAfterSeek}s)`
      );

      // Verify ZERO snapback on any of the ticks
      seekResult.postSeekTicks.forEach((tick, idx) => {
        assert.ok(
          tick >= 3.8,
          `Tick ${idx} (${tick}s) must NOT snap back to start time (< 3.8s)`
        );
        assert.ok(
          tick <= 4.8,
          `Tick ${idx} (${tick}s) must not jump unexpectedly into future (> 4.8s)`
        );
      });
    });

    it('Stress 5.2: Boundary Clamping on Ruler Seeks', async () => {
      await setupTrackWithMedia('Clamping Track', 0, 8.0);

      const clampingResult = await session.evaluate(() => {
        const ruler = document.getElementById('reaperRulerTrack');
        const rect = ruler.getBoundingClientRect();

        // 1. Extreme left click (negative X)
        ruler.dispatchEvent(new MouseEvent('click', {
          clientX: rect.left - 200,
          clientY: rect.top,
          bubbles: true
        }));
        const posNegative = window.BeatboxStudio.getProjectSummary().playheadPosSec;
        const leftNegative = document.getElementById('reaperPlayhead')?.style.left;

        // 2. Extreme right click (beyond right edge)
        ruler.dispatchEvent(new MouseEvent('click', {
          clientX: rect.left + rect.width + 300,
          clientY: rect.top,
          bubbles: true
        }));
        const posExcess = window.BeatboxStudio.getProjectSummary().playheadPosSec;
        const leftExcess = document.getElementById('reaperPlayhead')?.style.left;

        return {
          posNegative,
          leftNegative,
          posExcess,
          leftExcess
        };
      });

      assert.equal(clampingResult.posNegative, 0, 'Negative seek must clamp strictly at 0s');
      assert.equal(clampingResult.leftNegative, '0%', 'Playhead left must clamp at 0%');
      assert.ok(clampingResult.posExcess >= 7.9, 'Seek past end must clamp to project duration');
      assert.equal(clampingResult.leftExcess, '100%', 'Playhead left must clamp at 100%');
    });

    it('Stress 5.3: Seek While Paused and Subsequent Resume Monotonicity', async () => {
      await setupTrackWithMedia('Seek Paused Track', 0, 10.0);

      const result = await session.evaluate(async () => {
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 60));

        // Pause
        window.BeatboxStudio.pauseStudioPlayback();

        // Seek to 50% (5.0s) while paused
        const ruler = document.getElementById('reaperRulerTrack');
        const rect = ruler.getBoundingClientRect();
        ruler.dispatchEvent(new MouseEvent('click', {
          clientX: rect.left + rect.width * 0.5,
          clientY: rect.top + rect.height * 0.5,
          bubbles: true
        }));

        const pausedSummary = window.BeatboxStudio.getProjectSummary();
        const pausedPlayheadLeft = document.getElementById('reaperPlayhead')?.style.left;

        // Resume
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 50));
        const resumeTick1 = window.BeatboxStudio.getProjectSummary().playheadPosSec;

        await new Promise(r => setTimeout(r, 50));
        const resumeTick2 = window.BeatboxStudio.getProjectSummary().playheadPosSec;

        window.BeatboxStudio.stopStudioPlayback();

        return {
          pausedPos: pausedSummary.playheadPosSec,
          pausedIsPaused: pausedSummary.isPaused,
          pausedPlayheadLeft,
          resumeTick1,
          resumeTick2
        };
      });

      assert.ok(result.pausedPos >= 4.8 && result.pausedPos <= 5.2, 'Paused seek must set position to ~5.0s');
      assert.equal(result.pausedIsPaused, true, 'isPaused must remain true');
      assert.ok(result.resumeTick1 >= result.pausedPos, 'Resume must advance from sought position (no reset)');
      assert.ok(result.resumeTick2 >= result.resumeTick1, 'Resume must advance monotonically');
    });

    it('Stress 5.4: 25-Cycle High-Frequency Seek Blitz During Active Playback', async () => {
      await setupTrackWithMedia('Blitz Track', 0, 10.0);

      const blitzResult = await session.evaluate(async () => {
        window.BeatboxStudio.startStudioPlayback();
        const ruler = document.getElementById('reaperRulerTrack');
        const rect = ruler.getBoundingClientRect();

        // 25 rapid random seeks
        for (let i = 0; i < 25; i++) {
          const randPct = 0.05 + Math.random() * 0.90;
          ruler.dispatchEvent(new MouseEvent('click', {
            clientX: rect.left + rect.width * randPct,
            clientY: rect.top + rect.height * 0.5,
            bubbles: true
          }));
          await new Promise(r => setTimeout(r, 10));
        }

        const summaryAfterBlitz = window.BeatboxStudio.getProjectSummary();
        const isStillPlaying = summaryAfterBlitz.isPlaying;
        const currentPos = summaryAfterBlitz.playheadPosSec;

        window.BeatboxStudio.stopStudioPlayback();

        return {
          isStillPlaying,
          currentPos
        };
      });

      assert.equal(blitzResult.isStillPlaying, true, 'Playback engine must survive 25 rapid seeks without crash');
      assert.ok(blitzResult.currentPos >= 0 && blitzResult.currentPos <= 10.0, 'Playhead must remain within valid timeline bounds');
    });
  });

  // =========================================================================
  // Challenge 6: Studio Options & Extreme Scaling Integration (Feature 19)
  // =========================================================================
  describe('Challenge 6: Studio Options & Extreme Scaling Integration', () => {

    it('Stress 6.1: Dead Button Elimination in Studio Settings Popover', async () => {
      const deadButtons = await session.evaluate(() => {
        const popover = document.getElementById('studioSettingsPopover');
        if (!popover) return { error: 'Popover not found' };

        // Query for abandoned buttons #btnTimelineLoop and #btnTimelineAddTrack inside popover
        const abandonedLoop = popover.querySelector('#btnTimelineLoop');
        const abandonedAddTrack = popover.querySelector('#btnTimelineAddTrack');

        return {
          hasAbandonedLoop: !!abandonedLoop,
          hasAbandonedAddTrack: !!abandonedAddTrack
        };
      });

      assert.ifError(deadButtons.error);
      assert.equal(deadButtons.hasAbandonedLoop, false, 'Abandoned #btnTimelineLoop must be removed from studioSettingsPopover');
      assert.equal(deadButtons.hasAbandonedAddTrack, false, 'Abandoned #btnTimelineAddTrack must be removed from studioSettingsPopover');
    });

    it('Stress 6.2: 16-Track Concurrent Multi-Arm and Multi-Solo Scalability', async () => {
      const scaleResult = await session.evaluate(async () => {
        const trackIds = [];
        for (let i = 1; i <= 16; i++) {
          const t = window.BeatboxStudio.addTrack(`Scale Faixa ${i}`);
          trackIds.push(t.id);
        }
        window.BeatboxStudio.renderStudioViews();

        const armBtns = document.querySelectorAll('.btn-rec-arm');
        const soloBtns = document.querySelectorAll('.tcp-btn-solo');

        // Arm odd tracks (1, 3, 5, 7, 9, 11, 13, 15)
        for (let i = 0; i < 16; i += 2) {
          armBtns[i].click();
        }

        // Solo first 4 tracks
        for (let i = 0; i < 4; i++) {
          soloBtns[i].click();
        }

        const armedCount = document.querySelectorAll('.btn-rec-arm.armed').length;
        const soloCount = document.querySelectorAll('.tcp-btn-solo.active').length;
        const totalRows = document.querySelectorAll('.reaper-track-row').length;

        // Perform transport operations on 16 tracks
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 60));
        window.BeatboxStudio.pauseStudioPlayback();
        const isPaused = window.BeatboxStudio.getProjectSummary().isPaused;
        window.BeatboxStudio.stopStudioPlayback();

        return {
          totalRows,
          armedCount,
          soloCount,
          isPaused
        };
      });

      assert.equal(scaleResult.totalRows, 16, 'Studio must render 16 rows');
      assert.equal(scaleResult.armedCount, 8, '8 odd tracks must be armed');
      assert.equal(scaleResult.soloCount, 4, '4 tracks must be soloed');
      assert.equal(scaleResult.isPaused, true, 'Transport must pause smoothly across 16 tracks');
    });
  });
});
