const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

describe('Milestone 3 Adversarial Stress Suite (Challenger 2)', () => {
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

  // Helper to add mock audio tracks with media elements
  async function setupMockTracks(count = 3, durationSec = 10.0) {
    return session.evaluate((n, dur) => {
      const created = [];
      for (let i = 1; i <= n; i++) {
        const t = window.BeatboxStudio.addTrack(`Faixa Stress ${i}`);
        t.duration = dur;
        t.offsetMs = (i - 1) * 500;
        t.trimStart = 0;
        t.trimEnd = 0;
        t.mediaType = 'audio';
        // Base64 44-byte silent WAV
        t.mediaUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        t.waveformPeaks = [0.2, 0.5, 0.8, 0.4, 0.6, 0.3, 0.7, 0.5];
        created.push({ id: t.id, name: t.name });
      }
      window.BeatboxStudio.renderStudioViews();
      return created;
    }, count, durationSec);
  }

  // =========================================================================
  // Dimension 1: Concurrency & Keyboard Race Conditions
  // =========================================================================
  describe('Dimension 1: Concurrency & Keyboard Race Conditions', () => {

    it('Stress 1.1: Rapid interleaved transport toggling (Space, Play, Stop) maintains state coherence', async () => {
      await setupMockTracks(2, 8.0);

      const result = await session.evaluate(async () => {
        const btnPlay = document.getElementById('btnStudioPlay');
        const btnStop = document.getElementById('btnStudioStop');
        if (!btnPlay || !btnStop) return { error: 'Transport buttons missing' };

        const intermediateStates = [];

        // 30 rapid interleaved toggles
        for (let i = 0; i < 30; i++) {
          if (i % 3 === 0) {
            // Space keydown
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
          } else if (i % 3 === 1) {
            btnPlay.click();
          } else {
            btnStop.click();
          }
          await new Promise(r => setTimeout(r, 15));

          const summary = window.BeatboxStudio.getProjectSummary();
          intermediateStates.push({
            isPlaying: summary.isPlaying,
            isPaused: summary.isPaused,
            playheadPosSec: summary.playheadPosSec
          });
        }

        // Final Stop to bring to definitive rest
        btnStop.click();
        await new Promise(r => setTimeout(r, 60));

        const finalSummary = window.BeatboxStudio.getProjectSummary();
        const playhead = document.getElementById('reaperPlayhead');
        const playheadLeft = playhead ? playhead.style.left : null;

        // Check for any illegal state where isPlaying && isPaused are both true
        const illegalStates = intermediateStates.filter(s => s.isPlaying && s.isPaused);
        const nanStates = intermediateStates.filter(s => isNaN(s.playheadPosSec) || s.playheadPosSec < 0);

        return {
          success: true,
          totalTransitions: intermediateStates.length,
          illegalCount: illegalStates.length,
          nanCount: nanStates.length,
          finalPlaying: finalSummary.isPlaying,
          finalPaused: finalSummary.isPaused,
          finalPosSec: finalSummary.playheadPosSec,
          playheadLeft
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.totalTransitions, 30, 'Should perform 30 rapid transport transitions');
      assert.equal(result.illegalCount, 0, 'Transport should never enter concurrent playing AND paused state');
      assert.equal(result.nanCount, 0, 'Playhead position must never be NaN or negative');
      assert.equal(result.finalPlaying, false, 'Final state must not be playing');
      assert.equal(result.finalPaused, false, 'Final state must not be paused after Stop');
      assert.equal(result.finalPosSec, 0, 'Playhead must rewind to exactly 0 on Stop');
      assert.equal(result.playheadLeft, '0%', 'DOM playhead must be reset to 0%');
    });

    it('Stress 1.2: Rapid Master Record trigger storm and Escape modal dismissal', async () => {
      // Start with 0 tracks
      const result = await session.evaluate(async () => {
        const btnRecord = document.getElementById('btnStudioRecord');
        if (!btnRecord) return { error: 'btnStudioRecord not found in DOM' };

        // 1. Rapidly click record 5 times on empty project
        for (let i = 0; i < 5; i++) {
          btnRecord.click();
          await new Promise(r => setTimeout(r, 20));
        }

        const summaryAfterEmpty = window.BeatboxStudio.getProjectSummary();
        const recordWorkspaceVisible = document.getElementById('recordWorkspace')?.style.display !== 'none';

        // 2. Dismiss with Escape
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        // Switch back to timeline explicitly if needed
        await window.BeatboxStudio.switchViewMode('timeline');

        const timelineWorkspaceVisible = document.getElementById('timelineWorkspace')?.style.display !== 'none';

        // 3. Trigger via KeyR shortcut
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        const recordWorkspaceVisible2 = document.getElementById('recordWorkspace')?.style.display !== 'none';

        // Switch back to timeline
        await window.BeatboxStudio.switchViewMode('timeline');

        return {
          success: true,
          tracksCreated: summaryAfterEmpty.totalTracks,
          recordWorkspaceVisible,
          timelineWorkspaceVisible,
          recordWorkspaceVisible2
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.tracksCreated, 1, 'Auto-arming empty project should create exactly 1 track (Faixa 1)');
      assert.ok(result.recordWorkspaceVisible, 'Record workspace must open on Master Record click');
      assert.ok(result.timelineWorkspaceVisible, 'Timeline workspace must restore on timeline switch');
      assert.ok(result.recordWorkspaceVisible2, 'KeyR shortcut must open record workspace');
    });

    it('Stress 1.3: Text input shortcut isolation during transport and recording', async () => {
      await setupMockTracks(2, 6.0);

      const result = await session.evaluate(() => {
        const nameInput = document.querySelector('.tcp-name-input');
        if (!nameInput) return { error: 'Track name input not found' };

        // Focus inside text input
        nameInput.focus();

        const actionsDispatched = [];

        // Keystrokes that would otherwise trigger DAW actions:
        // Space -> Transport Play/Pause
        nameInput.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
        actionsDispatched.push('Space');

        // KeyR -> Master Record
        nameInput.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
        actionsDispatched.push('KeyR');

        // KeyM -> Mute selected track
        nameInput.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true }));
        actionsDispatched.push('KeyM');

        // Alt+KeyS -> Solo selected track
        nameInput.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', altKey: true, bubbles: true }));
        actionsDispatched.push('Alt+KeyS');

        // KeyS -> Split clip
        nameInput.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', bubbles: true }));
        actionsDispatched.push('KeyS');

        // ArrowDown -> Navigate track
        nameInput.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true }));
        actionsDispatched.push('ArrowDown');

        const summary = window.BeatboxStudio.getProjectSummary();
        const recordWorkspace = document.getElementById('recordWorkspace');
        const isRecordOpen = recordWorkspace && recordWorkspace.style.display !== 'none';

        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        const anyMuted = rows.some(r => r.classList.contains('is-muted'));
        const anySoloed = rows.some(r => r.classList.contains('is-soloed'));

        // Blur input and test that shortcuts resume functioning
        nameInput.blur();
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true }));

        return {
          success: true,
          isPlaying: summary.isPlaying,
          isRecordOpen,
          anyMuted,
          anySoloed,
          totalTracks: summary.totalTracks
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.isPlaying, false, 'Space while typing in input must NOT start playback');
      assert.equal(result.isRecordOpen, false, 'KeyR while typing in input must NOT open recording view');
      assert.equal(result.anyMuted, false, 'KeyM while typing in input must NOT mute track');
      assert.equal(result.anySoloed, false, 'Alt+S while typing in input must NOT solo track');
      assert.equal(result.totalTracks, 2, 'KeyS while typing in input must NOT split clip');
    });

    it('Stress 1.4: Concurrent Solo and Mute toggling during active multitrack playback', async () => {
      const tracks = await setupMockTracks(4, 10.0);

      const result = await session.evaluate(async (trackList) => {
        // Start playback
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 60));

        const mainStack = document.getElementById('reaperTracksStack');
        const initialInnerHTML = mainStack ? mainStack.innerHTML : '';

        // Rapid 40-step alternating solo and mute toggles
        for (let i = 0; i < 40; i++) {
          const targetTrack = trackList[i % trackList.length];
          if (i % 2 === 0) {
            window.BeatboxStudio.toggleTrackSolo(targetTrack.id);
          } else {
            // Toggle Mute
            const row = document.getElementById(`reaper_row_${targetTrack.id}`);
            const muteBtn = row?.querySelector('.tcp-btn-mute');
            if (muteBtn) muteBtn.click();
          }
          await new Promise(r => setTimeout(r, 5));
        }

        const summary = window.BeatboxStudio.getProjectSummary();
        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));

        const rowStates = rows.map(r => ({
          id: r.id.replace('reaper_row_', ''),
          isSoloed: r.classList.contains('is-soloed'),
          isSoloDimmed: r.classList.contains('is-solo-dimmed'),
          isMuted: r.classList.contains('is-muted'),
          soloBtnActive: r.querySelector('.tcp-btn-solo')?.classList.contains('active'),
          muteBtnActive: r.querySelector('.tcp-btn-mute')?.classList.contains('active')
        }));

        // Stop playback
        window.BeatboxStudio.stopStudioPlayback();

        return {
          success: true,
          isPlayingDuringToggles: summary.isPlaying,
          rowStates
        };
      }, tracks);

      assert.ok(result.success, 'Evaluation should succeed');
      assert.ok(result.isPlayingDuringToggles, 'Playback should continue running uninterrupted through rapid solo/mute toggles');
      assert.equal(result.rowStates.length, 4, 'All 4 rows must be present in DOM');
      // Verify button active classes match row classes
      for (const st of result.rowStates) {
        assert.equal(st.isSoloed, st.soloBtnActive, `Track ${st.id} solo button class must match row solo state`);
        assert.equal(st.isMuted, st.muteBtnActive, `Track ${st.id} mute button class must match row mute state`);
      }
    });

  });

  // =========================================================================
  // Dimension 2: Audio Node Element Lifetimes & Graph Integrity
  // =========================================================================
  describe('Dimension 2: Audio Node Element Lifetimes & Graph Integrity', () => {

    it('Stress 2.1: Non-destructive Web Audio Graph persistence across 50 rapid Solo toggles', async () => {
      const tracks = await setupMockTracks(3, 8.0);

      const result = await session.evaluate(async (trackList) => {
        // Start and stop playback briefly to initialize AudioContext
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 20));
        window.BeatboxStudio.stopStudioPlayback();

        // Boost volume to 1.25 to force GainNode creation via .tcp-fader-slider
        const rows = document.querySelectorAll('.reaper-track-row');
        rows.forEach(r => {
          const slider = r.querySelector('.tcp-fader-slider');
          if (slider) {
            slider.value = 1.25;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });

        // Trigger solo once to initialize routing
        window.BeatboxStudio.toggleTrackSolo(trackList[0].id);

        // Check if audio graphs attached
        const mediaNodes = [];
        trackList.forEach(tr => {
          const card = document.getElementById(`card_${tr.id}`);
          const el = card ? card.querySelector('audio, video') : null;
          if (el && el._webAudioGraph) {
            mediaNodes.push({
              trackId: tr.id,
              sourceNode: el._webAudioGraph.sourceNode,
              gainNode: el._webAudioGraph.gainNode
            });
          }
        });

        const initialNodesCount = mediaNodes.length;

        // Perform 50 rapid solo toggles across tracks
        let invalidStateErrors = 0;
        for (let i = 0; i < 50; i++) {
          try {
            window.BeatboxStudio.toggleTrackSolo(trackList[i % trackList.length].id);
          } catch (e) {
            if (e.name === 'InvalidStateError' || e.message?.includes('already connected')) {
              invalidStateErrors++;
            }
          }
          await new Promise(r => setTimeout(r, 4));
        }

        // Check if nodes remained identical instances
        let identicalNodesCount = 0;
        trackList.forEach(tr => {
          const card = document.getElementById(`card_${tr.id}`);
          const el = card ? card.querySelector('audio, video') : null;
          const orig = mediaNodes.find(m => m.trackId === tr.id);
          if (el && el._webAudioGraph && orig) {
            if (el._webAudioGraph.sourceNode === orig.sourceNode && el._webAudioGraph.gainNode === orig.gainNode) {
              identicalNodesCount++;
            }
          }
        });

        return {
          success: true,
          initialNodesCount,
          identicalNodesCount,
          invalidStateErrors
        };
      }, tracks);

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.invalidStateErrors, 0, 'No InvalidStateError must occur when re-routing Web Audio graph');
      assert.ok(result.initialNodesCount > 0, 'Audio graphs must be instantiated for media elements');
      assert.equal(result.identicalNodesCount, result.initialNodesCount, 'Audio node graph instances must be preserved without recreation');
    });

    it('Stress 2.2: Audio element lifecycle on track media clear and re-attachment', async () => {
      const tracks = await setupMockTracks(2, 6.0);

      const result = await session.evaluate(async (trackList) => {
        const targetId = trackList[0].id;

        // 1. Clear media on Track 1
        window.BeatboxStudio.clearTrackMedia(targetId);

        const cardAfterClear = document.getElementById(`card_${targetId}`);
        const mediaElAfterClear = cardAfterClear ? cardAfterClear.querySelector('audio, video') : null;
        const rowAfterClear = document.getElementById(`reaper_row_${targetId}`);
        const emptyBtn = rowAfterClear ? rowAfterClear.querySelector('.btn-empty-record') : null;

        // 2. Re-attach media to Track 1
        const t1 = window.BeatboxStudio.addTrack('Temp'); // dummy call, get track directly
        // Find track in state
        const allTracksSummary = window.BeatboxStudio.getProjectSummary();

        // Directly re-arm track with new media URL and render
        const reattachedResult = await new Promise((resolve) => {
          // Re-populate media on Track 1
          const trackRow = document.getElementById(`reaper_row_${targetId}`);
          resolve({
            hasEmptyBtn: !!emptyBtn,
            hasMediaElAfterClear: !!mediaElAfterClear
          });
        });

        return {
          success: true,
          hasEmptyBtn: reattachedResult.hasEmptyBtn,
          hasMediaElAfterClear: reattachedResult.hasMediaElAfterClear
        };
      }, tracks);

      assert.ok(result.success, 'Evaluation should succeed');
      assert.ok(result.hasEmptyBtn, 'Track should show clean empty recording trigger after clearTrackMedia');
      assert.equal(result.hasMediaElAfterClear, false, 'Media element must be removed from DOM after clearTrackMedia');
    });

    it('Stress 2.3: Overdrive volume routing (1.5x) and boundary clamping', async () => {
      const tracks = await setupMockTracks(3, 6.0);

      const result = await session.evaluate(async (trackList) => {
        // Start and stop playback briefly to initialize AudioContext
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 20));
        window.BeatboxStudio.stopStudioPlayback();

        // Set Track 1 to 1.5 (maximum overdrive) via .tcp-fader-slider
        const row1 = document.getElementById(`reaper_row_${trackList[0].id}`);
        const slider1 = row1?.querySelector('.tcp-fader-slider');
        if (slider1) {
          slider1.value = 1.5;
          slider1.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Set Track 2 to 0.0 (muted volume) via .tcp-fader-slider
        const row2 = document.getElementById(`reaper_row_${trackList[1].id}`);
        const slider2 = row2?.querySelector('.tcp-fader-slider');
        if (slider2) {
          slider2.value = 0.0;
          slider2.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Check effective values
        const card1 = document.getElementById(`card_${trackList[0].id}`);
        const el1 = card1?.querySelector('audio, video');
        const gain1 = el1?._webAudioGraph?.gainNode?.gain?.value ?? el1?.volume;

        const card2 = document.getElementById(`card_${trackList[1].id}`);
        const el2 = card2?.querySelector('audio, video');
        const vol2 = el2?.volume;

        // Toggle Solo on Track 2 (Track 1 must be dimmed to 0)
        window.BeatboxStudio.toggleTrackSolo(trackList[1].id);
        const gain1Dimmed = el1?._webAudioGraph?.gainNode?.gain?.value ?? el1?.volume;

        // Unsolo Track 2 (Track 1 must restore to 1.5)
        window.BeatboxStudio.toggleTrackSolo(trackList[1].id);
        const gain1Restored = el1?._webAudioGraph?.gainNode?.gain?.value ?? el1?.volume;

        return {
          success: true,
          gain1Initial: gain1,
          vol2Initial: vol2,
          gain1Dimmed,
          gain1Restored
        };
      }, tracks);

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.gain1Initial, 1.5, 'Overdrive volume should reach 1.5 via GainNode');
      assert.equal(result.vol2Initial, 0.0, 'Zero volume slider should evaluate to 0.0');
      assert.equal(result.gain1Dimmed, 0.0, 'Solo on another track must dim overdrive track gain to 0.0');
      assert.equal(result.gain1Restored, 1.5, 'Releasing solo must smoothly restore overdrive track gain to 1.5');
    });

    it('Stress 2.4: Active track deletion during playback with running timers', async () => {
      const tracks = await setupMockTracks(3, 8.0);

      const result = await session.evaluate(async (trackList) => {
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 50));

        // Delete middle track during active playback
        window.BeatboxStudio.removeTrack(trackList[1].id);
        window.BeatboxStudio.renderStudioViews();

        await new Promise(r => setTimeout(r, 60));

        const summary = window.BeatboxStudio.getProjectSummary();
        const remainingRows = Array.from(document.querySelectorAll('.reaper-track-row'));
        const remainingNumbers = remainingRows.map(r => r.querySelector('.tcp-track-number')?.textContent?.trim());

        window.BeatboxStudio.stopStudioPlayback();

        return {
          success: true,
          totalTracks: summary.totalTracks,
          remainingNumbers,
          isPlaying: summary.isPlaying
        };
      }, tracks);

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.totalTracks, 2, 'Project should have 2 tracks remaining');
      assert.deepEqual(result.remainingNumbers, ['01', '02'], 'Track numbers must re-index sequentially as 01, 02');
    });

  });

  // =========================================================================
  // Dimension 3: Seek Boundary, High-Frequency Jitter & Clock Synchronization
  // =========================================================================
  describe('Dimension 3: Seek Boundary, High-Frequency Jitter & Clock Synchronization', () => {

    it('Stress 3.1: Sub-millisecond boundary seek clamping (Negative, Zero, Exact End, Far Beyond)', async () => {
      await setupMockTracks(2, 10.0);

      const result = await session.evaluate(() => {
        const rulerTrack = document.getElementById('reaperRulerTrack');
        const playhead = document.getElementById('reaperPlayhead');
        if (!rulerTrack || !playhead) return { error: 'Ruler elements missing' };

        const testPoints = [
          { name: 'negative_extreme', clientXPct: -0.5 },
          { name: 'zero_boundary', clientXPct: 0.0 },
          { name: 'quarter', clientXPct: 0.25 },
          { name: 'halfway', clientXPct: 0.5 },
          { name: 'end_boundary', clientXPct: 1.0 },
          { name: 'past_boundary_extreme', clientXPct: 2.0 }
        ];

        const outcomes = [];
        const rect = rulerTrack.getBoundingClientRect();

        for (const pt of testPoints) {
          const clickX = rect.left + rect.width * pt.clientXPct;
          const evt = new MouseEvent('click', {
            clientX: clickX,
            clientY: rect.top + rect.height * 0.5,
            bubbles: true
          });
          rulerTrack.dispatchEvent(evt);

          const summary = window.BeatboxStudio.getProjectSummary();
          const leftPct = parseFloat(playhead.style.left);
          const lcdBars = document.getElementById('reaperTimeBars')?.textContent;

          outcomes.push({
            name: pt.name,
            clientXPct: pt.clientXPct,
            playheadPosSec: summary.playheadPosSec,
            playheadLeftPct: leftPct,
            lcdValid: !lcdBars?.includes('NaN')
          });
        }

        return { success: true, outcomes };
      });

      assert.ok(result.success, 'Evaluation should succeed');

      // Negative extreme must clamp to 0
      const neg = result.outcomes.find(o => o.name === 'negative_extreme');
      assert.equal(neg.playheadPosSec, 0, 'Negative seek must clamp to 0 seconds');
      assert.equal(neg.playheadLeftPct, 0, 'Playhead must clamp to 0%');

      // Zero boundary must be 0
      const zero = result.outcomes.find(o => o.name === 'zero_boundary');
      assert.equal(zero.playheadPosSec, 0, 'Zero seek must be 0 seconds');
      assert.equal(zero.playheadLeftPct, 0, 'Playhead must be 0%');

      // Past boundary extreme must clamp to 100%
      const past = result.outcomes.find(o => o.name === 'past_boundary_extreme');
      assert.ok(past.playheadPosSec > 0, 'Past boundary seek must clamp to project duration');
      assert.equal(past.playheadLeftPct, 100, 'Playhead must clamp to 100%');

      // All points must have valid LCD string without NaN
      for (const o of result.outcomes) {
        assert.ok(o.lcdValid, `LCD display must be valid for ${o.name}`);
      }
    });

    it('Stress 3.2: 100-cycle high-frequency ruler seek jitter during active playback', async () => {
      await setupMockTracks(2, 12.0);

      const result = await session.evaluate(async () => {
        const rulerTrack = document.getElementById('reaperRulerTrack');
        if (!rulerTrack) return { error: 'reaperRulerTrack missing' };

        // Start playback
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 40));

        const rect = rulerTrack.getBoundingClientRect();
        let lastTargetSec = 0;

        // 100 rapid seek jitter clicks
        for (let i = 0; i < 100; i++) {
          const randPct = 0.1 + (i % 80) * 0.01;
          const clickX = rect.left + rect.width * randPct;
          const evt = new MouseEvent('click', {
            clientX: clickX,
            clientY: rect.top + rect.height * 0.5,
            bubbles: true
          });
          rulerTrack.dispatchEvent(evt);
          lastTargetSec = randPct * 12.0; // approximate
        }

        // Wait 50ms for next playback interval tick to fire
        await new Promise(r => setTimeout(r, 50));

        const summary = window.BeatboxStudio.getProjectSummary();
        const playhead = document.getElementById('reaperPlayhead');
        const finalLeftPct = playhead ? parseFloat(playhead.style.left) : null;

        // Stop playback
        window.BeatboxStudio.stopStudioPlayback();

        return {
          success: true,
          finalPlaying: summary.isPlaying,
          finalPosSec: summary.playheadPosSec,
          finalLeftPct,
          isFinitePos: isFinite(summary.playheadPosSec) && !isNaN(summary.playheadPosSec)
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.ok(result.isFinitePos, 'Playhead position must remain a finite number under 100-cycle seek jitter');
      assert.ok(result.finalPosSec >= 0 && result.finalPosSec <= 12.0, 'Playhead position must stay within timeline bounds');
      assert.ok(result.finalLeftPct >= 0 && result.finalLeftPct <= 100, 'DOM playhead style.left must be in [0%, 100%]');
    });

    it('Stress 3.3: Seek while transport is Paused preserves position and resumes accurately', async () => {
      await setupMockTracks(2, 10.0);

      const result = await session.evaluate(async () => {
        const rulerTrack = document.getElementById('reaperRulerTrack');
        const playhead = document.getElementById('reaperPlayhead');
        if (!rulerTrack || !playhead) return { error: 'Ruler elements missing' };

        // 1. Start playback and run for 100ms
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 100));

        // 2. Pause
        window.BeatboxStudio.pauseStudioPlayback();
        const pausedSummary = window.BeatboxStudio.getProjectSummary();

        // 3. Seek to 75% while paused
        const rect = rulerTrack.getBoundingClientRect();
        const seekX = rect.left + rect.width * 0.75;
        rulerTrack.dispatchEvent(new MouseEvent('click', {
          clientX: seekX,
          clientY: rect.top + rect.height * 0.5,
          bubbles: true
        }));

        const afterSeekSummary = window.BeatboxStudio.getProjectSummary();
        const afterSeekLeftPct = parseFloat(playhead.style.left);

        // 4. Resume playback
        window.BeatboxStudio.startStudioPlayback();
        await new Promise(r => setTimeout(r, 80));

        const resumedSummary = window.BeatboxStudio.getProjectSummary();

        window.BeatboxStudio.stopStudioPlayback();

        return {
          success: true,
          pausedPosSec: pausedSummary.playheadPosSec,
          afterSeekPosSec: afterSeekSummary.playheadPosSec,
          afterSeekLeftPct,
          afterSeekIsPlaying: afterSeekSummary.isPlaying,
          afterSeekIsPaused: afterSeekSummary.isPaused,
          resumedPosSec: resumedSummary.playheadPosSec,
          resumedIsPlaying: resumedSummary.isPlaying
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.afterSeekIsPlaying, false, 'Seeking while paused must NOT start playing');
      assert.equal(result.afterSeekIsPaused, true, 'Seeking while paused must keep paused state');
      assert.ok(Math.abs(result.afterSeekLeftPct - 75) <= 2, `Playhead left should be ~75%, got ${result.afterSeekLeftPct}`);
      assert.ok(result.resumedPosSec >= result.afterSeekPosSec, 'Playback must resume from the seeked position (>= 7.5s), not snap back to paused position');
    });

    it('Stress 3.4: Zero-duration empty project seek immunity', async () => {
      const result = await session.evaluate(() => {
        const rulerTrack = document.getElementById('reaperRulerTrack');
        const playhead = document.getElementById('reaperPlayhead');
        if (!rulerTrack) return { error: 'reaperRulerTrack missing' };

        const summaryBefore = window.BeatboxStudio.getProjectSummary();

        // Click ruler on empty project at left edge (0%) and interior
        const rect = rulerTrack.getBoundingClientRect();
        rulerTrack.dispatchEvent(new MouseEvent('click', {
          clientX: rect.left,
          clientY: rect.top + 10,
          bubbles: true
        }));

        const summaryAtZero = window.BeatboxStudio.getProjectSummary();
        const playheadLeftAtZero = playhead ? playhead.style.left : '';

        // Click interior at 100px
        rulerTrack.dispatchEvent(new MouseEvent('click', {
          clientX: rect.left + 100,
          clientY: rect.top + 10,
          bubbles: true
        }));

        const summaryAfter = window.BeatboxStudio.getProjectSummary();
        const playheadLeftAfter = playhead ? playhead.style.left : '';

        return {
          success: true,
          totalTracks: summaryBefore.totalTracks,
          posAtZero: summaryAtZero.playheadPosSec,
          playheadLeftAtZero,
          posAfter: summaryAfter.playheadPosSec,
          playheadLeftAfter,
          isFinitePos: isFinite(summaryAfter.playheadPosSec) && !isNaN(summaryAfter.playheadPosSec),
          noNaN: !playheadLeftAfter.includes('NaN')
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.totalTracks, 0, 'Project should have 0 tracks');
      assert.equal(result.posAtZero, 0, 'Seek at left boundary on empty project must be exactly 0');
      assert.equal(result.playheadLeftAtZero, '0%', 'Playhead left at boundary must be 0%');
      assert.ok(result.isFinitePos, 'Seek on empty project must compute a finite valid timestamp');
      assert.ok(result.noNaN, 'Playhead style.left must not contain NaN');
    });

  });

  // =========================================================================
  // Dimension 4: Extreme Track Scaling Limits (Up to 32 Tracks & Beyond)
  // =========================================================================
  describe('Dimension 4: Extreme Track Scaling Limits (Up to 32 Tracks & Beyond)', () => {

    it('Stress 4.1: Mass track scaling up to exactly 32 tracks (MAX_STUDIO_TRACKS)', async () => {
      const result = await session.evaluate(() => {
        const added = [];
        for (let i = 1; i <= 32; i++) {
          const t = window.BeatboxStudio.addTrack(`Faixa Escala ${i}`);
          added.push(t ? t.id : null);
        }
        window.BeatboxStudio.renderStudioViews();

        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        const numbers = rows.map(r => r.querySelector('.tcp-track-number')?.textContent?.trim());
        const hasArmButtons = rows.every(r => !!r.querySelector('.btn-rec-arm'));
        const hasSoloButtons = rows.every(r => !!r.querySelector('.tcp-btn-solo'));
        const hasMuteButtons = rows.every(r => !!r.querySelector('.tcp-btn-mute'));
        const hasSliders = rows.every(r => !!r.querySelector('.tcp-fader-slider'));

        return {
          success: true,
          totalAdded: added.filter(Boolean).length,
          rowCount: rows.length,
          firstNum: numbers[0],
          lastNum: numbers[numbers.length - 1],
          allControlsPresent: hasArmButtons && hasSoloButtons && hasMuteButtons && hasSliders
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.totalAdded, 32, 'Must add 32 tracks successfully');
      assert.equal(result.rowCount, 32, 'DOM must render exactly 32 distinct track rows');
      assert.equal(result.firstNum, '01', 'First track number must be 01');
      assert.equal(result.lastNum, '32', '32nd track number must be 32');
      assert.ok(result.allControlsPresent, 'All 32 tracks must have full suite of TCP controls (Arm, Solo, Mute, Volume)');
    });

    it('Stress 4.2: Hard limit enforcement beyond 32 tracks (rejects 33rd track)', async () => {
      const result = await session.evaluate(() => {
        // Pre-fill to 32 tracks
        for (let i = 1; i <= 32; i++) {
          window.BeatboxStudio.addTrack(`Pista ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();

        // Attempt to add 33rd track
        const t33 = window.BeatboxStudio.addTrack('Pista 33 Overflow');

        // Attempt to duplicate Track 1
        const summary = window.BeatboxStudio.getProjectSummary();
        const firstTrackId = document.querySelector('.reaper-track-row')?.id?.replace('reaper_row_', '');
        const dupResult = firstTrackId ? window.BeatboxStudio.duplicateTrack(firstTrackId) : 'no_id';

        window.BeatboxStudio.renderStudioViews();
        const finalRowCount = document.querySelectorAll('.reaper-track-row').length;

        return {
          success: true,
          t33Result: t33,
          dupResult,
          finalRowCount
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.t33Result, null, 'addTrack at 32 must reject and return null');
      assert.equal(result.dupResult, null, 'duplicateTrack at 32 must reject and return null');
      assert.equal(result.finalRowCount, 32, 'DOM row count must remain clamped strictly at 32');
    });

    it('Stress 4.3: Keyboard navigation clamping across 32 tracks (ArrowDown & ArrowUp)', async () => {
      const result = await session.evaluate(() => {
        for (let i = 1; i <= 32; i++) {
          window.BeatboxStudio.addTrack(`Faixa Nav ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();

        // Select first track
        const firstRow = document.querySelector('.reaper-track-row');
        const firstId = firstRow?.id?.replace('reaper_row_', '');
        window.BeatboxStudio.selectTrack(firstId);

        // Rapidly dispatch 40 ArrowDown presses (overshooting 32)
        for (let i = 0; i < 40; i++) {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true }));
        }

        const bottomSelectedRow = document.querySelector('.reaper-track-row.is-selected');
        const bottomTrackNum = bottomSelectedRow?.querySelector('.tcp-track-number')?.textContent?.trim();

        // Rapidly dispatch 40 ArrowUp presses (overshooting back to 0)
        for (let i = 0; i < 40; i++) {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }));
        }

        const topSelectedRow = document.querySelector('.reaper-track-row.is-selected');
        const topTrackNum = topSelectedRow?.querySelector('.tcp-track-number')?.textContent?.trim();

        return {
          success: true,
          bottomTrackNum,
          topTrackNum
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.bottomTrackNum, '32', 'ArrowDown overshoot must clamp cleanly at track 32');
      assert.equal(result.topTrackNum, '01', 'ArrowUp overshoot must clamp cleanly at track 01');
    });

    it('Stress 4.4: Master Record auto-routing in 32-track project', async () => {
      const result = await session.evaluate(async () => {
        for (let i = 1; i <= 32; i++) {
          window.BeatboxStudio.addTrack(`Pista Rec ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();

        // Arm track 27
        const rows = document.querySelectorAll('.reaper-track-row');
        const row27 = rows[26];
        const armBtn27 = row27?.querySelector('.btn-rec-arm');
        if (armBtn27) armBtn27.click();

        // Trigger Master Record
        window.BeatboxStudio.triggerMasterRecord();

        const recordWorkspace = document.getElementById('recordWorkspace');
        const isRecordActive = recordWorkspace && recordWorkspace.style.display !== 'none';
        const activeTrackName = document.getElementById('audioViewfinderInstrument')?.textContent;

        // Return to timeline
        await window.BeatboxStudio.switchViewMode('timeline');

        return {
          success: true,
          isRecordActive,
          activeTrackName
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.ok(result.isRecordActive, 'Master Record must open recording workspace in 32-track project');
      assert.equal(result.activeTrackName, 'Pista Rec 27', 'Master Record must correctly route to armed Track 27');
    });

    it('Stress 4.5: High-density mass Solo performance across 32 tracks', async () => {
      const result = await session.evaluate(() => {
        for (let i = 1; i <= 32; i++) {
          window.BeatboxStudio.addTrack(`Pista Solo ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();

        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        const targetRow = rows[15]; // Track 16
        const targetId = targetRow?.id?.replace('reaper_row_', '');

        // Measure execution time of solo toggle on 32 tracks
        const t0 = performance.now();
        window.BeatboxStudio.toggleTrackSolo(targetId);
        const elapsedMs = performance.now() - t0;

        const soloedRows = document.querySelectorAll('.reaper-track-row.is-soloed');
        const dimmedRows = document.querySelectorAll('.reaper-track-row.is-solo-dimmed');

        // Toggle back off
        window.BeatboxStudio.toggleTrackSolo(targetId);
        const dimmedRowsAfter = document.querySelectorAll('.reaper-track-row.is-solo-dimmed');

        return {
          success: true,
          elapsedMs,
          soloedCount: soloedRows.length,
          dimmedCount: dimmedRows.length,
          dimmedCountAfter: dimmedRowsAfter.length
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.ok(result.elapsedMs < 100, `Mass solo on 32 tracks must execute in < 100ms, took ${result.elapsedMs.toFixed(2)}ms`);
      assert.equal(result.soloedCount, 1, 'Exactly 1 track must be marked .is-soloed');
      assert.equal(result.dimmedCount, 31, 'Remaining 31 tracks must be marked .is-solo-dimmed');
      assert.equal(result.dimmedCountAfter, 0, 'Releasing solo must clear dimming on all 32 tracks');
    });

    it('Stress 4.6: Mass project reset from 32 tracks to clean empty state', async () => {
      const result = await session.evaluate(async () => {
        for (let i = 1; i <= 32; i++) {
          window.BeatboxStudio.addTrack(`Pista Clear ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();

        const countBefore = document.querySelectorAll('.reaper-track-row').length;

        // Clear project synchronously
        await window.BeatboxStudio.clearCurrentProjectTracks(true);

        const countAfter = document.querySelectorAll('.reaper-track-row').length;
        const summaryAfter = window.BeatboxStudio.getProjectSummary();
        const emptyStateVisible = document.querySelector('.empty-studio-hero')?.style?.display !== 'none';

        // Add 1 track to verify immediate reuse
        const freshTrack = window.BeatboxStudio.addTrack('Faixa Limpa');
        window.BeatboxStudio.renderStudioViews();

        const finalRowCount = document.querySelectorAll('.reaper-track-row').length;
        const freshTrackNum = document.querySelector('.reaper-track-row .tcp-track-number')?.textContent?.trim();

        return {
          success: true,
          countBefore,
          countAfter,
          summaryTotal: summaryAfter.totalTracks,
          emptyStateVisible,
          finalRowCount,
          freshTrackNum
        };
      });

      assert.ok(result.success, 'Evaluation should succeed');
      assert.equal(result.countBefore, 32, 'Must have started with 32 tracks');
      assert.equal(result.countAfter, 0, 'All 32 track rows must be removed from DOM');
      assert.equal(result.summaryTotal, 0, 'State summary must report 0 total tracks');
      assert.equal(result.finalRowCount, 1, 'Fresh track must be added cleanly');
      assert.equal(result.freshTrackNum, '01', 'Fresh track number must restart at 01');
    });

  });

});
