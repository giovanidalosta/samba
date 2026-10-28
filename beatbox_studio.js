/* =========================================================================
   SAMBA BREQUE STUDIO - BEATBOX & VIDEO MOSAIC LOGIC
   ========================================================================= */

(function () {
  'use strict';

  // --- IndexedDB Database Helper ---
  const DB_NAME = 'SambaBrequeStudioDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'studio_project';

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveProjectToDB(data) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id: 'current_project', data, updatedAt: Date.now() });
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = rej;
      });
    } catch (err) {
      console.warn('Erro ao salvar no IndexedDB:', err);
    }
  }

  async function loadProjectFromDB() {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('current_project');
      return new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn('Erro ao carregar do IndexedDB:', err);
      return null;
    }
  }

  // --- Web Audio Context ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Som do metrônomo sintético (Web Audio puro)
  function playMetronomeClick(isAccent = false) {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isAccent ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isAccent ? 1200 : 800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(isAccent ? 0.8 : 0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.warn('Metrônomo áudio error:', e);
    }
  }

  // --- Presets de Nomes com Onomatopeias de Boca ---
  const INSTRUMENT_PRESETS = [
    'Surdo 1ª (Tum)',
    'Surdo 2ª (Tump)',
    'Caixa (Tchá)',
    'Repique (Tá-tá)',
    'Tamborim (Teleco-teco)',
    'Agogô (Dlim-dlom)',
    'Cuíca (Ronco)',
    'Ganzá (Tchi-tchi)',
    'Breque (Voz / Fala)'
  ];

  const INSTRUMENT_COLORS = [
    '#3b82f6', // Surdo 1ª (Azul Real)
    '#06b6d4', // Surdo 2ª (Ciano)
    '#f97316', // Caixa (Laranja Samba)
    '#eab308', // Repique (Amarelo)
    '#10b981', // Tamborim (Verde Esmeralda)
    '#8b5cf6', // Agogô (Roxo Vibrante)
    '#ec4899', // Cuíca (Rosa Magenta)
    '#84cc16', // Ganzá (Verde Lima)
    '#ef4444'  // Breque (Voz / Fala - Vermelho)
  ];

  // --- Estado do Beatbox Studio ---
  const state = {
    bpm: 120,
    meter: '2/4', // 2/4 ou 4/4
    mode: 'free', // 'free' (tamanho baseado na gravação) ou 'fixed' (compassos fixos)
    measures: 4, // 2, 4, 8, 16, 32
    looping: false, // false = tocar até o fim da gravação e parar; true = repetir em loop contínuo
    metronomeEnabled: true,
    layout: 'auto',
    viewMode: 'timeline', // 'timeline' (DAW estilo REAPER) ou 'mosaic' (Mosaico de Vídeos)
    zoomLevel: 100, // 100, 125, 150, 200
    snapToGrid: true,
    isPlaying: false,
    playbackTimer: null,
    tracks: []
  };

  // --- Objeto da Faixa (Track) ---
  function createTrack(name, initialIndex) {
    return {
      id: 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: name || (INSTRUMENT_PRESETS[initialIndex] || `Instrumento ${initialIndex + 1}`),
      mediaBlob: null,
      mediaUrl: null,
      mediaType: 'video', // 'video' | 'audio'
      volume: 1.0, // 0.0 a 1.5
      muted: false,
      solo: false,
      offsetMs: 0, // -500 a 500 ms
      trimStart: 0,
      trimEnd: 0,
      duration: 0, // Duração real da gravação em segundos
      videoElement: null,
      audioNode: null,
      gainNode: null
    };
  }

  // --- Elementos do DOM ---
  let dom = {};

  function cacheDom() {
    dom.btnMasterPlay = document.getElementById('btnStudioPlay');
    dom.btnMasterStop = document.getElementById('btnStudioStop');
    dom.btnToggleLoop = document.getElementById('btnToggleLoop');
    dom.loopIcon = document.getElementById('loopIcon');
    dom.loopText = document.getElementById('loopText');
    dom.btnTimelineLoop = document.getElementById('btnTimelineLoop');
    dom.bpmInput = document.getElementById('studioBpm');
    dom.bpmVal = document.getElementById('studioBpmVal');
    dom.btnBpmMinus = document.getElementById('btnBpmMinus');
    dom.btnBpmPlus = document.getElementById('btnBpmPlus');
    dom.meterSelect = document.getElementById('studioMeter');
    dom.modeSelect = document.getElementById('studioMode');
    dom.measuresSelect = document.getElementById('studioMeasures');
    dom.measuresGroup = document.getElementById('measuresGroup');
    dom.btnToggleMetronome = document.getElementById('btnStudioMetronome');
    dom.led1 = document.getElementById('metroLed1');
    dom.led2 = document.getElementById('metroLed2');
    dom.mosaicGrid = document.getElementById('mosaicGrid');
    dom.btnAddTrack = document.getElementById('btnAddTrack');
    dom.btnExportVideo = document.getElementById('btnExportVideo');
    dom.btnExportAudio = document.getElementById('btnExportAudio');
    dom.btnSaveProject = document.getElementById('btnSaveProject');
    dom.btnLoadProject = document.getElementById('btnLoadProject');
    dom.projectFileInput = document.getElementById('projectFileInput');

    // Seletor de Modo de Exibição (Reaper Timeline vs Mosaico)
    dom.btnViewTimeline = document.getElementById('btnViewTimeline');
    dom.btnViewMosaic = document.getElementById('btnViewMosaic');
    dom.timelineWorkspace = document.getElementById('timelineWorkspace');
    dom.mosaicWorkspace = document.getElementById('mosaicWorkspace');

    // Elementos da DAW estilo REAPER
    dom.reaperTimeBars = document.getElementById('reaperTimeBars');
    dom.reaperTimeSeconds = document.getElementById('reaperTimeSeconds');
    dom.reaperLoopInfo = document.getElementById('reaperLoopInfo');
    dom.reaperRulerBars = document.getElementById('reaperRulerBars');
    dom.reaperRulerTrack = document.getElementById('reaperRulerTrack');
    dom.reaperPlayhead = document.getElementById('reaperPlayhead');
    dom.reaperTracksStack = document.getElementById('reaperTracksStack');
    dom.reaperDawMain = document.getElementById('reaperDawMain');
    dom.btnZoomMinus = document.getElementById('btnZoomMinus');
    dom.btnZoomPlus = document.getElementById('btnZoomPlus');
    dom.zoomLevelVal = document.getElementById('zoomLevelVal');
    dom.btnSnapToggle = document.getElementById('btnSnapToggle');
    dom.btnTimelineAddTrack = document.getElementById('btnTimelineAddTrack');

    // Status da Sub-barra
    dom.statTrackCount = document.getElementById('statTrackCount');
    dom.statLoopDuration = document.getElementById('statLoopDuration');
    dom.statViewMode = document.getElementById('statViewMode');

    // Modal de Gravação
    dom.recordModal = document.getElementById('recordModal');
    dom.recordModalTitle = document.getElementById('recordModalTitle');
    dom.recordCloseBtn = document.getElementById('recordCloseBtn');
    dom.viewfinderVideo = document.getElementById('viewfinderVideo');
    dom.recModeVideoBtn = document.getElementById('recModeVideoBtn');
    dom.recModeAudioBtn = document.getElementById('recModeAudioBtn');
    dom.audioOnlyViewfinder = document.getElementById('audioOnlyViewfinder');
    dom.audioViewfinderInstrument = document.getElementById('audioViewfinderInstrument');
    dom.audioPulsingCircle = document.getElementById('audioPulsingCircle');
    dom.countdownOverlay = document.getElementById('countdownOverlay');
    dom.countdownNumber = document.getElementById('countdownNumber');
    dom.countdownSubtext = document.getElementById('countdownSubtext');
    dom.recLiveIndicator = document.getElementById('recLiveIndicator');
    dom.recProgressBar = document.getElementById('recProgressBar');
    dom.micMeterLevel = document.getElementById('micMeterLevel');
    dom.btnStartRecord = document.getElementById('btnStartRecord');
    dom.recordTipText = document.getElementById('recordTipText');
    dom.reviewActions = document.getElementById('reviewActions');
    dom.btnKeepTake = document.getElementById('btnKeepTake');
    dom.btnDiscardTake = document.getElementById('btnDiscardTake');

    // Modal de Exportação
    dom.exportModal = document.getElementById('exportModal');
    dom.exportTitle = document.getElementById('exportTitle');
    dom.exportStatus = document.getElementById('exportStatus');
    dom.exportProgressBar = document.getElementById('exportProgressBar');
    dom.exportCloseBtn = document.getElementById('exportCloseBtn');
    dom.exportRenderCanvas = document.getElementById('exportRenderCanvas');
  }

  // --- Alternar Modo de Loop (Repetir vs Tocar até o fim) ---
  function toggleLoopMode() {
    state.looping = !state.looping;
    updateLoopUi();
    updateQuickStats();
    saveCurrentSession();
  }

  function updateLoopUi() {
    if (dom.btnToggleLoop) {
      dom.btnToggleLoop.classList.toggle('loop-active', state.looping);
      if (dom.loopText) dom.loopText.textContent = state.looping ? 'Loop: Ligado' : 'Loop: Desligado';
    }
    if (dom.btnTimelineLoop) {
      dom.btnTimelineLoop.classList.toggle('loop-active', state.looping);
      dom.btnTimelineLoop.innerHTML = `<span>🔁</span> Loop: ${state.looping ? 'On' : 'Off'}`;
    }
  }

  // --- Cálculo da Duração Total da Timeline (Baseado no Tamanho Real da Gravação) ---
  function getTimelineDurationSec() {
    let maxDur = 0;
    state.tracks.forEach(t => {
      if (t.mediaUrl && t.duration > 0) {
        const durWithOffset = t.duration + Math.max(0, (t.offsetMs || 0) / 1000);
        if (durWithOffset > maxDur) maxDur = durWithOffset;
      }
    });

    if (state.mode === 'fixed') {
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      return (state.measures * beatsPerMeasure * 60) / state.bpm;
    }

    // Modo Livre: a duração é determinada pela tomada mais longa gravada
    if (maxDur > 0) {
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const measureDurationSec = (beatsPerMeasure * 60) / state.bpm;
      const totalMeasures = Math.max(2, Math.ceil(maxDur / measureDurationSec));
      return totalMeasures * measureDurationSec;
    }

    // Padrão inicial se nada foi gravado: 4 compassos
    const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
    return (4 * beatsPerMeasure * 60) / state.bpm;
  }

  // --- Alternância entre Modo Faixas REAPER e Mosaico ---
  function switchViewMode(newMode) {
    state.viewMode = newMode;
    if (dom.btnViewTimeline) {
      dom.btnViewTimeline.classList.toggle('active', state.viewMode === 'timeline');
    }
    if (dom.btnViewMosaic) {
      dom.btnViewMosaic.classList.toggle('active', state.viewMode === 'mosaic');
    }
    if (dom.timelineWorkspace) {
      dom.timelineWorkspace.style.display = state.viewMode === 'timeline' ? 'flex' : 'none';
    }
    if (dom.mosaicWorkspace) {
      dom.mosaicWorkspace.style.display = state.viewMode === 'mosaic' ? 'flex' : 'none';
    }
    updateQuickStats();
    saveCurrentSession();
  }

  function updateQuickStats() {
    if (dom.statTrackCount) {
      dom.statTrackCount.textContent = `${state.tracks.length} Faixas`;
    }
    const durSec = getTimelineDurationSec().toFixed(1);
    if (dom.statLoopDuration) {
      dom.statLoopDuration.textContent = state.looping
        ? `${durSec}s (Loop 🔁)`
        : `${durSec}s (Tocar até o fim)`;
    }
    if (dom.statViewMode) {
      dom.statViewMode.textContent = state.viewMode === 'timeline'
        ? 'Modo: Faixas (DAW Reaper)'
        : 'Modo: Mosaico de Câmeras';
    }
    if (dom.reaperLoopInfo) {
      dom.reaperLoopInfo.textContent = state.looping
        ? `${durSec}s (Loop Ativo 🔁)`
        : `${durSec}s (Até o fim)`;
    }
  }

  // --- Renderização do Mosaico de Faixas ---
  function renderMosaic() {
    if (!dom.mosaicGrid) return;
    dom.mosaicGrid.innerHTML = '';
    dom.mosaicGrid.setAttribute('data-count', state.tracks.length);

    state.tracks.forEach((track, index) => {
      const card = document.createElement('div');
      card.className = 'track-card';
      card.id = `card_${track.id}`;

      // Card Header
      const header = document.createElement('div');
      header.className = 'track-card-header';
      header.innerHTML = `
        <div class="track-title-box">
          <div class="track-badge-num">${index + 1}</div>
          <input type="text" class="track-name-input" value="${escapeHtml(track.name)}" data-id="${track.id}" title="Clique para editar o nome do instrumento">
        </div>
        ${state.tracks.length > 1 ? `<button class="track-delete-btn" data-id="${track.id}" title="Remover esta faixa">✕</button>` : ''}
      `;

      // Video/Audio Viewport Stage
      const stage = document.createElement('div');
      stage.className = 'track-video-stage';

      if (track.mediaUrl) {
        if (track.mediaType === 'audio') {
          // Card Especial para Faixa Apenas de Áudio / Voz
          const audioStage = document.createElement('div');
          audioStage.className = 'track-audio-stage-card';
          audioStage.innerHTML = `
            <div class="stage-mic-icon">🎙️</div>
            <div style="font-size: 13px; font-weight: 700; color: #fff;">${escapeHtml(track.name)}</div>
            <div class="stage-audio-badge">Faixa de Áudio (Boca)</div>
          `;
          const audio = document.createElement('audio');
          audio.src = track.mediaUrl;
          audio.preload = 'auto';
          audio.playsInline = true;
          track.videoElement = audio;

          const visualizer = document.createElement('div');
          visualizer.className = 'track-audio-visualizer';
          visualizer.innerHTML = `<div class="track-progress-fill" id="prog_${track.id}"></div>`;

          stage.appendChild(audioStage);
          stage.appendChild(audio);
          stage.appendChild(visualizer);
        } else {
          // Card com Vídeo Normal da Webcam
          const video = document.createElement('video');
          video.className = 'track-video-element';
          video.src = track.mediaUrl;
          video.playsInline = true;
          video.preload = 'auto';
          video.muted = false;
          video.loop = false;
          track.videoElement = video;

          const visualizer = document.createElement('div');
          visualizer.className = 'track-audio-visualizer';
          visualizer.innerHTML = `<div class="track-progress-fill" id="prog_${track.id}"></div>`;

          stage.appendChild(video);
          stage.appendChild(visualizer);
        }
      } else {
        track.videoElement = null;
        const emptyState = document.createElement('div');
        emptyState.className = 'track-empty-state';
        emptyState.innerHTML = `
          <div class="empty-icon">🎙️</div>
          <div style="font-size: 13px; font-weight: 600; color: #f8fafc;">Faixa Vazia</div>
          <div style="font-size: 11px; color: var(--text-muted); max-width: 210px;">Grave o som da boca usando sua câmera ou apenas o microfone.</div>
          <div class="track-empty-actions">
            <button class="btn-record-slot" data-id="${track.id}" data-mode="video" title="Gravar vídeo com a webcam e áudio do microfone">
              <span>📹</span> Câmera & Mic
            </button>
            <button class="btn-record-audio-slot" data-id="${track.id}" data-mode="audio" title="Gravar apenas o som do microfone sem usar câmera">
              <span>🎙️</span> Só Microfone
            </button>
            <label class="btn-upload-slot" title="Enviar arquivo existente">
              <span>📁</span> Upload
              <input type="file" accept="video/*,audio/*" data-id="${track.id}" class="track-file-uploader" style="display:none;">
            </label>
          </div>
        `;
        stage.appendChild(emptyState);
      }

      // Mixer Strip
      const mixer = document.createElement('div');
      mixer.className = 'track-mixer-strip';

      const volPercent = Math.round(track.volume * 100);
      mixer.innerHTML = `
        <div class="mixer-row-primary">
          <div class="volume-control-box">
            <span style="font-size: 12px;" title="Volume">🔊</span>
            <input type="range" class="volume-slider" min="0" max="1.5" step="0.05" value="${track.volume}" data-id="${track.id}" title="Volume: ${volPercent}%">
            <span class="volume-val-badge">${volPercent}%</span>
          </div>
          <div class="mute-solo-group">
            <button class="btn-mute ${track.muted ? 'active' : ''}" data-id="${track.id}" title="Silenciar instrumento (Mute)">M</button>
            <button class="btn-solo ${track.solo ? 'active' : ''}" data-id="${track.id}" title="Tocar apenas este instrumento (Solo)">S</button>
          </div>
        </div>

        <div class="mixer-row-secondary">
          <div class="nudge-controls">
            <span style="font-weight: 600; color: var(--text-muted);">Sync:</span>
            <button class="btn-nudge" data-id="${track.id}" data-delta="-20" title="Adiantar 20ms">-20</button>
            <button class="btn-nudge" data-id="${track.id}" data-delta="-5" title="Adiantar 5ms">-5</button>
            <span class="nudge-val-display" title="Ajuste fino de sincronia">${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms</span>
            <button class="btn-nudge" data-id="${track.id}" data-delta="5" title="Atrasar 5ms">+5</button>
            <button class="btn-nudge" data-id="${track.id}" data-delta="20" title="Atrasar 20ms">+20</button>
          </div>

          <div class="track-extra-actions">
            ${track.mediaUrl ? `
              <button class="btn-track-action btn-re-record" data-id="${track.id}" data-mode="video" title="Regravar com a webcam">📹 Câmera</button>
              <button class="btn-track-action btn-re-record" data-id="${track.id}" data-mode="audio" title="Regravar apenas com o microfone">🎙️ Mic</button>
              <button class="btn-track-action btn-clear-media" data-id="${track.id}" title="Remover gravação">🗑️</button>
            ` : ''}
          </div>
        </div>
      `;

      card.appendChild(header);
      card.appendChild(stage);
      card.appendChild(mixer);
      dom.mosaicGrid.appendChild(card);
    });

    bindTrackEvents();
    updateAudioMixRouting();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Eventos das Faixas ---
  function bindTrackEvents() {
    // Título editável
    dom.mosaicGrid.querySelectorAll('.track-name-input').forEach(input => {
      input.onchange = (e) => {
        const id = e.target.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.name = e.target.value.trim() || 'Instrumento';
          saveCurrentSession();
        }
      };
    });

    // Excluir faixa
    dom.mosaicGrid.querySelectorAll('.track-delete-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        if (state.tracks.length <= 1) return;
        if (confirm('Deseja remover esta faixa e seu vídeo gravado?')) {
          removeTrack(id);
        }
      };
    });

    // Botão Gravar no card vazio (Câmera ou Só Microfone) e Regravar
    dom.mosaicGrid.querySelectorAll('.btn-record-slot, .btn-record-audio-slot, .btn-re-record').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const mode = btn.dataset.mode || 'video';
        openRecordingModal(id, mode);
      };
    });

    // Upload de arquivo de vídeo/áudio
    dom.mosaicGrid.querySelectorAll('.track-file-uploader').forEach(input => {
      input.onchange = (e) => {
        const id = input.dataset.id;
        const file = e.target.files[0];
        if (file) {
          loadMediaFileToTrack(id, file);
        }
      };
    });

    // Limpar vídeo gravado
    dom.mosaicGrid.querySelectorAll('.btn-clear-media').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track && confirm(`Limpar gravação de "${track.name}"?`)) {
          if (track.mediaUrl) URL.revokeObjectURL(track.mediaUrl);
          track.mediaUrl = null;
          track.mediaBlob = null;
          track.duration = 0;
          renderMosaic();
          saveCurrentSession();
        }
      };
    });

    // Volume Slider
    dom.mosaicGrid.querySelectorAll('.volume-slider').forEach(slider => {
      slider.oninput = (e) => {
        const id = slider.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.volume = parseFloat(e.target.value);
          const badge = slider.parentElement.querySelector('.volume-val-badge');
          if (badge) badge.textContent = `${Math.round(track.volume * 100)}%`;
          updateAudioMixRouting();
        }
      };
      slider.onchange = () => saveCurrentSession();
    });

    // Mute Button
    dom.mosaicGrid.querySelectorAll('.btn-mute').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.muted = !track.muted;
          btn.classList.toggle('active', track.muted);
          updateAudioMixRouting();
          saveCurrentSession();
        }
      };
    });

    // Solo Button
    dom.mosaicGrid.querySelectorAll('.btn-solo').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.solo = !track.solo;
          renderMosaic(); // Re-renderiza para atualizar destaques de solo
          updateAudioMixRouting();
          saveCurrentSession();
        }
      };
    });

    // Sincronia / Nudge Buttons
    dom.mosaicGrid.querySelectorAll('.btn-nudge').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const delta = parseInt(btn.dataset.delta, 10);
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.offsetMs = Math.max(-500, Math.min(500, track.offsetMs + delta));
          const display = btn.parentElement.querySelector('.nudge-val-display');
          if (display) display.textContent = `${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms`;
          renderReaperTimeline(); // Mantém o REAPER sincronizado
          saveCurrentSession();
        }
      };
    });
  }

  // --- Função Unificada de Renderização dos Modos (Faixas REAPER & Mosaico) ---
  function renderStudioViews() {
    renderReaperTimeline();
    renderMosaic();
    updateQuickStats();
    updateAudioMixRouting();
  }

  // --- RENDERIZADOR DA DAW ESTILO REAPER (FAIXAS HORIZONTAIS MULTITRACK) ---
  function renderReaperTimeline() {
    if (!dom.reaperTracksStack || !dom.reaperRulerBars) return;

    // 1. Duração dinâmica da Linha de Tempo com base no tamanho das gravações
    const timelineDurSec = getTimelineDurationSec();
    const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
    const measureDurationSec = (beatsPerMeasure * 60) / state.bpm;
    const measures = Math.max(2, Math.ceil(timelineDurSec / measureDurationSec));

    // Renderiza a Régua de Compassos (Timeline Ruler) cobrindo a gravação
    dom.reaperRulerBars.innerHTML = '';
    for (let m = 1; m <= measures; m++) {
      const barItem = document.createElement('div');
      barItem.className = 'ruler-bar-item';
      barItem.innerHTML = `
        <span>Bar ${m}</span>
        <span class="ruler-sub-label">.1</span>
        <div class="ruler-bar-beat-ticks">
          ${Array.from({ length: beatsPerMeasure }).map(() => '<div class="ruler-tick"></div>').join('')}
        </div>
      `;
      dom.reaperRulerBars.appendChild(barItem);
    }

    // Aplica Zoom na Timeline
    if (dom.reaperDawMain) {
      dom.reaperDawMain.style.width = state.zoomLevel === 100 ? '100%' : `${state.zoomLevel}%`;
    }

    // 2. Renderiza as Faixas Empilhadas (Multitrack Stack)
    dom.reaperTracksStack.innerHTML = '';

    const hasSolo = state.tracks.some(t => t.solo);

    state.tracks.forEach((track, index) => {
      const trackRow = document.createElement('div');
      trackRow.className = `reaper-track-row ${track.solo ? 'is-soloed' : ''} ${track.muted ? 'is-muted' : ''}`;
      trackRow.id = `reaper_row_${track.id}`;

      const trackColor = INSTRUMENT_COLORS[index % INSTRUMENT_COLORS.length];
      const volPercent = Math.round(track.volume * 100);
      const volDb = track.volume === 0 ? '-inf' : (20 * Math.log10(track.volume)).toFixed(1);

      // --- Track Control Panel (TCP à esquerda) ---
      const tcp = document.createElement('div');
      tcp.className = 'reaper-tcp';

      tcp.innerHTML = `
        <div class="tcp-color-strip" style="background: ${trackColor};"></div>

        <!-- Linha 1: Número, Nome e Excluir -->
        <div class="tcp-header-row">
          <span class="tcp-track-number">${String(index + 1).padStart(2, '0')}</span>
          <input type="text" class="tcp-name-input" value="${escapeHtml(track.name)}" data-id="${track.id}" title="Clique para editar o nome da faixa">
          ${state.tracks.length > 1 ? `<button class="tcp-btn-delete" data-id="${track.id}" title="Remover faixa">✕</button>` : ''}
        </div>

        <!-- Linha 2: REC ARM, Mute, Solo e Miniatura -->
        <div class="tcp-controls-row">
          <div class="tcp-arm-mute-solo">
            <button class="btn-rec-arm ${recordingContext.activeTrackId === track.id ? 'armed' : ''}" data-id="${track.id}" title="Armar Pista / Gravar Tomada">●</button>
            <button class="tcp-btn-mute ${track.muted ? 'active' : ''}" data-id="${track.id}" title="Mute [M]">M</button>
            <button class="tcp-btn-solo ${track.solo ? 'active' : ''}" data-id="${track.id}" title="Solo [S]">S</button>
          </div>

          <!-- Miniatura PIP / Preview da Webcam ou Mic -->
          <div class="tcp-media-pip" data-id="${track.id}" title="${track.mediaUrl ? 'Ver tomada gravada' : 'Pista sem gravação'}">
            ${track.mediaUrl ? (
              track.mediaType === 'video'
                ? `<video src="${track.mediaUrl}" muted playsinline loop></video>`
                : `<span class="pip-placeholder">🎙️</span>`
            ) : `<span class="pip-placeholder" style="color: #475569;">+</span>`}
          </div>
        </div>

        <!-- Linha 3: Fader de Volume Horizontal -->
        <div class="tcp-fader-row">
          <span class="fader-icon" title="Volume">VOL</span>
          <input type="range" class="tcp-fader-slider" min="0" max="1.5" step="0.05" value="${track.volume}" data-id="${track.id}" title="Volume: ${volPercent}% (${volDb} dB)">
          <span class="tcp-vol-db">${volPercent}%</span>
        </div>

        <!-- Linha 4: Sincronia Fina e Ações Rápidas -->
        <div class="tcp-footer-row">
          <div class="tcp-sync-box" title="Ajuste fino de sincronismo temporal (offset milissegundos)">
            <button class="tcp-sync-btn" data-id="${track.id}" data-delta="-10">-10</button>
            <span class="tcp-sync-display">${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms</span>
            <button class="tcp-sync-btn" data-id="${track.id}" data-delta="10">+10</button>
          </div>
          <div class="tcp-actions-box">
            <button class="tcp-action-btn btn-tcp-rec" data-id="${track.id}" data-mode="video" title="Gravar com Câmera e Microfone">📹</button>
            <button class="tcp-action-btn btn-tcp-rec" data-id="${track.id}" data-mode="audio" title="Gravar apenas Microfone">🎙️</button>
            <label class="tcp-action-btn" title="Carregar arquivo de áudio/vídeo" style="cursor: pointer; margin: 0;">
              📁
              <input type="file" accept="video/*,audio/*" data-id="${track.id}" class="tcp-file-uploader" style="display:none;">
            </label>
            ${track.mediaUrl ? `<button class="tcp-action-btn btn-tcp-clear" data-id="${track.id}" title="Limpar gravação desta faixa">🗑️</button>` : ''}
          </div>
        </div>
      `;

      // --- Arrange Lane (Linha de Tempo da Faixa à direita) ---
      const lane = document.createElement('div');
      lane.className = 'reaper-arrange-lane';
      lane.id = `reaper_lane_${track.id}`;

      // Linhas verticais de grade (Grid Lines)
      const gridOverlay = document.createElement('div');
      gridOverlay.className = 'lane-grid-overlay';
      for (let m = 1; m <= measures; m++) {
        const gridCol = document.createElement('div');
        gridCol.className = 'lane-grid-col';
        gridOverlay.appendChild(gridCol);
      }
      lane.appendChild(gridOverlay);

      if (track.mediaUrl) {
        // Bloco de Mídia / Item da Pista estilo REAPER
        // O tamanho da faixa reflete EXATAMENTE o tamanho da gravação!
        const mediaItem = document.createElement('div');
        mediaItem.className = 'reaper-media-item';
        mediaItem.id = `media_item_${track.id}`;
        mediaItem.style.borderColor = trackColor;

        const trackDur = track.duration > 0 ? track.duration : timelineDurSec;
        const widthPercent = Math.min(100, Math.max(6, (trackDur / timelineDurSec) * 100));
        const offsetSec = (track.offsetMs || 0) / 1000;
        const leftPercent = Math.max(0, Math.min(94, (offsetSec / timelineDurSec) * 100));

        mediaItem.style.width = widthPercent + '%';
        mediaItem.style.left = leftPercent + '%';
        mediaItem.style.transform = 'none';

        mediaItem.innerHTML = `
          <div class="media-item-header">
            <div class="item-title">
              <span>${track.mediaType === 'video' ? '📹' : '🎙️'}</span>
              <span>Take 01 — ${escapeHtml(track.name)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span class="item-meta-tag item-sync-badge">${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms</span>
              <span class="item-meta-tag" style="background: rgba(255,255,255,0.08); color: #cbd5e1;">${trackDur.toFixed(1)}s</span>
            </div>
          </div>
          <div class="media-item-waveform-wrapper">
            <canvas class="media-item-waveform" id="wf_${track.id}"></canvas>
          </div>
        `;

        lane.appendChild(mediaItem);

        // Desenha a forma de onda acústica no tamanho real do clipe gravado
        requestAnimationFrame(() => {
          const cvs = document.getElementById(`wf_${track.id}`);
          if (cvs) drawWaveform(cvs, track, trackColor);
        });

        // Suporte a arrasto do clipe (Drag & Slide) para sincronização fina
        setupMediaItemDrag(mediaItem, track);
      } else {
        // Faixa vazia com botões rápidos estilo DAW
        const emptyLane = document.createElement('div');
        emptyLane.className = 'reaper-empty-lane';
        emptyLane.innerHTML = `
          <span class="empty-lane-text"><span>🎙️</span> Faixa sem gravação</span>
          <button class="btn-empty-action btn-tcp-rec" data-id="${track.id}" data-mode="video" title="Gravar câmera e voz">
            <span>📹</span> Gravar Câmera
          </button>
          <button class="btn-empty-action btn-tcp-rec" data-id="${track.id}" data-mode="audio" title="Gravar voz pelo microfone">
            <span>🎙️</span> Gravar Microfone
          </button>
        `;
        lane.appendChild(emptyLane);
      }

      trackRow.appendChild(tcp);
      trackRow.appendChild(lane);
      dom.reaperTracksStack.appendChild(trackRow);
    });

    // 3. Botão largo na base da timeline: Inserir Nova Pista
    const addLaneBtn = document.createElement('div');
    addLaneBtn.className = 'reaper-add-track-lane';
    addLaneBtn.innerHTML = `<span>➕</span> Inserir Nova Pista de Instrumento / Breque Vocal (Track)`;
    addLaneBtn.onclick = addTrack;
    dom.reaperTracksStack.appendChild(addLaneBtn);

    bindReaperEvents();
  }

  // --- Desenho da Onda Sonora (Audio Waveform) Realista ---
  function drawWaveform(canvas, track, trackColor) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 600;
    const height = canvas.height = canvas.parentElement.clientHeight || 50;

    ctx.clearRect(0, 0, width, height);

    // Gradiente bonito estilo Reaper
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, trackColor || '#60a5fa');
    grad.addColorStop(0.5, '#38bdf8');
    grad.addColorStop(1, trackColor || '#2563eb');

    ctx.fillStyle = grad;

    // Gerador de picos rítmicos de percussão/breque de alta definição
    const barsCount = Math.floor(width / 3.5);
    const midY = height / 2;
    const seed = hashString(track.id + (track.duration || 1));

    for (let i = 0; i < barsCount; i++) {
      const x = i * 3.5;
      const rhythmPulse = (Math.sin(i * 0.18) * 0.5 + 0.5);
      const noise = pseudoRandom(seed + i);
      const beatAccent = (i % 16 === 0 || i % 16 === 6 || i % 16 === 10) ? 1.5 : 0.8;
      let amp = (noise * 0.65 + rhythmPulse * 0.5) * beatAccent;
      amp = Math.min(1.0, Math.max(0.12, amp));

      const barHeight = amp * (height * 0.82);
      const y = midY - (barHeight / 2);

      ctx.fillRect(x, y, 2, barHeight);
    }
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function pseudoRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // --- Arraste Horizontal do Clipe (Drag & Slide) para Offset Temporal ---
  function setupMediaItemDrag(itemEl, track) {
    let isDragging = false;
    let startX = 0;
    let initialOffset = track.offsetMs || 0;

    itemEl.addEventListener('mousedown', (e) => {
      // Ignora clique se for botão interno
      if (e.target.closest('button') || e.target.closest('input')) return;
      isDragging = true;
      startX = e.clientX;
      initialOffset = track.offsetMs || 0;
      itemEl.classList.add('is-selected');

      const onMouseMove = (moveEvt) => {
        if (!isDragging) return;
        const dx = moveEvt.clientX - startX;
        const laneWidth = itemEl.parentElement.clientWidth || 800;
        const timelineDurSec = getTimelineDurationSec();

        // Converte pixel delta para milissegundos
        const deltaMs = Math.round((dx / laneWidth) * timelineDurSec * 1000);
        let newOffset = Math.max(-500, Math.min(500, initialOffset + deltaMs));

        if (state.snapToGrid) {
          // Snap em múltiplos de 10ms
          newOffset = Math.round(newOffset / 10) * 10;
        }

        track.offsetMs = newOffset;

        // Atualiza posição horizontal relativa (left) e badges
        const offsetSec = (track.offsetMs || 0) / 1000;
        const leftPercent = Math.max(0, Math.min(94, (offsetSec / timelineDurSec) * 100));
        itemEl.style.left = leftPercent + '%';

        const badge = itemEl.querySelector('.item-sync-badge');
        if (badge) badge.textContent = `${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms`;

        const row = document.getElementById(`reaper_row_${track.id}`);
        if (row) {
          const syncDisp = row.querySelector('.tcp-sync-display');
          if (syncDisp) syncDisp.textContent = `${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms`;
        }
      };

      const onMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          itemEl.classList.remove('is-selected');
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          renderMosaic(); // Atualiza mosaico
          saveCurrentSession();
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  // --- Binds de Eventos da DAW estilo REAPER ---
  function bindReaperEvents() {
    if (!dom.reaperTracksStack) return;

    // Edição do nome da faixa
    dom.reaperTracksStack.querySelectorAll('.tcp-name-input').forEach(input => {
      input.onchange = (e) => {
        const id = e.target.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.name = e.target.value.trim() || 'Instrumento';
          renderMosaic(); // Atualiza também o mosaico
          saveCurrentSession();
        }
      };
    });

    // Excluir faixa
    dom.reaperTracksStack.querySelectorAll('.tcp-btn-delete').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        if (state.tracks.length <= 1) return;
        if (confirm('Deseja remover esta pista do projeto?')) {
          removeTrack(id);
        }
      };
    });

    // Botão REC ARM (●) e Botões de Gravação rápida
    dom.reaperTracksStack.querySelectorAll('.btn-rec-arm, .btn-tcp-rec').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const mode = btn.dataset.mode || 'video';
        openRecordingModal(id, mode);
      };
    });

    // Upload de arquivo de áudio/vídeo
    dom.reaperTracksStack.querySelectorAll('.tcp-file-uploader').forEach(input => {
      input.onchange = (e) => {
        const id = input.dataset.id;
        const file = e.target.files[0];
        if (file) {
          loadMediaFileToTrack(id, file);
        }
      };
    });

    // Limpar mídia gravada
    dom.reaperTracksStack.querySelectorAll('.btn-tcp-clear').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track && confirm(`Limpar gravação de "${track.name}"?`)) {
          if (track.mediaUrl) URL.revokeObjectURL(track.mediaUrl);
          track.mediaUrl = null;
          track.mediaBlob = null;
          track.duration = 0;
          renderStudioViews();
          saveCurrentSession();
        }
      };
    });

    // Slider de Volume Horizontal estilo Fader
    dom.reaperTracksStack.querySelectorAll('.tcp-fader-slider').forEach(slider => {
      slider.oninput = (e) => {
        const id = slider.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.volume = parseFloat(e.target.value);
          const percent = Math.round(track.volume * 100);
          const row = slider.closest('.reaper-track-row');
          if (row) {
            const dbLabel = row.querySelector('.tcp-vol-db');
            if (dbLabel) dbLabel.textContent = `${percent}%`;
          }
          // Sincroniza slider no mosaico se visível
          const mosaicSlider = dom.mosaicGrid ? dom.mosaicGrid.querySelector(`.volume-slider[data-id="${id}"]`) : null;
          if (mosaicSlider) {
            mosaicSlider.value = track.volume;
            const badge = mosaicSlider.parentElement.querySelector('.volume-val-badge');
            if (badge) badge.textContent = `${percent}%`;
          }
          updateAudioMixRouting();
        }
      };
      slider.onchange = () => saveCurrentSession();
    });

    // Botão MUTE [M]
    dom.reaperTracksStack.querySelectorAll('.tcp-btn-mute').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.muted = !track.muted;
          btn.classList.toggle('active', track.muted);
          const row = btn.closest('.reaper-track-row');
          if (row) row.classList.toggle('is-muted', track.muted);
          // Reflete no mosaico
          const mosaicBtn = dom.mosaicGrid ? dom.mosaicGrid.querySelector(`.btn-mute[data-id="${id}"]`) : null;
          if (mosaicBtn) mosaicBtn.classList.toggle('active', track.muted);
          updateAudioMixRouting();
          saveCurrentSession();
        }
      };
    });

    // Botão SOLO [S]
    dom.reaperTracksStack.querySelectorAll('.tcp-btn-solo').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.solo = !track.solo;
          renderStudioViews(); // Atualiza destaques de solo em ambos
          saveCurrentSession();
        }
      };
    });

    // Sync Nudge Buttons (-10 / +10)
    dom.reaperTracksStack.querySelectorAll('.tcp-sync-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const delta = parseInt(btn.dataset.delta, 10);
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.offsetMs = Math.max(-500, Math.min(500, track.offsetMs + delta));
          renderStudioViews();
          saveCurrentSession();
        }
      };
    });
  }

  // --- Atualização do Visor Digital LCD estilo REAPER ---
  function updateReaperLcdDisplay(elapsedMs, loopDurationMs) {
    if (!dom.reaperTimeBars && !dom.reaperTimeSeconds) return;

    const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
    const msPerBeat = (60 / state.bpm) * 1000;
    const curTimeMs = elapsedMs % loopDurationMs;

    const totalBeats = curTimeMs / msPerBeat;
    const currentBar = Math.floor(totalBeats / beatsPerMeasure) + 1;
    const currentBeat = Math.floor(totalBeats % beatsPerMeasure) + 1;
    const ticks = Math.floor((totalBeats % 1) * 100);

    const barStr = String(currentBar).padStart(3, '0');
    const beatStr = String(currentBeat).padStart(2, '0');
    const tickStr = String(ticks).padStart(2, '0');

    if (dom.reaperTimeBars) {
      dom.reaperTimeBars.textContent = `${barStr}.${beatStr}.${tickStr}`;
    }

    const sec = Math.floor(curTimeMs / 1000);
    const ms = Math.floor(curTimeMs % 1000);
    const secStr = String(sec).padStart(2, '0');
    const msStr = String(ms).padStart(3, '0');

    if (dom.reaperTimeSeconds) {
      dom.reaperTimeSeconds.textContent = `00:${secStr}.${msStr}`;
    }
  }

  function addTrack() {
    if (state.tracks.length >= 9) {
      alert('Limite de 9 faixas no projeto atingido.');
      return;
    }
    const newTrack = createTrack(null, state.tracks.length);
    state.tracks.push(newTrack);
    renderStudioViews();
    saveCurrentSession();
  }

  function removeTrack(id) {
    const idx = state.tracks.findIndex(t => t.id === id);
    if (idx !== -1) {
      const tr = state.tracks[idx];
      if (tr.mediaUrl) URL.revokeObjectURL(tr.mediaUrl);
      state.tracks.splice(idx, 1);
      renderStudioViews();
      saveCurrentSession();
    }
  }

  function loadMediaFileToTrack(trackId, file) {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return;

    if (track.mediaUrl) URL.revokeObjectURL(track.mediaUrl);
    track.mediaBlob = file;
    track.mediaUrl = URL.createObjectURL(file);
    track.mediaType = file.type.startsWith('video') ? 'video' : 'audio';

    // Determina a duração exata do arquivo para a faixa
    const tempMedia = document.createElement(track.mediaType === 'video' ? 'video' : 'audio');
    tempMedia.src = track.mediaUrl;
    tempMedia.preload = 'metadata';
    tempMedia.onloadedmetadata = () => {
      if (tempMedia.duration && !isNaN(tempMedia.duration) && isFinite(tempMedia.duration)) {
        track.duration = tempMedia.duration;
        renderStudioViews();
        saveCurrentSession();
      }
    };

    renderStudioViews();
    saveCurrentSession();
  }

  // --- Gravação com Webcam & Microfone (Overdubbing) ---
  let recordingContext = {
    activeTrackId: null,
    captureMode: 'video', // 'video' ou 'audio'
    stream: null,
    mediaRecorder: null,
    recordedChunks: [],
    lastRecordedBlob: null,
    micAudioCtx: null,
    micAnalyser: null,
    micAnimationId: null,
    countdownTimer: null,
    recordingTimer: null,
    isRecording: false
  };

  async function setRecordingMode(mode) {
    recordingContext.captureMode = mode;
    if (dom.recModeVideoBtn && dom.recModeAudioBtn) {
      dom.recModeVideoBtn.classList.toggle('active', mode === 'video');
      dom.recModeAudioBtn.classList.toggle('active', mode === 'audio');
    }

    // Para o stream anterior se houver
    if (recordingContext.stream) {
      recordingContext.stream.getTracks().forEach(t => t.stop());
      recordingContext.stream = null;
    }

    const track = state.tracks.find(t => t.id === recordingContext.activeTrackId);
    if (dom.audioViewfinderInstrument && track) {
      dom.audioViewfinderInstrument.textContent = track.name;
    }

    try {
      if (mode === 'audio') {
        // MODO APENAS MICROFONE (não pede câmera)
        if (dom.viewfinderVideo) {
          dom.viewfinderVideo.style.display = 'none';
          dom.viewfinderVideo.srcObject = null;
          dom.viewfinderVideo.src = '';
        }
        if (dom.audioOnlyViewfinder) dom.audioOnlyViewfinder.style.display = 'flex';

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        recordingContext.stream = stream;
        setupMicMeter(stream);
      } else {
        // MODO CÂMERA & MICROFONE
        if (dom.audioOnlyViewfinder) dom.audioOnlyViewfinder.style.display = 'none';
        if (dom.viewfinderVideo) dom.viewfinderVideo.style.display = 'block';

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        recordingContext.stream = stream;
        dom.viewfinderVideo.srcObject = stream;
        dom.viewfinderVideo.muted = true;
        await dom.viewfinderVideo.play();
        setupMicMeter(stream);
      }
    } catch (err) {
      console.error('Erro ao acessar dispositivo no modo ' + mode, err);
      alert(`Não foi possível acessar seu dispositivo no modo ${mode === 'audio' ? 'apenas microfone' : 'câmera'}. Verifique as permissões do navegador.`);
    }
  }

  async function openRecordingModal(trackId, preferredMode = 'video') {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return;

    recordingContext.activeTrackId = trackId;
    dom.recordModalTitle.textContent = `Gravar: ${track.name}`;
    dom.recordModal.classList.add('active');
    dom.reviewActions.classList.remove('active');
    dom.btnStartRecord.style.display = 'inline-flex';
    dom.btnStartRecord.textContent = '🔴 Iniciar Gravação';
    dom.btnStartRecord.classList.remove('is-recording');
    dom.recLiveIndicator.classList.remove('active');
    dom.recProgressBar.style.width = '0%';
    dom.countdownOverlay.classList.remove('active');

    await setRecordingMode(preferredMode);
  }

  function setupMicMeter(stream) {
    try {
      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function updateMeter() {
        if (!recordingContext.stream) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const percent = Math.min(100, Math.round((avg / 128) * 100));
        if (dom.micMeterLevel) dom.micMeterLevel.style.width = percent + '%';

        // Pulsação visual no círculo de áudio quando falando no microfone
        if (dom.audioPulsingCircle && recordingContext.captureMode === 'audio') {
          const scale = 1 + (percent / 100) * 0.25;
          dom.audioPulsingCircle.style.transform = `scale(${scale})`;
        }

        recordingContext.micAnimationId = requestAnimationFrame(updateMeter);
      }
      updateMeter();
    } catch (e) {
      console.warn('VU meter error:', e);
    }
  }

  function closeRecordingModal() {
    stopCurrentRecording(false);

    if (recordingContext.stream) {
      recordingContext.stream.getTracks().forEach(t => t.stop());
      recordingContext.stream = null;
    }
    if (recordingContext.micAnimationId) {
      cancelAnimationFrame(recordingContext.micAnimationId);
      recordingContext.micAnimationId = null;
    }
    if (dom.viewfinderVideo) {
      dom.viewfinderVideo.srcObject = null;
      dom.viewfinderVideo.src = '';
    }

    dom.recordModal.classList.remove('active');
    stopStudioPlayback();
  }

  // Contagem regressiva antes da gravação (1 compasso de pré-roll)
  function startPreRollCountdown() {
    const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
    const beatIntervalMs = (60 / state.bpm) * 1000;
    let count = beatsPerMeasure;

    dom.countdownOverlay.classList.add('active');
    dom.countdownNumber.textContent = count;
    dom.countdownSubtext.textContent = 'Prepare o instrumento da boca...';
    playMetronomeClick(true);

    recordingContext.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        dom.countdownNumber.textContent = count;
        playMetronomeClick(false);
      } else {
        clearInterval(recordingContext.countdownTimer);
        recordingContext.countdownTimer = null;
        dom.countdownOverlay.classList.remove('active');
        startActualRecording();
      }
    }, beatIntervalMs);
  }

  // Início oficial da gravação com overdub nos fones
  function startActualRecording() {
    if (!recordingContext.stream) return;

    recordingContext.recordedChunks = [];
    recordingContext.isRecording = true;

    // Configura MediaRecorder de acordo com o modo (vídeo ou áudio)
    let mimeType;
    if (recordingContext.captureMode === 'audio') {
      mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/ogg';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
    } else {
      mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
    }

    const options = mimeType ? { mimeType } : {};
    const recorder = new MediaRecorder(recordingContext.stream, options);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordingContext.recordedChunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const finalMime = mimeType || (recordingContext.captureMode === 'audio' ? 'audio/webm' : 'video/webm');
      const blob = new Blob(recordingContext.recordedChunks, { type: finalMime });
      recordingContext.lastRecordedBlob = blob;
      showRecordingReview(blob);
    };

    recordingContext.mediaRecorder = recorder;
    recordingContext.recordingStartTime = Date.now();
    recorder.start(100);

    dom.recLiveIndicator.classList.add('active');
    dom.btnStartRecord.textContent = '⏹ Parar Gravação';
    dom.btnStartRecord.classList.add('is-recording');

    // DISPARA OVERDUB NOS FONES:
    // Toca as outras faixas já gravadas e o metrônomo para o usuário acompanhar perfeitamente
    startOverdubMonitoring();

    // Se estiver em modo de compassos fixos, agenda término automático no último compasso
    if (state.mode === 'fixed') {
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const totalBeats = state.measures * beatsPerMeasure;
      const totalDurationMs = (totalBeats * (60 / state.bpm)) * 1000;
      const startTime = Date.now();

      recordingContext.recordingTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, (elapsed / totalDurationMs) * 100);
        dom.recProgressBar.style.width = progress + '%';

        if (elapsed >= totalDurationMs) {
          clearInterval(recordingContext.recordingTimer);
          recordingContext.recordingTimer = null;
          stopCurrentRecording(true);
        }
      }, 50);
    } else {
      // Modo Livre: atualiza o cronômetro da gravação em tempo real
      const startTime = Date.now();
      recordingContext.recordingTimer = setInterval(() => {
        const elapsedSec = (Date.now() - startTime) / 1000;
        dom.recLiveIndicator.innerHTML = `<span class="rec-dot"></span> GRAVANDO: <strong>${elapsedSec.toFixed(1)}s</strong>`;
      }, 100);
    }
  }

  // Reprodução simultânea das outras faixas durante a gravação para o fone do usuário
  function startOverdubMonitoring() {
    const activeTrackId = recordingContext.activeTrackId;

    state.tracks.forEach(track => {
      if (track.id !== activeTrackId && track.videoElement && !track.muted) {
        track.videoElement.currentTime = 0;
        track.videoElement.play().catch(e => console.warn('Overdub play:', e));
      }
    });

    // Metrônomo durante a gravação
    if (state.metronomeEnabled) {
      startMetronomeClock();
    }
  }

  function stopCurrentRecording(hasSuccess) {
    if (recordingContext.countdownTimer) {
      clearInterval(recordingContext.countdownTimer);
      recordingContext.countdownTimer = null;
    }
    if (recordingContext.recordingTimer) {
      clearInterval(recordingContext.recordingTimer);
      recordingContext.recordingTimer = null;
    }

    if (recordingContext.mediaRecorder && recordingContext.mediaRecorder.state !== 'inactive') {
      recordingContext.mediaRecorder.stop();
    }

    // Calcula o tamanho exato da gravação em segundos
    const now = Date.now();
    const start = recordingContext.recordingStartTime || now;
    recordingContext.recordedDurationSec = Math.max(0.5, (now - start) / 1000);

    recordingContext.isRecording = false;
    dom.recLiveIndicator.classList.remove('active');
    dom.btnStartRecord.classList.remove('is-recording');

    // Para o playback das faixas de apoio e o metrônomo
    state.tracks.forEach(t => {
      if (t.videoElement) {
        t.videoElement.pause();
        t.videoElement.currentTime = 0;
      }
    });
    stopMetronomeClock();
  }

  function showRecordingReview(blob) {
    dom.btnStartRecord.style.display = 'none';
    dom.reviewActions.classList.add('active');

    // Reproduz a mídia gravada para o usuário escutar e avaliar
    const mediaUrl = URL.createObjectURL(blob);
    if (recordingContext.captureMode === 'audio') {
      if (dom.audioOnlyViewfinder) dom.audioOnlyViewfinder.style.display = 'flex';
      dom.viewfinderVideo.style.display = 'none';
      dom.viewfinderVideo.srcObject = null;
      dom.viewfinderVideo.src = mediaUrl;
      dom.viewfinderVideo.muted = false;
      dom.viewfinderVideo.loop = true;
      dom.viewfinderVideo.play();
    } else {
      if (dom.audioOnlyViewfinder) dom.audioOnlyViewfinder.style.display = 'none';
      dom.viewfinderVideo.style.display = 'block';
      dom.viewfinderVideo.srcObject = null;
      dom.viewfinderVideo.src = mediaUrl;
      dom.viewfinderVideo.muted = false;
      dom.viewfinderVideo.loop = true;
      dom.viewfinderVideo.play();
    }
  }

  function keepCurrentTake() {
    if (!recordingContext.lastRecordedBlob) return;
    const track = state.tracks.find(t => t.id === recordingContext.activeTrackId);
    if (track) {
      if (track.mediaUrl) URL.revokeObjectURL(track.mediaUrl);
      track.mediaBlob = recordingContext.lastRecordedBlob;
      track.mediaUrl = URL.createObjectURL(recordingContext.lastRecordedBlob);
      track.mediaType = recordingContext.captureMode; // 'audio' ou 'video'
      // Define a duração exata da faixa com base na gravação!
      track.duration = recordingContext.recordedDurationSec || 0;
    }
    closeRecordingModal();
    renderStudioViews();
    saveCurrentSession();
  }

  function discardAndRetry() {
    dom.reviewActions.classList.remove('active');
    dom.btnStartRecord.style.display = 'inline-flex';
    dom.btnStartRecord.textContent = '🔴 Iniciar Gravação';
    dom.recProgressBar.style.width = '0%';
    setRecordingMode(recordingContext.captureMode);
  }

  // --- Sistema de Metrônomo do Studio ---
  let metroClock = {
    timer: null,
    beatCount: 0
  };

  function startMetronomeClock() {
    stopMetronomeClock();
    metroClock.beatCount = 0;
    const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
    const beatIntervalMs = (60 / state.bpm) * 1000;

    metroClock.timer = setInterval(() => {
      const beatInMeasure = (metroClock.beatCount % beatsPerMeasure) + 1;
      const isAccent = beatInMeasure === 1;

      if (state.metronomeEnabled) {
        playMetronomeClick(isAccent);
      }

      // Pisca os LEDs no cabeçalho
      if (dom.led1 && dom.led2) {
        if (isAccent) {
          dom.led1.classList.add('beat-1');
          dom.led2.classList.remove('beat-sub');
          setTimeout(() => dom.led1.classList.remove('beat-1'), 120);
        } else {
          dom.led2.classList.add('beat-sub');
          dom.led1.classList.remove('beat-1');
          setTimeout(() => dom.led2.classList.remove('beat-sub'), 120);
        }
      }

      metroClock.beatCount++;
    }, beatIntervalMs);
  }

  function stopMetronomeClock() {
    if (metroClock.timer) {
      clearInterval(metroClock.timer);
      metroClock.timer = null;
    }
    if (dom.led1) dom.led1.classList.remove('beat-1');
    if (dom.led2) dom.led2.classList.remove('beat-sub');
  }

  // --- Sincronização & Playback Master do Mosaico e Linha de Tempo ---
  function startStudioPlayback() {
    getAudioContext();
    const hasMedia = state.tracks.some(t => t.videoElement);
    if (!hasMedia && !state.metronomeEnabled) {
      alert('Grave pelo menos um instrumento com a boca ou ative o metrônomo para ouvir!');
      return;
    }

    state.isPlaying = true;
    dom.btnMasterPlay.classList.add('playing');
    dom.btnMasterPlay.innerHTML = `<span>⏸</span> Pausar Breque`;

    // Duração total calculada com base na gravação real
    const totalDurationSec = getTimelineDurationSec();
    const totalDurationMs = totalDurationSec * 1000;

    // Inicia todos os vídeos sincronizados
    state.tracks.forEach(track => {
      if (track.videoElement) {
        const offsetSec = (track.offsetMs || 0) / 1000;
        track.videoElement.currentTime = Math.max(0, offsetSec);
        track.videoElement.play().catch(e => console.warn('Play error:', e));

        const card = document.getElementById(`card_${track.id}`);
        if (card) card.classList.add('active-playing');

        const reaperRow = document.getElementById(`reaper_row_${track.id}`);
        if (reaperRow) reaperRow.classList.add('active-playing');
      }
    });

    startMetronomeClock();

    // Timer de Reprodução (Tocar até o fim ou Repetir em Loop)
    const startTime = Date.now();

    clearInterval(state.playbackTimer);
    state.playbackTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;

      // SE LOOP ESTIVER DESLIGADO: Para automaticamente assim que terminar a gravação!
      if (!state.looping && elapsed >= totalDurationMs) {
        stopStudioPlayback();
        return;
      }

      const cycleProgress = (elapsed % totalDurationMs) / totalDurationMs;

      // 1. Atualiza barrinhas de progresso dos vídeos no Mosaico
      state.tracks.forEach(track => {
        const prog = document.getElementById(`prog_${track.id}`);
        if (prog) prog.style.width = (cycleProgress * 100) + '%';
      });

      // 2. Atualiza Playhead (Cursor Vertical) na Timeline estilo REAPER
      if (dom.reaperPlayhead) {
        dom.reaperPlayhead.style.left = (cycleProgress * 100) + '%';
      }

      // 3. Atualiza Visor Digital LCD com Compassos.Batidas.Ticks e Segundos
      updateReaperLcdDisplay(elapsed, totalDurationMs);

      // SE LOOP ESTIVER LIGADO: reseta e reinicia tudo perfeitamente sincronizado a cada ciclo
      if (state.looping && elapsed > 0 && Math.floor(elapsed / totalDurationMs) !== Math.floor((elapsed - 40) / totalDurationMs)) {
        state.tracks.forEach(track => {
          if (track.videoElement) {
            const offsetSec = (track.offsetMs || 0) / 1000;
            track.videoElement.currentTime = Math.max(0, offsetSec);
          }
        });
      }
    }, 30);
  }

  function stopStudioPlayback() {
    state.isPlaying = false;
    clearInterval(state.playbackTimer);
    state.playbackTimer = null;
    stopMetronomeClock();

    if (dom.btnMasterPlay) {
      dom.btnMasterPlay.classList.remove('playing');
      dom.btnMasterPlay.innerHTML = `<span>▶</span> Reproduzir Breque`;
    }

    // Reseta Playhead e Visor Digital LCD
    if (dom.reaperPlayhead) {
      dom.reaperPlayhead.style.left = '0%';
    }
    updateReaperLcdDisplay(0, 1000);

    state.tracks.forEach(track => {
      if (track.videoElement) {
        track.videoElement.pause();
        track.videoElement.currentTime = 0;
      }
      const card = document.getElementById(`card_${track.id}`);
      if (card) card.classList.remove('active-playing');

      const reaperRow = document.getElementById(`reaper_row_${track.id}`);
      if (reaperRow) reaperRow.classList.remove('active-playing');

      const prog = document.getElementById(`prog_${track.id}`);
      if (prog) prog.style.width = '0%';
    });
  }

  // --- Roteamento e Mixagem de Áudio ---
  function updateAudioMixRouting() {
    const hasSolo = state.tracks.some(t => t.solo);

    state.tracks.forEach(track => {
      if (!track.videoElement) return;

      let effectiveVol = track.volume;
      if (track.muted) {
        effectiveVol = 0;
      } else if (hasSolo && !track.solo) {
        effectiveVol = 0;
      }

      // Aplica volume direto no elemento de vídeo (simples, direto, nativo)
      track.videoElement.volume = Math.min(1.0, effectiveVol);
    });
  }

  // --- Exportação de Vídeo Mosaico Completo (Canvas + MediaRecorder) ---
  async function exportMosaicVideo() {
    const recordedTracks = state.tracks.filter(t => t.videoElement);
    if (recordedTracks.length === 0) {
      alert('Grave ou importe ao menos uma faixa para poder exportar o vídeo mosaico!');
      return;
    }

    dom.exportModal.classList.add('active');
    dom.exportTitle.textContent = '🎬 Exportando Vídeo Mosaico Full HD...';
    dom.exportStatus.textContent = 'Iniciando renderizador de vídeo e mixagem...';
    dom.exportProgressBar.style.width = '5%';

    try {
      const canvas = dom.exportRenderCanvas;
      const ctx = canvas.getContext('2d');

      // Resolução 1280x720 (padrão ótimo para compartilhamento ágil)
      canvas.width = 1280;
      canvas.height = 720;

      // Determina grid do canvas
      const count = recordedTracks.length;
      let cols = 2;
      let rows = 2;
      if (count === 1) { cols = 1; rows = 1; }
      else if (count === 2) { cols = 2; rows = 1; }
      else if (count <= 4) { cols = 2; rows = 2; }
      else if (count <= 6) { cols = 3; rows = 2; }
      else { cols = 3; rows = 3; }

      const cellW = canvas.width / cols;
      const cellH = canvas.height / rows;

      // Prepara áudio mixado
      const audioContext = getAudioContext();
      const dest = audioContext.createMediaStreamDestination();

      recordedTracks.forEach(track => {
        if (!track.audioSourceNode) {
          try {
            track.audioSourceNode = audioContext.createMediaElementSource(track.videoElement);
            track.audioGainNode = audioContext.createGain();
            track.audioSourceNode.connect(track.audioGainNode);
            track.audioGainNode.connect(dest);
            track.audioGainNode.connect(audioContext.destination);
          } catch (e) {
            // Se já foi criado, apenas ajusta
          }
        }
        if (track.audioGainNode) {
          track.audioGainNode.gain.value = track.muted ? 0 : track.volume;
        }
      });

      // Stream de vídeo do canvas + áudio
      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 3500000 });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      // Duração de 1 ciclo completo
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const totalBeats = state.measures * beatsPerMeasure;
      const durationSec = (totalBeats * 60) / state.bpm;
      const durationMs = durationSec * 1000;

      recorder.start();

      // Inicia todos os vídeos
      recordedTracks.forEach(t => {
        t.videoElement.currentTime = 0;
        t.videoElement.play();
      });

      const startTime = Date.now();
      let animFrame;

      function drawFrame() {
        // Fundo escuro elegante
        ctx.fillStyle = '#080c14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Desenha cada vídeo na sua célula
        recordedTracks.forEach((track, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const x = c * cellW;
          const y = r * cellH;

          // Desenha vídeo ou card sonoro para faixas de apenas áudio
          if (track.mediaType === 'audio' || (track.videoElement && track.videoElement.tagName.toLowerCase() === 'audio')) {
            // Fundo escuro com gradiente radial para áudio vocal
            const grad = ctx.createRadialGradient(x + cellW / 2, y + cellH / 2, 10, x + cellW / 2, y + cellH / 2, cellW / 1.4);
            grad.addColorStop(0, '#1e293b');
            grad.addColorStop(1, '#080c14');
            ctx.fillStyle = grad;
            ctx.fillRect(x + 4, y + 4, cellW - 8, cellH - 8);

            // Ícone do Microfone central
            ctx.fillStyle = '#38bdf8';
            ctx.font = '42px "Outfit", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🎙️', x + cellW / 2, y + cellH / 2 + 12);
            ctx.textAlign = 'left';
          } else if (track.videoElement && track.videoElement.readyState >= 2) {
            ctx.drawImage(track.videoElement, x + 4, y + 4, cellW - 8, cellH - 8);
          }

          // Moldura
          ctx.strokeStyle = '#27334d';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 4, y + 4, cellW - 8, cellH - 8);

          // Tarja com nome do instrumento
          ctx.fillStyle = 'rgba(14, 19, 32, 0.85)';
          ctx.fillRect(x + 8, y + cellH - 38, cellW - 16, 30);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 15px "Outfit", sans-serif';
          ctx.fillText(track.name, x + 16, y + cellH - 18);
        });

        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, Math.round((elapsed / durationMs) * 100));
        dom.exportProgressBar.style.width = progress + '%';
        dom.exportStatus.textContent = `Renderizando quadro a quadro... ${progress}%`;

        if (elapsed < durationMs) {
          animFrame = requestAnimationFrame(drawFrame);
        } else {
          cancelAnimationFrame(animFrame);
          recorder.stop();
          recordedTracks.forEach(t => t.videoElement.pause());

          recorder.onstop = () => {
            const finalBlob = new Blob(chunks, { type: mimeType });
            downloadBlob(finalBlob, `samba_breque_mosaico_${state.bpm}bpm.webm`);
            dom.exportStatus.textContent = '✅ Exportação concluída com sucesso!';
            dom.exportProgressBar.style.width = '100%';
            setTimeout(() => dom.exportModal.classList.remove('active'), 1500);
          };
        }
      }

      drawFrame();
    } catch (err) {
      console.error('Erro na exportação de vídeo:', err);
      alert('Ocorreu um erro durante a renderização do vídeo mosaico: ' + err.message);
      dom.exportModal.classList.remove('active');
    }
  }

  // --- Exportação de Áudio Mixado (WAV) ---
  function exportMixedAudio() {
    const recordedTracks = state.tracks.filter(t => t.videoElement);
    if (recordedTracks.length === 0) {
      alert('Nenhuma gravação encontrada para exportar o áudio!');
      return;
    }

    dom.exportModal.classList.add('active');
    dom.exportTitle.textContent = '🎵 Exportando Áudio Mixado...';
    dom.exportStatus.textContent = 'Mixando faixas e gerando arquivo de áudio...';
    dom.exportProgressBar.style.width = '40%';

    try {
      const audioContext = getAudioContext();
      const dest = audioContext.createMediaStreamDestination();

      recordedTracks.forEach(track => {
        if (!track.audioSourceNode) {
          try {
            track.audioSourceNode = audioContext.createMediaElementSource(track.videoElement);
            track.audioGainNode = audioContext.createGain();
            track.audioSourceNode.connect(track.audioGainNode);
            track.audioGainNode.connect(dest);
          } catch (e) {}
        }
        if (track.audioGainNode) {
          track.audioGainNode.gain.value = track.muted ? 0 : track.volume;
        }
      });

      const recorder = new MediaRecorder(dest.stream);
      const chunks = [];

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const totalBeats = state.measures * beatsPerMeasure;
      const durationMs = ((totalBeats * 60) / state.bpm) * 1000;

      recorder.start();
      recordedTracks.forEach(t => {
        t.videoElement.currentTime = 0;
        t.videoElement.play();
      });

      setTimeout(() => {
        recorder.stop();
        recordedTracks.forEach(t => t.videoElement.pause());
        recorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          downloadBlob(audioBlob, `samba_breque_mix_${state.bpm}bpm.webm`);
          dom.exportProgressBar.style.width = '100%';
          dom.exportStatus.textContent = '✅ Áudio exportado com sucesso!';
          setTimeout(() => dom.exportModal.classList.remove('active'), 1200);
        };
      }, durationMs);
    } catch (e) {
      alert('Erro na exportação de áudio: ' + e.message);
      dom.exportModal.classList.remove('active');
    }
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }, 1000);
  }

  // --- Persistência de Sessão (IndexedDB & JSON) ---
  async function saveCurrentSession() {
    const serializable = {
      bpm: state.bpm,
      meter: state.meter,
      mode: state.mode,
      measures: state.measures,
      looping: state.looping,
      metronomeEnabled: state.metronomeEnabled,
      viewMode: state.viewMode,
      zoomLevel: state.zoomLevel,
      tracks: state.tracks.map(t => ({
        id: t.id,
        name: t.name,
        volume: t.volume,
        muted: t.muted,
        solo: t.solo,
        offsetMs: t.offsetMs,
        duration: t.duration || 0,
        mediaBlob: t.mediaBlob
      }))
    };
    await saveProjectToDB(serializable);
  }

  async function restoreSession() {
    const saved = await loadProjectFromDB();
    if (saved && saved.tracks && saved.tracks.length > 0) {
      state.bpm = saved.bpm || 120;
      state.meter = saved.meter || '2/4';
      state.mode = saved.mode || 'free';
      state.measures = saved.measures || 4;
      state.looping = !!saved.looping;
      state.metronomeEnabled = saved.metronomeEnabled !== undefined ? saved.metronomeEnabled : true;
      state.viewMode = saved.viewMode || 'timeline';
      state.zoomLevel = saved.zoomLevel || 100;

      state.tracks = saved.tracks.map((st, i) => {
        const tr = createTrack(st.name, i);
        tr.id = st.id || tr.id;
        tr.volume = st.volume !== undefined ? st.volume : 1.0;
        tr.muted = !!st.muted;
        tr.solo = !!st.solo;
        tr.offsetMs = st.offsetMs || 0;
        tr.duration = st.duration || 0;
        if (st.mediaBlob) {
          tr.mediaBlob = st.mediaBlob;
          tr.mediaUrl = URL.createObjectURL(st.mediaBlob);
        }
        return tr;
      });
    } else {
      // 4 Faixas padrão em branco com sugestões de instrumentos
      state.tracks = [
        createTrack('Surdo 1ª (Tum)', 0),
        createTrack('Surdo 2ª (Tump)', 1),
        createTrack('Caixa (Tchá)', 2),
        createTrack('Tamborim (Teleco-teco)', 4)
      ];
    }

    if (dom.zoomLevelVal) dom.zoomLevelVal.textContent = `${state.zoomLevel}%`;
    syncToolbarControls();
    updateLoopUi();
    switchViewMode(state.viewMode);
    renderStudioViews();
  }

  function syncToolbarControls() {
    if (dom.bpmInput) dom.bpmInput.value = state.bpm;
    if (dom.bpmVal) dom.bpmVal.textContent = state.bpm;
    if (dom.meterSelect) dom.meterSelect.value = state.meter;
    if (dom.modeSelect) dom.modeSelect.value = state.mode;
    if (dom.measuresSelect) dom.measuresSelect.value = state.measures;
    if (dom.measuresGroup) dom.measuresGroup.style.display = state.mode === 'fixed' ? 'flex' : 'none';
  }

  // --- Inicialização e Bind Global ---
  function init() {
    cacheDom();

    // Toolbar Play / Stop Master
    dom.btnMasterPlay.onclick = () => {
      if (state.isPlaying) {
        stopStudioPlayback();
      } else {
        startStudioPlayback();
      }
    };

    dom.btnMasterStop.onclick = stopStudioPlayback;

    // Botões de Alternar Loop (Toolbar e Timeline)
    if (dom.btnToggleLoop) {
      dom.btnToggleLoop.onclick = toggleLoopMode;
    }
    if (dom.btnTimelineLoop) {
      dom.btnTimelineLoop.onclick = toggleLoopMode;
    }

    // Seletor de Modo de Visualização (Faixas REAPER vs Mosaico)
    if (dom.btnViewTimeline) {
      dom.btnViewTimeline.onclick = () => switchViewMode('timeline');
    }
    if (dom.btnViewMosaic) {
      dom.btnViewMosaic.onclick = () => switchViewMode('mosaic');
    }

    // Ferramentas da DAW REAPER: Zoom In / Zoom Out
    if (dom.btnZoomPlus) {
      dom.btnZoomPlus.onclick = () => {
        const levels = [100, 125, 150, 200];
        const curIdx = levels.indexOf(state.zoomLevel);
        if (curIdx < levels.length - 1) {
          state.zoomLevel = levels[curIdx + 1];
          if (dom.zoomLevelVal) dom.zoomLevelVal.textContent = `${state.zoomLevel}%`;
          renderReaperTimeline();
          saveCurrentSession();
        }
      };
    }

    if (dom.btnZoomMinus) {
      dom.btnZoomMinus.onclick = () => {
        const levels = [100, 125, 150, 200];
        const curIdx = levels.indexOf(state.zoomLevel);
        if (curIdx > 0) {
          state.zoomLevel = levels[curIdx - 1];
          if (dom.zoomLevelVal) dom.zoomLevelVal.textContent = `${state.zoomLevel}%`;
          renderReaperTimeline();
          saveCurrentSession();
        }
      };
    }

    // Snap to Grid Toggle
    if (dom.btnSnapToggle) {
      dom.btnSnapToggle.onclick = () => {
        state.snapToGrid = !state.snapToGrid;
        dom.btnSnapToggle.classList.toggle('active', state.snapToGrid);
      };
    }

    // Botão Adicionar Pista no Header DAW
    if (dom.btnTimelineAddTrack) {
      dom.btnTimelineAddTrack.onclick = addTrack;
    }

    // Clique na Régua da Linha de Tempo para Seek / Reposicionar Cursor
    if (dom.reaperRulerTrack) {
      dom.reaperRulerTrack.onclick = (e) => {
        const rect = dom.reaperRulerTrack.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, clickX / rect.width));

        const beats = state.measures * (state.meter === '2/4' ? 2 : 4);
        const loopDurationSec = (beats * 60) / state.bpm;
        const targetTimeSec = percent * loopDurationSec;

        if (dom.reaperPlayhead) {
          dom.reaperPlayhead.style.left = (percent * 100) + '%';
        }

        // Ajusta currentTime dos vídeos
        state.tracks.forEach(track => {
          if (track.videoElement) {
            const offsetSec = (track.offsetMs || 0) / 1000;
            track.videoElement.currentTime = Math.max(0, targetTimeSec + offsetSec);
          }
        });

        updateReaperLcdDisplay(targetTimeSec * 1000, loopDurationSec * 1000);
      };
    }

    // Atalho de Teclado: Barra de Espaço = Play / Pause no Studio
    window.addEventListener('keydown', (e) => {
      const tabBeatbox = document.getElementById('tab-beatbox');
      const isStudioActive = tabBeatbox && tabBeatbox.classList.contains('active');
      if (!isStudioActive) return;

      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        if (state.isPlaying) {
          stopStudioPlayback();
        } else {
          startStudioPlayback();
        }
      }
    });

    // BPM Slider & Buttons
    dom.bpmInput.oninput = (e) => {
      state.bpm = parseInt(e.target.value, 10);
      dom.bpmVal.textContent = state.bpm;
      updateQuickStats();
    };
    dom.bpmInput.onchange = () => {
      renderReaperTimeline();
      saveCurrentSession();
    };

    dom.btnBpmMinus.onclick = () => {
      state.bpm = Math.max(60, state.bpm - 2);
      dom.bpmInput.value = state.bpm;
      dom.bpmVal.textContent = state.bpm;
      updateQuickStats();
      renderReaperTimeline();
      saveCurrentSession();
    };

    dom.btnBpmPlus.onclick = () => {
      state.bpm = Math.min(200, state.bpm + 2);
      dom.bpmInput.value = state.bpm;
      dom.bpmVal.textContent = state.bpm;
      updateQuickStats();
      renderReaperTimeline();
      saveCurrentSession();
    };

    // Compasso & Modo
    dom.meterSelect.onchange = (e) => {
      state.meter = e.target.value;
      renderStudioViews();
      saveCurrentSession();
    };

    dom.modeSelect.onchange = (e) => {
      state.mode = e.target.value;
      dom.measuresGroup.style.display = state.mode === 'fixed' ? 'flex' : 'none';
      renderStudioViews();
      saveCurrentSession();
    };

    dom.measuresSelect.onchange = (e) => {
      state.measures = parseInt(e.target.value, 10);
      renderStudioViews();
      saveCurrentSession();
    };

    // Metrônomo Toggle
    dom.btnToggleMetronome.onclick = () => {
      state.metronomeEnabled = !state.metronomeEnabled;
      dom.btnToggleMetronome.style.borderColor = state.metronomeEnabled ? '#3b82f6' : 'var(--border-color)';
      dom.btnToggleMetronome.style.background = state.metronomeEnabled ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-card)';
      saveCurrentSession();
    };

    // Adicionar Faixa
    dom.btnAddTrack.onclick = addTrack;

    // Exportações
    dom.btnExportVideo.onclick = exportMosaicVideo;
    dom.btnExportAudio.onclick = exportMixedAudio;
    dom.exportCloseBtn.onclick = () => dom.exportModal.classList.remove('active');

    // Gravação Modal & Seletores de Modo
    dom.recordCloseBtn.onclick = closeRecordingModal;
    if (dom.recModeVideoBtn) {
      dom.recModeVideoBtn.onclick = () => setRecordingMode('video');
    }
    if (dom.recModeAudioBtn) {
      dom.recModeAudioBtn.onclick = () => setRecordingMode('audio');
    }

    dom.btnStartRecord.onclick = () => {
      if (recordingContext.isRecording) {
        stopCurrentRecording(true);
      } else {
        startPreRollCountdown();
      }
    };
    dom.btnKeepTake.onclick = keepCurrentTake;
    dom.btnDiscardTake.onclick = discardAndRetry;

    // Salvar Projeto em Arquivo JSON
    dom.btnSaveProject.onclick = async () => {
      const exportData = {
        bpm: state.bpm,
        meter: state.meter,
        mode: state.mode,
        measures: state.measures,
        viewMode: state.viewMode,
        tracks: state.tracks.map(t => ({
          name: t.name,
          volume: t.volume,
          muted: t.muted,
          solo: t.solo,
          offsetMs: t.offsetMs
        }))
      };
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      downloadBlob(blob, `samba_breque_projeto_${Date.now()}.json`);
    };

    // Carregar Projeto
    dom.btnLoadProject.onclick = () => dom.projectFileInput.click();
    dom.projectFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            if (data && data.tracks) {
              state.bpm = data.bpm || 120;
              state.meter = data.meter || '2/4';
              state.mode = data.mode || 'fixed';
              state.measures = data.measures || 4;
              state.viewMode = data.viewMode || 'timeline';
              state.tracks = data.tracks.map((t, idx) => {
                const tr = createTrack(t.name, idx);
                tr.volume = t.volume !== undefined ? t.volume : 1.0;
                tr.muted = !!t.muted;
                tr.solo = !!t.solo;
                tr.offsetMs = t.offsetMs || 0;
                return tr;
              });
              syncToolbarControls();
              switchViewMode(state.viewMode);
              renderStudioViews();
              saveCurrentSession();
              alert('Projeto carregado com sucesso!');
            }
          } catch (err) {
            alert('Arquivo de projeto inválido: ' + err.message);
          }
        };
        reader.readAsText(file);
      }
    };

    // Restaura ou inicializa sessão padrão
    restoreSession();
  }

  // Exporta init para ser chamado pelo orquestrador
  window.BeatboxStudio = {
    init,
    stopStudioPlayback
  };

})();
