    /* =========================================================================
       3. ESTADO DA APLICAÇÃO E SEQUENCIADOR
       ========================================================================= */
    const audio = new SambaAudioEngine();
    // O soundbank é carregado com defer (executa antes do DOMContentLoaded), então o pré-carregamento espera por ele.
    window.addEventListener('DOMContentLoaded', () => audio.preloadSamples());

    const state = {
      bpm: 120,
      meter: '2/4',
      subdivision: 'semicolcheia',
      measures: 4,
      metronomeEnabled: false,
      isPlaying: false,
      currentStep: 0,
      loopCount: 0,
      timerId: null,
      nextNoteTime: 0,
      mutes: {},
      solos: {},
      volumes: {},        // 0.0 a 1.5 por instrumento
      selectedBrush: {},  // 'cycle' ou id fixo da articulação por instrumento
      selectedGroove: {}, // última levada selecionada por instrumento
      gridData: {},
      loopGridData: {},
      stepMeta: {},       // metadados opcionais por step (ex: { tipo: 'acento'|'medio', vel: 0-127 })
      beatTuplets: {}     // mapa { [globalBeatIdx]: 3 | 6 } para tempos em Tercina (3) ou Sextina (6)
    };

    function computeStepVelMultiplier(noteId, meta) {
      if (!meta || typeof meta.vel !== 'number') return 1.0;
      if (meta.tipo === 'acento' || noteId === 'forte') {
        return meta.vel / 120; // 125 -> 1.04, 120 -> 1.0, 115 -> 0.96, 110 -> 0.92
      }
      if (meta.tipo === 'medio' || noteId === 'fraco') {
        return meta.vel / 70;  // 75 -> 1.07, 70 -> 1.0, 65 -> 0.93 sobre o sample fantasma (sn_2e)
      }
      return meta.vel / 100;
    }

    // Estado de Pintura Arrastando (Click & Drag Paint)
    const dragPaintState = {
      active: false,
      mode: null,         // 'paint' | 'erase'
      instrumentId: null,
      brushArtId: null
    };

    window.addEventListener('mouseup', () => {
      dragPaintState.active = false;
      dragPaintState.mode = null;
      dragPaintState.instrumentId = null;
      dragPaintState.brushArtId = null;
    });

    function normalizeArticulationId(instId, artId) {
      if (!artId) return null;
      if (instId === 'ganza') {
        if (artId === 'frente') return 'forte';
        if (artId === 'tras') return 'fraco';
      }
      if (instId === 'repique' && (artId === 'slap' || artId === 'flam' || artId === 'rulo')) {
        return null;
      }
      return artId;
    }

    function getStepsPerMeasure() {
      const beats = state.meter === '2/4' ? 2 : 4;
      if (state.subdivision === 'fusa') return beats * 8;
      return beats * 4;
    }

    function getTotalSteps() {
      return state.measures * getStepsPerMeasure();
    }

    function getBeatTuplet(globalBeatIdx) {
      const raw = state.beatTuplets?.[globalBeatIdx];
      if (!raw) return null;
      if (raw === 6 && state.subdivision !== 'fusa') return 3;
      return raw === 3 || raw === 6 ? raw : null;
    }

    function getActiveStepsInBeat(globalBeatIdx) {
      const stepsPerBeat = state.subdivision === 'fusa' ? 8 : 4;
      return getBeatTuplet(globalBeatIdx) || stepsPerBeat;
    }

    function getAllPlayableSteps(totalSteps) {
      const stepsPerMeasure = getStepsPerMeasure();
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const stepsPerBeat = stepsPerMeasure / beatsPerMeasure;
      const totalBeats = Math.floor(totalSteps / stepsPerBeat);
      const steps = [];
      for (let b = 0; b < totalBeats; b++) {
        const activeCount = getActiveStepsInBeat(b);
        for (let k = 0; k < activeCount; k++) {
          steps.push(b * stepsPerBeat + k);
        }
      }
      return steps;
    }

    function getRufadaRunInfo(activeGrid, stepIndex, totalSteps) {
      if (!activeGrid || activeGrid[stepIndex] !== 'rufado') {
        return { isRufado: false, isStart: false, durationSec: 0, count: 0 };
      }
      const playable = getAllPlayableSteps(totalSteps);
      const pIdx = playable.indexOf(stepIndex);
      if (pIdx === -1) {
        return { isRufado: false, isStart: false, durationSec: 0, count: 0 };
      }

      // Se o passo jogável anterior já era 'rufado', este passo NÃO é o início da nota estendida
      const prevIsRufado = pIdx > 0 && activeGrid[playable[pIdx - 1]] === 'rufado';
      if (prevIsRufado) {
        return { isRufado: true, isStart: false, durationSec: 0, count: 0 };
      }

      // Este passo é o início de uma sequência de rufadas (RF)!
      let count = 0;
      let durationSec = 0;
      for (let j = pIdx; j < playable.length; j++) {
        const s = playable[j];
        if (activeGrid[s] === 'rufado') {
          count++;
          durationSec += getStepDurationSec(s);
        } else {
          break;
        }
      }

      return { isRufado: true, isStart: true, durationSec, count };
    }

    function updateTrackRufadaTies(instId) {
      if (instId !== 'caixa' && instId !== 'repique') return;
      const totalSteps = getTotalSteps();
      const playable = getAllPlayableSteps(totalSteps);
      const arr = state.gridData[instId] || [];

      for (let i = 0; i < playable.length; i++) {
        const s = playable[i];
        const cell = document.querySelector(`.step-cell[data-instrument="${instId}"][data-step="${s}"]`);
        if (!cell) continue;
        cell.classList.remove('rf-tie-start', 'rf-tie-mid', 'rf-tie-end');

        if (arr[s] === 'rufado') {
          const prevIsRf = i > 0 && arr[playable[i - 1]] === 'rufado';
          const nextIsRf = i < playable.length - 1 && arr[playable[i + 1]] === 'rufado';

          if (nextIsRf && !prevIsRf) {
            cell.classList.add('rf-tie-start');
          } else if (prevIsRf && nextIsRf) {
            cell.classList.add('rf-tie-mid');
          } else if (prevIsRf && !nextIsRf) {
            cell.classList.add('rf-tie-end');
          }
        }
      }
    }

    function toggleBeatTuplet(globalBeatIdx) {
      if (!state.beatTuplets) state.beatTuplets = {};
      const stepsPerBeat = state.subdivision === 'fusa' ? 8 : 4;
      const beatStart = globalBeatIdx * stepsPerBeat;
      const current = getBeatTuplet(globalBeatIdx);

      if (state.loopGridData) {
        state.loopGridData = {};
      }

      if (state.subdivision === 'semicolcheia') {
        // Em Semicolcheia (4 por tempo): alterna Normal (4) <-> Tercina (3)
        if (!current) {
          state.beatTuplets[globalBeatIdx] = 3;
        } else {
          delete state.beatTuplets[globalBeatIdx];
        }
      } else {
        // Em Fusa (8 por tempo): alterna Normal (8) -> Tercina (3) -> Sextina (6) -> Normal (8)
        if (!current) {
          // Normal (8) -> Tercina (3): se só havia notas nas posições pares (0, 2, 4), agrupa-as em (0, 1, 2)
          INSTRUMENTS.forEach(inst => {
            const arr = state.gridData[inst.id];
            if (!arr) return;
            const hasOdd = arr[beatStart + 1] || arr[beatStart + 3] || arr[beatStart + 5];
            if (!hasOdd && (arr[beatStart + 2] || arr[beatStart + 4])) {
              const n0 = arr[beatStart + 0];
              const n1 = arr[beatStart + 2];
              const n2 = arr[beatStart + 4];
              arr[beatStart + 0] = n0;
              arr[beatStart + 1] = n1;
              arr[beatStart + 2] = n2;
              for (let k = 3; k < 8; k++) arr[beatStart + k] = null;
            }
          });
          state.beatTuplets[globalBeatIdx] = 3;
        } else if (current === 3) {
          // Tercina (3) -> Sextina (6): espaça as 3 notas (0, 1, 2) para (0, 2, 4) mantendo o ritmo exato
          INSTRUMENTS.forEach(inst => {
            const arr = state.gridData[inst.id];
            if (!arr) return;
            const n0 = arr[beatStart + 0];
            const n1 = arr[beatStart + 1];
            const n2 = arr[beatStart + 2];
            arr[beatStart + 0] = n0;
            arr[beatStart + 1] = null;
            arr[beatStart + 2] = n1;
            arr[beatStart + 3] = null;
            arr[beatStart + 4] = n2;
            arr[beatStart + 5] = null;
          });
          state.beatTuplets[globalBeatIdx] = 6;
        } else {
          delete state.beatTuplets[globalBeatIdx];
        }
      }

      renderStudio();
    }

    function rescaleArrayForSubdivisionChange(arr, fromSubdiv, toSubdiv) {
      if (!Array.isArray(arr) || fromSubdiv === toSubdiv) return arr;
      if (fromSubdiv === 'semicolcheia' && toSubdiv === 'fusa') {
        const totalBeats = Math.floor(arr.length / 4);
        const out = new Array(arr.length * 2).fill(null);
        for (let b = 0; b < totalBeats; b++) {
          const oldStart = b * 4;
          const newStart = b * 8;
          const tuplet = state.beatTuplets?.[b];
          if (tuplet === 3) {
            // Mantém as 3 notas da tercina nas 3 células da tercina (0, 1, 2)
            out[newStart + 0] = arr[oldStart + 0] ?? null;
            out[newStart + 1] = arr[oldStart + 1] ?? null;
            out[newStart + 2] = arr[oldStart + 2] ?? null;
          } else {
            for (let i = 0; i < 4; i++) {
              out[newStart + i * 2] = arr[oldStart + i] ?? null;
            }
          }
        }
        return out;
      }
      if (fromSubdiv === 'fusa' && toSubdiv === 'semicolcheia') {
        const totalBeats = Math.floor(arr.length / 8);
        const out = new Array(Math.max(1, totalBeats * 4)).fill(null);
        for (let b = 0; b < totalBeats; b++) {
          const oldStart = b * 8;
          const newStart = b * 4;
          const tuplet = state.beatTuplets?.[b];
          if (tuplet === 3) {
            out[newStart + 0] = arr[oldStart + 0] ?? null;
            out[newStart + 1] = arr[oldStart + 1] ?? null;
            out[newStart + 2] = arr[oldStart + 2] ?? null;
          } else if (tuplet === 6) {
            // Converte Sextina (6) para Tercina (3) ao voltar para Semicolcheia
            for (let k = 0; k < 3; k++) {
              out[newStart + k] = (arr[oldStart + k * 2] !== null && arr[oldStart + k * 2] !== undefined)
                ? arr[oldStart + k * 2]
                : (arr[oldStart + k * 2 + 1] ?? null);
            }
          } else {
            for (let i = 0; i < 4; i++) {
              out[newStart + i] = (arr[oldStart + i * 2] !== null && arr[oldStart + i * 2] !== undefined)
                ? arr[oldStart + i * 2]
                : (arr[oldStart + i * 2 + 1] ?? null);
            }
          }
        }
        return out;
      }
      return arr;
    }

    function changeSubdivisionAndRescaleNotes(newSubdiv) {
      const prevSubdiv = state.subdivision;
      if (!newSubdiv || prevSubdiv === newSubdiv) return;

      INSTRUMENTS.forEach(inst => {
        if (Array.isArray(state.gridData[inst.id])) {
          state.gridData[inst.id] = rescaleArrayForSubdivisionChange(state.gridData[inst.id], prevSubdiv, newSubdiv);
        }
        if (state.loopGridData && Array.isArray(state.loopGridData[inst.id])) {
          state.loopGridData[inst.id] = rescaleArrayForSubdivisionChange(state.loopGridData[inst.id], prevSubdiv, newSubdiv);
        }
        if (state.stepMeta && Array.isArray(state.stepMeta[inst.id])) {
          state.stepMeta[inst.id] = rescaleArrayForSubdivisionChange(state.stepMeta[inst.id], prevSubdiv, newSubdiv);
        }
      });

      if (prevSubdiv === 'fusa' && newSubdiv === 'semicolcheia' && state.beatTuplets) {
        Object.keys(state.beatTuplets).forEach(b => {
          if (state.beatTuplets[b] === 6) {
            state.beatTuplets[b] = 3;
          }
        });
      }

      state.subdivision = newSubdiv;
    }

    function updateSubdivSelectLabels() {
      const subdivSelect = document.getElementById('subdivSelect');
      if (!subdivSelect) return;
      subdivSelect.value = state.subdivision;
    }

    function initGridData() {
      const totalSteps = getTotalSteps();
      INSTRUMENTS.forEach(inst => {
        if (state.volumes[inst.id] === undefined) {
          state.volumes[inst.id] = 1.0;
        }
        if (!state.selectedBrush[inst.id]) {
          state.selectedBrush[inst.id] = 'cycle';
        }
        if (!state.gridData[inst.id]) {
          state.gridData[inst.id] = new Array(totalSteps).fill(null);
        } else {
          const current = state.gridData[inst.id].map(a => normalizeArticulationId(inst.id, a));
          if (current.length < totalSteps) {
            state.gridData[inst.id] = current.concat(new Array(totalSteps - current.length).fill(null));
          } else if (current.length > totalSteps) {
            state.gridData[inst.id] = current.slice(0, totalSteps);
          } else {
            state.gridData[inst.id] = current;
          }
        }
        if (!state.stepMeta[inst.id]) {
          state.stepMeta[inst.id] = new Array(totalSteps).fill(null);
        } else if (state.stepMeta[inst.id].length < totalSteps) {
          state.stepMeta[inst.id] = state.stepMeta[inst.id].concat(new Array(totalSteps - state.stepMeta[inst.id].length).fill(null));
        } else if (state.stepMeta[inst.id].length > totalSteps) {
          state.stepMeta[inst.id] = state.stepMeta[inst.id].slice(0, totalSteps);
        }
      });
    }

    const CUSTOM_GROOVES_STORAGE_KEY = 'naumteria_custom_grooves_v1';

    const DEFAULT_CUSTOM_GROOVES = {
      surdo1: [
        {
          id: 'levada_base_custom',
          name: '⭐ Levada Base (Salva)',
          pattern: [
            'abafado', null, null, null, 'aberto', null, null, null,
            'abafado', null, null, null, 'aberto', null, null, null,
            'abafado', null, null, null, 'aberto', null, null, null,
            'abafado', null, null, null, 'aberto', null, null, null
          ],
          savedSubdivision: 'semicolcheia',
          isCustom: true
        }
      ],
      surdo2: [
        {
          id: 'levada_base_custom',
          name: '⭐ Levada Base (Salva)',
          pattern: [
            'aberto', null, null, null, 'abafado', null, null, null,
            'aberto', null, null, null, 'abafado', null, null, null,
            'aberto', null, null, null, 'abafado', null, null, null,
            'aberto', null, null, null, 'abafado', null, null, null
          ],
          savedSubdivision: 'semicolcheia',
          isCustom: true
        }
      ],
      surdo3: [
        {
          id: 'levada_base_custom',
          name: '⭐ Levada Base (Salva)',
          pattern: [
            'corte', null, null, null, 'aberto', null, 'aberto', null,
            'corte', null, null, null, 'aberto', 'aberto', null, 'aberto',
            'corte', null, null, null, 'aberto', null, 'aberto', null,
            'corte', null, 'aberto', null, 'corte', 'aberto', 'corte', 'aberto'
          ],
          savedSubdivision: 'semicolcheia',
          isCustom: true
        }
      ],
      caixa: [
        {
          id: 'levada_base_custom',
          name: '⭐ Levada Base (Salva)',
          pattern: [
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'forte', 'fraco',
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'rufado', 'rufado', 'fraco',
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'forte', 'fraco',
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'rufado', 'fraco', 'fraco'
          ],
          savedSubdivision: 'semicolcheia',
          isCustom: true
        }
      ],
      repique: [
        {
          id: 'levada_base_custom',
          name: '⭐ Levada Base (Salva)',
          pattern: [
            'meio', 'intermedio', 'ringshot', 'open', 'meio', 'intermedio', 'ringshot', 'open',
            'meio', 'intermedio', 'ringshot', 'open', 'meio', 'intermedio', 'ringshot', 'open',
            'meio', 'intermedio', 'ringshot', 'open', 'meio', 'intermedio', 'ringshot', 'open',
            'meio', 'intermedio', 'ringshot', 'open', 'meio', 'intermedio', 'ringshot', 'open'
          ],
          savedSubdivision: 'semicolcheia',
          isCustom: true
        }
      ],
      tamborim: [
        {
          id: 'levada_base_custom',
          name: '⭐ Levada Base (Salva)',
          pattern: [
            'forte', 'medio', 'fraco', 'medio', 'forte', 'medio', 'fraco', 'medio',
            'forte', 'medio', 'fraco', 'medio', 'forte', 'medio', 'fraco', 'medio',
            'forte', 'medio', 'fraco', 'medio', 'forte', 'medio', 'fraco', 'medio',
            'forte', 'medio', 'fraco', 'medio', 'forte', 'medio', 'fraco', 'medio'
          ],
          savedSubdivision: 'semicolcheia',
          isCustom: true
        }
      ],
      agogo: [
        {
          id: 'levada_base_custom',
          name: '⭐ Levada Base (Salva)',
          pattern: [
            'boca1', null, null, 'boca1', 'boca3', null, 'boca4', null,
            'boca3', null, 'boca3', null, 'boca2', 'boca2', null, 'boca1',
            null, 'boca1', null, 'boca1', 'boca3', null, 'boca4', null,
            'boca3', null, 'boca3', null, 'boca2', 'boca2', null, 'boca1'
          ],
          savedSubdivision: 'semicolcheia',
          isCustom: true
        }
      ],
      ganza: [
        {
          id: 'levada_base_custom',
          name: '⭐ Levada Base (Salva)',
          pattern: [
            'forte', 'fraco', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'fraco',
            'forte', 'fraco', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'fraco',
            'forte', 'fraco', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'fraco',
            'forte', 'fraco', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'fraco'
          ],
          savedSubdivision: 'semicolcheia',
          isCustom: true
        }
      ]
    };

    function loadCustomGroovesFromStorage() {
      try {
        const raw = localStorage.getItem(CUSTOM_GROOVES_STORAGE_KEY);
        let parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || Object.keys(parsed).length === 0) {
          parsed = JSON.parse(JSON.stringify(DEFAULT_CUSTOM_GROOVES));
          saveCustomGroovesToStorage(parsed);
          return parsed;
        }

        // Reúne qualquer levada que tenha sido separada anteriormente em introPattern + loop
        // garantindo que o que está no pad seja exatamente o que toca contínua e uniformemente
        let modified = false;
        Object.keys(parsed).forEach(instId => {
          if (Array.isArray(parsed[instId])) {
            parsed[instId].forEach(g => {
              if (Array.isArray(g.introPattern) && g.introPattern.length > 0) {
                g.pattern = [...g.introPattern, ...(g.pattern || [])];
                delete g.introPattern;
                modified = true;
              } else if (g.introPattern !== undefined) {
                delete g.introPattern;
                modified = true;
              }
            });
          }
        });

        // Garante que todos os 8 instrumentos possuam a levada base salva como padrão
        Object.keys(DEFAULT_CUSTOM_GROOVES).forEach(instId => {
          if (!Array.isArray(parsed[instId]) || parsed[instId].length === 0) {
            parsed[instId] = JSON.parse(JSON.stringify(DEFAULT_CUSTOM_GROOVES[instId]));
            modified = true;
          }
        });

        if (modified) {
          saveCustomGroovesToStorage(parsed);
        }
        return parsed;
      } catch (e) {
        return JSON.parse(JSON.stringify(DEFAULT_CUSTOM_GROOVES));
      }
    }

    function saveCustomGroovesToStorage(customGroovesObj) {
      try {
        localStorage.setItem(CUSTOM_GROOVES_STORAGE_KEY, JSON.stringify(customGroovesObj));
      } catch (e) {
        console.warn('Erro ao salvar levadas personalizadas no localStorage:', e);
      }
    }

    const customGrooves = loadCustomGroovesFromStorage();

    function getInstrumentGrooves(instId) {
      const userList = Array.isArray(customGrooves[instId]) ? customGrooves[instId] : [];
      const baseList = INSTRUMENT_GROOVES[instId] || [];
      return [...userList, ...baseList];
    }

    function convertPatternResolution(srcPattern, savedSubdivision = 'semicolcheia') {
      if (!srcPattern || srcPattern.length === 0) return [];
      const currentIsFusa = state.subdivision === 'fusa';
      const savedWasFusa = savedSubdivision === 'fusa';
      if (currentIsFusa === savedWasFusa) return srcPattern.slice();

      if (currentIsFusa && !savedWasFusa) {
        const out = new Array(srcPattern.length * 2).fill(null);
        for (let i = 0; i < srcPattern.length; i++) {
          out[i * 2] = srcPattern[i] || null;
        }
        return out;
      }

      const outLen = Math.max(1, Math.floor(srcPattern.length / 2));
      const out = new Array(outLen).fill(null);
      for (let i = 0; i < outLen; i++) {
        out[i] = srcPattern[i * 2] || null;
      }
      return out;
    }

    /* Expande o padrão na grade de forma uniforme em todos os compassos, exatamente como desenhado */
    function expandPatternToGrid(pattern, targetTotalSteps, stepsPerMeasure, savedSubdivision = 'semicolcheia') {
      const result = new Array(targetTotalSteps).fill(null);
      const loopConv = convertPatternResolution(pattern, savedSubdivision);
      if (loopConv.length === 0) return result;

      for (let s = 0; s < targetTotalSteps; s++) {
        result[s] = loopConv[s % loopConv.length] || null;
      }
      return result;
    }

    async function saveCurrentTrackAsGroove(inst, asMainBase = true, flashBtn = null) {
      const trackData = state.gridData[inst.id] || [];
      const hasAnyNote = trackData.some(n => n !== null);
      if (!hasAnyNote) {
        window.appAlert(`Desenhe os toques de ${inst.name} na grade antes de salvar a levada.`);
        return;
      }

      const stepsPerMeasure = getStepsPerMeasure();
      let lastActiveMeasure = 0;
      for (let m = 0; m < state.measures; m++) {
        const slice = trackData.slice(m * stepsPerMeasure, (m + 1) * stepsPerMeasure);
        if (slice.some(n => n !== null)) {
          lastActiveMeasure = m;
        }
      }

      const activeMeasuresCount = lastActiveMeasure + 1;
      const patternLength = activeMeasuresCount * stepsPerMeasure;
      const rawSlice = trackData.slice(0, patternLength);
      const extractedPattern = rawSlice;

      if (!Array.isArray(customGrooves[inst.id])) {
        customGrooves[inst.id] = [];
      }

      let grooveId = 'levada_base_custom';
      let grooveName = `Levada Base (${inst.name})`;

      if (!asMainBase) {
        const typed = await window.appPrompt(`Digite um nome para salvar esta levada de ${inst.name}:`, `Minha Levada (${inst.name})`, 'Salvar levada');
        if (!typed || !typed.trim()) return;
        grooveId = 'custom_' + Date.now();
        grooveName = typed.trim();
        customGrooves[inst.id].push({
          id: grooveId,
          name: grooveName,
          pattern: extractedPattern,
          savedSubdivision: state.subdivision,
          isCustom: true
        });
      } else {
        const existingIdx = customGrooves[inst.id].findIndex(g => g.id === 'levada_base_custom');
        const newObj = {
          id: 'levada_base_custom',
          name: '⭐ Levada Base (Salva)',
          pattern: extractedPattern,
          savedSubdivision: state.subdivision,
          isCustom: true
        };
        if (existingIdx !== -1) {
          customGrooves[inst.id][existingIdx] = newObj;
        } else {
          customGrooves[inst.id].unshift(newObj);
        }
      }

      saveCustomGroovesToStorage(customGrooves);

      // Copia o JSON da levada para a área de transferência e tenta salvar no servidor local (se em localhost)
      const groovePayload = JSON.stringify({
        instrument: inst.id,
        subdivision: state.subdivision,
        pattern: extractedPattern,
        allCustomGrooves: customGrooves
      }, null, 2);

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(groovePayload).catch(() => { });
      }
      fetch('/__save_custom_grooves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: groovePayload
      }).catch(() => { });

      // Aplica a levada recém-salva em todos os compassos ativos da grade
      applyInstrumentGroove(inst.id, grooveId);

      if (flashBtn) {
        const prevText = flashBtn.textContent;
        flashBtn.classList.add('saved-flash');
        flashBtn.textContent = '✓ Salva!';
        setTimeout(() => {
          flashBtn.classList.remove('saved-flash');
          flashBtn.textContent = prevText;
        }, 1400);
      }
    }

    async function applyInstrumentGroove(instId, grooveId) {
      if (grooveId === '__save_named__') {
        const inst = INSTRUMENTS.find(i => i.id === instId);
        if (inst) saveCurrentTrackAsGroove(inst, false, null);
        else renderStudio();
        return;
      }
      if (grooveId === '__clear_custom__') {
        if (await window.appConfirm('Deseja remover as levadas personalizadas deste instrumento e restaurar apenas as de fábrica?', 'Restaurar levadas', { isDanger: true, confirmText: 'Restaurar' })) {
          delete customGrooves[instId];
          saveCustomGroovesToStorage(customGrooves);
          state.selectedGroove[instId] = '';
          delete state.loopGridData[instId];
        }
        renderStudio();
        return;
      }

      const grooves = getInstrumentGrooves(instId);
      const found = grooves.find(g => g.id === grooveId);
      if (!found) return;

      audio.init();
      const sub = found.savedSubdivision || 'semicolcheia';
      const stepsPerMeasure = getStepsPerMeasure();
      const convertedRef = convertPatternResolution(found.pattern, sub);
      const neededMeasures = Math.ceil(convertedRef.length / stepsPerMeasure);
      if (state.measures < neededMeasures) {
        state.measures = neededMeasures;
        document.getElementById('measureCountDisplay').textContent = `${state.measures} Compassos`;
        initGridData();
      }
      const totalSteps = getTotalSteps();

      state.gridData[instId] = expandPatternToGrid(
        found.pattern,
        totalSteps,
        stepsPerMeasure,
        sub
      );

      delete state.loopGridData[instId];

      state.stepMeta[instId] = found.stepsMeta
        ? expandPatternToGrid(found.stepsMeta, totalSteps, stepsPerMeasure, 'semicolcheia')
        : new Array(totalSteps).fill(null);
      state.selectedGroove[instId] = grooveId;

      // Toca o primeiro toque ativo da levada como feedback imediato
      const srcFirst = found.pattern.find(n => n !== null);
      if (srcFirst) {
        audio.triggerInstrument(instId, srcFirst, state.volumes[instId] ?? 1.0);
      }
      renderStudio();
    }

    const CUSTOM_BATERIA_PRESETS_KEY = 'naumteria_custom_bateria_presets_v1';

    const SCHEMA_VERSION = 1;
    const SCHEMA_KEY = 'naumteria_schema_v';

    function loadCustomBateriaPresets() {
      let raw = null;
      try {
        raw = localStorage.getItem(CUSTOM_BATERIA_PRESETS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('presets não é um objeto');
        return parsed;
      } catch (e) {
        // JSON corrompido: guarda uma cópia antes que o próximo save sobrescreva os dados.
        try {
          if (raw && !localStorage.getItem(CUSTOM_BATERIA_PRESETS_KEY + '_bak')) {
            localStorage.setItem(CUSTOM_BATERIA_PRESETS_KEY + '_bak', raw);
          }
        } catch (e2) { /* sem espaço: nada a fazer */ }
        return {};
      }
    }
    window.loadCustomBateriaPresets = loadCustomBateriaPresets;

    let persistRequested = false;
    function saveCustomBateriaPresetsToStorage(obj) {
      try {
        localStorage.setItem(CUSTOM_BATERIA_PRESETS_KEY, JSON.stringify(obj));
        localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
        // Pede ao navegador que não apague os breques por falta de espaço (uma vez por sessão).
        if (!persistRequested && navigator.storage && typeof navigator.storage.persist === 'function') {
          persistRequested = true;
          navigator.storage.persist().catch(() => {});
        }
      } catch (e) {
        console.warn('Erro ao salvar presets de bateria:', e);
      }
    }
    window.saveCustomBateriaPresetsToStorage = saveCustomBateriaPresetsToStorage;

    function readRawGrooves() {
      try { return JSON.parse(localStorage.getItem(CUSTOM_GROOVES_STORAGE_KEY) || '{}') || {}; } catch (e) { return {}; }
    }

    // Backup geral: breques + levadas do usuário (as gravações do Estúdio ficam no navegador e não entram neste arquivo).
    function buildBackupData() {
      return {
        app: 'naumteria-studio',
        schema: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        presets: loadCustomBateriaPresets(),
        grooves: readRawGrooves(),
      };
    }
    function importBackupData(data) {
      if (!data || typeof data !== 'object' || data.schema !== SCHEMA_VERSION
        || !data.presets || typeof data.presets !== 'object' || Array.isArray(data.presets)) {
        return { ok: false, error: 'Arquivo de backup inválido ou de uma versão não suportada.' };
      }
      const current = loadCustomBateriaPresets();
      let added = 0;
      let updated = 0;
      for (const [id, p] of Object.entries(data.presets)) {
        if (!p || typeof p !== 'object' || Array.isArray(p) || typeof p.name !== 'string'
          || (p.gridData !== undefined && (!p.gridData || typeof p.gridData !== 'object'))) continue;
        if (!current[id]) { current[id] = p; added++; }
        else if ((p.updatedAt || 0) > (current[id].updatedAt || 0)) { current[id] = p; updated++; }
      }
      saveCustomBateriaPresetsToStorage(current);
      if (data.grooves && typeof data.grooves === 'object' && !Array.isArray(data.grooves)) {
        const g = readRawGrooves();
        for (const [instId, list] of Object.entries(data.grooves)) {
          if (!Array.isArray(list)) continue;
          g[instId] = g[instId] || [];
          list.forEach(item => { if (item && item.id && !g[instId].some(x => x.id === item.id)) g[instId].push(item); });
        }
        try { localStorage.setItem(CUSTOM_GROOVES_STORAGE_KEY, JSON.stringify(g)); } catch (e) { /* sem espaço */ }
      }
      customBateriaPresets = loadCustomBateriaPresets();
      try { const fresh = loadCustomGroovesFromStorage(); Object.keys(customGrooves).forEach(k => delete customGrooves[k]); Object.assign(customGrooves, fresh); } catch (e) { /* recarregado no próximo uso */ }
      return { ok: true, added, updated };
    }
    window.buildBackupData = buildBackupData;
    window.importBackupData = importBackupData;

    document.getElementById('btnExportAllBreques')?.addEventListener('click', () => {
      const data = buildBackupData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'naumteria-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      window.appToast(Object.keys(data.presets).length + ' breque(s) exportado(s).', 'info');
    });
    const inputImportBackup = document.getElementById('inputImportBackup');
    document.getElementById('btnImportBackup')?.addEventListener('click', () => inputImportBackup && inputImportBackup.click());
    inputImportBackup?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      let res;
      try { res = importBackupData(JSON.parse(await file.text())); } catch (err) { res = { ok: false, error: 'O arquivo não é um JSON válido.' }; }
      if (!res.ok) { window.appAlert(res.error, 'Importar backup'); return; }
      if (typeof renderHomeBrequesList === 'function') renderHomeBrequesList();
      window.appToast(res.added + ' novo(s), ' + res.updated + ' atualizado(s).', 'info');
    });

    let customBateriaPresets = loadCustomBateriaPresets();

    function updateBateriaPresetSelect() {
      const select = document.getElementById('bateriaPresetSelect');
      if (!select) return;
      select.innerHTML = '';

      const defOpt = document.createElement('option');
      defOpt.value = '';
      defOpt.disabled = true;
      defOpt.selected = true;
      defOpt.hidden = true;
      defOpt.textContent = 'Presets Bateria...';
      select.appendChild(defOpt);

      const nativeKeys = Object.keys(BATERIA_PRESETS);
      if (nativeKeys.length > 0) {
        const groupNative = document.createElement('optgroup');
        groupNative.label = 'Presets Nativos';
        nativeKeys.forEach(k => {
          const opt = document.createElement('option');
          opt.value = k;
          opt.textContent = `${BATERIA_PRESETS[k].name || k}`;
          groupNative.appendChild(opt);
        });
        select.appendChild(groupNative);
      }

      const customKeys = Object.keys(customBateriaPresets);
      if (customKeys.length > 0) {
        const groupCustom = document.createElement('optgroup');
        groupCustom.label = 'Meus Presets Salvos';
        customKeys.forEach(k => {
          const opt = document.createElement('option');
          opt.value = 'custom:' + k;
          opt.textContent = `${customBateriaPresets[k].name || k}`;
          groupCustom.appendChild(opt);
        });
        select.appendChild(groupCustom);
      }

      const groupActions = document.createElement('optgroup');
      groupActions.label = 'Ações';

      const saveOpt = document.createElement('option');
      saveOpt.value = '__save_bateria__';
      saveOpt.textContent = 'Salvar grade atual como Preset...';
      groupActions.appendChild(saveOpt);

      if (customKeys.length > 0) {
        const clearOpt = document.createElement('option');
        clearOpt.value = '__clear_custom_bateria__';
        clearOpt.textContent = 'Excluir meus presets salvos';
        groupActions.appendChild(clearOpt);
      }

      select.appendChild(groupActions);
    }

    function applyBateriaPresetObject(preset) {
      if (!preset) return;
      audio.init();

      if (preset.bpm) {
        state.bpm = preset.bpm;
        document.getElementById('bpmSlider').value = state.bpm;
        document.getElementById('bpmDisplay').textContent = state.bpm;
      }
      if (preset.meter) {
        state.meter = preset.meter;
        const meterSel = document.getElementById('meterSelect');
        if (meterSel) meterSel.value = state.meter;
      }
      if (preset.subdivision) {
        state.subdivision = preset.subdivision;
        const subdivSel = document.getElementById('subdivSelect');
        if (subdivSel) subdivSel.value = state.subdivision;
      }
      if (preset.measures && state.measures !== preset.measures) {
        state.measures = preset.measures;
        document.getElementById('measureCountDisplay').textContent = `${state.measures} Compassos`;
      }
      if (preset.volumes && typeof preset.volumes === 'object') {
        state.volumes = { ...state.volumes, ...preset.volumes };
      }
      state.beatTuplets = preset.beatTuplets ? { ...preset.beatTuplets } : {};

      const totalSteps = getTotalSteps();
      const stepsPerMeasure = getStepsPerMeasure();
      const srcTracks = preset.tracks || preset.gridData || null;

      INSTRUMENTS.forEach(inst => {
        const trackPattern = srcTracks ? srcTracks[inst.id] : null;
        if (trackPattern) {
          state.gridData[inst.id] = expandPatternToGrid(trackPattern, totalSteps, stepsPerMeasure, preset.subdivision || state.subdivision || 'semicolcheia');
        } else {
          state.gridData[inst.id] = new Array(totalSteps).fill(null);
        }
        delete state.loopGridData[inst.id];

        const metaPattern = preset.tracksMeta ? preset.tracksMeta[inst.id] : (preset.stepMeta ? preset.stepMeta[inst.id] : null);
        if (metaPattern) {
          state.stepMeta[inst.id] = expandPatternToGrid(metaPattern, totalSteps, stepsPerMeasure, preset.subdivision || state.subdivision || 'semicolcheia');
        } else {
          state.stepMeta[inst.id] = new Array(totalSteps).fill(null);
        }
        state.selectedGroove[inst.id] = preset.selectedGroove?.[inst.id] || null;
      });

      renderStudio();
    }

    function applyBateriaPreset(presetId) {
      if (!presetId) return;
      if (presetId.startsWith('custom:')) {
        const id = presetId.replace('custom:', '');
        applyBateriaPresetObject(customBateriaPresets[id]);
      } else if (BATERIA_PRESETS[presetId]) {
        applyBateriaPresetObject(BATERIA_PRESETS[presetId]);
      }
    }

    async function saveCurrentBateriaAsPreset() {
      const hasAnyNote = INSTRUMENTS.some(inst =>
        (state.gridData[inst.id] || []).some(n => n !== null)
      );
      if (!hasAnyNote) {
        window.appAlert('Desenhe os toques dos instrumentos na grade antes de salvar o preset da bateria.');
        return;
      }

      const typed = await window.appPrompt('Digite o nome deste Preset de Bateria:', 'Novo Preset de Bateria', 'Salvar preset');
      if (!typed || !typed.trim()) return;

      const presetName = typed.trim();
      const presetId = 'preset_' + Date.now();

      const tracks = {};
      const tracksMeta = {};

      INSTRUMENTS.forEach(inst => {
        const data = state.gridData[inst.id] || [];
        tracks[inst.id] = data.slice();
        if (state.stepMeta && state.stepMeta[inst.id]) {
          tracksMeta[inst.id] = state.stepMeta[inst.id].slice();
        }
      });

      const newPreset = {
        id: presetId,
        name: presetName,
        measures: state.measures,
        bpm: state.bpm,
        meter: state.meter,
        subdivision: state.subdivision,
        beatTuplets: state.beatTuplets && Object.keys(state.beatTuplets).length > 0 ? { ...state.beatTuplets } : undefined,
        tracks,
        tracksMeta: Object.keys(tracksMeta).length > 0 ? tracksMeta : undefined
      };

      customBateriaPresets[presetId] = newPreset;
      saveCustomBateriaPresetsToStorage(customBateriaPresets);
      updateBateriaPresetSelect();
      document.getElementById('bateriaPresetSelect').value = 'custom:' + presetId;

      const jsonStr = JSON.stringify(newPreset, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonStr).catch(() => { });
      }

      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = presetName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      a.href = url;
      a.download = `bateria_preset_${safeName}.json`;
      a.click();
      URL.revokeObjectURL(url);

      window.appAlert(`Preset "${presetName}" salvo com sucesso!

O arquivo JSON foi baixado e também copiado para a Área de Transferência para você me enviar.`);
    }

    function duplicateMeasure(measureIndex) {
      const stepsPerMeasure = getStepsPerMeasure();
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const srcStart = measureIndex * stepsPerMeasure;

      // Se for o último compasso, adiciona +1 compasso automaticamente para colar a cópia
      if (measureIndex === state.measures - 1) {
        state.measures++;
        document.getElementById('measureCountDisplay').textContent = `${state.measures} Compassos`;
        initGridData();
      }

      const dstStart = (measureIndex + 1) * stepsPerMeasure;
      INSTRUMENTS.forEach(inst => {
        for (let i = 0; i < stepsPerMeasure; i++) {
          state.gridData[inst.id][dstStart + i] = state.gridData[inst.id][srcStart + i];
          state.stepMeta[inst.id][dstStart + i] = state.stepMeta[inst.id]?.[srcStart + i] || null;
        }
      });

      if (!state.beatTuplets) state.beatTuplets = {};
      for (let b = 0; b < beatsPerMeasure; b++) {
        const srcBeat = measureIndex * beatsPerMeasure + b;
        const dstBeat = (measureIndex + 1) * beatsPerMeasure + b;
        if (state.beatTuplets[srcBeat]) {
          state.beatTuplets[dstBeat] = state.beatTuplets[srcBeat];
        } else {
          delete state.beatTuplets[dstBeat];
        }
      }

      renderStudio();
    }

    function clearMeasure(measureIndex) {
      const stepsPerMeasure = getStepsPerMeasure();
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const start = measureIndex * stepsPerMeasure;
      INSTRUMENTS.forEach(inst => {
        for (let i = 0; i < stepsPerMeasure; i++) {
          state.gridData[inst.id][start + i] = null;
          if (state.stepMeta[inst.id]) state.stepMeta[inst.id][start + i] = null;
        }
      });
      if (state.beatTuplets) {
        for (let b = 0; b < beatsPerMeasure; b++) {
          delete state.beatTuplets[measureIndex * beatsPerMeasure + b];
        }
      }
      renderStudio();
    }
