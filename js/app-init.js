    /* =========================================================================
       8. EVENT LISTENERS E INICIALIZAÇÃO
       ========================================================================= */
    document.getElementById('btnPlay').onclick = () => {
      if (state.isPlaying) {
        stopPlayback();
      } else {
        if (state.preRollEnabled) {
          runPreRollCountdown(() => startPlayback());
        } else {
          startPlayback();
        }
      }
    };

    document.getElementById('btnStop').onclick = stopPlayback;

    document.getElementById('bpmSlider').oninput = (e) => {
      state.bpm = parseInt(e.target.value, 10);
      document.getElementById('bpmDisplay').textContent = state.bpm;
      updatePrintDetails();
    };

    document.getElementById('meterSelect').onchange = (e) => {
      state.meter = e.target.value;
      stopPlayback();
      renderStudio();
    };

    document.getElementById('subdivSelect').onchange = (e) => {
      changeSubdivisionAndRescaleNotes(e.target.value);
      stopPlayback();
      renderStudio();
    };

    document.getElementById('btnAddMeasure').onclick = () => {
      state.measures++;
      document.getElementById('measureCountDisplay').textContent = `${state.measures} Compassos`;
      stopPlayback();
      initGridData();
      const totalSteps = getTotalSteps();
      const stepsPerMeasure = getStepsPerMeasure();
      INSTRUMENTS.forEach(inst => {
        const gId = state.selectedGroove[inst.id];
        if (gId) {
          const groove = getInstrumentGrooves(inst.id).find(g => g.id === gId);
          if (groove && groove.pattern) {
            const patSubdiv = groove.subdiv || 'semicolcheia';
            state.gridData[inst.id] = expandPatternToGrid(groove.pattern, totalSteps, stepsPerMeasure, patSubdiv);
          }
        }
      });
      renderStudio();
    };

    document.getElementById('btnRemoveMeasure').onclick = () => {
      if (state.measures > 1) {
        state.measures--;
        document.getElementById('measureCountDisplay').textContent = `${state.measures} Compassos`;
        stopPlayback();
        renderStudio();
      }
    };

    document.getElementById('btnMetronome').onclick = () => {
      state.metronomeEnabled = !state.metronomeEnabled;
      const btnMet = document.getElementById('btnMetronome');
      btnMet.classList.toggle('active', state.metronomeEnabled);
      btnMet.setAttribute('aria-pressed', String(state.metronomeEnabled));
      btnMet.style.borderColor = state.metronomeEnabled ? 'var(--naum-gold)' : 'var(--border-color)';
      btnMet.style.background = state.metronomeEnabled ? 'var(--naum-gold-muted)' : 'var(--bg-card)';
      btnMet.style.color = state.metronomeEnabled ? 'var(--naum-gold)' : 'var(--text-silver)';
    };

    document.getElementById('bateriaPresetSelect').onchange = (e) => {
      const val = e.target.value;
      if (!val) return;
      if (val === '__save_bateria__') {
        saveCurrentBateriaAsPreset();
        e.target.value = '';
        return;
      }
      if (val === '__clear_custom_bateria__') {
        window.appConfirm('Deseja realmente apagar todos os presets de bateria salvos por você?', 'Excluir Presets', { isDanger: true, confirmText: 'Apagar Todos' }).then(confirmed => {
          if (confirmed) {
            customBateriaPresets = {};
            saveCustomBateriaPresetsToStorage(customBateriaPresets);
            updateBateriaPresetSelect();
            window.appToast('Presets excluídos.', 'info');
          }
        });
        e.target.value = '';
        return;
      }
      applyBateriaPreset(val);
      e.target.value = '';
    };

    document.getElementById('btnSendToStudio').onclick = sendSequenceToMultitrackStudio;

    document.getElementById('btnClear').onclick = async () => {
      const confirmed = await window.appConfirm('Deseja limpar todas as notas marcadas na grade de bateria?', 'Limpar Grade', { isDanger: true, confirmText: 'Limpar Tudo' });
      if (confirmed) {
        state.gridData = {};
        state.stepMeta = {};
        state.loopGridData = {};
        state.selectedGroove = {};
        state.beatTuplets = {};
        document.getElementById('bateriaPresetSelect').value = '';
        stopPlayback();
        renderStudio();
        window.appToast('Grade de notas limpa!', 'info');
      }
    };

    document.getElementById('btnExportJSON').onclick = exportToJSON;

    document.getElementById('btnImportJSON').onclick = () => {
      document.getElementById('fileInput').click();
    };



    document.getElementById('fileInput').onchange = (e) => {
      if (e.target.files.length > 0) {
        importFromJSON(e.target.files[0]);
      }
    };

    document.getElementById('btnPrint').onclick = () => {
      const pTitle = document.getElementById('printTitle');
      const pDetails = document.getElementById('printDetails');
      if (pTitle) pTitle.textContent = `Naumteria Studio — ${state.activeBrequeName || 'Mapa de Breques'}`;
      if (pDetails) pDetails.textContent = `BPM: ${state.bpm || 120} | Fórmula: ${state.meter || '2/4'} | Compassos: ${state.measures || 4}`;
      window.print();
    };
    // Tap Tempo, Contagem Pré-Roll, Speed Trainer e Compartilhamento
    const btnTap = document.getElementById('btnTapTempo');
    if (btnTap) btnTap.onclick = () => handleTap(false);

    const btnStudioTap = document.getElementById('btnStudioTap');
    if (btnStudioTap) btnStudioTap.onclick = () => handleTap(true);

    const btnPreRoll = document.getElementById('btnPreRoll');
    if (btnPreRoll) {
      btnPreRoll.onclick = () => {
        state.preRollEnabled = !state.preRollEnabled;
        btnPreRoll.classList.toggle('btn-primary', state.preRollEnabled);
        const text = document.getElementById('preRollText');
        if (text) text.textContent = `Contagem: ${state.preRollEnabled ? '1 Comp' : 'Off'}`;
      };
    }

    const btnShareLink = document.getElementById('btnShareLink');
    if (btnShareLink) {
      btnShareLink.onclick = shareBrequeLink;
    }

    const btnToggleSeqSettings = document.getElementById('btnToggleSeqSettings');
    const seqSettingsPopover = document.getElementById('seqSettingsPopover');
    const btnToggleSeqActions = document.getElementById('btnToggleSeqActions');
    const seqActionsPopover = document.getElementById('seqActionsPopover');

    function resetPopoverInlineBounds(popEl) {
      if (!popEl) return;
      popEl.style.left = '';
      popEl.style.right = '';
      popEl.style.maxHeight = '';
    }

    function clampDesktopPopover(popEl, triggerBtn) {
      if (!popEl || !triggerBtn) return;
      resetPopoverInlineBounds(popEl);
      if (window.innerWidth <= 768) return;
      const pad = 8;
      const r = popEl.getBoundingClientRect();
      const tr = triggerBtn.getBoundingClientRect();
      if (r.left < pad) {
        popEl.style.right = 'auto';
        popEl.style.left = `${Math.round(pad - tr.left)}px`;
      } else if (r.right > window.innerWidth - pad) {
        popEl.style.left = 'auto';
        popEl.style.right = `${Math.round(tr.right - (window.innerWidth - pad))}px`;
      }
      const availH = Math.max(160, window.innerHeight - Math.round(r.top) - pad);
      popEl.style.maxHeight = `${availH}px`;
    }

    function closeSeqPopovers() {
      if (seqSettingsPopover) {
        seqSettingsPopover.classList.remove('open');
        resetPopoverInlineBounds(seqSettingsPopover);
      }
      if (seqActionsPopover) {
        seqActionsPopover.classList.remove('open');
        resetPopoverInlineBounds(seqActionsPopover);
      }
      if (btnToggleSeqSettings) {
        btnToggleSeqSettings.classList.remove('active');
        btnToggleSeqSettings.setAttribute('aria-expanded', 'false');
      }
      if (btnToggleSeqActions) {
        btnToggleSeqActions.classList.remove('active');
        btnToggleSeqActions.setAttribute('aria-expanded', 'false');
      }
    }
    window.closeSeqPopovers = closeSeqPopovers;

    if (btnToggleSeqSettings && seqSettingsPopover) {
      btnToggleSeqSettings.onclick = (e) => {
        e.stopPropagation();
        const willOpen = !seqSettingsPopover.classList.contains('open');
        closeSeqPopovers();
        if (willOpen) {
          seqSettingsPopover.classList.add('open');
          btnToggleSeqSettings.classList.add('active');
          btnToggleSeqSettings.setAttribute('aria-expanded', 'true');
          clampDesktopPopover(seqSettingsPopover, btnToggleSeqSettings);
        }
      };
    }

    if (btnToggleSeqActions && seqActionsPopover) {
      btnToggleSeqActions.onclick = (e) => {
        e.stopPropagation();
        const willOpen = !seqActionsPopover.classList.contains('open');
        closeSeqPopovers();
        if (willOpen) {
          seqActionsPopover.classList.add('open');
          btnToggleSeqActions.classList.add('active');
          btnToggleSeqActions.setAttribute('aria-expanded', 'true');
          clampDesktopPopover(seqActionsPopover, btnToggleSeqActions);
        }
      };
      seqActionsPopover.addEventListener('click', (e) => {
        if (e.target.closest('.popover-action-item')) {
          closeSeqPopovers();
        }
      });
    }

    if (seqSettingsPopover) {
      seqSettingsPopover.addEventListener('click', (e) => {
        if (e.target.closest('#btnClear')) {
          closeSeqPopovers();
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#seqSettingsWrap') && !e.target.closest('#seqActionsWrap')) {
        closeSeqPopovers();
      }
    });

    window.addEventListener('resize', () => {
      if (seqSettingsPopover && seqSettingsPopover.classList.contains('open')) {
        clampDesktopPopover(seqSettingsPopover, btnToggleSeqSettings);
      }
      if (seqActionsPopover && seqActionsPopover.classList.contains('open')) {
        clampDesktopPopover(seqActionsPopover, btnToggleSeqActions);
      }
    });


    // =========================================================================
    // NAVEGAÇÃO POR PROJETO (HOME -> BREQUE ABERTO [PAD | ESTÚDIO])
    // =========================================================================
    const appMainHeader = document.getElementById('appMainHeader');
    const headerBrandLogo = document.getElementById('headerBrandLogo');
    const projectHeaderBar = document.getElementById('projectHeaderBar');
    const projectModeSwitch = document.getElementById('projectModeSwitch');
    const btnHeaderNewBreque = document.getElementById('btnHeaderNewBreque');
    const btnBackToHome = document.getElementById('btnBackToHome');
    const btnEditBrequeTitle = document.getElementById('btnEditBrequeTitle');
    const activeBrequeTitleText = document.getElementById('activeBrequeTitleText');
    const btnSwitchToPad = document.getElementById('btnSwitchToPad');
    const btnSwitchToStudio = document.getElementById('btnSwitchToStudio');
    const btnImportFromPad = document.getElementById('btnImportFromPad');

    const tabHome = document.getElementById('tab-home');
    const tabSequencer = document.getElementById('tab-sequencer');
    const tabBeatbox = document.getElementById('tab-beatbox');

    const mobHeaderInstall = document.getElementById('mobHeaderInstall');
    const mobStatusPill = document.getElementById('mobStatusPill');
    const mobileOrientHint = document.getElementById('mobileOrientHint');
    const btnDismissOrient = document.getElementById('btnDismissOrient');
    const mobileHeadphonesToast = document.getElementById('mobileHeadphonesToast');
    const btnDismissHp = document.getElementById('btnDismissHp');

    let currentActiveTab = 'tab-home';
    state.activeBrequeId = null;
    state.activeBrequeName = 'Novo Breque';

    function hasPadNotesInCurrentGrid() {
      return INSTRUMENTS.some(inst =>
        (state.gridData[inst.id] || []).some(n => n !== null)
      );
    }

    function updateHeaderBrequeTitle() {
      if (activeBrequeTitleText) {
        activeBrequeTitleText.textContent = state.activeBrequeName || 'Novo Breque';
      }
    }

    function saveActiveBrequeState(modeOverride) {
      if (!state.activeBrequeId) return;
      customBateriaPresets = loadCustomBateriaPresets();

      // Se o usuário editou um preset nativo, mantém salvo apenas se já for custom:
      if (!state.activeBrequeId.startsWith('custom:')) {
        return;
      }

      const rawKey = state.activeBrequeId.replace('custom:', '');
      const existing = customBateriaPresets[rawKey] || {};
      const currentMode = modeOverride || (currentActiveTab === 'tab-beatbox' ? 'studio' : (currentActiveTab === 'tab-sequencer' ? 'pad' : (existing.lastMode || 'pad')));

      customBateriaPresets[rawKey] = {
        ...existing,
        name: state.activeBrequeName || existing.name || 'Novo Breque',
        bpm: state.bpm || existing.bpm || 120,
        meter: state.meter || existing.meter || '2/4',
        subdivision: state.subdivision || existing.subdivision || 'semicolcheia',
        measures: state.measures || existing.measures || 4,
        lastMode: currentMode,
        hasPadNotes: hasPadNotesInCurrentGrid(),
        updatedAt: Date.now(),
        gridData: JSON.parse(JSON.stringify(state.gridData || {})),
        stepMeta: JSON.parse(JSON.stringify(state.stepMeta || {})),
        beatTuplets: JSON.parse(JSON.stringify(state.beatTuplets || {})),
        loopMeasures: state.loopMeasures,
        loopGridData: JSON.parse(JSON.stringify(state.loopGridData || {})),
        selectedGroove: JSON.parse(JSON.stringify(state.selectedGroove || {})),
        trackGains: JSON.parse(JSON.stringify(state.trackGains || {}))
      };

      saveCustomBateriaPresetsToStorage(customBateriaPresets);
      updateBateriaPresetSelect();
    }

    window.onStudioSessionUpdated = (summary) => {
      if (!state.activeBrequeId || !summary) return;
      if (state.activeBrequeId.startsWith('custom:')) {
        const rawKey = state.activeBrequeId.replace('custom:', '');
        customBateriaPresets = loadCustomBateriaPresets();
        if (customBateriaPresets[rawKey]) {
          customBateriaPresets[rawKey].studioTrackCount = summary.totalTracks || 0;
          customBateriaPresets[rawKey].studioRecordedCount = summary.recordedCount || 0;
          if (summary.bpm) {
            customBateriaPresets[rawKey].bpm = summary.bpm;
            state.bpm = summary.bpm;
          }
          saveCustomBateriaPresetsToStorage(customBateriaPresets);
        }
      }
    };
    window.saveActiveBrequeState = saveActiveBrequeState;

    // Autosave do Pad: edições na grade são persistidas sem depender de troca de aba.
    // Só salva se houve interação pendente (dirty) e apenas no mesmo breque em que ela ocorreu.
    let brequeAutosaveTimer = null;
    let brequeAutosaveDirtyId = null;
    function flushBrequeAutosave() {
      clearTimeout(brequeAutosaveTimer);
      brequeAutosaveTimer = null;
      const dirtyId = brequeAutosaveDirtyId;
      brequeAutosaveDirtyId = null;
      if (!dirtyId || dirtyId !== state.activeBrequeId) return;
      if (currentActiveTab === 'tab-sequencer') saveActiveBrequeState('pad');
    }
    function scheduleBrequeAutosave() {
      if (currentActiveTab !== 'tab-sequencer' || !state.activeBrequeId) return;
      brequeAutosaveDirtyId = state.activeBrequeId;
      clearTimeout(brequeAutosaveTimer);
      brequeAutosaveTimer = setTimeout(flushBrequeAutosave, 400);
    }
    window.flushBrequeAutosave = flushBrequeAutosave;
    window.scheduleBrequeAutosave = scheduleBrequeAutosave;

    // Escuta no documento: cobre grade, toolbar e popovers anexados ao body.
    ['pointerup', 'change', 'input', 'keyup'].forEach(evt => {
      document.addEventListener(evt, scheduleBrequeAutosave);
    });

    function clearSharedBrequeHash() {
      if (window.location.hash.startsWith('#breque=')) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    window.addEventListener('pagehide', flushBrequeAutosave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushBrequeAutosave();
    });

    function createNewBrequeProject({ name, bpm = 120, measures = 4, initialMode = 'pad', quick = false }) {
      const cleanName = (name && name.trim()) || `Breque ${Object.keys(customBateriaPresets || {}).length + 1}`;
      const key = 'breque_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      flushBrequeAutosave();
      clearSharedBrequeHash();

      state.gridData = {};
      state.stepMeta = {};
      state.loopGridData = {};
      state.selectedGroove = {};
      state.beatTuplets = {};
      state.bpm = Math.min(220, Math.max(60, parseInt(bpm, 10) || 120));
      state.measures = parseInt(measures, 10) || 4;
      state.activeBrequeName = cleanName;
      state.activeBrequeId = 'custom:' + key;

      const bpmSlider = document.getElementById('bpmSlider');
      if (bpmSlider) bpmSlider.value = state.bpm;
      const bpmDisplay = document.getElementById('bpmDisplay');
      if (bpmDisplay) bpmDisplay.textContent = state.bpm;
      const measureCountDisplay = document.getElementById('measureCountDisplay');
      if (measureCountDisplay) measureCountDisplay.textContent = `${state.measures} Compassos`;

      customBateriaPresets = loadCustomBateriaPresets();
      customBateriaPresets[key] = {
        name: cleanName,
        bpm: state.bpm,
        measures: state.measures,
        lastMode: initialMode,
        quickCreated: !!quick,
        hasPadNotes: false,
        studioTrackCount: 0,
        studioRecordedCount: 0,
        updatedAt: Date.now(),
        gridData: {},
        stepMeta: {},
        loopMeasures: state.loopMeasures,
        loopGridData: {},
        selectedGroove: {},
        trackGains: {}
      };
      saveCustomBateriaPresetsToStorage(customBateriaPresets);
      updateBateriaPresetSelect();
      updateHeaderBrequeTitle();
      return state.activeBrequeId;
    }

    async function openBrequeProject(brequeId, modeOverride) {
      flushBrequeAutosave();
      clearSharedBrequeHash();
      stopPlayback();
      activePreviewPresetId = null;

      customBateriaPresets = loadCustomBateriaPresets();
      let presetObj = null;
      let isCustom = false;

      if (brequeId.startsWith('custom:')) {
        const rawKey = brequeId.replace('custom:', '');
        presetObj = customBateriaPresets[rawKey];
        isCustom = true;
      } else {
        presetObj = BATERIA_PRESETS[brequeId];
      }

      if (!presetObj) return;

      state.activeBrequeId = brequeId;
      state.activeBrequeName = presetObj.name || brequeId;
      updateHeaderBrequeTitle();

      const hasSavedGrid = presetObj.gridData && Object.keys(presetObj.gridData).length > 0;
      const hasSavedTracks = presetObj.tracks && Object.keys(presetObj.tracks).length > 0;

      if (hasSavedGrid || hasSavedTracks) {
        applyBateriaPresetObject(presetObj);
      } else {
        state.gridData = {};
        state.stepMeta = {};
        state.loopGridData = {};
        state.selectedGroove = {};
        state.beatTuplets = presetObj.beatTuplets ? { ...presetObj.beatTuplets } : {};
        state.bpm = presetObj.bpm || 120;
        state.measures = presetObj.measures || 4;
        const bpmSlider = document.getElementById('bpmSlider');
        if (bpmSlider) bpmSlider.value = state.bpm;
        const bpmDisplay = document.getElementById('bpmDisplay');
        if (bpmDisplay) bpmDisplay.textContent = state.bpm;
        const measureCountDisplay = document.getElementById('measureCountDisplay');
        if (measureCountDisplay) measureCountDisplay.textContent = `${state.measures} Compassos`;
        initGridData();
      }

      if (window.BeatboxStudio && typeof window.BeatboxStudio.loadBrequeProject === 'function') {
        await window.BeatboxStudio.loadBrequeProject(brequeId, state.bpm);
      }

      const targetMode = modeOverride || presetObj.lastMode || (isCustom && !hasPadNotesInCurrentGrid() && presetObj.studioTrackCount > 0 ? 'studio' : 'pad');
      if (isCustom) {
        saveActiveBrequeState(targetMode);
      }
      switchTab(targetMode === 'studio' ? 'tab-beatbox' : 'tab-sequencer');
    }

    // Breque criado pelo atalho da Home que continua sem notas e sem gravações não deve virar item órfão em Meus Breques.
    function discardEmptyQuickBreque() {
      const id = state.activeBrequeId;
      if (!id || !id.startsWith('custom:')) return;
      const rawKey = id.replace('custom:', '');
      customBateriaPresets = loadCustomBateriaPresets();
      const p = customBateriaPresets[rawKey];
      if (!p || !p.quickCreated || p.hasPadNotes || (p.studioRecordedCount || 0) > 0) return;
      delete customBateriaPresets[rawKey];
      saveCustomBateriaPresetsToStorage(customBateriaPresets);
      state.activeBrequeId = null;
      updateBateriaPresetSelect();
      updateHeaderBrequeTitle();
    }

    // Desfazer/refazer do Pad: pilha de snapshots da grade (máx. 50). Cada interação "assenta" (debounce) e, se a grade
    // mudou em relação ao topo da pilha, vira um novo estado. Trocar de breque zera o histórico.
    const PAD_UNDO_CAP = 50;
    let padUndoStack = [];
    let padUndoIdx = -1;
    let padUndoBreque = null;
    let padUndoTimer = null;
    const padUndoSnapshot = () => JSON.stringify({
      g: state.gridData, m: state.stepMeta, l: state.loopGridData, s: state.selectedGroove, t: state.beatTuplets, c: state.measures,
    });
    function updatePadUndoButtons() {
      const u = document.getElementById('btnPadUndo');
      const r = document.getElementById('btnPadRedo');
      if (u) u.disabled = padUndoIdx <= 0;
      if (r) r.disabled = padUndoIdx >= padUndoStack.length - 1;
    }
    function padUndoCommit() {
      clearTimeout(padUndoTimer);
      if (!state.activeBrequeId || currentActiveTab !== 'tab-sequencer') return;
      const snap = padUndoSnapshot();
      if (padUndoBreque !== state.activeBrequeId) {
        padUndoBreque = state.activeBrequeId;
        padUndoStack = [snap];
        padUndoIdx = 0;
      } else if (snap !== padUndoStack[padUndoIdx]) {
        padUndoStack = padUndoStack.slice(0, padUndoIdx + 1);
        padUndoStack.push(snap);
        if (padUndoStack.length > PAD_UNDO_CAP + 1) padUndoStack.shift();
        padUndoIdx = padUndoStack.length - 1;
      }
      updatePadUndoButtons();
    }
    function padUndoRestore(idx) {
      if (idx < 0 || idx >= padUndoStack.length) return;
      padUndoCommit(); // assenta qualquer edição pendente antes de navegar na pilha
      if (idx > padUndoStack.length - 1) return;
      padUndoIdx = idx;
      const d = JSON.parse(padUndoStack[idx]);
      state.gridData = d.g; state.stepMeta = d.m; state.loopGridData = d.l; state.selectedGroove = d.s; state.beatTuplets = d.t;
      state.measures = d.c;
      const mc = document.getElementById('measureCountDisplay');
      if (mc) mc.textContent = state.measures + ' Compassos';
      renderStudio();
      updatePadUndoButtons();
      scheduleBrequeAutosave();
    }
    const padUndo = () => { padUndoCommit(); padUndoRestore(padUndoIdx - 1); };
    const padRedo = () => padUndoRestore(padUndoIdx + 1);
    window.padUndo = padUndo;
    window.padRedo = padRedo;
    window.padUndoDepth = () => padUndoStack.length;
    document.getElementById('btnPadUndo')?.addEventListener('click', padUndo);
    document.getElementById('btnPadRedo')?.addEventListener('click', padRedo);
    ['pointerup', 'change', 'input', 'keyup'].forEach(evt => document.addEventListener(evt, () => {
      clearTimeout(padUndoTimer);
      padUndoTimer = setTimeout(padUndoCommit, 120);
    }));
    document.addEventListener('keydown', (e) => {
      if (currentActiveTab !== 'tab-sequencer' || !(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
      const dlg = document.getElementById('appDialogModal');
      if (dlg && dlg.style.display !== 'none' && dlg.style.display !== '') return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { if (padUndoIdx > 0 || padUndoTimer) { e.preventDefault(); padUndo(); } }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); padRedo(); }
    });

    // Faixa de ajuda (some após a 1ª nota) e legenda "?" com sigla → nome → som (toque para ouvir).
    const padHelpStrip = document.getElementById('padHelpStrip');
    const btnPadLegend = document.getElementById('btnPadLegend');
    const padLegendPopover = document.getElementById('padLegendPopover');
    function updatePadHelp() {
      if (padHelpStrip) padHelpStrip.classList.toggle('is-hidden', hasPadNotesInCurrentGrid());
    }
    function buildPadLegend() {
      padLegendPopover.innerHTML = '';
      INSTRUMENTS.forEach(inst => {
        const h = document.createElement('h4');
        h.textContent = inst.name;
        padLegendPopover.appendChild(h);
        inst.articulations.forEach(art => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'pad-legend-row';
          row.setAttribute('data-legend-row', '');
          row.title = 'Tocar para ouvir';
          const b = document.createElement('b');
          b.textContent = art.label;
          const span = document.createElement('span');
          span.textContent = art.name;
          row.append(b, span);
          row.onclick = () => audio.triggerInstrument(inst.id, art.id, state.volumes[inst.id] ?? 1.0);
          padLegendPopover.appendChild(row);
        });
      });
    }
    if (btnPadLegend && padLegendPopover) {
      btnPadLegend.onclick = (e) => {
        e.stopPropagation();
        if (!padLegendPopover.childElementCount) buildPadLegend();
        const open = padLegendPopover.classList.toggle('open');
        btnPadLegend.setAttribute('aria-expanded', String(open));
      };
      document.addEventListener('pointerdown', (e) => {
        if (padLegendPopover.classList.contains('open') && !e.target.closest('.pad-legend-wrap')) {
          padLegendPopover.classList.remove('open');
          btnPadLegend.setAttribute('aria-expanded', 'false');
        }
      });
    }
    ['pointerup', 'change', 'keyup'].forEach(evt => document.addEventListener(evt, () => setTimeout(updatePadHelp, 80)));

    // Rotas por hash: #/ (Home), #/b/<id>/pad e #/b/<id>/estudio. O link compartilhado (#breque=) continua com prioridade.
    let routeReady = false;
    let applyingRoute = false;
    function routeFor(target) {
      if (target === 'tab-home') return '#/';
      if (!state.activeBrequeId) return null;
      return '#/b/' + encodeURIComponent(state.activeBrequeId) + '/' + (target === 'tab-beatbox' ? 'estudio' : 'pad');
    }
    function syncRoute(target) {
      if (!routeReady || applyingRoute) return;
      const r = routeFor(target);
      if (!r || window.location.hash === r) return;
      if (target === 'tab-home' && window.location.hash.startsWith('#breque=')) return;
      history.pushState(null, '', window.location.pathname + window.location.search + r);
    }
    async function applyRoute() {
      const m = /^#\/b\/([^/]+)\/(pad|estudio)$/.exec(window.location.hash);
      applyingRoute = true;
      try {
        if (m) {
          const id = decodeURIComponent(m[1]);
          const tab = m[2] === 'estudio' ? 'tab-beatbox' : 'tab-sequencer';
          if (id === state.activeBrequeId) {
            if (currentActiveTab !== tab) switchTab(tab);
          } else {
            await openBrequeProject(id, m[2] === 'estudio' ? 'studio' : 'pad');
            if (state.activeBrequeId !== id) {
              history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
              if (currentActiveTab !== 'tab-home') switchTab('tab-home');
            }
          }
        } else if (!window.location.hash.startsWith('#breque=') && currentActiveTab !== 'tab-home') {
          switchTab('tab-home');
        }
      } finally {
        applyingRoute = false;
      }
    }
    window.addEventListener('popstate', applyRoute);

    function switchTab(target) {
      // Se estava em um breque aberto e vai trocar de modo ou voltar para Home, salva estado do breque
      if (currentActiveTab !== 'tab-home' && state.activeBrequeId) {
        const nextMode = target === 'tab-beatbox' ? 'studio' : (target === 'tab-sequencer' ? 'pad' : undefined);
        saveActiveBrequeState(nextMode);
        if (target === 'tab-home') discardEmptyQuickBreque();
      }

      currentActiveTab = target;
      syncRoute(target);
      closeSeqPopovers();
      updatePadHelp();
      if (typeof setPadSheet === 'function') setPadSheet(null);
      if (target === 'tab-sequencer') setTimeout(padUndoCommit, 0);
      if (window.BeatboxStudio && typeof window.BeatboxStudio.closeStudioMenus === 'function') {
        window.BeatboxStudio.closeStudioMenus();
      }

      // Interrompe reproduções ao trocar de contexto
      if (target !== 'tab-sequencer' && typeof stopPlayback === 'function') {
        stopPlayback();
      }
      if (target !== 'tab-beatbox' && window.BeatboxStudio) {
        if (typeof window.BeatboxStudio.stopStudioPlayback === 'function') {
          window.BeatboxStudio.stopStudioPlayback();
        }
        if (typeof window.BeatboxStudio.stopRecordingView === 'function') {
          window.BeatboxStudio.stopRecordingView();
        }
      }

      // Alterna visibilidade dos painéis
      if (tabHome) tabHome.classList.toggle('active', target === 'tab-home');
      if (tabSequencer) tabSequencer.classList.toggle('active', target === 'tab-sequencer');
      if (tabBeatbox) tabBeatbox.classList.toggle('active', target === 'tab-beatbox');

      // Exibe/oculta a barra contextual do Breque no Header
      const isProjectOpen = target !== 'tab-home';
      if (projectHeaderBar) {
        projectHeaderBar.style.display = isProjectOpen ? 'flex' : 'none';
      }
      if (projectModeSwitch) {
        projectModeSwitch.style.display = isProjectOpen ? 'inline-flex' : 'none';
      }
      if (appMainHeader) {
        appMainHeader.classList.toggle('project-open', isProjectOpen);
      }
      if (btnSwitchToPad) {
        btnSwitchToPad.classList.toggle('active', target === 'tab-sequencer');
      }
      if (btnSwitchToStudio) {
        btnSwitchToStudio.classList.toggle('active', target === 'tab-beatbox');
      }

      // Ações específicas ao abrir cada visão
      closeSeqPopovers();
      if (target === 'tab-home') {
        state.activeBrequeId = null;
        renderHomeBrequesList();
      } else if (target === 'tab-sequencer') {
        renderStudio();
      } else if (target === 'tab-beatbox') {
        if (window.BeatboxStudio && typeof window.BeatboxStudio.renderStudioViews === 'function') {
          window.BeatboxStudio.renderStudioViews();
        }
      }
      if (typeof checkOrientation === 'function') {
        checkOrientation();
      }
    }

    if (btnBackToHome) {
      btnBackToHome.onclick = () => switchTab('tab-home');
    }
    if (headerBrandLogo) {
      headerBrandLogo.onclick = () => {
        if (currentActiveTab !== 'tab-home') switchTab('tab-home');
      };
    }
    if (btnSwitchToPad) {
      btnSwitchToPad.onclick = () => switchTab('tab-sequencer');
    }
    if (btnSwitchToStudio) {
      btnSwitchToStudio.onclick = () => {
        switchTab('tab-beatbox');
        if (window.BeatboxStudio && typeof window.BeatboxStudio.switchViewMode === 'function') {
          window.BeatboxStudio.switchViewMode('timeline');
        }
      };
    }
    if (btnImportFromPad) {
      btnImportFromPad.onclick = () => sendSequenceToMultitrackStudio();
    }
    if (btnEditBrequeTitle) {
      btnEditBrequeTitle.onclick = async () => {
        const newName = await window.appPrompt('Digite o novo nome para este breque:', state.activeBrequeName || 'Novo Breque', 'Renomear Breque');
        if (newName && newName.trim()) {
          state.activeBrequeName = newName.trim();
          updateHeaderBrequeTitle();
          saveActiveBrequeState();
          window.appToast('Breque renomeado!', 'success');
        }
      };
    }

    // =========================================================================
    // MODAL DE CRIAÇÃO GUIADA: "CRIAR NOVO BREQUE"
    // =========================================================================
    const modalNewBreque = document.getElementById('modalNewBreque');
    const btnHomeRecordBreque = document.getElementById('btnHomeRecordBreque');
    const btnHomePadBreque = document.getElementById('btnHomePadBreque');
    const btnCloseModalNewBreque = document.getElementById('btnCloseModalNewBreque');
    const modalNewBrequeTitle = document.getElementById('modalNewBrequeTitle');
    const stepModalChoice = document.getElementById('stepModalChoice');
    const stepModalRecordSetup = document.getElementById('stepModalRecordSetup');
    const stepModalPadSetup = document.getElementById('stepModalPadSetup');
    const cardChoiceRecord = document.getElementById('cardChoiceRecord');
    const cardChoicePad = document.getElementById('cardChoicePad');
    const btnBackFromRecord = document.getElementById('btnBackFromRecord');
    const btnConfirmRecordSetup = document.getElementById('btnConfirmRecordSetup');
    const inputRecordBrequeName = document.getElementById('inputRecordBrequeName');
    const selectRecordCaptureMode = document.getElementById('selectRecordCaptureMode');
    const inputRecordBpm = document.getElementById('inputRecordBpm');
    const selectRecordMetronome = document.getElementById('selectRecordMetronome');
    const btnBackToChoice = document.getElementById('btnBackToChoice');
    const btnConfirmPadSetup = document.getElementById('btnConfirmPadSetup');
    const inputNewBrequeName = document.getElementById('inputNewBrequeName');
    const inputNewBrequeBpm = document.getElementById('inputNewBrequeBpm');

    function openModalNewBreque() {
      if (!modalNewBreque) return;
      if (modalNewBrequeTitle) modalNewBrequeTitle.textContent = 'Criar Novo Breque';
      if (stepModalChoice) stepModalChoice.style.display = 'flex';
      if (stepModalRecordSetup) stepModalRecordSetup.style.display = 'none';
      if (stepModalPadSetup) stepModalPadSetup.style.display = 'none';

      // Gera nome sugerido sequencial
      customBateriaPresets = loadCustomBateriaPresets();
      const existingCount = Object.keys(customBateriaPresets || {}).length;
      const suggestedName = `Breque ${existingCount + 1}`;
      if (inputNewBrequeName) inputNewBrequeName.value = suggestedName;
      if (inputRecordBrequeName) inputRecordBrequeName.value = suggestedName;
      if (inputNewBrequeBpm) inputNewBrequeBpm.value = state.bpm || 120;
      if (inputRecordBpm) inputRecordBpm.value = state.bpm || 120;
      modalNewBreque.style.display = 'flex';
    }

    function closeModalNewBreque() {
      if (modalNewBreque) modalNewBreque.style.display = 'none';
    }

    async function startQuickBreque(initialMode) {
      if (!window.BeatboxStudio) {
        window.appToast('O estúdio ainda está carregando. Tente novamente em instantes.', 'warn');
        return;
      }

      customBateriaPresets = loadCustomBateriaPresets();
      const nextNum = Object.keys(customBateriaPresets || {}).length + 1;
      const isRecord = initialMode === 'studio';
      const name = isRecord ? `Ideia ${nextNum}` : `Breque ${nextNum}`;
      const bpm = 120;
      const measures = 4;
      const brequeId = createNewBrequeProject({ name, bpm, measures, initialMode, quick: true });

      await window.BeatboxStudio.loadBrequeProject(brequeId, bpm);
      if (isRecord) {
        switchTab('tab-beatbox');
        showHeadphonesToast();
        await window.BeatboxStudio.startGuidedRecording({ mode: 'audio', bpm, metronome: true, autoStartCountdown: true });
        return;
      }

      switchTab('tab-sequencer');
    }

    if (btnHomeRecordBreque) btnHomeRecordBreque.onclick = () => startQuickBreque('studio');
    if (btnHomePadBreque) btnHomePadBreque.onclick = () => startQuickBreque('pad');
    if (btnHeaderNewBreque) btnHeaderNewBreque.onclick = openModalNewBreque;
    if (btnCloseModalNewBreque) btnCloseModalNewBreque.onclick = closeModalNewBreque;

    if (modalNewBreque) {
      modalNewBreque.onclick = (e) => {
        if (e.target === modalNewBreque) closeModalNewBreque();
      };
    }

    // Opção 1: Gravar ao Vivo (Abre passo rápido de escolha do instrumento e modo)
    if (cardChoiceRecord) {
      cardChoiceRecord.onclick = () => {
        if (stepModalChoice) stepModalChoice.style.display = 'none';
        if (stepModalPadSetup) stepModalPadSetup.style.display = 'none';
        if (stepModalRecordSetup) stepModalRecordSetup.style.display = 'flex';
        if (modalNewBrequeTitle) modalNewBrequeTitle.textContent = 'Novo Breque • Gravar ao Vivo';
      };
    }

    if (btnBackFromRecord) {
      btnBackFromRecord.onclick = () => {
        if (stepModalChoice) stepModalChoice.style.display = 'flex';
        if (stepModalRecordSetup) stepModalRecordSetup.style.display = 'none';
        if (modalNewBrequeTitle) modalNewBrequeTitle.textContent = 'Criar Novo Breque';
      };
    }

    if (btnConfirmRecordSetup) {
      btnConfirmRecordSetup.onclick = async () => {
        const name = (inputRecordBrequeName && inputRecordBrequeName.value.trim()) || 'Novo Breque';
        const mode = selectRecordCaptureMode ? selectRecordCaptureMode.value : 'audio';
        const bpm = parseInt(inputRecordBpm ? inputRecordBpm.value : '120', 10) || 120;
        const metronome = selectRecordMetronome ? selectRecordMetronome.value !== 'false' : true;

        const brequeId = createNewBrequeProject({ name, bpm, measures: 4, initialMode: 'studio' });
        closeModalNewBreque();

        if (window.BeatboxStudio && typeof window.BeatboxStudio.loadBrequeProject === 'function') {
          await window.BeatboxStudio.loadBrequeProject(brequeId, bpm);
        }
        switchTab('tab-beatbox');
        showHeadphonesToast();
        if (window.BeatboxStudio && typeof window.BeatboxStudio.startGuidedRecording === 'function') {
          await window.BeatboxStudio.startGuidedRecording({ mode, bpm, metronome, autoStartCountdown: true });
        } else if (window.BeatboxStudio && typeof window.BeatboxStudio.switchViewMode === 'function') {
          window.BeatboxStudio.switchViewMode('record');
        }
      };
    }

    // Opção 2: Montar no Pad / Sequenciador
    if (cardChoicePad) {
      cardChoicePad.onclick = () => {
        if (stepModalChoice) stepModalChoice.style.display = 'none';
        if (stepModalRecordSetup) stepModalRecordSetup.style.display = 'none';
        if (stepModalPadSetup) stepModalPadSetup.style.display = 'flex';
        if (modalNewBrequeTitle) modalNewBrequeTitle.textContent = 'Novo Breque • Montar no Pad';
        if (inputNewBrequeName) {
          inputNewBrequeName.focus();
          inputNewBrequeName.select();
        }
      };
    }

    if (btnBackToChoice) {
      btnBackToChoice.onclick = () => {
        if (stepModalChoice) stepModalChoice.style.display = 'flex';
        if (stepModalRecordSetup) stepModalRecordSetup.style.display = 'none';
        if (stepModalPadSetup) stepModalPadSetup.style.display = 'none';
        if (modalNewBrequeTitle) modalNewBrequeTitle.textContent = 'Criar Novo Breque';
      };
    }

    if (btnConfirmPadSetup) {
      btnConfirmPadSetup.onclick = async () => {
        const name = (inputNewBrequeName && inputNewBrequeName.value.trim()) || 'Novo Breque';
        const bpm = parseInt(inputNewBrequeBpm ? inputNewBrequeBpm.value : '120', 10) || 120;

        const brequeId = createNewBrequeProject({ name, bpm, measures: 4, initialMode: 'pad' });
        if (window.BeatboxStudio && typeof window.BeatboxStudio.loadBrequeProject === 'function') {
          await window.BeatboxStudio.loadBrequeProject(brequeId, bpm);
        }
        closeModalNewBreque();
        switchTab('tab-sequencer');
      };
    }

    // Botão Salvar Breque (Salva alterações no breque atual ou cria cópia se for nativo)
    const btnSaveToMyBreques = document.getElementById('btnSaveToMyBreques');
    if (btnSaveToMyBreques) {
      btnSaveToMyBreques.onclick = async () => {
        if (state.activeBrequeId && state.activeBrequeId.startsWith('custom:')) {
          saveActiveBrequeState('pad');
        } else {
          const defaultName = state.activeBrequeName || `Breque ${Object.keys(customBateriaPresets || {}).length + 1}`;
          const chosenName = await window.appPrompt('Nome do breque para salvar em "Meus Breques":', defaultName, 'Salvar Breque');
          if (!chosenName || !chosenName.trim()) return;
          const cleanName = chosenName.trim();
          state.activeBrequeName = cleanName;
          const key = 'breque_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
          state.activeBrequeId = 'custom:' + key;
          updateHeaderBrequeTitle();
          saveActiveBrequeState('pad');
        }
        const origHtml = btnSaveToMyBreques.innerHTML;
        // Já salvo em Meus Breques: o link não deve mais ser reaplicado num reload.
        clearSharedBrequeHash();
        btnSaveToMyBreques.innerHTML = '<span>✓</span> <span>Salvo!</span>';
        setTimeout(() => { btnSaveToMyBreques.innerHTML = origHtml; }, 1800);
      };
    }

    // =========================================================================
    // LISTA DE MEUS BREQUES & REPERTÓRIO NA HOME
    // =========================================================================
    let activePreviewPresetId = null;
    let homeBrequeFilter = 'all';
    let homeBrequeSearch = '';

    const homeBrequeSearchInput = document.getElementById('homeBrequeSearch');
    const homeBrequeFilterButtons = Array.from(document.querySelectorAll('[data-home-filter]'));

    function updateHomeBrequeFilters() {
      homeBrequeFilterButtons.forEach(button => {
        const isActive = button.dataset.homeFilter === homeBrequeFilter;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
    }

    homeBrequeFilterButtons.forEach(button => {
      button.addEventListener('click', () => {
        homeBrequeFilter = button.dataset.homeFilter || 'all';
        updateHomeBrequeFilters();
        renderHomeBrequesList();
      });
    });

    if (homeBrequeSearchInput) {
      homeBrequeSearchInput.addEventListener('input', () => {
        homeBrequeSearch = homeBrequeSearchInput.value.trim().toLocaleLowerCase('pt-BR');
        renderHomeBrequesList();
      });
    }

    function renderHomeBrequesList() {
      const container = document.getElementById('homeBrequeList');
      const countDisplay = document.getElementById('homeBrequesCount');
      if (!container) return;

      container.innerHTML = '';
      customBateriaPresets = loadCustomBateriaPresets();

      const customKeys = Object.keys(customBateriaPresets || {});
      const nativeKeys = Object.keys(BATERIA_PRESETS || {});
      const totalCount = customKeys.length + nativeKeys.length;

      if (totalCount === 0) {
        if (countDisplay) countDisplay.textContent = '0 breques';
        container.innerHTML = `
          <div class="home-empty-state" style="grid-column: 1 / -1;">
            <span class="home-empty-icon">🥁</span>
            <p class="home-empty-text">Nenhum breque cadastrado ainda. Comece criando seu primeiro breque agora!</p>
            <button class="btn-empty-starter" onclick="openModalNewBreque()">➕ Criar Primeiro Breque</button>
          </div>
        `;
        return;
      }

      const projects = [];

      // 1. Breques personalizados do usuário (mais recentes primeiro)
      customKeys.slice().reverse().forEach(key => {
        const p = customBateriaPresets[key];
        projects.push({
          id: 'custom:' + key,
          name: p.name || key,
          bpm: p.bpm || 120,
          measures: p.measures || 4,
          isCustom: true,
          presetObj: p
        });
      });

      // 2. Renderiza Repertório Nativo da Bateria
      nativeKeys.forEach(key => {
        const p = BATERIA_PRESETS[key];
        projects.push({
          id: key,
          name: p.name || key,
          bpm: p.bpm || 130,
          measures: p.measures || 4,
          isCustom: false,
          presetObj: p
        });
      });

      const filteredProjects = projects.filter(project => {
        const matchesFilter = homeBrequeFilter === 'all' ||
          (homeBrequeFilter === 'custom' && project.isCustom) ||
          (homeBrequeFilter === 'native' && !project.isCustom);
        const searchableText = `${project.name} ${project.bpm}`.toLocaleLowerCase('pt-BR');
        return matchesFilter && (!homeBrequeSearch || searchableText.includes(homeBrequeSearch));
      });

      if (countDisplay) {
        countDisplay.textContent = filteredProjects.length === totalCount
          ? `${totalCount} ${totalCount === 1 ? 'breque' : 'breques'}`
          : `${filteredProjects.length} de ${totalCount} ${totalCount === 1 ? 'breque' : 'breques'}`;
      }

      if (filteredProjects.length === 0) {
        container.innerHTML = `
          <div class="home-empty-state" style="grid-column: 1 / -1;">
            <span class="home-empty-icon">🔎</span>
            <p class="home-empty-text">Nenhum breque encontrado. Tente outro termo ou limpe os filtros.</p>
            <button type="button" class="btn-empty-starter" id="btnClearHomeBrequeFilters">Limpar filtros</button>
          </div>
        `;
        const clearButton = document.getElementById('btnClearHomeBrequeFilters');
        if (clearButton) {
          clearButton.onclick = () => {
            homeBrequeFilter = 'all';
            homeBrequeSearch = '';
            if (homeBrequeSearchInput) homeBrequeSearchInput.value = '';
            updateHomeBrequeFilters();
            renderHomeBrequesList();
          };
        }
        return;
      }

      filteredProjects.forEach(project => {
        container.appendChild(createBrequeCardElement(project));
      });
    }

    function createBrequeCardElement({ id, name, bpm, measures, isCustom, presetObj }) {
      const card = document.createElement('div');
      card.className = 'home-breque-card home-breque-card-clickable';
      card.tabIndex = 0;
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', `${name} — ${bpm} BPM`);

      const isPlayingThis = (activePreviewPresetId === id) && state.isPlaying;
      const lastMode = presetObj.lastMode || 'pad';
      const hasPad = !isCustom || presetObj.hasPadNotes || (presetObj.gridData && Object.values(presetObj.gridData).some(arr => Array.isArray(arr) && arr.some(n => n !== null)));
      const studioTracks = presetObj.studioTrackCount || 0;
      const studioRecorded = presetObj.studioRecordedCount || 0;

      const altModeButtonHtml = lastMode === 'studio'
        ? `<button type="button" class="btn-card-action btn-card-pad" title="Abrir diretamente no Pad Sequenciador">
             <span>🥁 Abrir no Pad</span>
           </button>`
        : `<button type="button" class="btn-card-action btn-card-multitrack" title="Abrir diretamente no Estúdio Multitrack">
             <span>🎛️ Abrir no Estúdio</span>
           </button>`;

      card.innerHTML = `
        <div class="home-breque-card-top">
          <div class="home-breque-title-wrap">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span class="home-breque-name">${escapeHtml(name)}</span>
              <span class="home-open-hint">${lastMode === 'studio' ? '🎛️ Estúdio →' : '🥁 Pad →'}</span>
            </div>
            <div class="home-breque-badges">
              <span class="home-badge-pill">${bpm} BPM</span>
              ${hasPad ? `<span class="home-badge-pill">🥁 Pad (${measures} Comp)</span>` : ''}
              ${studioTracks > 0 ? `<span class="home-badge-pill" style="background:rgba(218,54,51,0.16); color:#ff7b72; border-color:rgba(218,54,51,0.35);">🎙️ ${studioRecorded}/${studioTracks} Faixas</span>` : ''}
              <span class="home-badge-pill ${isCustom ? '' : 'pill-native'}">
                ${isCustom ? '⭐ Meu Breque' : '🏛️ Repertório Naumteria'}
              </span>
            </div>
          </div>
        </div>
        <div class="home-breque-actions">
          <button type="button" class="btn-card-action btn-card-play" title="${isPlayingThis ? 'Parar preview' : 'Ouvir preview'}" aria-label="${isPlayingThis ? 'Parar preview' : 'Ouvir preview'}">
            <span>${isPlayingThis ? '⏹ Parar' : '▶ Ouvir'}</span>
          </button>
          ${altModeButtonHtml}
          ${isCustom ? `
            <button type="button" class="btn-card-action btn-card-delete" title="Excluir este breque" aria-label="Excluir ${escapeHtml(name)}">
              <span>🗑</span>
            </button>
          ` : ''}
        </div>
      `;

      // Clique ou Enter/Espaço no card abre o Breque no último modo usado (Pad ou Estúdio)
      card.onclick = () => {
        openBrequeProject(id, lastMode);
      };
      card.onkeydown = (e) => {
        if (e.target === card && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          openBrequeProject(id, lastMode);
        }
      };

      // Evento Preview Play / Stop
      const btnPlay = card.querySelector('.btn-card-play');
      if (btnPlay) {
        btnPlay.onclick = (e) => {
          e.stopPropagation();
          if (activePreviewPresetId === id && state.isPlaying) {
            stopPlayback();
            activePreviewPresetId = null;
            renderHomeBrequesList();
          } else {
            stopPlayback();
            if (!hasPad && studioTracks > 0) {
              openBrequeProject(id, 'studio');
              return;
            }
            activePreviewPresetId = id;
            applyBateriaPresetObject(presetObj);
            startPlayback();
            renderHomeBrequesList();
          }
        };
      }

      // Atalho: Abrir direto no Pad
      const btnPad = card.querySelector('.btn-card-pad');
      if (btnPad) {
        btnPad.onclick = (e) => {
          e.stopPropagation();
          openBrequeProject(id, 'pad');
        };
      }

      // Atalho: Abrir direto no Estúdio
      const btnMulti = card.querySelector('.btn-card-multitrack');
      if (btnMulti) {
        btnMulti.onclick = (e) => {
          e.stopPropagation();
          openBrequeProject(id, 'studio');
        };
      }

      // Evento Excluir (apenas para custom)
      const btnDel = card.querySelector('.btn-card-delete');
      if (btnDel) {
        btnDel.onclick = async (e) => {
          e.stopPropagation();
          const confirmed = await window.appConfirm(`Deseja realmente excluir o breque "${name}"?`, 'Excluir Breque', { isDanger: true, confirmText: 'Excluir' });
          if (confirmed) {
            const rawKey = id.replace('custom:', '');
            delete customBateriaPresets[rawKey];
            saveCustomBateriaPresetsToStorage(customBateriaPresets);
            if (window.BeatboxStudio && typeof window.BeatboxStudio.deleteProjectFromDB === 'function') {
              await window.BeatboxStudio.deleteProjectFromDB(id);
            }
            updateBateriaPresetSelect();
            renderHomeBrequesList();
            window.appToast('Breque excluído com sucesso.', 'info');
          }
        };
      }

      return card;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Sincronização de estado de reprodução (atualiza ícones da Home quando ativo)
    function syncGlobalPlayButton() {
      if (currentActiveTab === 'tab-home') {
        renderHomeBrequesList();
      }
    }
    window.syncGlobalPlayButton = syncGlobalPlayButton;

    // Clique no status pill do topo para ajuste rápido de BPM
    if (mobStatusPill) {
      mobStatusPill.onclick = async () => {
        const studioSummary = window.BeatboxStudio && typeof window.BeatboxStudio.getProjectSummary === 'function'
          ? window.BeatboxStudio.getProjectSummary()
          : null;
        const curBpm = currentActiveTab === 'tab-beatbox' ? (studioSummary && studioSummary.bpm ? studioSummary.bpm : 120) : state.bpm;
        const newBpm = await window.appPrompt('Defina o andamento (BPM):', curBpm, 'Ajustar Andamento (BPM)');
        if (newBpm && !isNaN(newBpm)) {
          const parsed = Math.min(220, Math.max(60, parseInt(newBpm, 10)));
          if (currentActiveTab === 'tab-beatbox') {
            const studioBpmInput = document.getElementById('studioBpm');
            if (studioBpmInput) {
              studioBpmInput.value = parsed;
              studioBpmInput.dispatchEvent(new Event('input'));
            }
          } else {
            const bpmSlider = document.getElementById('bpmSlider');
            if (bpmSlider) {
              bpmSlider.value = parsed;
              bpmSlider.dispatchEvent(new Event('input'));
            }
          }
          window.appToast(`BPM ajustado para ${parsed}`, 'info');
        }
      };
    }

    // Notificação de Fones de Ouvido ao Gravar
    function showHeadphonesToast() {
      if (!mobileHeadphonesToast) return;
      // No máximo um aviso por vez: o de fones tem prioridade sobre a dica de orientação.
      if (mobileOrientHint) mobileOrientHint.style.display = 'none';
      mobileHeadphonesToast.style.display = 'flex';
      setTimeout(() => {
        if (mobileHeadphonesToast) mobileHeadphonesToast.style.display = 'none';
      }, 5000);
    }
    window.showHeadphonesToast = showHeadphonesToast;
    if (btnDismissHp) {
      btnDismissHp.onclick = () => {
        if (mobileHeadphonesToast) mobileHeadphonesToast.style.display = 'none';
      };
    }

    // Banner de Orientação de Tela (Exibido APENAS em vistas de timeline/grade em retrato mobile)
    let orientTimer = null;
    function isTimelineViewActive() {
      if (currentActiveTab === 'tab-sequencer') return true;
      if (currentActiveTab === 'tab-beatbox') {
        const summary = window.BeatboxStudio && typeof window.BeatboxStudio.getProjectSummary === 'function'
          ? window.BeatboxStudio.getProjectSummary()
          : null;
        const vm = summary && summary.viewMode ? summary.viewMode : 'timeline';
        return vm === 'timeline';
      }
      return false;
    }

    function checkOrientation() {
      if (!mobileOrientHint) return;
      const isMobile = window.innerWidth <= 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      const dismissed = sessionStorage.getItem('orient_hint_dismissed');

      const headphonesShowing = mobileHeadphonesToast && mobileHeadphonesToast.style.display !== 'none';
      if (isMobile && isPortrait && !dismissed && !headphonesShowing && isTimelineViewActive()) {
        mobileOrientHint.style.display = 'flex';
        clearTimeout(orientTimer);
        orientTimer = setTimeout(() => {
          if (mobileOrientHint) mobileOrientHint.style.display = 'none';
        }, 5000);
      } else {
        clearTimeout(orientTimer);
        mobileOrientHint.style.display = 'none';
      }
    }
    window.checkOrientation = checkOrientation;

    if (btnDismissOrient) {
      btnDismissOrient.onclick = () => {
        if (mobileOrientHint) mobileOrientHint.style.display = 'none';
        sessionStorage.setItem('orient_hint_dismissed', 'true');
      };
    }

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    // Desbloqueio Antecipado de Áudio no Primeiro Toque (iOS / Android)
    function unlockAudioOnFirstTouch() {
      if (typeof audio !== 'undefined' && audio) audio.init();
      document.removeEventListener('touchstart', unlockAudioOnFirstTouch);
      document.removeEventListener('pointerdown', unlockAudioOnFirstTouch);
    }
    document.addEventListener('touchstart', unlockAudioOnFirstTouch, { passive: true });
    document.addEventListener('pointerdown', unlockAudioOnFirstTouch, { passive: true });

    // Registro do Service Worker e Instalação PWA
    let deferredPrompt = null;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker registrado com sucesso.'))
        .catch(err => console.log('Erro ao registrar Service Worker:', err));
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (mobHeaderInstall) {
        mobHeaderInstall.style.display = 'inline-flex';
      }
    });

    if (mobHeaderInstall) {
      mobHeaderInstall.onclick = async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log('Resultado da instalação PWA:', outcome);
          deferredPrompt = null;
          mobHeaderInstall.style.display = 'none';
        } else {
          window.appAlert('Para instalar no celular: toque no menu de 3 pontinhos do navegador e selecione "Adicionar à tela de início" ou "Instalar aplicativo".');
        }
      };
    }


    // Desbloqueio universal do Web Audio API no primeiro gesto do usuário
    ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'].forEach(evt => {
      window.addEventListener(evt, () => {
        if (typeof audio !== 'undefined' && audio) {
          audio.init();
        }
      }, { once: true, passive: true });
    });

    // Atalhos Globais de Teclado (Desktop): Espaço para Play/Pause no Sequenciador, Esc para fechar modais
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.code === 'Escape') {
        if ((seqSettingsPopover && seqSettingsPopover.classList.contains('open')) ||
            (seqActionsPopover && seqActionsPopover.classList.contains('open'))) {
          e.preventDefault();
          closeSeqPopovers();
          return;
        }
        const appDialog = document.getElementById('appDialogModal');
        if (appDialog && appDialog.style.display !== 'none') {
          e.preventDefault();
          appDialog.style.display = 'none';
          return;
        }
        if (modalNewBreque && modalNewBreque.style.display !== 'none') {
          e.preventDefault();
          closeModalNewBreque();
        }
      } else if (e.code === 'Space') {
        const tabSequencer = document.getElementById('tab-sequencer');
        if (tabSequencer && tabSequencer.classList.contains('active')) {
          e.preventDefault();
          const btnPlay = document.getElementById('btnPlay');
          if (btnPlay) btnPlay.click();
        }
      }
    });

    window.addEventListener('DOMContentLoaded', () => {
      state.gridData = {};
      initGridData();
      updateBateriaPresetSelect();
      renderStudio();
      checkOrientation();
      checkSharedBrequeUrl();
      if (window.BeatboxStudio) {
        window.BeatboxStudio.init();
      }
      switchTab('tab-home');
      routeReady = true;
      if (window.location.hash.startsWith('#/b/')) applyRoute();
      else if (!window.location.hash.startsWith('#breque=')) history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
    });
