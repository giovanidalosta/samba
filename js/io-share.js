    /* =========================================================================
       7. IMPORTAÇÃO E EXPORTAÇÃO JSON / ENVIO AO STUDIO MULTITRACK / IMPRESSÃO
       ========================================================================= */
    function exportToJSON() {
      const exportObject = {
        app: 'BateriaBrequesStudio',
        version: '2.1',
        createdAt: new Date().toISOString(),
        settings: {
          bpm: state.bpm,
          meter: state.meter,
          subdivision: state.subdivision,
          measures: state.measures,
          volumes: state.volumes,
          beatTuplets: state.beatTuplets
        },
        customGrooves,
        customBateriaPresets,
        gridData: state.gridData
      };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `breque_naumteria_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    function importFromJSON(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.tracks && (data.measures || data.bpm)) {
            // Arquivo de preset individual de bateria
            applyBateriaPresetObject(data);
            if (data.name) {
              const presetId = data.id || ('preset_' + Date.now());
              customBateriaPresets[presetId] = data;
              saveCustomBateriaPresetsToStorage(customBateriaPresets);
              updateBateriaPresetSelect();
            }
            return;
          }

          if (!data.gridData || !data.settings) {
            window.appAlert('Arquivo JSON inválido para o Naumteria Studio.');
            return;
          }

          stopPlayback();
          state.bpm = data.settings.bpm || 120;
          state.meter = data.settings.meter || '2/4';
          state.subdivision = data.settings.subdivision || 'semicolcheia';
          state.measures = data.settings.measures || 4;
          if (data.settings.volumes) {
            state.volumes = { ...state.volumes, ...data.settings.volumes };
          }
          state.beatTuplets = data.settings.beatTuplets ? { ...data.settings.beatTuplets } : {};
          if (data.customGrooves && typeof data.customGrooves === 'object') {
            Object.assign(customGrooves, data.customGrooves);
            saveCustomGroovesToStorage(customGrooves);
          }
          if (data.customBateriaPresets && typeof data.customBateriaPresets === 'object') {
            Object.assign(customBateriaPresets, data.customBateriaPresets);
            saveCustomBateriaPresetsToStorage(customBateriaPresets);
            updateBateriaPresetSelect();
          }
          state.gridData = data.gridData;

          document.getElementById('bpmSlider').value = state.bpm;
          document.getElementById('bpmDisplay').textContent = state.bpm;
          document.getElementById('meterSelect').value = state.meter;
          document.getElementById('subdivSelect').value = state.subdivision;
          document.getElementById('measureCountDisplay').textContent = `${state.measures} Compassos`;

          renderStudio();
        } catch (err) {
          window.appAlert('Erro ao processar o arquivo: ' + err.message);
        }
      };
      reader.readAsText(file);
    }

    async function sendSequenceToMultitrackStudio() {
      const hasAnyNote = INSTRUMENTS.some(inst =>
        (state.gridData[inst.id] || []).some(n => n !== null)
      );
      if (!hasAnyNote) {
        if (currentActiveTab === 'tab-beatbox') {
          if (await window.appConfirm('O Pad deste breque ainda não tem notas desenhadas. Deseja ir para o Pad agora para montar a levada?', 'Pad vazio', { confirmText: 'Ir para o Pad' })) {
            switchTab('tab-sequencer');
          }
        } else {
          window.appAlert('Desenhe algumas notas ou escolha uma Levada no Pad antes de importar para o Estúdio.');
        }
        return;
      }

      const btn = document.getElementById('btnSendToStudio');
      const btnImport = document.getElementById('btnImportFromPad');
      const originalText = btn ? btn.innerHTML : '';
      const originalImportText = btnImport ? btnImport.innerHTML : '';
      try {
        if (btn) {
          btn.disabled = true;
          btn.textContent = '⏳ Renderizando...';
        }
        if (btnImport) {
          btnImport.disabled = true;
          btnImport.textContent = '⏳ Importando Pad...';
        }
        stopPlayback();

        const totalSteps = getTotalSteps();
        const stepsPerMeasure = getStepsPerMeasure();
        const { wavBlob, durationSec } = await audio.renderSequenceToWavBlob(
          state,
          INSTRUMENTS,
          totalSteps,
          stepsPerMeasure
        );

        // Identifica quais instrumentos estão ativos na grade exportada para dar o nome automático da faixa
        const hasAnySolo = Object.values(state.solos).some(v => v === true);
        const activeInsts = INSTRUMENTS.filter(inst => {
          if (state.mutes[inst.id]) return false;
          if (hasAnySolo && !state.solos[inst.id]) return false;
          return (state.gridData[inst.id] || []).some(n => n !== null);
        });
        let importedTrackName = 'Bateria (Pad)';
        if (activeInsts.length === 1) {
          importedTrackName = activeInsts[0].name;
        } else if (activeInsts.length >= 2 && activeInsts.length <= 3) {
          importedTrackName = activeInsts.map(i => i.name).join(' + ');
        }

        if (window.BeatboxStudio && typeof window.BeatboxStudio.importSequencerBounce === 'function') {
          await window.BeatboxStudio.importSequencerBounce(
            wavBlob,
            durationSec,
            state.bpm,
            state.meter,
            state.measures,
            importedTrackName
          );
          if (typeof saveActiveBrequeState === 'function') {
            saveActiveBrequeState('studio');
          }
          switchTab('tab-beatbox');
        }
      } catch (err) {
        console.error('Erro ao enviar breque para o Estúdio:', err);
        window.appAlert('Não foi possível renderizar o breque: ' + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
        if (btnImport) {
          btnImport.disabled = false;
          btnImport.innerHTML = originalImportText;
        }
      }
    }
    window.importPadToCurrentStudio = sendSequenceToMultitrackStudio;

    function updatePrintDetails() {
      const printDetails = document.getElementById('printDetails');
      if (printDetails) {
        printDetails.textContent = `BPM: ${state.bpm} | Fórmula: ${state.meter} | Subdivisão: ${state.subdivision} | Total: ${state.measures} compasso(s)`;
      }
    }
