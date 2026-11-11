    /* =========================================================================
       5. REPRODUÇÃO & SEQUENCIADOR (CLOCK DE ALTA PRECISÃO WEB AUDIO)
       ========================================================================= */
    function getStepDurationSec(stepIndex = 0) {
      const stepsPerMeasure = getStepsPerMeasure();
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const stepsPerBeat = stepsPerMeasure / beatsPerMeasure;
      const globalBeatIdx = Math.floor(stepIndex / stepsPerBeat);
      const activeStepsInBeat = getActiveStepsInBeat(globalBeatIdx);
      return (60 / state.bpm) / activeStepsInBeat;
    }

    function getNextPlayableStep(stepIndex, totalSteps) {
      const stepsPerMeasure = getStepsPerMeasure();
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const stepsPerBeat = stepsPerMeasure / beatsPerMeasure;
      const globalBeatIdx = Math.floor(stepIndex / stepsPerBeat);
      const offsetInBeat = stepIndex % stepsPerBeat;
      const activeStepsInBeat = getActiveStepsInBeat(globalBeatIdx);

      if (offsetInBeat + 1 < activeStepsInBeat) {
        return { nextStep: stepIndex + 1, wrapped: false };
      }
      const nextBeatStart = (globalBeatIdx + 1) * stepsPerBeat;
      if (nextBeatStart >= totalSteps) {
        return { nextStep: 0, wrapped: true };
      }
      return { nextStep: nextBeatStart, wrapped: false };
    }

    function startPlayback() {
      audio.init();
      requestScreenWakeLock();
      if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
      }
      state.isPlaying = true;
      state.loopCount = 0;
      document.getElementById('playIcon').textContent = '⏸';
      document.getElementById('playText').textContent = 'Pausar';
      document.getElementById('btnPlay').classList.add('btn-primary');
      if (typeof syncGlobalPlayButton === 'function') syncGlobalPlayButton();

      state.nextNoteTime = audio.ctx.currentTime + 0.02;

      // Scheduler com compensação de drift no clock do Web Audio API e suporte exato a Tercinas/Sextinas
      state.timerId = setInterval(() => {
        if (!state.isPlaying || !audio.ctx) return;
        const now = audio.ctx.currentTime;
        const totalSteps = getTotalSteps();

        while (state.nextNoteTime <= now + 0.035) {
          const stepToPlay = state.currentStep;
          const stepDur = getStepDurationSec(stepToPlay);
          playStep(stepToPlay, state.nextNoteTime);
          updateCursor(stepToPlay);
          const { nextStep, wrapped } = getNextPlayableStep(stepToPlay, totalSteps);
          state.currentStep = nextStep;
          if (wrapped) {
            state.loopCount = (state.loopCount || 0) + 1;
          }
          state.nextNoteTime += stepDur;
        }
      }, 15);
    }

    function stopPlayback() {
      state.isPlaying = false;
      releaseScreenWakeLock();
      if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
      }
      state.currentStep = 0;
      state.loopCount = 0;
      if (audio && typeof audio.stopAll === 'function') {
        audio.stopAll();
      } else if (audio && typeof audio.stopActiveRufadas === 'function') {
        audio.stopActiveRufadas();
      }
      document.getElementById('playIcon').textContent = '▶';
      document.getElementById('playText').textContent = 'Reproduzir';
      clearCursor();
      if (typeof syncGlobalPlayButton === 'function') syncGlobalPlayButton();
    }

    function playStep(stepIndex, scheduledTime = null) {
      const stepsPerMeasure = getStepsPerMeasure();
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const stepsPerBeat = stepsPerMeasure / beatsPerMeasure;

      if (state.metronomeEnabled && stepIndex % stepsPerBeat === 0) {
        const isDownbeat = stepIndex % stepsPerMeasure === 0;
        audio.playMetronome(isDownbeat, scheduledTime);
      }

      const hasAnySolo = Object.values(state.solos).some(v => v === true);
      const totalSteps = getTotalSteps();

      INSTRUMENTS.forEach(inst => {
        if (state.mutes[inst.id]) return;
        if (hasAnySolo && !state.solos[inst.id]) return;

        const activeGrid = state.gridData[inst.id];

        const note = activeGrid?.[stepIndex];
        const baseVol = state.volumes[inst.id] ?? 1.0;
        const meta = state.stepMeta?.[inst.id]?.[stepIndex];
        const velMult = computeStepVelMultiplier(note, meta);
        const volMult = baseVol * velMult;
        if (note && volMult > 0) {
          if (note === 'rufado' && (inst.id === 'caixa' || inst.id === 'repique')) {
            const runInfo = getRufadaRunInfo(activeGrid, stepIndex, totalSteps);
            if (runInfo.isRufado && !runInfo.isStart) {
              return; // Faz parte da sequência de rufada já iniciada e em extensão
            }
            const dur = runInfo.durationSec || getStepDurationSec(stepIndex);
            audio.triggerInstrument(inst.id, note, volMult, scheduledTime, dur, runInfo.count || 1);
          } else {
            audio.triggerInstrument(inst.id, note, volMult, scheduledTime);
          }
        }
      });
    }

    function updateCursor(stepIndex) {
      clearCursor();
      const cells = document.querySelectorAll(`.step-cell[data-step="${stepIndex}"]`);
      cells.forEach(cell => cell.classList.add('active-step-cursor'));
    }

    function clearCursor() {
      document.querySelectorAll('.active-step-cursor').forEach(el => el.classList.remove('active-step-cursor'));
    }
