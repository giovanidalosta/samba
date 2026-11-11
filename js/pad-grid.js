    /* =========================================================================
       4. RENDERIZAÇÃO DA GRADE (DOM)
       ========================================================================= */
    const rulerRow = document.getElementById('rulerRow');
    const tracksWrapper = document.getElementById('tracksWrapper');
    tracksWrapper.setAttribute('role', 'grid');
    tracksWrapper.setAttribute('aria-label', 'Grade rítmica do Pad. Setas navegam, Enter ou Espaço marcam.');

    // Grade acessível: rótulo falado por célula e foco "roving" (um único tabstop).
    let padFocus = { inst: null, step: null };
    function padCellLabel(inst, stepIndex, artLabel) {
      const perMeasure = getStepsPerMeasure();
      const beats = state.meter === '2/4' ? 2 : 4;
      const perBeat = perMeasure / beats;
      const inMeasure = stepIndex % perMeasure;
      const sub = (inMeasure % perBeat) + 1;
      return `${inst.name}, compasso ${Math.floor(stepIndex / perMeasure) + 1}, tempo ${Math.floor(inMeasure / perBeat) + 1}, ${state.subdivision || 'subdivisão'} ${sub}: ${artLabel || 'vazio'}`;
    }
    function movePadFocus(cell, key) {
      const row = cell.parentElement;
      const cells = [...row.querySelectorAll('.step-cell')];
      const i = cells.indexOf(cell);
      let target = null;
      if (key === 'ArrowRight') target = cells[i + 1];
      else if (key === 'ArrowLeft') target = cells[i - 1];
      else if (key === 'Home') target = cells[0];
      else if (key === 'End') target = cells[cells.length - 1];
      else if (key === 'ArrowDown' || key === 'ArrowUp') {
        const rows = [...tracksWrapper.querySelectorAll('.steps-container')];
        const other = rows[rows.indexOf(row) + (key === 'ArrowDown' ? 1 : -1)];
        if (other) {
          const step = Number(cell.dataset.step);
          const oc = [...other.querySelectorAll('.step-cell')];
          target = oc.filter(c => Number(c.dataset.step) <= step).pop() || oc[0];
        }
      }
      if (target) target.focus();
    }
    tracksWrapper.addEventListener('keydown', (e) => {
      const cell = e.target.closest && e.target.closest('.step-cell');
      if (!cell) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cell.click();
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        movePadFocus(cell, e.key);
      }
    });
    tracksWrapper.addEventListener('focusin', (e) => {
      const cell = e.target.closest && e.target.closest('.step-cell');
      if (!cell) return;
      tracksWrapper.querySelectorAll('.step-cell[tabindex="0"]').forEach(c => { c.tabIndex = -1; });
      cell.tabIndex = 0;
      padFocus = { inst: cell.dataset.instrument, step: cell.dataset.step };
    });

    function updateSingleCellDOM(cell, inst, stepIndex) {
      cell.innerHTML = '';
      cell.setAttribute('aria-label', padCellLabel(inst, stepIndex, (inst.articulations.find(a => a.id === state.gridData[inst.id][stepIndex]) || {}).label));
      const activeArtId = state.gridData[inst.id][stepIndex];
      const meta = state.stepMeta?.[inst.id]?.[stepIndex];
      if (activeArtId) {
        const artObj = inst.articulations.find(a => a.id === activeArtId);
        if (artObj) {
          const node = document.createElement('div');
          node.className = `step-node ${artObj.css}`;
          node.textContent = artObj.label;
          node.title = meta && typeof meta.vel === 'number'
            ? `${inst.name}: ${artObj.name} (vel: ${meta.vel})`
            : `${inst.name}: ${artObj.name}`;
          cell.appendChild(node);
        }
      }
    }

    // Bottom sheet do naipe (celular): qual naipe está aberto sobrevive ao re-render da grade.
    let padSheetInstId = null;
    function setPadSheet(instId) {
      padSheetInstId = instId;
      document.body.classList.toggle('pad-sheet-open', !!instId);
      document.querySelectorAll('#tracksWrapper .track-header').forEach(h => {
        h.classList.toggle('sheet-open', !!instId && h.dataset.instId === instId);
      });
    }
    document.getElementById('padSheetBackdrop')?.addEventListener('click', () => setPadSheet(null));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && padSheetInstId) setPadSheet(null); });

    function renderStudio() {
      updateSubdivSelectLabels();
      initGridData();
      const totalSteps = getTotalSteps();
      const stepsPerMeasure = getStepsPerMeasure();
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const stepsPerBeat = stepsPerMeasure / beatsPerMeasure;

      // 1. Régua Superior Dupla (Compasso + Botões Duplicar/Limpar + Guias dos Tempos 1 e 2)
      rulerRow.innerHTML = '';
      for (let m = 0; m < state.measures; m++) {
        const measureGroup = document.createElement('div');
        measureGroup.className = 'measure-group';
        measureGroup.style.width = `${stepsPerMeasure * 36}px`;

        const measureBadge = document.createElement('div');
        measureBadge.className = 'measure-badge';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = `Compasso ${m + 1} (${state.meter})`;
        measureBadge.appendChild(titleSpan);

        const badgeActions = document.createElement('div');
        badgeActions.className = 'measure-badge-actions';

        const btnDup = document.createElement('button');
        btnDup.className = 'btn-measure-act';
        btnDup.textContent = '⧉ Duplicar';
        btnDup.title = m === state.measures - 1
          ? 'Duplicar este compasso criando um novo compasso à frente'
          : `Copiar notas do Compasso ${m + 1} para o Compasso ${m + 2}`;
        btnDup.onclick = (e) => {
          e.stopPropagation();
          duplicateMeasure(m);
        };

        const btnClrMeasure = document.createElement('button');
        btnClrMeasure.className = 'btn-measure-act';
        btnClrMeasure.textContent = '✕';
        btnClrMeasure.title = `Limpar todas as notas do Compasso ${m + 1}`;
        btnClrMeasure.onclick = (e) => {
          e.stopPropagation();
          clearMeasure(m);
        };

        badgeActions.appendChild(btnDup);
        badgeActions.appendChild(btnClrMeasure);
        measureBadge.appendChild(badgeActions);
        measureGroup.appendChild(measureBadge);

        const beatsSubruler = document.createElement('div');
        beatsSubruler.className = 'beats-subruler';

        for (let b = 0; b < beatsPerMeasure; b++) {
          const globalBeatIdx = m * beatsPerMeasure + b;
          const tuplet = getBeatTuplet(globalBeatIdx);
          const beatBadge = document.createElement('div');
          beatBadge.style.width = `${stepsPerBeat * 36}px`;
          const isSurdo2Beat = (b % 2 === 0);
          beatBadge.className = `beat-badge ${isSurdo2Beat ? 'beat-surdo2' : 'beat-surdo1'} ${tuplet ? 'beat-tuplet-active' : ''}`;
          const surdoLabel = isSurdo2Beat ? `Tempo ${b + 1} (2ª)` : `Tempo ${b + 1} (1ª)`;

          const labelSpan = document.createElement('span');
          labelSpan.textContent = surdoLabel;

          const btnTuplet = document.createElement('button');
          btnTuplet.type = 'button';
          btnTuplet.className = `btn-beat-tuplet ${tuplet ? 'active' : ''}`;
          if (tuplet === 6) {
            btnTuplet.textContent = '6x Sextina';
            btnTuplet.title = 'Sextina ativa (6 divisões iguais neste tempo) — Clique para voltar à divisão normal';
          } else if (tuplet === 3) {
            btnTuplet.textContent = '3x Tercina';
            btnTuplet.title = state.subdivision === 'fusa'
              ? 'Tercina ativa (3 divisões iguais neste tempo) — Clique para mudar para Sextina (6x) ou voltar ao normal'
              : 'Tercina ativa (3 divisões iguais neste tempo) — Clique para voltar à divisão normal';
          } else {
            btnTuplet.textContent = '3x';
            btnTuplet.title = 'Transformar este tempo em Tercina (3 divisões iguais no tempo)';
          }
          btnTuplet.onclick = (e) => {
            e.stopPropagation();
            toggleBeatTuplet(globalBeatIdx);
          };

          beatBadge.appendChild(labelSpan);
          beatBadge.appendChild(btnTuplet);
          beatsSubruler.appendChild(beatBadge);
        }

        measureGroup.appendChild(beatsSubruler);
        rulerRow.appendChild(measureGroup);
      }

      // 2. Faixas de Instrumentos
      tracksWrapper.innerHTML = '';

      INSTRUMENTS.forEach(inst => {
        const row = document.createElement('div');
        row.className = 'track-row';
        row.style.setProperty('--instrument-color', inst.color);

        const header = document.createElement('div');
        header.className = 'track-header';
        header.dataset.instId = inst.id;

        // Topo do Header: Nome + M / S / Audition / Limpar Faixa
        const headerTop = document.createElement('div');
        headerTop.className = 'track-header-top';

        const info = document.createElement('div');
        info.className = 'track-info';
        info.innerHTML = `
          <span class="track-name">${inst.name}</span>
          <span class="track-sub">${inst.sub}</span>
        `;

        const actions = document.createElement('div');
        actions.className = 'track-actions';

        const btnMute = document.createElement('button');
        btnMute.className = `btn-icon-mini ${state.mutes[inst.id] ? 'active-mute' : ''}`;
        btnMute.textContent = 'M';
        btnMute.title = 'Mudo (Mute)';
        btnMute.onclick = (e) => {
          e.stopPropagation();
          state.mutes[inst.id] = !state.mutes[inst.id];
          renderStudio();
        };

        const btnSolo = document.createElement('button');
        btnSolo.className = `btn-icon-mini ${state.solos[inst.id] ? 'active-solo' : ''}`;
        btnSolo.textContent = 'S';
        btnSolo.title = 'Solo';
        btnSolo.onclick = (e) => {
          e.stopPropagation();
          state.solos[inst.id] = !state.solos[inst.id];
          renderStudio();
        };

        const btnClearTrack = document.createElement('button');
        btnClearTrack.type = 'button';
        btnClearTrack.className = 'btn-icon-mini btn-clear-track';
        btnClearTrack.textContent = '✕';
        btnClearTrack.title = `Limpar faixa de ${inst.name}`;
        btnClearTrack.onclick = (e) => {
          e.stopPropagation();
          state.gridData[inst.id] = new Array(totalSteps).fill(null);
          state.stepMeta[inst.id] = new Array(totalSteps).fill(null);
          if (state.loopGridData) delete state.loopGridData[inst.id];
          state.selectedGroove[inst.id] = '';
          renderStudio();
        };

        btnMute.type = 'button';
        btnSolo.type = 'button';
        actions.appendChild(btnMute);
        actions.appendChild(btnSolo);
        actions.appendChild(btnClearTrack);
        info.style.cursor = 'pointer';
        info.title = `Toque para ouvir o timbre de ${inst.name}`;
        info.onclick = (e) => {
          e.stopPropagation();
          const brush = state.selectedBrush[inst.id];
          const artId = (brush && brush !== 'cycle' && brush !== 'erase') ? brush : inst.articulations[0].id;
          audio.triggerInstrument(inst.id, artId, state.volumes[inst.id] ?? 1.0);
          if (navigator.vibrate) navigator.vibrate(20);
          if (window.matchMedia('(max-width: 600px)').matches) setPadSheet(inst.id);
          header.classList.add('pad-pressed');
          setTimeout(() => header.classList.remove('pad-pressed'), 120);
        };
        headerTop.appendChild(info);
        headerTop.appendChild(actions);

        // Meio do Header: Paleta de Toques (Pincel Rápido)
        const artPalette = document.createElement('div');
        artPalette.className = 'track-art-palette';

        const currentBrush = state.selectedBrush[inst.id] || 'cycle';

        const cyclePill = document.createElement('button');
        cyclePill.className = `art-brush-pill ${currentBrush === 'cycle' ? 'active' : ''}`;
        cyclePill.textContent = '↻ Ciclo';
        cyclePill.title = 'Modo Ciclo: cada clique na mesma célula alterna entre os toques deste instrumento';
        cyclePill.onclick = (e) => {
          e.stopPropagation();
          state.selectedBrush[inst.id] = 'cycle';
          renderStudio();
        };
        artPalette.appendChild(cyclePill);

        inst.articulations.forEach(art => {
          const pill = document.createElement('button');
          pill.className = `art-brush-pill ${currentBrush === art.id ? 'active' : ''}`;
          pill.textContent = art.label;
          pill.title = `${art.name} — Clique para fixar este pincel e pintar arrastando na grade`;
          pill.onclick = (e) => {
            e.stopPropagation();
            state.selectedBrush[inst.id] = art.id;
            audio.triggerInstrument(inst.id, art.id, state.volumes[inst.id] ?? 1.0);
            renderStudio();
          };
          artPalette.appendChild(pill);
        });

        const erasePill = document.createElement('button');
        erasePill.className = `art-brush-pill ${currentBrush === 'erase' ? 'active' : ''}`;
        erasePill.textContent = '⌫';
        erasePill.title = 'Modo Borracha (ideal para celular): toque ou arraste nas células para apagar notas';
        erasePill.onclick = (e) => {
          e.stopPropagation();
          state.selectedBrush[inst.id] = 'erase';
          renderStudio();
        };
        artPalette.appendChild(erasePill);

        // Base do Header: Seletor de Levada Característica + Botão Salvar Base + Slider de Volume
        const headerBottom = document.createElement('div');
        headerBottom.className = 'track-header-bottom';

        const grooveSelect = document.createElement('select');
        grooveSelect.className = 'inst-groove-select';
        grooveSelect.title = `Preencher levada característica de ${inst.name}`;

        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.disabled = true;
        defaultOpt.hidden = true;
        defaultOpt.selected = !state.selectedGroove[inst.id];
        defaultOpt.textContent = 'Preencher levada...';
        grooveSelect.appendChild(defaultOpt);

        const instGrooves = getInstrumentGrooves(inst.id);
        instGrooves.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = String(g.name).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}️]\s?/gu, '');
          if (state.selectedGroove[inst.id] === g.id) {
            opt.selected = true;
          }
          grooveSelect.appendChild(opt);
        });

        const saveNamedOpt = document.createElement('option');
        saveNamedOpt.value = '__save_named__';
        saveNamedOpt.textContent = 'Salvar desenho atual com nome...';
        grooveSelect.appendChild(saveNamedOpt);

        if (Array.isArray(customGrooves[inst.id]) && customGrooves[inst.id].length > 0) {
          const clearCustomOpt = document.createElement('option');
          clearCustomOpt.value = '__clear_custom__';
          clearCustomOpt.textContent = 'Restaurar levadas padrão';
          grooveSelect.appendChild(clearCustomOpt);
        }

        grooveSelect.onchange = (e) => {
          e.stopPropagation();
          if (e.target.value) {
            applyInstrumentGroove(inst.id, e.target.value);
          }
        };

        const btnSaveBase = document.createElement('button');
        btnSaveBase.className = 'btn-save-groove';
        btnSaveBase.textContent = 'Salvar base';
        btnSaveBase.title = `Salvar o que está desenhado na linha de ${inst.name} como a Levada Base deste instrumento`;
        btnSaveBase.onclick = (e) => {
          e.stopPropagation();
          saveCurrentTrackAsGroove(inst, true, btnSaveBase);
        };

        const volBox = document.createElement('div');
        volBox.className = 'inst-vol-box';
        volBox.title = `Volume de ${inst.name}: ${Math.round((state.volumes[inst.id] ?? 1.0) * 100)}%`;

        const volSlider = document.createElement('input');
        volSlider.type = 'range';
        volSlider.className = 'inst-vol-slider';
        volSlider.dataset.inst = inst.id;
        volSlider.min = '0';
        volSlider.max = '150';
        volSlider.step = '1';
        volSlider.value = Math.round((state.volumes[inst.id] ?? 1.0) * 100);
        volSlider.oninput = (e) => {
          e.stopPropagation();
          const v = parseInt(e.target.value, 10) / 100;
          state.volumes[inst.id] = v;
          volBox.title = `Volume de ${inst.id}: ${e.target.value}%`;
        };

        volBox.appendChild(volSlider);
        headerBottom.appendChild(grooveSelect);
        headerBottom.appendChild(btnSaveBase);
        headerBottom.appendChild(volBox);

        // Pílulas e levada ficam num wrapper: inline no desktop, bottom sheet no celular (≤600px).
        const headerExtra = document.createElement('div');
        headerExtra.className = 'track-header-extra';
        const sheetClose = document.createElement('button');
        sheetClose.type = 'button';
        sheetClose.className = 'btn sheet-close';
        sheetClose.textContent = 'Fechar';
        sheetClose.onclick = (e) => { e.stopPropagation(); setPadSheet(null); };
        const sheetClear = document.createElement('button');
        sheetClear.type = 'button';
        sheetClear.className = 'btn sheet-clear';
        sheetClear.textContent = '✕ Limpar faixa';
        sheetClear.onclick = (e) => { btnClearTrack.onclick(e); setPadSheet(null); };
        headerExtra.append(sheetClose, artPalette, headerBottom, sheetClear);

        header.appendChild(headerTop);
        header.appendChild(headerExtra);
        if (padSheetInstId === inst.id) header.classList.add('sheet-open');

        // Células da Grade com suporte a Click & Drag Paint e Tercinas/Sextinas por Tempo
        const stepsContainer = document.createElement('div');
        stepsContainer.className = 'steps-container';
        stepsContainer.setAttribute('role', 'row');

        for (let s = 0; s < totalSteps; s++) {
          const globalBeatIdx = Math.floor(s / stepsPerBeat);
          const offsetInBeat = s % stepsPerBeat;
          const tuplet = getBeatTuplet(globalBeatIdx);
          const activeStepsInBeat = tuplet || stepsPerBeat;
          if (offsetInBeat >= activeStepsInBeat) continue;

          const cell = document.createElement('div');
          cell.className = 'step-cell';
          cell.setAttribute('role', 'gridcell');
          cell.tabIndex = -1;
          const cellWidthPx = (stepsPerBeat * 36) / activeStepsInBeat;
          cell.style.width = `${cellWidthPx}px`;
          cell.dataset.instrument = inst.id;
          cell.dataset.step = s;
          if (tuplet) {
            cell.classList.add('tuplet-cell');
            cell.dataset.tupletSub = `${offsetInBeat + 1}/${tuplet}`;
          }

          const stepInMeasure = s % stepsPerMeasure;
          const isMeasureFirst = stepInMeasure === 0;
          const isBeatFirst = stepInMeasure % stepsPerBeat === 0;
          const beatIndex = Math.floor(stepInMeasure / stepsPerBeat);

          if (isMeasureFirst) {
            cell.classList.add('measure-first');
          } else if (isBeatFirst) {
            cell.classList.add('beat-first');
            if (beatIndex % 2 === 0) cell.classList.add('beat-surdo2-head');
            else cell.classList.add('beat-surdo1-head');
          }

          updateSingleCellDOM(cell, inst, s);

          let handledByMouseDown = false;

          const applyCellStroke = () => {
            const brush = state.selectedBrush[inst.id] || 'cycle';
            let targetArt = null;

            if (brush === 'erase') {
              targetArt = null;
            } else if (brush === 'cycle') {
              targetArt = computeNextCycledArticulation(inst, s);
            } else {
              // Se já tem a mesma articulação do pincel no clique/toque inicial, alterna (apaga); senão pinta com o pincel
              targetArt = state.gridData[inst.id][s] === brush ? null : brush;
            }

            state.gridData[inst.id][s] = targetArt;
            if (state.stepMeta[inst.id]) state.stepMeta[inst.id][s] = null;
            if (state.loopGridData) delete state.loopGridData[inst.id];
            state.selectedGroove[inst.id] = '';
            grooveSelect.value = '';
            if (targetArt) {
              audio.triggerInstrument(inst.id, targetArt, state.volumes[inst.id] ?? 1.0);
            }
            updateSingleCellDOM(cell, inst, s);
            if (inst.id === 'caixa' || inst.id === 'repique') {
              updateTrackRufadaTies(inst.id);
            }
            return { targetArt, brush };
          };

          cell.onmousedown = (e) => {
            if (e.button === 2) {
              // Botão direito: apaga célula e inicia arraste de borracha
              e.preventDefault();
              dragPaintState.active = true;
              dragPaintState.mode = 'erase';
              dragPaintState.instrumentId = inst.id;
              state.gridData[inst.id][s] = null;
              if (state.stepMeta[inst.id]) state.stepMeta[inst.id][s] = null;
              if (state.loopGridData) delete state.loopGridData[inst.id];
              state.selectedGroove[inst.id] = '';
              grooveSelect.value = '';
              updateSingleCellDOM(cell, inst, s);
              if (inst.id === 'caixa' || inst.id === 'repique') {
                updateTrackRufadaTies(inst.id);
              }
              return;
            }
            if (e.button !== 0) return;

            handledByMouseDown = true;
            const { targetArt, brush } = applyCellStroke();

            dragPaintState.active = true;
            dragPaintState.mode = (brush === 'erase' || !targetArt) ? 'erase' : 'paint';
            dragPaintState.instrumentId = inst.id;
            dragPaintState.brushArtId = targetArt || (brush !== 'cycle' && brush !== 'erase' ? brush : inst.articulations[0].id);
          };

          cell.onclick = (e) => {
            if (handledByMouseDown) {
              handledByMouseDown = false;
              return;
            }
            // Fallback para toque em telas mobile onde mousedown pode ser omitido após scroll
            e.preventDefault();
            applyCellStroke();
          };

          cell.onmouseenter = () => {
            if (!dragPaintState.active || dragPaintState.instrumentId !== inst.id) return;
            if (state.loopGridData) delete state.loopGridData[inst.id];
            if (dragPaintState.mode === 'erase') {
              if (state.gridData[inst.id][s] !== null) {
                state.gridData[inst.id][s] = null;
                updateSingleCellDOM(cell, inst, s);
                if (inst.id === 'caixa' || inst.id === 'repique') {
                  updateTrackRufadaTies(inst.id);
                }
              }
            } else if (dragPaintState.mode === 'paint' && dragPaintState.brushArtId) {
              if (state.gridData[inst.id][s] !== dragPaintState.brushArtId) {
                state.gridData[inst.id][s] = dragPaintState.brushArtId;
                audio.triggerInstrument(inst.id, dragPaintState.brushArtId, state.volumes[inst.id] ?? 1.0);
                updateSingleCellDOM(cell, inst, s);
                if (inst.id === 'caixa' || inst.id === 'repique') {
                  updateTrackRufadaTies(inst.id);
                }
              }
            }
          };

          cell.oncontextmenu = (e) => {
            e.preventDefault();
          };

          stepsContainer.appendChild(cell);
        }

        row.appendChild(header);
        row.appendChild(stepsContainer);
        tracksWrapper.appendChild(row);
      });

      updateTrackRufadaTies('caixa');
      updateTrackRufadaTies('repique');
      updatePrintDetails();

      const wanted = padFocus.inst && tracksWrapper.querySelector(`.step-cell[data-instrument="${padFocus.inst}"][data-step="${padFocus.step}"]`);
      (wanted || tracksWrapper.querySelector('.step-cell')).tabIndex = 0;
    }

    // Estado dos novos recursos: Contagem, Speed Trainer e Tap
    state.preRollEnabled = false;
    state.speedTrainerMode = 0; // 0 = off, 2 = +2 BPM, 4 = +4 BPM

    function runPreRollCountdown(onFinished) {
      audio.init();
      const overlay = document.getElementById('seqPreRollOverlay');
      const numDisplay = document.getElementById('seqPreRollNum');
      if (!overlay || !numDisplay) return onFinished();

      const totalBeats = 4;
      const beatDurMs = (60 / state.bpm) * 1000;
      let currentBeat = 1;

      overlay.style.display = 'flex';
      numDisplay.textContent = currentBeat;
      audio.playPreRollClick(currentBeat, currentBeat === 1);
      if (navigator.vibrate) navigator.vibrate(25);

      const countTimer = setInterval(() => {
        currentBeat++;
        if (currentBeat <= totalBeats) {
          numDisplay.textContent = currentBeat;
          audio.playPreRollClick(currentBeat, false);
          if (navigator.vibrate) navigator.vibrate(15);
        } else {
          clearInterval(countTimer);
          overlay.style.display = 'none';
          onFinished();
        }
      }, beatDurMs);
    }

    // --- Screen Wake Lock API (Impede que a tela apague em ensaios e gravações) ---
    let screenWakeLockSentinel = null;
    async function requestScreenWakeLock() {
      try {
        if ('wakeLock' in navigator && !screenWakeLockSentinel && document.visibilityState === 'visible') {
          screenWakeLockSentinel = await navigator.wakeLock.request('screen');
          screenWakeLockSentinel.addEventListener('release', () => {
            screenWakeLockSentinel = null;
          });
        }
      } catch (err) {
        console.debug('WakeLock não pôde ser ativado:', err);
      }
    }

    async function releaseScreenWakeLock() {
      try {
        if (screenWakeLockSentinel) {
          await screenWakeLockSentinel.release();
          screenWakeLockSentinel = null;
        }
      } catch (err) {
        console.debug('WakeLock release erro:', err);
      }
    }

    window.requestScreenWakeLock = requestScreenWakeLock;
    window.releaseScreenWakeLock = releaseScreenWakeLock;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const isStudioPlaying = window.BeatboxStudio && typeof window.BeatboxStudio.getProjectSummary === 'function' && window.BeatboxStudio.getProjectSummary().isPlaying;
        if (state.isPlaying || isStudioPlaying) {
          requestScreenWakeLock();
        }
      }
    });

    async function shareBrequeLink() {
      try {
        const payload = {
          v: '2',
          b: state.bpm,
          m: state.meter,
          s: state.subdivision,
          c: state.measures,
          vol: state.volumes,
          t: state.beatTuplets,
          g: state.gridData
        };
        const jsonStr = JSON.stringify(payload);
        const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
        const shareUrl = `${window.location.origin}${window.location.pathname}#breque=${b64}`;
        const brequeTitle = state.activeBrequeName || 'Breque de Bateria';

        if (navigator.share) {
          try {
            await navigator.share({
              title: `${brequeTitle} — Naumteria Studio`,
              text: `Ouça e ensaie este breque no Naumteria Studio (${state.bpm} BPM, ${state.meter}):`,
              url: shareUrl
            });
            showShareToast('✅ Breque compartilhado com sucesso!');
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
          }
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            showShareToast('✅ Link do breque copiado! Cole no WhatsApp da bateria.');
          }).catch(() => {
            window.appPrompt('Copie o link abaixo para enviar:', shareUrl, 'Link do breque');
          });
        } else {
          window.appPrompt('Copie o link abaixo para enviar:', shareUrl, 'Link do breque');
        }
      } catch (e) {
        window.appAlert('Erro ao gerar link de compartilhamento: ' + e.message);
      }
    }

    function showShareToast(msg) {
      const toast = document.getElementById('shareToast');
      const text = document.getElementById('shareToastText');
      if (!toast || !text) return;
      text.textContent = msg;
      toast.style.display = 'flex';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 4000);
    }

    function checkSharedBrequeUrl() {
      const hash = window.location.hash;
      if (!hash || !hash.startsWith('#breque=')) return;
      try {
        const b64 = hash.substring(8);
        const jsonStr = decodeURIComponent(escape(atob(b64)));
        const data = JSON.parse(jsonStr);
        if (!data || !data.g || typeof data.g !== 'object' || Array.isArray(data.g)) return;
        const gridIsValid = Object.values(data.g).every(row => row === null || Array.isArray(row));
        if (!gridIsValid) return;

        // Salva o breque aberto e se desliga dele antes de aplicar o link,
        // para que o conteúdo recebido nunca seja gravado por cima do trabalho do usuário.
        if (typeof window.flushBrequeAutosave === 'function') window.flushBrequeAutosave();
        state.activeBrequeId = null;
        state.activeBrequeName = 'Breque compartilhado';
        updateHeaderBrequeTitle();

        const clampNum = (v, min, max, fallback) => {
          const n = Number(v);
          return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
        };
        const slider = document.getElementById('bpmSlider');
        const bpmMin = slider ? Number(slider.min) || 80 : 80;
        const bpmMax = slider ? Number(slider.max) || 170 : 170;
        state.bpm = clampNum(data.b, bpmMin, bpmMax, 120);
        state.meter = typeof data.m === 'string' ? data.m : '2/4';
        state.subdivision = typeof data.s === 'string' ? data.s : 'semicolcheia';
        state.measures = clampNum(data.c, 1, 32, 4);
        if (data.vol && typeof data.vol === 'object') state.volumes = { ...state.volumes, ...data.vol };
        state.beatTuplets = data.t && typeof data.t === 'object' ? { ...data.t } : {};
        state.gridData = data.g;
        // Nada do breque anterior pode vazar para o compartilhado.
        state.stepMeta = {};
        state.loopGridData = {};
        state.selectedGroove = {};
        // O Estúdio também se desliga do breque anterior (sessão própria para o link).
        if (window.BeatboxStudio && typeof window.BeatboxStudio.loadBrequeProject === 'function') {
          window.BeatboxStudio.loadBrequeProject('shared_breque', state.bpm).catch(err => console.warn(err));
        }

        const disp = document.getElementById('bpmDisplay');
        if (slider) slider.value = state.bpm;
        if (disp) disp.textContent = state.bpm;
        const meterSel = document.getElementById('meterSelect');
        if (meterSel) meterSel.value = state.meter;
        const subdivSel = document.getElementById('subdivSelect');
        if (subdivSel) subdivSel.value = state.subdivision;
        const measDisp = document.getElementById('measureCountDisplay');
        if (measDisp) measDisp.textContent = `${state.measures} Compassos`;

        switchTab('tab-sequencer');
        renderStudio();
        showShareToast('Breque compartilhado aberto. Use "Salvar" para guardar em Meus Breques.');
      } catch (err) {
        console.warn('Erro ao carregar breque via hash:', err);
      }
    }
    window.addEventListener('hashchange', checkSharedBrequeUrl);

    let tapTimes = [];
    function handleTap(isStudio = false) {
      const now = performance.now();
      tapTimes = tapTimes.filter(t => now - t < 2500);
      tapTimes.push(now);

      if (navigator.vibrate) navigator.vibrate(18);

      if (tapTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
          intervals.push(tapTimes[i] - tapTimes[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const newBpm = Math.min(200, Math.max(60, Math.round(60000 / avgInterval)));

        if (isStudio) {
          const studioBpmInput = document.getElementById('studioBpm');
          if (studioBpmInput) {
            studioBpmInput.value = newBpm;
            studioBpmInput.dispatchEvent(new Event('input'));
          }
        } else {
          state.bpm = newBpm;
          const bpmSlider = document.getElementById('bpmSlider');
          const bpmDisplay = document.getElementById('bpmDisplay');
          if (bpmSlider) bpmSlider.value = newBpm;
          if (bpmDisplay) bpmDisplay.textContent = newBpm;
          updatePrintDetails();
        }
      }
    }

    function computeNextCycledArticulation(inst, stepIndex) {
      const current = state.gridData[inst.id][stepIndex];
      const arts = inst.articulations;
      if (!current) return arts[0].id;
      const idx = arts.findIndex(a => a.id === current);
      if (idx !== -1 && idx < arts.length - 1) {
        return arts[idx + 1].id;
      }
      return null;
    }
