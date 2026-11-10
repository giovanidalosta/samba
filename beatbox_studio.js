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

  async function saveProjectToDB(data, projectId = 'current_project') {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id: projectId || 'current_project', data, updatedAt: Date.now() });
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = rej;
      });
    } catch (err) {
      console.warn('Erro ao salvar no IndexedDB:', err);
    }
  }

  async function loadProjectFromDB(projectId = 'current_project') {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(projectId || 'current_project');
      return new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn('Erro ao carregar do IndexedDB:', err);
      return null;
    }
  }

  async function deleteProjectFromDB(projectId) {
    if (!projectId) return;
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(projectId);
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = rej;
      });
    } catch (err) {
      console.warn('Erro ao remover projeto do IndexedDB:', err);
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

  // Som do metrônomo sintético (Web Audio puro com suporte a agendamento preciso)
  function playMetronomeClick(isAccent = false, targetTime = null) {
    try {
      const ctx = getAudioContext();
      const t = (targetTime !== null && isFinite(targetTime)) ? Math.max(ctx.currentTime, targetTime) : ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isAccent ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isAccent ? 1200 : 800, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.04);

      gain.gain.setValueAtTime(isAccent ? 0.8 : 0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.05);
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
    '#C84B4B', // Surdo 1ª (Matte Crimson)
    '#D4843E', // Surdo 2ª (Matte Amber)
    '#247BB8', // Caixa (Naumteria Badger Blue)
    '#E8C31B', // Repique (Naumteria Gold)
    '#4A9E75', // Tamborim (Matte Sage)
    '#8868B8', // Agogô (Matte Violet)
    '#B85D88', // Cuíca (Matte Rose)
    '#3898A6', // Ganzá (Matte Teal)
    '#E05A5A'  // Breque (Voz / Fala)
  ];

  // --- Estado do Beatbox Studio ---
  const state = {
    projectId: 'current_project',
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
    isPaused: false,
    playbackStartPerfTime: 0,
    playbackStartPosSec: 0,
    playbackTimer: null,
    playheadPosSec: 0,
    selectedTrackId: null,
    selectedAudioDeviceId: localStorage.getItem('samba_selected_audio_dev') || '',
    selectedVideoDeviceId: localStorage.getItem('samba_selected_video_dev') || '',
    audioProfile: localStorage.getItem('samba_audio_profile') || 'raw', // 'raw' (estúdio/beatbox sem corte de frequências) ou 'filtered' (ruído/eco)
    latencyCompensationMs: parseInt(localStorage.getItem('samba_latency_compensation') || '80', 10), // Compensação de atraso round-trip (fones/mic)
    tracks: []
  };

  const MAX_STUDIO_TRACKS = 32;
  let sessionEpoch = 0;

  function closeAllKebabMenus() {
    document.querySelectorAll('.tcp-menu-dropdown').forEach(m => {
      m.style.display = 'none';
    });
    document.querySelectorAll('.reaper-track-row.menu-open').forEach(r => {
      r.classList.remove('menu-open');
    });
  }

  function closeStudioMenus() {
    closeAllKebabMenus();
    ['studioSettingsPopover', 'studioProjectPopover'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('open', 'active');
        el.style.left = '';
        el.style.right = '';
        el.style.maxHeight = '';
      }
    });
  }

  // --- Objeto da Faixa (Track) ---
  function createTrack(name, initialIndex) {
    const safeName = (typeof name === 'string' && name.trim() && !name.startsWith('[object'))
      ? name.trim()
      : `Faixa ${(initialIndex || 0) + 1}`;
    return {
      id: 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: safeName,
      armed: false, // Status de gravação / REC ARM
      mediaBlob: null,
      mediaUrl: null,
      mediaType: 'video', // 'video' | 'audio'
      volume: 1.0, // 0.0 a 1.5
      muted: false,
      solo: false,
      offsetMs: 0, // deslocamento temporal em ms
      trimStart: 0, // segundos cortados no início da gravação
      trimEnd: 0, // segundos cortados no final da gravação
      duration: 0, // Duração real total da gravação em segundos
      waveformPeaks: null, // Cache dos picos reais decodificados via Web Audio API
      _offsetTimer: null,
      _trimStopTimer: null,
      videoElement: null,
      audioNode: null,
      gainNode: null
    };
  }

  function getTrackEffectiveDuration(track) {
    const rawDur = track && track.duration > 0 ? track.duration : 0;
    if (rawDur <= 0) return 0;
    const tStart = Math.max(0, track.trimStart || 0);
    const tEnd = Math.max(0, track.trimEnd || 0);
    return Math.max(0.08, rawDur - tStart - tEnd);
  }

  function getTrackEndMediaTime(track) {
    const rawDur = track && track.duration > 0 ? track.duration : 0;
    if (rawDur <= 0) return 0;
    const tStart = Math.max(0, track.trimStart || 0);
    const tEnd = Math.max(0, track.trimEnd || 0);
    return Math.max(tStart + 0.08, rawDur - tEnd);
  }

  // --- Elementos do DOM ---
  let dom = {};

  function cacheDom() {
    dom.btnMasterPlay = document.getElementById('btnStudioPlay');
    dom.btnMasterStop = document.getElementById('btnStudioStop');
    dom.btnStudioRecord = document.getElementById('btnStudioRecord');
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
    dom.btnToolbarNewProject = document.getElementById('btnToolbarNewProject');
    dom.btnNewProject = document.getElementById('btnNewProject');
    dom.btnClearProject = document.getElementById('btnClearProject');
    dom.btnExportVideo = document.getElementById('btnExportVideo');
    dom.btnExportAudio = document.getElementById('btnExportAudio');
    dom.btnSaveProject = document.getElementById('btnSaveProject');
    dom.btnLoadProject = document.getElementById('btnLoadProject');
    dom.projectFileInput = document.getElementById('projectFileInput');

    // Modal Montar Novo Projeto
    dom.newProjectModal = document.getElementById('newProjectModal');
    dom.newProjectCloseBtn = document.getElementById('newProjectCloseBtn');
    dom.newProjectCancelBtn = document.getElementById('btnNewProjectCancel');
    dom.newProjectConfirmBtn = document.getElementById('btnNewProjectConfirm');
    dom.newProjectName = document.getElementById('newProjectName');
    dom.newProjectBpm = document.getElementById('newProjectBpm');
    dom.newProjectBpmVal = document.getElementById('newProjectBpmVal');
    dom.btnNewProjBpmMinus = document.getElementById('btnNewProjBpmMinus');
    dom.btnNewProjBpmPlus = document.getElementById('btnNewProjBpmPlus');
    dom.newProjectBpmPresets = document.getElementById('newProjectBpmPresets');
    dom.newProjectMeter = document.getElementById('newProjectMeter');
    dom.newProjectMode = document.getElementById('newProjectMode');
    dom.newProjectInstrumentsPicker = document.getElementById('newProjectInstrumentsPicker');
    dom.newProjectTrackCountHint = document.getElementById('newProjectTrackCountHint');
    dom.btnPickerClearAll = document.getElementById('btnPickerClearAll');
    dom.btnPickerSelectClassic = document.getElementById('btnPickerSelectClassic');
    dom.btnPickerSelectAll = document.getElementById('btnPickerSelectAll');

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

    // Workspace e Aba de Gravação
    dom.recordWorkspace = document.getElementById('recordWorkspace');
    dom.recordModal = dom.recordWorkspace; // Compatibilidade retroativa
    dom.recordModalTitle = document.getElementById('recordModalTitle') || { textContent: '' };
    dom.recordCloseBtn = document.getElementById('recordCloseBtn') || document.getElementById('recordBackBtn');
    dom.recordBackBtn = document.getElementById('recordBackBtn');
    dom.btnViewRecord = document.getElementById('btnViewRecord');
    dom.recTrackSelect = document.getElementById('recTrackSelect');
    dom.recordDeviceBar = document.getElementById('recordDeviceBar');
    dom.recAudioDevice = document.getElementById('recAudioDevice');
    dom.recVideoDevice = document.getElementById('recVideoDevice');
    dom.recVideoDeviceGroup = document.getElementById('recVideoDeviceGroup');
    dom.recAudioProfile = document.getElementById('recAudioProfile');
    dom.recLatencyCompensation = document.getElementById('recLatencyCompensation');
    dom.studioLatencyCompensation = document.getElementById('studioLatencyCompensation');
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
    dom.recTakeNameInput = document.getElementById('recTakeNameInput');
    dom.btnKeepTake = document.getElementById('btnKeepTake');
    dom.btnDiscardTake = document.getElementById('btnDiscardTake');

    // Modal de Exportação
    dom.exportModal = document.getElementById('exportModal');
    dom.exportTitle = document.getElementById('exportTitle');
    dom.exportStatus = document.getElementById('exportStatus');
    dom.exportProgressBar = document.getElementById('exportProgressBar');
    dom.exportCloseBtn = document.getElementById('exportCloseBtn');
    dom.exportRenderCanvas = document.getElementById('exportRenderCanvas');

    // Corte e Divisão de Faixas
    dom.btnSplitAtPlayhead = document.getElementById('btnSplitAtPlayhead');
    dom.trackCutModal = document.getElementById('trackCutModal');
    dom.cutModalTrackTitle = document.getElementById('cutModalTrackTitle');
    dom.cutModalCloseBtn = document.getElementById('cutModalCloseBtn');
    dom.cutWaveformStage = document.getElementById('cutWaveformStage');
    dom.cutWaveformCanvas = document.getElementById('cutWaveformCanvas');
    dom.cutShadeLeft = document.getElementById('cutShadeLeft');
    dom.cutShadeRight = document.getElementById('cutShadeRight');
    dom.cutHandleStart = document.getElementById('cutHandleStart');
    dom.cutHandleEnd = document.getElementById('cutHandleEnd');
    dom.cutBadgeStart = document.getElementById('cutBadgeStart');
    dom.cutBadgeEnd = document.getElementById('cutBadgeEnd');
    dom.cutCursorLine = document.getElementById('cutCursorLine');
    dom.cutStatStartVal = document.getElementById('cutStatStartVal');
    dom.cutStatCursorVal = document.getElementById('cutStatCursorVal');
    dom.cutStatDurationVal = document.getElementById('cutStatDurationVal');
    dom.cutStatEndVal = document.getElementById('cutStatEndVal');
    dom.btnCutStartMinus = document.getElementById('btnCutStartMinus');
    dom.btnCutStartPlus = document.getElementById('btnCutStartPlus');
    dom.btnCutEndMinus = document.getElementById('btnCutEndMinus');
    dom.btnCutEndPlus = document.getElementById('btnCutEndPlus');
    dom.btnCutPreviewPlay = document.getElementById('btnCutPreviewPlay');
    dom.btnCutTrimToCursorStart = document.getElementById('btnCutTrimToCursorStart');
    dom.btnCutTrimToCursorEnd = document.getElementById('btnCutTrimToCursorEnd');
    dom.btnCutSplitAtCursor = document.getElementById('btnCutSplitAtCursor');
    dom.btnCutResetFull = document.getElementById('btnCutResetFull');
    dom.btnCutCancel = document.getElementById('btnCutCancel');
    dom.btnCutApply = document.getElementById('btnCutApply');

    // Calibração Automática de Latência
    dom.latencyCalibrationModal = document.getElementById('latencyCalibrationModal');
    dom.btnCalibTriggerStudio = document.getElementById('btnCalibTriggerStudio');
    dom.btnCalibTriggerRec = document.getElementById('btnCalibTriggerRec');
    dom.btnCalibClose = document.getElementById('btnCalibClose');
    dom.btnCalibCancel = document.getElementById('btnCalibCancel');
    dom.btnCalibStart = document.getElementById('btnCalibStart');
    dom.calibStatusText = document.getElementById('calibStatusText');
    dom.calibVuFill = document.getElementById('calibVuFill');
    dom.calibResultCard = document.getElementById('calibResultCard');
    dom.calibResultValue = document.getElementById('calibResultValue');
    dom.calibResultDesc = document.getElementById('calibResultDesc');
    dom.calibApplyTrackWrap = document.getElementById('calibApplyTrackWrap');
    dom.calibTrackName = document.getElementById('calibTrackName');
    dom.calibApplyToCurrentTrack = document.getElementById('calibApplyToCurrentTrack');
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
      if (dom.loopText) dom.loopText.textContent = state.looping ? 'Loop: On' : 'Loop: Off';
    }
    if (dom.btnTimelineLoop) {
      dom.btnTimelineLoop.classList.toggle('loop-active', state.looping);
      dom.btnTimelineLoop.innerHTML = `<span>🔁</span> Loop: ${state.looping ? 'On' : 'Off'}`;
    }
  }

  // --- Quantização Musical / Snap-to-Grid com Limiar Magnético (Compassos, Tempos e Colcheias) ---
  function snapTimeToGrid(timeSec, bpm, meter, snapEnabled = true) {
    if (!snapEnabled) return Math.max(0, timeSec);
    const validBpm = (typeof bpm === 'number' && bpm > 0) ? bpm : 120;
    const beatsPerMeasure = meter === '2/4' ? 2 : 4;
    const beatSec = 60 / validBpm;
    const subdivisionSec = beatSec / 2; // Subdivisão em colcheias (8th notes)
    if (subdivisionSec <= 0) return Math.max(0, timeSec);

    const nearest = Math.round(timeSec / subdivisionSec) * subdivisionSec;
    // Limiar magnético: 80ms ou 35% da subdivisão
    const threshold = Math.min(0.08, subdivisionSec * 0.35);
    if (Math.abs(timeSec - nearest) <= threshold) {
      return Math.max(0, nearest);
    }
    return Math.max(0, timeSec);
  }

  // --- Cálculo da Duração Total da Timeline (Baseado no Tamanho Efetivo da Gravação) ---
  function getTimelineDurationSec() {
    if (!state.tracks || state.tracks.length === 0) {
      state.projectDurationSec = 0;
    }
    let maxDur = state.projectDurationSec || 0;
    state.tracks.forEach(t => {
      const effDur = getTrackEffectiveDuration(t);
      if (t.mediaUrl && effDur > 0) {
        const durWithOffset = effDur + Math.max(0, (t.offsetMs || 0) / 1000);
        if (durWithOffset > maxDur) maxDur = durWithOffset;
      }
    });

    if (maxDur > 0) {
      state.projectDurationSec = maxDur;
    }

    if (state.mode === 'fixed') {
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      return (state.measures * beatsPerMeasure * 60) / state.bpm;
    }

    // Modo Livre: a duração é determinada pela tomada mais longa gravada
    if (maxDur > 0) {
      const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
      const measureDurationSec = (beatsPerMeasure * 60) / state.bpm;
      const rawMeasures = maxDur / measureDurationSec;
      const fraction = rawMeasures - Math.floor(rawMeasures);
      // Se a folga após o compasso for pequena (< 35% de um compasso, ex: tempo de reação para clicar em Parar),
      // faz o snap para o compasso completado em vez de criar um compasso inteiro vazio!
      const totalMeasures = (fraction > 0 && fraction < 0.35)
        ? Math.max(2, Math.floor(rawMeasures))
        : Math.max(2, Math.ceil(rawMeasures));
      return totalMeasures * measureDurationSec;
    }

    // Padrão inicial se nada foi gravado: 4 compassos
    const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
    return (4 * beatsPerMeasure * 60) / state.bpm;
  }

  // --- Alternância entre Modo Faixas REAPER, Mosaico e Gravação ---
  async function switchViewMode(newMode, trackId = null, preferredMode = null) {
    const previousMode = state.viewMode;
    state.viewMode = newMode;

    if (dom.btnViewTimeline) {
      dom.btnViewTimeline.classList.toggle('active', state.viewMode === 'timeline');
    }
    if (dom.btnViewMosaic) {
      dom.btnViewMosaic.classList.toggle('active', state.viewMode === 'mosaic');
    }
    if (dom.btnViewRecord) {
      dom.btnViewRecord.classList.toggle('active', state.viewMode === 'record');
    }

    const mobNavBeatbox = document.getElementById('mobNavBeatbox');
    const isBeatboxActive = document.getElementById('tab-beatbox')?.classList.contains('active');

    if (isBeatboxActive && mobNavBeatbox) {
      mobNavBeatbox.classList.add('active');
    }

    if (dom.timelineWorkspace) {
      dom.timelineWorkspace.style.display = state.viewMode === 'timeline' ? 'flex' : 'none';
    }
    if (dom.mosaicWorkspace) {
      dom.mosaicWorkspace.style.display = state.viewMode === 'mosaic' ? 'flex' : 'none';
    }
    if (dom.recordWorkspace) {
      dom.recordWorkspace.style.display = state.viewMode === 'record' ? 'flex' : 'none';
    }

    closeStudioMenus();
    updateQuickStats();

    // Se estiver saindo da gravação, encerra streams de webcam/mic para poupar bateria e recursos
    if (previousMode === 'record' && newMode !== 'record') {
      stopRecordingView();
    }

    // Se estiver entrando no modo gravação, inicializa o viewfinder e captura
    if (state.viewMode === 'record') {
      await startRecordingView(trackId, preferredMode);
    }

    if (typeof window.checkOrientation === 'function') {
      window.checkOrientation();
    }

    updateQuickStats();
    saveCurrentSession();
  }

  // Preenche o seletor de faixas na tela de gravação
  function updateRecTrackPicker() {
    if (!dom.recTrackSelect) return;
    dom.recTrackSelect.innerHTML = '';

    state.tracks.forEach((t, idx) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      const statusIcon = t.mediaUrl ? '🎬 ' : '🎙️ ';
      opt.textContent = `${statusIcon}Faixa ${idx + 1}: ${t.name}${t.mediaUrl ? ' (Gravada)' : ' (Vazia)'}`;
      if (t.id === recordingContext.activeTrackId) {
        opt.selected = true;
      }
      dom.recTrackSelect.appendChild(opt);
    });

    const optNew = document.createElement('option');
    optNew.value = '__new__';
    optNew.textContent = '➕ Adicionar Nova Faixa...';
    dom.recTrackSelect.appendChild(optNew);

    const activeTrack = state.tracks.find(t => t.id === recordingContext.activeTrackId);
    if (dom.audioViewfinderInstrument && activeTrack) {
      dom.audioViewfinderInstrument.textContent = activeTrack.name;
    }
  }

  // Inicializa o ambiente e viewfinder da aba Gravar
  async function startRecordingView(trackId = null, preferredMode = null) {
    stopStudioPlayback();

    // Se não houver faixas criadas, cria a primeira faixa do projeto
    if (state.tracks.length === 0) {
      addTrack();
    }

    let targetTrack = null;
    if (trackId) {
      targetTrack = state.tracks.find(t => t.id === trackId);
    }
    if (!targetTrack && recordingContext.activeTrackId) {
      targetTrack = state.tracks.find(t => t.id === recordingContext.activeTrackId);
    }
    if (!targetTrack) {
      targetTrack = state.tracks.find(t => !t.mediaUrl) || state.tracks[0];
    }
    if (targetTrack) {
      recordingContext.activeTrackId = targetTrack.id;
    }

    recordingContext.aborted = false;
    recordingContext.isCountingDown = false;
    recordingContext.isRecording = false;
    recordingContext.lastRecordedBlob = null;

    if (dom.reviewActions) dom.reviewActions.classList.remove('active');
    if (dom.recordTipText) dom.recordTipText.style.display = '';
    if (dom.btnStartRecord) {
      dom.btnStartRecord.style.display = 'inline-flex';
      dom.btnStartRecord.textContent = '🔴 Iniciar Gravação';
      dom.btnStartRecord.classList.remove('is-recording');
    }
    if (dom.btnStudioRecord) dom.btnStudioRecord.classList.remove('is-recording');
    if (dom.recLiveIndicator) dom.recLiveIndicator.classList.remove('active');
    if (dom.recProgressBar) dom.recProgressBar.style.width = '0%';
    if (dom.countdownOverlay) dom.countdownOverlay.classList.remove('active');

    updateRecTrackPicker();
    await populateMediaDevices();
    const mode = preferredMode || recordingContext.captureMode || 'video';
    await setRecordingMode(mode);
  }

  // Desativa os dispositivos de captura e visualizadores ao sair da aba Gravar
  function stopRecordingView() {
    stopCurrentRecording(false);
    cleanupReviewMedia();
    disconnectMicMeter();

    if (recordingContext.stream) {
      recordingContext.stream.getTracks().forEach(t => t.stop());
      recordingContext.stream = null;
    }
    if (dom.viewfinderVideo) {
      dom.viewfinderVideo.srcObject = null;
    }
  }

  function updateQuickStats() {
    if (dom.statTrackCount) {
      dom.statTrackCount.textContent = `${state.tracks.length} Faixas`;
    }
    const durSec = getTimelineDurationSec().toFixed(1);
    if (dom.statLoopDuration) {
      dom.statLoopDuration.textContent = state.looping
        ? `${durSec}s (Loop)`
        : `${durSec}s`;
    }
    if (dom.statViewMode) {
      dom.statViewMode.textContent = state.viewMode === 'timeline'
        ? 'Modo: Faixas'
        : (state.viewMode === 'record' ? 'Modo: Cabine' : 'Modo: Mosaico');
    }
    if (dom.reaperLoopInfo) {
      dom.reaperLoopInfo.textContent = state.looping
        ? `${durSec}s • Loop`
        : `${durSec}s`;
    }
  }

  // --- Renderização do Mosaico de Faixas ---
  function renderMosaic() {
    if (!dom.mosaicGrid) return;
    dom.mosaicGrid.innerHTML = '';
    dom.mosaicGrid.setAttribute('data-count', state.tracks.length);

    if (state.tracks.length === 0) {
      const emptyMosaic = document.createElement('div');
      emptyMosaic.className = 'studio-empty-mosaic-hero';
      emptyMosaic.innerHTML = `
        <div class="empty-hero-icon">🎬</div>
        <h3 class="empty-hero-title">Mosaico Zerado • Monte suas Faixas</h3>
        <p class="empty-hero-desc">
          Nenhuma faixa no projeto. Grave sua guia ou instrumentos e dê o nome que preferir:
        </p>
        <div class="empty-hero-actions">
          <button class="btn btn-gold btn-hero-add-track" title="Adicionar nova faixa">
            <span>➕</span> Adicionar Faixa ao Mosaico
          </button>
          <button class="btn btn-secondary btn-hero-new-project" title="Configurar e montar novo projeto">
            <span>✨</span> Montar Projeto
          </button>
        </div>
      `;
      dom.mosaicGrid.appendChild(emptyMosaic);
      bindMosaicEmptyEvents(emptyMosaic);
      return;
    }

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
          <input type="text" class="track-name-input" value="${escapeHtml(track.name)}" data-id="${track.id}" placeholder="Ex: Guia, Voz, Caixa..." title="Clique para dar um nome personalizado à faixa">
        </div>
        <button class="track-delete-btn" data-id="${track.id}" title="Remover esta faixa">✕</button>
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
          <div class="nudge-controls mosaic-sync-pill" title="Ajuste fino de sincronismo temporal (Shift: ±50ms)">
            <button type="button" class="mosaic-sync-step" data-id="${track.id}" data-step="-10" title="Adiantar 10ms (Shift: 50ms)">‹</button>
            <span class="nudge-val-display" data-id="${track.id}" title="Clique para zerar offset (0ms)">${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms</span>
            <button type="button" class="mosaic-sync-step" data-id="${track.id}" data-step="10" title="Atrasar 10ms (Shift: 50ms)">›</button>
          </div>

          <div class="track-extra-actions">
            ${track.mediaUrl ? `
              <button type="button" class="btn-track-action btn-cut-track" data-id="${track.id}" title="Cortar / Aparar início e fim ou dividir esta faixa">✂️ <span class="act-label">Cortar</span></button>
              <button type="button" class="btn-track-action btn-re-record" data-id="${track.id}" data-mode="video" title="Regravar com a webcam">📹 <span class="act-label">Câmera</span></button>
              <button type="button" class="btn-track-action btn-re-record" data-id="${track.id}" data-mode="audio" title="Regravar apenas com o microfone">🎙️ <span class="act-label">Mic</span></button>
              <button type="button" class="btn-track-action btn-clear-media" data-id="${track.id}" title="Remover gravação">🗑️</button>
            ` : ''}
          </div>
        </div>
      `;

      card.appendChild(header);
      card.appendChild(stage);
      card.appendChild(mixer);
      dom.mosaicGrid.appendChild(card);
    });

    if (state.tracks.length > 0 && state.tracks.length < MAX_STUDIO_TRACKS) {
      const addCard = document.createElement('div');
      addCard.className = 'track-card track-add-card';
      addCard.title = 'Adicionar nova faixa ao estúdio';
      addCard.innerHTML = `
        <div class="track-add-card-content">
          <span class="track-add-icon">➕</span>
          <span class="track-add-label">Adicionar Faixa</span>
          <span class="track-add-sub">Pista ${state.tracks.length + 1} de ${MAX_STUDIO_TRACKS}</span>
        </div>
      `;
      addCard.onclick = () => addTrack();
      dom.mosaicGrid.appendChild(addCard);
    }

    bindTrackEvents();
    updateAudioMixRouting();
  }

  function escapeHtml(str) {
    if (str === null || str === undefined || typeof str === 'object') return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track && track.mediaUrl) {
          const ok = window.appConfirm
            ? await window.appConfirm(`Deseja remover a faixa "${track.name}" e seu vídeo gravado?`, 'Remover Faixa', { isDanger: true, confirmText: 'Remover' })
            : confirm(`Deseja remover a faixa "${track.name}" e seu vídeo gravado?`);
          if (!ok) return;
        }
        removeTrack(id);
        if (window.appToast) window.appToast('Faixa removida.', 'info');
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

    // Botão Cortar Faixa no Mosaico
    dom.mosaicGrid.querySelectorAll('.btn-cut-track').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        openTrackCutModal(id);
      };
    });

    // Limpar vídeo/áudio gravado
    dom.mosaicGrid.querySelectorAll('.btn-clear-media').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (!track || !track.mediaUrl) return;
        const ok = window.appConfirm
          ? await window.appConfirm(`Limpar a gravação da faixa "${track.name}"? A faixa vazia será mantida no projeto.`, 'Limpar Gravação', { isDanger: true, confirmText: 'Limpar' })
          : confirm(`Limpar gravação de "${track.name}"?`);
        if (ok) {
          clearTrackMedia(id);
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
        toggleTrackSolo(id);
      };
    });

    // Sincronia / Nudge compacto no Mosaico
    dom.mosaicGrid.querySelectorAll('.mosaic-sync-step, .btn-nudge').forEach(btn => {
      btn.onclick = (e) => {
        const id = btn.dataset.id;
        const mult = e.shiftKey ? 5 : 1;
        const rawStep = parseInt(btn.dataset.step || btn.dataset.delta, 10) || 0;
        const delta = btn.dataset.step ? rawStep * mult : rawStep;
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.offsetMs = Math.max(-5000, Math.min(5000, (track.offsetMs || 0) + delta));
          updateTrackOffsetInPlace(track);
          saveCurrentSession();
        }
      };
    });

    dom.mosaicGrid.querySelectorAll('.nudge-val-display').forEach(valEl => {
      valEl.onclick = () => {
        const id = valEl.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          const current = track.offsetMs || 0;
          const val = prompt(`Ajuste fino de offset (ms) para "${track.name}":\nDigite o valor em ms (ex: -120 para adiantar, +50 para atrasar, ou 0 para zerar):`, current);
          if (val !== null) {
            const parsed = parseInt(val, 10);
            if (!isNaN(parsed)) {
              track.offsetMs = Math.max(-5000, Math.min(5000, parsed));
              updateTrackOffsetInPlace(track);
              saveCurrentSession();
            }
          }
        }
      };
    });
  }

  // --- Atualização de Sincronismo (Offset) em Tempo Real sem Recriar o DOM ---
  function updateTrackOffsetInPlace(track) {
    if (!track) return;
    const offsetStr = `${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms`;

    // 1. Visor da Pílula no TCP
    const tcpRow = document.getElementById(`reaper_row_${track.id}`);
    if (tcpRow) {
      const syncVal = tcpRow.querySelector('.tcp-sync-val, .tcp-sync-display');
      if (syncVal) syncVal.textContent = offsetStr;
    }

    // 2. Visor no Card do Mosaico
    const mosaicCard = document.getElementById(`card_${track.id}`);
    if (mosaicCard) {
      const display = mosaicCard.querySelector('.nudge-val-display');
      if (display) display.textContent = offsetStr;
    }

    // 3. Posição visual do Clip e Badge na Arrange Lane
    const mediaItem = document.getElementById(`media_item_${track.id}`);
    if (mediaItem) {
      const badge = mediaItem.querySelector('.item-sync-badge');
      if (badge) badge.textContent = offsetStr;

      const timelineDurSec = getTimelineDurationSec();
      const offsetSec = (track.offsetMs || 0) / 1000;
      const leftPercent = Math.max(0, Math.min(100, (offsetSec / timelineDurSec) * 100));
      mediaItem.style.left = leftPercent + '%';
    }

    // 4. Se a reprodução estiver ativa, resincroniza o áudio da faixa em tempo real
    if (state.isPlaying && track.videoElement) {
      triggerTrackAtTimelineOffset(track, state.playheadPosSec);
    }
  }

  // --- Função Unificada de Renderização dos Modos (Faixas REAPER & Mosaico) ---
  function renderStudioViews() {
    renderReaperTimeline();
    renderMosaic();
    updateQuickStats();
    updateAudioMixRouting();
  }


  function bindMosaicEmptyEvents(container) {
    container.querySelectorAll('.btn-preset-add').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.preset, 10);
        addTrack(INSTRUMENT_PRESETS[idx]);
      };
    });
    const addBtn = container.querySelector('.btn-hero-add-track');
    if (addBtn) addBtn.onclick = () => addTrack();
    const newProjBtn = container.querySelector('.btn-hero-new-project');
    if (newProjBtn) newProjBtn.onclick = openNewProjectModal;
  }

  function bindTimelineEmptyEvents(container) {
    container.querySelectorAll('.btn-preset-add').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.preset, 10);
        addTrack(INSTRUMENT_PRESETS[idx]);
      };
    });
    const recNowBtn = container.querySelector('.btn-hero-record-now');
    if (recNowBtn) {
      recNowBtn.onclick = () => switchViewMode('record', null, 'audio');
    }
    const importPadBtn = container.querySelector('.btn-hero-import-pad');
    if (importPadBtn) {
      importPadBtn.onclick = () => {
        if (typeof window.importPadToCurrentStudio === 'function') {
          window.importPadToCurrentStudio();
        }
      };
    }
    const addBtn = container.querySelector('.btn-hero-add-track');
    if (addBtn) addBtn.onclick = () => addTrack();
    const newProjBtn = container.querySelector('.btn-hero-new-project');
    if (newProjBtn) newProjBtn.onclick = openNewProjectModal;
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

    if (state.tracks.length === 0) {
      const emptyProjectHero = document.createElement('div');
      emptyProjectHero.className = 'studio-empty-project-hero';
      emptyProjectHero.innerHTML = `
        <div class="empty-hero-icon">🎛️</div>
        <h3 class="empty-hero-title">Estúdio Multitrack deste Breque</h3>
        <p class="empty-hero-desc">
          Grave sua guia ou instrumentos ao vivo e dê o nome que quiser depois, ou importe faixas montadas no Pad:
        </p>
        <div class="empty-hero-actions" style="margin-bottom: 4px;">
          <button class="btn btn-gold btn-hero-record-now" title="Abrir gravador de áudio/vídeo agora">
            <span>🎙️</span> Gravar Faixa Agora
          </button>
          <button class="btn btn-primary btn-hero-import-pad" title="Trazer o instrumento ou bateria desenhada no Pad deste breque como faixa de áudio">
            <span>🥁</span> Importar do Pad
          </button>
          <button class="btn btn-secondary btn-hero-add-track" title="Adicionar faixa em branco">
            <span>➕</span> Nova Faixa Vazia
          </button>
        </div>
      `;
      dom.reaperTracksStack.appendChild(emptyProjectHero);
      bindTimelineEmptyEvents(emptyProjectHero);
      return;
    }

    const hasSolo = state.tracks.some(t => t.solo);

    state.tracks.forEach((track, index) => {
      const trackRow = document.createElement('div');
      trackRow.className = `reaper-track-row ${track.solo ? 'is-soloed' : ''} ${track.muted ? 'is-muted' : ''} ${state.selectedTrackId === track.id ? 'is-selected' : ''}`;
      trackRow.id = `reaper_row_${track.id}`;

      const trackColor = INSTRUMENT_COLORS[index % INSTRUMENT_COLORS.length];
      const volPercent = Math.round(track.volume * 100);
      const volDb = track.volume === 0 ? '-inf' : (20 * Math.log10(track.volume)).toFixed(1);

      // --- Track Control Panel (TCP à esquerda - 3 Linhas Limpas) ---
      const tcp = document.createElement('div');
      tcp.className = 'reaper-tcp';

      tcp.innerHTML = `
        <div class="tcp-color-strip" style="background: ${trackColor};"></div>

        <!-- Linha 1: Número, Nome e Menu Mais Opções (Kebab) -->
        <div class="tcp-header-row">
          <span class="tcp-track-number">${String(index + 1).padStart(2, '0')}</span>
          <input type="text" class="tcp-name-input" value="${escapeHtml(track.name)}" data-id="${track.id}" placeholder="Ex: Guia, Voz, Caixa..." title="Clique para dar um nome personalizado à faixa">
          <div class="tcp-kebab-wrap">
            <button type="button" class="tcp-btn-more" data-id="${track.id}" title="Mais opções da faixa (Carregar, Duplicar, Limpar, Excluir)" aria-label="Mais opções">⋯</button>
            <div class="tcp-menu-dropdown" id="tcp_menu_${track.id}" style="display: none;">
              <button type="button" class="tcp-menu-item tcp-menu-load" data-id="${track.id}">
                <span class="menu-item-icon">📁</span> Carregar arquivo
              </button>
              <button type="button" class="tcp-menu-item tcp-menu-duplicate" data-id="${track.id}">
                <span class="menu-item-icon">🔄</span> Duplicar faixa
              </button>
              <button type="button" class="tcp-menu-item tcp-menu-clear" data-id="${track.id}" ${track.mediaUrl ? '' : 'disabled'}>
                <span class="menu-item-icon">🗑️</span> Limpar gravação
              </button>
              <div class="tcp-menu-divider"></div>
              <button type="button" class="tcp-menu-item tcp-menu-delete tcp-menu-danger" data-id="${track.id}">
                <span class="menu-item-icon">✕</span> Excluir faixa
              </button>
            </div>
          </div>
          <input type="file" accept="video/*,audio/*" data-id="${track.id}" class="tcp-file-uploader" style="display:none;">
        </div>

        <!-- Linha 2: Arm ● REC, Mute, Solo e Miniatura -->
        <div class="tcp-controls-row">
          <div class="tcp-arm-mute-solo">
            <button type="button" class="btn-rec-arm ${track.armed ? 'armed active' : ''}" data-id="${track.id}" title="Armar Pista / Gravar Tomada">● REC</button>
            <button type="button" class="tcp-btn-mute ${track.muted ? 'active' : ''}" data-id="${track.id}" title="Mute [M]">M</button>
            <button type="button" class="tcp-btn-solo ${track.solo ? 'active' : ''}" data-id="${track.id}" title="Solo [Alt+S]">S</button>
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

        <!-- Linha 3: Volume Fader e Offset Temporal Compacto -->
        <div class="tcp-fader-row">
          <span class="fader-icon" title="Volume">🔊</span>
          <input type="range" class="tcp-fader-slider" min="0" max="1.5" step="0.05" value="${track.volume}" data-id="${track.id}" title="Volume: ${volPercent}% (${volDb} dB)">
          <span class="tcp-vol-db">${volPercent}%</span>
          <div class="tcp-sync-pill" data-id="${track.id}" title="Ajuste fino de sincronismo temporal (offset)">
            <button type="button" class="tcp-sync-step sync-prev" data-id="${track.id}" data-step="-10" title="Adiantar 10ms (Shift: 50ms)">‹</button>
            <span class="tcp-sync-val" data-id="${track.id}" title="Clique para resetar offset para 0ms">${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms</span>
            <button type="button" class="tcp-sync-step sync-next" data-id="${track.id}" data-step="10" title="Atrasar 10ms (Shift: 50ms)">›</button>
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
        // O tamanho da faixa reflete EXATAMENTE a duração ativa (com cortes aplicados)
        const mediaItem = document.createElement('div');
        mediaItem.className = `reaper-media-item ${state.selectedTrackId === track.id ? 'is-selected' : ''}`;
        mediaItem.id = `media_item_${track.id}`;
        mediaItem.style.borderColor = trackColor;

        const trackDur = track.duration > 0 ? getTrackEffectiveDuration(track) : timelineDurSec;
        const widthPercent = Math.min(100, Math.max(4, (trackDur / timelineDurSec) * 100));
        const offsetSec = (track.offsetMs || 0) / 1000;
        const leftPercent = Math.max(0, Math.min(100, (offsetSec / timelineDurSec) * 100));

        mediaItem.style.width = widthPercent + '%';
        mediaItem.style.left = leftPercent + '%';
        mediaItem.style.transform = 'none';

        const isTrimmed = (track.trimStart || 0) > 0.02 || (track.trimEnd || 0) > 0.02;
        const trimEndTime = getTrackEndMediaTime(track);

        mediaItem.innerHTML = `
          <div class="clip-trim-handle clip-trim-handle-left" data-id="${track.id}" data-side="left" title="Arraste para cortar o início da faixa"></div>
          <div class="clip-trim-handle clip-trim-handle-right" data-id="${track.id}" data-side="right" title="Arraste para cortar o final da faixa"></div>
          <div class="media-item-header">
            <div class="item-title">
              <span>${track.mediaType === 'video' ? '📹' : '🎙️'}</span>
              <span>${escapeHtml(track.name)}</span>
            </div>
            <div class="media-item-badges">
              ${isTrimmed ? `<span class="item-meta-tag item-trim-badge" title="Trecho cortado ativo">✂️ ${(track.trimStart || 0).toFixed(1)}s–${trimEndTime.toFixed(1)}s</span>` : ''}
              <span class="item-meta-tag item-sync-badge">${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms</span>
              <span class="item-meta-tag item-dur-badge" style="background: rgba(255,255,255,0.08); color: #cbd5e1;">${trackDur.toFixed(1)}s</span>
              <button type="button" class="btn-clip-action btn-clip-cut" data-id="${track.id}" title="Abrir editor de corte da faixa">✂️ Cortar</button>
              ${isTrimmed ? `<button type="button" class="btn-clip-action btn-clip-restore" data-id="${track.id}" title="Restaurar gravação original inteira">↺</button>` : ''}
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

        // Suporte a arrasto do clipe (Drag & Slide) e Alças de Corte (Trim Esquerda / Direita)
        setupMediaItemDrag(mediaItem, track);
      } else {
        // Faixa vazia com botão único e limpo estilo DAW moderna
        const emptyLane = document.createElement('div');
        emptyLane.className = 'reaper-empty-lane';
        emptyLane.innerHTML = `
          <button type="button" class="btn-empty-action btn-empty-record" data-id="${track.id}" title="Gravar nesta faixa">
            <span>🎙️</span> Gravar nesta faixa
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
    const isAtTrackLimit = state.tracks.length >= MAX_STUDIO_TRACKS;
    addLaneBtn.className = `reaper-add-track-lane${isAtTrackLimit ? ' is-capped' : ''}`;
    if (isAtTrackLimit) {
      addLaneBtn.innerHTML = `<span class="add-lane-inner"><span>⚠️</span> Limite de ${MAX_STUDIO_TRACKS} faixas atingido</span>`;
    } else {
      addLaneBtn.innerHTML = `<span class="add-lane-inner"><span>➕</span> <span class="add-lane-label-desktop">Inserir Nova Pista de Instrumento / Breque Vocal</span><span class="add-lane-label-mobile">Nova Faixa (${state.tracks.length + 1}/${MAX_STUDIO_TRACKS})</span></span>`;
      addLaneBtn.onclick = () => addTrack();
    }
    dom.reaperTracksStack.appendChild(addLaneBtn);

    // Mantém playhead sincronizado na posição atual
    if (!state.isPlaying && dom.reaperPlayhead) {
      const pct = timelineDurSec > 0 ? Math.min(100, Math.max(0, (state.playheadPosSec / timelineDurSec) * 100)) : 0;
      dom.reaperPlayhead.style.left = pct + '%';
    }

    bindReaperEvents();
  }

  // --- Desenho da Onda Sonora (Audio Waveform) Real Decodificada ---
  async function extractWaveformPeaks(track, numBuckets = 240) {
    if (track.waveformPeaks && track.waveformPeaks.length === numBuckets) {
      return track.waveformPeaks;
    }
    if (!track.mediaBlob || typeof track.mediaBlob.arrayBuffer !== 'function') {
      return null;
    }
    if (track._decodingPromise) {
      return track._decodingPromise;
    }

    track._decodingPromise = (async () => {
      try {
        const arrayBuf = await track.mediaBlob.arrayBuffer();
        const audioContext = getAudioContext();
        const audioBuf = await audioContext.decodeAudioData(arrayBuf.slice(0));

        // Atualiza duração real decodificada pelo motor de áudio (corrige Infinity do WebM)
        if (audioBuf.duration && isFinite(audioBuf.duration) && audioBuf.duration > 0) {
          const prevDur = track.duration || 0;
          track.duration = audioBuf.duration;
          if (Math.abs(prevDur - audioBuf.duration) > 0.15) {
            updateQuickStats();
          }
        }

        const rawData = audioBuf.getChannelData(0);
        const samplesPerBucket = Math.max(1, Math.floor(rawData.length / numBuckets));
        const peaks = new Float32Array(numBuckets);

        for (let i = 0; i < numBuckets; i++) {
          const start = i * samplesPerBucket;
          const end = Math.min(rawData.length, start + samplesPerBucket);
          let max = 0;
          for (let j = start; j < end; j++) {
            const val = Math.abs(rawData[j]);
            if (val > max) max = val;
          }
          peaks[i] = max;
        }

        track.waveformPeaks = Array.from(peaks);
        return track.waveformPeaks;
      } catch (err) {
        console.warn('Falha ao decodificar waveform real da faixa:', err);
        return null;
      } finally {
        track._decodingPromise = null;
      }
    })();

    return track._decodingPromise;
  }

  function drawWaveform(canvas, track, trackColor) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 600;
    const height = canvas.height = canvas.parentElement.clientHeight || 50;

    ctx.clearRect(0, 0, width, height);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, trackColor || '#E8C31B');
    grad.addColorStop(0.5, trackColor || '#E8C31B');
    grad.addColorStop(1, trackColor || '#E8C31B');

    const midY = height / 2;

    // Linha central de referência (0 dBFS / silêncio)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, midY - 0.5, width, 1);

    const renderPeaksOnCanvas = (peaks) => {
      if (!canvas.isConnected) return;
      const w = canvas.width = canvas.parentElement?.clientWidth || width;
      const h = canvas.height = canvas.parentElement?.clientHeight || height;
      const center = h / 2;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(0, center - 0.5, w, 1);

      const barGap = 3.5;
      const barsCount = Math.max(1, Math.floor(w / barGap));
      ctx.fillStyle = grad;

      if (peaks && peaks.length > 0) {
        // Normalização suave mantendo proporção caso o sinal seja muito baixo ou mudo
        let maxPeak = 0;
        for (let i = 0; i < peaks.length; i++) {
          if (peaks[i] > maxPeak) maxPeak = peaks[i];
        }
        const normFactor = maxPeak > 0.02 ? (1 / Math.max(0.25, maxPeak)) : 1;

        const rawDur = track.duration > 0 ? track.duration : 1;
        const skipSec = Math.max(0, -(track.offsetMs || 0) / 1000);
        const startRatio = Math.max(0, Math.min(0.98, ((track.trimStart || 0) + skipSec) / rawDur));
        const endRatio = Math.max(startRatio + 0.02, Math.min(1, getTrackEndMediaTime(track) / rawDur));

        for (let i = 0; i < barsCount; i++) {
          const x = i * barGap;
          const rel = barsCount > 1 ? (i / barsCount) : 0;
          const mappedRatio = startRatio + rel * (endRatio - startRatio);
          const peakIdx = Math.min(peaks.length - 1, Math.max(0, Math.floor(mappedRatio * peaks.length)));
          const rawAmp = peaks[peakIdx] || 0;
          const scaledAmp = Math.min(1.0, rawAmp * normFactor);
          const barHeight = Math.max(2, scaledAmp * (h * 0.86));
          const y = center - (barHeight / 2);
          ctx.fillRect(x, y, 2, barHeight);
        }
      } else {
        // Fallback caso o container não suporte decodeAudioData
        const seed = hashString(track.id + (track.duration || 1));
        for (let i = 0; i < barsCount; i++) {
          const x = i * barGap;
          const noise = pseudoRandom(seed + i);
          const amp = Math.min(1.0, Math.max(0.08, noise * 0.6));
          const barHeight = amp * (h * 0.75);
          const y = center - (barHeight / 2);
          ctx.fillRect(x, y, 2, barHeight);
        }
      }
    };

    if (track.waveformPeaks) {
      renderPeaksOnCanvas(track.waveformPeaks);
    } else if (track.mediaBlob) {
      extractWaveformPeaks(track).then(peaks => {
        renderPeaksOnCanvas(peaks);
      });
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

  // Posiciona a Agulha (Playhead) da Timeline em segundos
  function setPlayheadTimeSec(targetTimeSec) {
    const loopDurationSec = getTimelineDurationSec();
    const clampedSec = Math.max(0, Math.min(loopDurationSec, targetTimeSec));
    state.playheadPosSec = clampedSec;

    if (dom.reaperPlayhead && loopDurationSec > 0) {
      dom.reaperPlayhead.style.left = ((clampedSec / loopDurationSec) * 100) + '%';
    }

    if (state.isPlaying) {
      // Feature 18: Ruler Seek Clock Synchronization
      state.playbackStartPosSec = clampedSec;
      state.playbackStartPerfTime = performance.now();
      state.tracks.forEach(track => {
        if (track.videoElement) {
          triggerTrackAtTimelineOffset(track, clampedSec);
        }
      });
      if (state.metronomeEnabled) {
        resyncMetronomeToLoop();
      }
    } else {
      state.tracks.forEach(track => {
        if (track.videoElement) {
          const offsetSec = (track.offsetMs || 0) / 1000;
          const trimStartSec = track.trimStart || 0;
          const mediaTime = Math.min(
            getTrackEndMediaTime(track) || Infinity,
            Math.max(trimStartSec, (clampedSec - offsetSec) + trimStartSec)
          );
          try { track.videoElement.currentTime = mediaTime; } catch (err) {}
        }
      });
    }

    updateReaperLcdDisplay(clampedSec * 1000, loopDurationSec * 1000);
  }

  // --- Arraste Horizontal do Clipe (Drag & Slide) e Alças de Corte (Trim Esquerda / Direita) ---
  function setupMediaItemDrag(itemEl, track) {
    let isInteracting = false;

    const startInteraction = (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      if (e.button !== undefined && e.button !== 0) return;

      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }

      isInteracting = true;

      if (e.pointerId !== undefined && typeof itemEl.setPointerCapture === 'function') {
        try {
          itemEl.setPointerCapture(e.pointerId);
        } catch (_) {}
      }

      const trimHandle = e.target.closest('.clip-trim-handle');
      const trimSide = trimHandle ? trimHandle.dataset.side : null;

      // Seleciona esta faixa na timeline (destacando a linha da pista e o clipe)
      selectTrack(track.id);

      if (trimHandle) {
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        trimHandle.classList.add('is-trimming');
      }

      let hasMoved = false;
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const startX = clientX;
      const laneEl = itemEl.parentElement;
      const startLaneRect = laneEl ? laneEl.getBoundingClientRect() : { left: 0, width: 800 };
      const clipRect = itemEl.getBoundingClientRect();
      const grabOffsetPx = Math.max(0, Math.min(clipRect.width || 0, clientX - clipRect.left));

      // Eliminação de Dead-Zone em t=0ms (Feature 13): garante que offsetMs não acumule valores negativos
      const initialOffsetMs = Math.max(0, track.offsetMs || 0);
      const initialTrimStart = track.trimStart || 0;
      const initialTrimEnd = track.trimEnd || 0;
      const rawDur = track.duration > 0 ? track.duration : getTimelineDurationSec();
      const timelineDurSec = getTimelineDurationSec();
      const trackColor = itemEl.style.borderColor || '#E8C31B';
      const scrollEl = dom.reaperDawScroll || document.getElementById('reaperDawScroll');
      const lockedScrollLeft = scrollEl ? scrollEl.scrollLeft : 0;

      const onMove = (moveEvt) => {
        const curX = moveEvt.clientX !== undefined ? moveEvt.clientX : (moveEvt.touches && moveEvt.touches[0] ? moveEvt.touches[0].clientX : startX);
        const dx = curX - startX;
        if (Math.abs(dx) >= 3) hasMoved = true;
        if (!hasMoved) return;

        if (typeof moveEvt.preventDefault === 'function') {
          moveEvt.preventDefault();
        }
        if (scrollEl && scrollEl.scrollLeft !== lockedScrollLeft) {
          scrollEl.scrollLeft = lockedScrollLeft;
        }

        const curLaneRect = laneEl ? laneEl.getBoundingClientRect() : { left: 0, width: 800 };
        const laneWidth = curLaneRect.width || (laneEl ? laneEl.clientWidth : 800) || 800;

        if (trimSide === 'left') {
          // Alça Esquerda: corta o início (trimStart) e ajusta offsetMs para manter o áudio cravado no compasso
          const compensatedDx = (curX - curLaneRect.left) - (startX - startLaneRect.left);
          const deltaSec = (compensatedDx / laneWidth) * timelineDurSec;
          const maxTrimStart = Math.max(0, rawDur - initialTrimEnd - 0.12);
          let newTrimStart = Math.max(0, Math.min(maxTrimStart, initialTrimStart + deltaSec));
          if (state.snapToGrid) {
            newTrimStart = snapTimeToGrid(newTrimStart, state.bpm, state.meter, true);
          }
          const appliedDeltaSec = newTrimStart - initialTrimStart;
          track.trimStart = newTrimStart;
          track.offsetMs = Math.max(0, Math.round(initialOffsetMs + appliedDeltaSec * 1000));
        } else if (trimSide === 'right') {
          // Alça Direita: corta o final (trimEnd)
          const compensatedDx = (curX - curLaneRect.left) - (startX - startLaneRect.left);
          const deltaSec = (compensatedDx / laneWidth) * timelineDurSec;
          const maxTrimEnd = Math.max(0, rawDur - initialTrimStart - 0.12);
          let newTrimEnd = Math.max(0, Math.min(maxTrimEnd, initialTrimEnd - deltaSec));
          if (state.snapToGrid) {
            newTrimEnd = snapTimeToGrid(newTrimEnd, state.bpm, state.meter, true);
          }
          track.trimEnd = newTrimEnd;
        } else {
          // Arraste do corpo do clipe: Scroll-Compensated Coordinate Math e Âncora de Grab (Features 9, 10, 13)
          const currentLeftPx = (curX - grabOffsetPx) - curLaneRect.left;
          const currentPercent = currentLeftPx / laneWidth;
          let rawTimeSec = currentPercent * timelineDurSec;

          // Dead-Zone Clamping Elimination: limite rígido em >= 0s (elimina dead-zone negativa)
          rawTimeSec = Math.max(0, rawTimeSec);

          // True Musical Snap-to-Grid: quantização em compassos, tempos e colcheias com threshold magnético
          if (state.snapToGrid) {
            rawTimeSec = snapTimeToGrid(rawTimeSec, state.bpm, state.meter, true);
          }

          // Limite superior na timeline
          const maxOffsetSec = Math.max(0, timelineDurSec - 0.1);
          rawTimeSec = Math.min(maxOffsetSec, rawTimeSec);

          track.offsetMs = Math.round(rawTimeSec * 1000);
        }

        // Atualização visual e badges em tempo real sem destruição de DOM
        const effDur = getTrackEffectiveDuration(track);
        const widthPercent = Math.min(100, Math.max(4, (effDur / timelineDurSec) * 100));
        const offsetSec = (track.offsetMs || 0) / 1000;
        const leftPercent = Math.max(0, Math.min(100, (offsetSec / timelineDurSec) * 100));

        itemEl.style.width = widthPercent + '%';
        itemEl.style.left = leftPercent + '%';

        const syncBadge = itemEl.querySelector('.item-sync-badge');
        if (syncBadge) syncBadge.textContent = `${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms`;

        const durBadge = itemEl.querySelector('.item-dur-badge');
        if (durBadge) durBadge.textContent = `${effDur.toFixed(1)}s`;

        const row = document.getElementById(`reaper_row_${track.id}`);
        if (row) {
          const syncDisp = row.querySelector('.tcp-sync-val, .tcp-sync-display');
          if (syncDisp) syncDisp.textContent = `${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms`;
        }

        if (trimSide) {
          const cvs = document.getElementById(`wf_${track.id}`);
          if (cvs) drawWaveform(cvs, track, trackColor);
        }
      };

      const onEnd = (endEvt) => {
        isInteracting = false;
        try {
          if (endEvt && endEvt.pointerId !== undefined && typeof itemEl.releasePointerCapture === 'function' && itemEl.hasPointerCapture && itemEl.hasPointerCapture(endEvt.pointerId)) {
            itemEl.releasePointerCapture(endEvt.pointerId);
          }
        } catch (_) {}

        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);

        if (trimHandle) trimHandle.classList.remove('is-trimming');

        if (!hasMoved && !trimSide && laneEl) {
          // Clique rápido sobre a onda sonora do clipe: posiciona a agulha exatamente onde clicou!
          const rect = laneEl.getBoundingClientRect();
          const clickPct = Math.max(0, Math.min(1, (startX - rect.left) / (rect.width || 1)));
          setPlayheadTimeSec(clickPct * timelineDurSec);
        } else if (hasMoved) {
          // Non-Destructive In-Place Drop (Feature 12):
          // Atualiza posições, estilos e offset in-place SEM destruir dom.reaperTracksStack,
          // preservando o scrollLeft do contêiner e eliminando flicker de canvas
          if (scrollEl && scrollEl.scrollLeft !== lockedScrollLeft) {
            scrollEl.scrollLeft = lockedScrollLeft;
          }
          const effDur = getTrackEffectiveDuration(track);
          const widthPercent = Math.min(100, Math.max(4, (effDur / timelineDurSec) * 100));
          const offsetSec = (track.offsetMs || 0) / 1000;
          const leftPercent = Math.max(0, Math.min(100, (offsetSec / timelineDurSec) * 100));

          itemEl.style.width = widthPercent + '%';
          itemEl.style.left = leftPercent + '%';

          const syncBadge = itemEl.querySelector('.item-sync-badge');
          if (syncBadge) syncBadge.textContent = `${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms`;

          const durBadge = itemEl.querySelector('.item-dur-badge');
          if (durBadge) durBadge.textContent = `${effDur.toFixed(1)}s`;

          const row = document.getElementById(`reaper_row_${track.id}`);
          if (row) {
            const syncDisp = row.querySelector('.tcp-sync-val, .tcp-sync-display');
            if (syncDisp) syncDisp.textContent = `${track.offsetMs >= 0 ? '+' : ''}${track.offsetMs}ms`;
          }

          if (trimSide) {
            const cvs = document.getElementById(`wf_${track.id}`);
            if (cvs) drawWaveform(cvs, track, trackColor);
          }

          // Se o clipe ultrapassou os limites anteriores da régua, expande os compassos in-place
          const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
          const measureDurationSec = (beatsPerMeasure * 60) / state.bpm;
          const newTimelineDurSec = getTimelineDurationSec();
          const newMeasures = Math.max(2, Math.ceil(newTimelineDurSec / measureDurationSec));
          const currentBars = dom.reaperRulerBars ? dom.reaperRulerBars.querySelectorAll('.ruler-bar-item').length : 0;
          if (newMeasures > currentBars && dom.reaperRulerBars) {
            for (let m = currentBars + 1; m <= newMeasures; m++) {
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
            if (dom.reaperTracksStack) {
              dom.reaperTracksStack.querySelectorAll('.lane-grid-overlay').forEach(overlay => {
                const curCols = overlay.querySelectorAll('.lane-grid-col').length;
                for (let m = curCols + 1; m <= newMeasures; m++) {
                  const gridCol = document.createElement('div');
                  gridCol.className = 'lane-grid-col';
                  overlay.appendChild(gridCol);
                }
              });
            }
            state.tracks.forEach(tr => {
              const el = document.getElementById(`media_item_${tr.id}`);
              if (el) {
                const tDur = getTrackEffectiveDuration(tr);
                el.style.width = Math.min(100, Math.max(4, (tDur / newTimelineDurSec) * 100)) + '%';
                el.style.left = Math.max(0, Math.min(100, (((tr.offsetMs || 0) / 1000) / newTimelineDurSec) * 100)) + '%';
              }
            });
            if (!state.isPlaying && dom.reaperPlayhead && newTimelineDurSec > 0) {
              const phPct = Math.min(100, Math.max(0, (state.playheadPosSec / newTimelineDurSec) * 100));
              dom.reaperPlayhead.style.left = phPct + '%';
            }
          }

          updateQuickStats();
          updateAudioMixRouting();
          saveCurrentSession();
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    };

    itemEl.addEventListener('pointerdown', startInteraction);
    itemEl.addEventListener('mousedown', (e) => {
      if (!isInteracting) startInteraction(e);
    });
    itemEl.addEventListener('touchstart', (e) => {
      if (!isInteracting && e.touches && e.touches[0]) startInteraction(e.touches[0]);
    }, { passive: false });
  }

  // Alternância Não-Destrutiva de Solo com Roteamento de Áudio em Tempo Real (Feature 16)
  function toggleTrackSolo(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return;
    track.solo = !track.solo;
    const anySolo = state.tracks.some(t => t.solo);

    // Atualiza classes na Timeline REAPER sem destruir o DOM
    if (dom.reaperTracksStack) {
      dom.reaperTracksStack.querySelectorAll('.reaper-track-row').forEach(r => {
        const trkId = r.id.replace('reaper_row_', '');
        const trk = state.tracks.find(t => t.id === trkId);
        if (trk) {
          const sBtn = r.querySelector('.tcp-btn-solo');
          if (sBtn) sBtn.classList.toggle('active', trk.solo);
          r.classList.toggle('is-soloed', trk.solo);
          r.classList.toggle('is-solo-dimmed', anySolo && !trk.solo);
        }
      });
    }

    // Reflete no Mosaico sem destruir elementos de áudio/vídeo
    if (dom.mosaicGrid) {
      dom.mosaicGrid.querySelectorAll('.mosaic-card').forEach(c => {
        const trkId = c.id.replace('card_', '');
        const trk = state.tracks.find(t => t.id === trkId);
        if (trk) {
          const mBtn = c.querySelector('.btn-solo');
          if (mBtn) mBtn.classList.toggle('active', trk.solo);
          c.classList.toggle('is-soloed', trk.solo);
          c.classList.toggle('is-solo-dimmed', anySolo && !trk.solo);
        }
      });
    }

    updateAudioMixRouting();
    saveCurrentSession();
  }

  // --- Binds de Eventos da DAW estilo REAPER ---
  function bindReaperEvents() {
    if (!dom.reaperTracksStack) return;

    // Seleção de faixa ao clicar na linha da faixa ou no TCP
    dom.reaperTracksStack.querySelectorAll('.reaper-track-row').forEach(row => {
      row.onclick = (e) => {
        if (e.target.closest('button, input, select, .tcp-menu-dropdown, .clip-trim-handle, .reaper-media-item')) return;
        const id = row.id.replace('reaper_row_', '');
        selectTrack(id);
      };
    });

    dom.reaperTracksStack.querySelectorAll('.reaper-tcp').forEach(tcp => {
      tcp.onclick = (e) => {
        if (e.target.closest('button, input, select, .tcp-menu-dropdown')) return;
        const row = tcp.closest('.reaper-track-row');
        if (row) {
          const id = row.id.replace('reaper_row_', '');
          selectTrack(id);
        }
      };
    });

    // Edição do nome da faixa
    dom.reaperTracksStack.querySelectorAll('.tcp-name-input').forEach(input => {
      input.onfocus = () => {
        if (input.dataset.id) selectTrack(input.dataset.id);
      };
      input.onchange = (e) => {
        const id = e.target.dataset.id;
        const idx = state.tracks.findIndex(t => t.id === id);
        if (idx !== -1) {
          state.tracks[idx].name = e.target.value.trim() || `Faixa ${idx + 1}`;
          e.target.value = state.tracks[idx].name;
          renderMosaic(); // Atualiza também o mosaico
          saveCurrentSession();
        }
      };
    });

    // Miniatura PIP clicável (abre gravação ou seleciona tomada)
    dom.reaperTracksStack.querySelectorAll('.tcp-media-pip').forEach(pip => {
      pip.onclick = (e) => {
        e.stopPropagation();
        const id = pip.dataset.id;
        selectTrack(id);
        const track = state.tracks.find(t => t.id === id);
        if (!track) return;
        if (!track.mediaUrl) {
          openRecordingModal(id, track.mediaType || 'audio');
        } else if (track.mediaType === 'video') {
          switchViewMode('mosaic');
        }
      };
    });

    // Menu Kebab (⋯) - Abrir/Fechar dropdown com coordenadas fixed seguras (não corta em 1 faixa)
    dom.reaperTracksStack.querySelectorAll('.tcp-btn-more').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        selectTrack(id);
        const menu = document.getElementById(`tcp_menu_${id}`);
        if (!menu) return;
        const isShown = menu.style.display === 'block';
        closeAllKebabMenus();
        const sPop = document.getElementById('studioSettingsPopover');
        const pPop = document.getElementById('studioProjectPopover');
        if (sPop) sPop.classList.remove('open', 'active');
        if (pPop) pPop.classList.remove('open', 'active');
        if (typeof window.closeSeqPopovers === 'function') window.closeSeqPopovers();
        if (!isShown) {
          const row = btn.closest('.reaper-track-row');
          if (row) row.classList.add('menu-open');
          menu.style.display = 'block';
          const btnRect = btn.getBoundingClientRect();
          const menuRect = menu.getBoundingClientRect();
          const minMenuW = window.innerWidth <= 360 ? 166 : 185;
          const menuW = Math.max(minMenuW, menuRect.width || minMenuW);
          const menuH = Math.max(140, menuRect.height || 146);
          const pad = 8;
          let left = btnRect.right + 6;
          if (left + menuW > window.innerWidth - pad) {
            left = Math.max(pad, window.innerWidth - menuW - pad);
          }
          let top = btnRect.top;
          if (top + menuH > window.innerHeight - pad) {
            top = Math.max(pad, window.innerHeight - menuH - pad);
          }
          if (top < pad) top = pad;
          menu.style.position = 'fixed';
          menu.style.top = `${Math.round(top)}px`;
          menu.style.left = `${Math.round(left)}px`;
          menu.style.right = 'auto';
          menu.style.marginTop = '0';
        }
      };
    });

    // Kebab Menu: 1. Carregar arquivo
    dom.reaperTracksStack.querySelectorAll('.tcp-menu-load').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        closeAllKebabMenus();
        const uploader = dom.reaperTracksStack.querySelector(`.tcp-file-uploader[data-id="${id}"]`);
        if (uploader) uploader.click();
      };
    });

    // Kebab Menu: 2. Duplicar faixa
    dom.reaperTracksStack.querySelectorAll('.tcp-menu-duplicate').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        closeAllKebabMenus();
        duplicateTrack(id);
      };
    });

    // Kebab Menu: 3. Limpar gravação
    dom.reaperTracksStack.querySelectorAll('.tcp-menu-clear').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        closeAllKebabMenus();
        const track = state.tracks.find(t => t.id === id);
        if (!track || !track.mediaUrl) return;
        const ok = window.appConfirm
          ? await window.appConfirm(`Limpar a gravação da faixa "${track.name}"? A faixa vazia será mantida no projeto.`, 'Limpar Gravação', { isDanger: true, confirmText: 'Limpar' })
          : confirm(`Limpar a gravação da faixa "${track.name}"?`);
        if (!ok) return;
        clearTrackMedia(id);
      };
    });

    // Kebab Menu: 4. Excluir faixa (e botão legado tcp-btn-delete)
    dom.reaperTracksStack.querySelectorAll('.tcp-menu-delete, .tcp-btn-delete').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        closeAllKebabMenus();
        const track = state.tracks.find(t => t.id === id);
        if (track && track.mediaUrl) {
          const ok = window.appConfirm
            ? await window.appConfirm(`Deseja remover a pista "${track.name}" e sua gravação?`, 'Remover Pista', { isDanger: true, confirmText: 'Remover' })
            : confirm(`Deseja remover a pista "${track.name}" e sua gravação?`);
          if (!ok) return;
        }
        removeTrack(id);
        if (window.appToast) window.appToast('Faixa removida.', 'info');
      };
    });

    // Botão de Gravação da Faixa Vazia e Botões de Gravação rápida
    dom.reaperTracksStack.querySelectorAll('.btn-tcp-rec, .btn-empty-record').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const mode = btn.dataset.mode || 'video';
        selectTrack(id);
        openRecordingModal(id, mode);
      };
    });

    // Botão REC ARM (● REC) - Armar Pista independente sem redirecionar view (Feature 14)
    dom.reaperTracksStack.querySelectorAll('.btn-rec-arm').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const track = state.tracks.find(t => t.id === id);
        if (!track) return;
        track.armed = !track.armed;
        btn.classList.toggle('armed', track.armed);
        btn.classList.toggle('active', track.armed);
        selectTrack(id);
        saveCurrentSession();
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

    // Botão Cortar Faixa (✂️ no TCP ou no Clipe)
    dom.reaperTracksStack.querySelectorAll('.btn-tcp-cut, .btn-clip-cut').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        selectTrack(id);
        openTrackCutModal(id);
      };
    });

    // Botão Restaurar Faixa Inteira (↺ no Clipe)
    dom.reaperTracksStack.querySelectorAll('.btn-clip-restore').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        selectTrack(id);
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.trimStart = 0;
          track.trimEnd = 0;
          renderStudioViews();
          saveCurrentSession();
        }
      };
    });

    // Limpar mídia gravada (legado btn-tcp-clear)
    dom.reaperTracksStack.querySelectorAll('.btn-tcp-clear').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        clearTrackMedia(id);
      };
    });

    // Slider de Volume Horizontal estilo Fader (Duplo clique reseta para 100%)
    const resetTrackVolume = (id, row) => {
      const track = state.tracks.find(t => t.id === id);
      if (!track) return;
      track.volume = 1.0;
      if (row) {
        const sl = row.querySelector('.tcp-fader-slider');
        if (sl) sl.value = '1';
        const dbLabel = row.querySelector('.tcp-vol-db');
        if (dbLabel) dbLabel.textContent = '100%';
      }
      const mosaicSlider = dom.mosaicGrid ? dom.mosaicGrid.querySelector(`.volume-slider[data-id="${id}"]`) : null;
      if (mosaicSlider) {
        mosaicSlider.value = '1';
        const badge = mosaicSlider.parentElement.querySelector('.volume-val-badge');
        if (badge) badge.textContent = '100%';
      }
      updateAudioMixRouting();
      saveCurrentSession();
    };

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
      slider.ondblclick = (e) => {
        e.stopPropagation();
        resetTrackVolume(slider.dataset.id, slider.closest('.reaper-track-row'));
      };
      slider.onchange = () => saveCurrentSession();
    });

    dom.reaperTracksStack.querySelectorAll('.tcp-vol-db').forEach(dbLabel => {
      dbLabel.style.cursor = 'pointer';
      dbLabel.title = 'Duplo clique para resetar volume em 100%';
      dbLabel.ondblclick = (e) => {
        e.stopPropagation();
        const row = dbLabel.closest('.reaper-track-row');
        const id = row ? row.id.replace('reaper_row_', '') : null;
        if (id) resetTrackVolume(id, row);
      };
    });

    // Botão MUTE [M]
    dom.reaperTracksStack.querySelectorAll('.tcp-btn-mute').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        selectTrack(id);
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

    // Botão SOLO [Alt+S] - Non-Destructive Solo Audio Routing (Feature 16)
    dom.reaperTracksStack.querySelectorAll('.tcp-btn-solo').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        selectTrack(id);
        toggleTrackSolo(id);
      };
    });

    // Sync Nudge Buttons (‹ e › compactos na Row 3)
    dom.reaperTracksStack.querySelectorAll('.tcp-sync-step').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        selectTrack(id);
        const deltaMultiplier = e.shiftKey ? 5 : 1;
        const delta = (parseInt(btn.dataset.step || btn.dataset.delta, 10) || (btn.classList.contains('sync-prev') ? -10 : 10)) * deltaMultiplier;
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.offsetMs = Math.max(-5000, Math.min(5000, (track.offsetMs || 0) + delta));
          updateTrackOffsetInPlace(track);
          saveCurrentSession();
        }
      };
    });

    // Ajuste direto ou Reset de Offset ao clicar no valor central
    dom.reaperTracksStack.querySelectorAll('.tcp-sync-val').forEach(valSpan => {
      valSpan.onclick = (e) => {
        e.stopPropagation();
        const id = valSpan.dataset.id;
        selectTrack(id);
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          const current = track.offsetMs || 0;
          const val = prompt(`Ajuste fino de offset (ms) para "${track.name}":\nDigite o valor em ms (ex: -120 para adiantar, +50 para atrasar, ou 0 para zerar):`, current);
          if (val !== null) {
            const parsed = parseInt(val, 10);
            if (!isNaN(parsed)) {
              track.offsetMs = Math.max(-5000, Math.min(5000, parsed));
              updateTrackOffsetInPlace(track);
              saveCurrentSession();
            }
          }
        }
      };
    });

    // Legado: tcp-sync-btn (-50 / -10 / +10 / +50)
    dom.reaperTracksStack.querySelectorAll('.tcp-sync-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        selectTrack(id);
        const delta = parseInt(btn.dataset.delta, 10);
        const track = state.tracks.find(t => t.id === id);
        if (track) {
          track.offsetMs = Math.max(-5000, Math.min(5000, (track.offsetMs || 0) + delta));
          updateTrackOffsetInPlace(track);
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

  function selectTrack(trackId) {
    state.selectedTrackId = trackId;
    if (dom.reaperTracksStack) {
      dom.reaperTracksStack.querySelectorAll('.reaper-track-row').forEach(row => {
        row.classList.toggle('is-selected', row.id === `reaper_row_${trackId}`);
      });
      dom.reaperTracksStack.querySelectorAll('.reaper-media-item').forEach(item => {
        item.classList.toggle('is-selected', item.id === `media_item_${trackId}`);
      });
    }
  }

  function addTrack(name) {
    if (state.tracks.length >= MAX_STUDIO_TRACKS) {
      if (window.appToast) window.appToast(`Limite máximo de ${MAX_STUDIO_TRACKS} faixas atingido.`, 'warn');
      else alert(`Limite de ${MAX_STUDIO_TRACKS} faixas no projeto atingido.`);
      return null;
    }
    sessionEpoch++;
    let trackName = (typeof name === 'string' && name.trim() && !name.startsWith('[object')) ? name.trim() : null;
    if (!trackName) {
      trackName = `Faixa ${state.tracks.length + 1}`;
    }
    const newTrack = createTrack(trackName, state.tracks.length);
    state.tracks.push(newTrack);
    selectTrack(newTrack.id);
    renderStudioViews();
    saveCurrentSession();
    return newTrack;
  }

  function duplicateTrack(trackId) {
    if (state.tracks.length >= MAX_STUDIO_TRACKS) {
      if (window.appToast) window.appToast(`Limite máximo de ${MAX_STUDIO_TRACKS} faixas atingido.`, 'warn');
      else alert(`Limite de ${MAX_STUDIO_TRACKS} faixas no projeto atingido.`);
      return null;
    }
    const source = state.tracks.find(t => t.id === trackId);
    if (!source) return null;
    sessionEpoch++;
    const newName = `${source.name} (Cópia)`;
    const newTrack = createTrack(newName, state.tracks.length);
    newTrack.volume = source.volume;
    newTrack.muted = source.muted;
    newTrack.solo = false;
    newTrack.offsetMs = source.offsetMs;
    newTrack.trimStart = source.trimStart;
    newTrack.trimEnd = source.trimEnd;
    newTrack.duration = source.duration;
    newTrack.mediaType = source.mediaType;
    if (source.waveformPeaks) {
      newTrack.waveformPeaks = [...source.waveformPeaks];
    }
    if (source.mediaBlob) {
      newTrack.mediaBlob = source.mediaBlob;
      newTrack.mediaUrl = URL.createObjectURL(source.mediaBlob);
      if (newTrack.mediaType === 'video') {
        const v = document.createElement('video');
        v.src = newTrack.mediaUrl;
        v.muted = true;
        v.playsInline = true;
        v.loop = true;
        v.preload = 'auto';
        newTrack.videoElement = v;
      }
    }
    const sourceIdx = state.tracks.findIndex(t => t.id === trackId);
    state.tracks.splice(sourceIdx + 1, 0, newTrack);
    selectTrack(newTrack.id);
    renderStudioViews();
    saveCurrentSession();
    if (window.appToast) window.appToast(`Faixa "${source.name}" duplicada.`, 'success');
    return newTrack;
  }

  function clearTrackMedia(id) {
    const track = state.tracks.find(t => t.id === id);
    if (!track) return;
    sessionEpoch++;
    if (track._offsetTimer) {
      clearTimeout(track._offsetTimer);
      track._offsetTimer = null;
    }
    if (track._trimStopTimer) {
      clearTimeout(track._trimStopTimer);
      track._trimStopTimer = null;
    }
    if (track.mediaUrl) {
      URL.revokeObjectURL(track.mediaUrl);
    }
    track.mediaUrl = null;
    track.mediaBlob = null;
    track.duration = 0;
    track.trimStart = 0;
    track.trimEnd = 0;
    track.waveformPeaks = null;
    if (track.videoElement) {
      track.videoElement.src = '';
      track.videoElement = null;
    }
    renderStudioViews();
    saveCurrentSession();
    if (window.appToast) window.appToast(`Gravação da faixa "${track.name}" limpa.`, 'info');
  }

  function removeTrack(id) {
    const idx = state.tracks.findIndex(t => t.id === id);
    if (idx !== -1) {
      sessionEpoch++;
      const tr = state.tracks[idx];
      if (tr.mediaUrl) URL.revokeObjectURL(tr.mediaUrl);
      state.tracks.splice(idx, 1);
      if (state.selectedTrackId === id) {
        state.selectedTrackId = state.tracks[Math.min(idx, state.tracks.length - 1)]?.id || null;
      }
      renderStudioViews();
      saveCurrentSession();
    }
  }

  function loadMediaFileToTrack(trackId, file) {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return;

    if (track._offsetTimer) {
      clearTimeout(track._offsetTimer);
      track._offsetTimer = null;
    }
    if (track._trimStopTimer) {
      clearTimeout(track._trimStopTimer);
      track._trimStopTimer = null;
    }
    if (track.mediaUrl) URL.revokeObjectURL(track.mediaUrl);
    track.mediaBlob = file;
    track.mediaUrl = URL.createObjectURL(file);
    track.mediaType = file.type.startsWith('video') ? 'video' : 'audio';
    track.trimStart = 0;
    track.trimEnd = 0;
    track.waveformPeaks = null;

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

    extractWaveformPeaks(track).then(() => {
      renderStudioViews();
      saveCurrentSession();
    });

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
    reviewUrl: null,
    micSourceNode: null,
    micAnalyser: null,
    micAnimationId: null,
    countdownTimer: null,
    recordingTimer: null,
    isCountingDown: false,
    isRecording: false,
    aborted: false
  };

  function disconnectMicMeter() {
    if (recordingContext.micAnimationId) {
      cancelAnimationFrame(recordingContext.micAnimationId);
      recordingContext.micAnimationId = null;
    }
    if (recordingContext.micSourceNode) {
      try { recordingContext.micSourceNode.disconnect(); } catch (e) {}
      recordingContext.micSourceNode = null;
    }
    if (recordingContext.micAnalyser) {
      try { recordingContext.micAnalyser.disconnect(); } catch (e) {}
      recordingContext.micAnalyser = null;
    }
    if (dom.micMeterLevel) dom.micMeterLevel.style.width = '0%';
  }

  function cleanupReviewMedia() {
    if (dom.viewfinderVideo) {
      try { dom.viewfinderVideo.pause(); } catch (e) {}
      dom.viewfinderVideo.removeAttribute('src');
      dom.viewfinderVideo.loop = false;
      dom.viewfinderVideo.muted = true;
    }
    if (recordingContext.reviewUrl) {
      URL.revokeObjectURL(recordingContext.reviewUrl);
      recordingContext.reviewUrl = null;
    }
  }

  // Enumera microfones e webcams disponíveis no computador do usuário
  async function populateMediaDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const videoInputs = devices.filter(d => d.kind === 'videoinput');

      if (dom.recAudioDevice) {
        const curVal = state.selectedAudioDeviceId || dom.recAudioDevice.value;
        dom.recAudioDevice.innerHTML = '';
        if (audioInputs.length === 0) {
          dom.recAudioDevice.innerHTML = '<option value="">Microfone Padrão do Sistema</option>';
        } else {
          audioInputs.forEach((dev, idx) => {
            const opt = document.createElement('option');
            opt.value = dev.deviceId;
            opt.textContent = dev.label ? dev.label : `Microfone ${idx + 1}`;
            if (dev.deviceId === curVal || (!curVal && idx === 0)) {
              opt.selected = true;
            }
            dom.recAudioDevice.appendChild(opt);
          });
          state.selectedAudioDeviceId = dom.recAudioDevice.value;
        }
      }

      if (dom.recVideoDevice) {
        const curVal = state.selectedVideoDeviceId || dom.recVideoDevice.value;
        dom.recVideoDevice.innerHTML = '';
        if (videoInputs.length === 0) {
          dom.recVideoDevice.innerHTML = '<option value="">Câmera Padrão</option>';
        } else {
          videoInputs.forEach((dev, idx) => {
            const opt = document.createElement('option');
            opt.value = dev.deviceId;
            opt.textContent = dev.label ? dev.label : `Câmera ${idx + 1}`;
            if (dev.deviceId === curVal || (!curVal && idx === 0)) {
              opt.selected = true;
            }
            dom.recVideoDevice.appendChild(opt);
          });
          state.selectedVideoDeviceId = dom.recVideoDevice.value;
        }
      }

      if (dom.recAudioProfile) {
        dom.recAudioProfile.value = state.audioProfile || 'raw';
      }
    } catch (err) {
      console.warn('Erro ao listar dispositivos de mídia:', err);
    }
  }

  async function setRecordingMode(mode) {
    recordingContext.captureMode = mode;
    if (dom.recModeVideoBtn && dom.recModeAudioBtn) {
      dom.recModeVideoBtn.classList.toggle('active', mode === 'video');
      dom.recModeAudioBtn.classList.toggle('active', mode === 'audio');
    }

    if (dom.recVideoDeviceGroup) {
      dom.recVideoDeviceGroup.style.display = (mode === 'video') ? 'flex' : 'none';
    }

    cleanupReviewMedia();
    disconnectMicMeter();

    // Para o stream anterior se houver
    if (recordingContext.stream) {
      recordingContext.stream.getTracks().forEach(t => t.stop());
      recordingContext.stream = null;
    }

    const track = state.tracks.find(t => t.id === recordingContext.activeTrackId);
    if (dom.audioViewfinderInstrument && track) {
      dom.audioViewfinderInstrument.textContent = track.name;
    }

    // Constraints de áudio de alta fidelidade
    const isFiltered = (state.audioProfile === 'filtered');
    const audioConstraints = {
      deviceId: state.selectedAudioDeviceId ? { ideal: state.selectedAudioDeviceId } : undefined,
      echoCancellation: isFiltered,
      noiseSuppression: isFiltered,
      autoGainControl: isFiltered,
      channelCount: { ideal: 2 },
      sampleRate: { ideal: 48000 }
    };

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      console.warn('navigator.mediaDevices.getUserMedia indisponível neste contexto.');
      if (typeof alert === 'function') {
        alert('O acesso ao microfone/câmera requer conexão segura (HTTPS ou localhost).');
      }
      return;
    }

    try {
      if (mode === 'audio') {
        // MODO APENAS MICROFONE (não pede câmera)
        if (dom.viewfinderVideo) {
          dom.viewfinderVideo.style.display = 'none';
          dom.viewfinderVideo.srcObject = null;
        }
        if (dom.audioOnlyViewfinder) dom.audioOnlyViewfinder.style.display = 'flex';

        let audioStream;
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
        } catch (e) {
          console.warn('Fallback audio constraints:', e);
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }

        recordingContext.stream = audioStream;
        setupMicMeter(audioStream);
      } else {
        // MODO CÂMERA & MICROFONE:
        // Requisita vídeo e áudio em uma única chamada getUserMedia para evitar conflito de hardware em mobile/drivers exclusivos
        if (dom.audioOnlyViewfinder) dom.audioOnlyViewfinder.style.display = 'none';
        if (dom.viewfinderVideo) dom.viewfinderVideo.style.display = 'block';

        const videoConstraints = {
          deviceId: state.selectedVideoDeviceId ? { ideal: state.selectedVideoDeviceId } : undefined,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user'
        };

        let combinedStream;
        try {
          combinedStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: audioConstraints
          });
        } catch (e) {
          console.warn('Fallback combined video+audio constraints:', e);
          try {
            combinedStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: audioConstraints
            });
          } catch (e2) {
            try {
              combinedStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
              });
            } catch (e3) {
              console.warn('Câmera não encontrada ou sem permissão, alternando para modo Só Microfone:', e3);
              return await setRecordingMode('audio');
            }
          }
        }

        recordingContext.stream = combinedStream;
        dom.viewfinderVideo.srcObject = combinedStream;
        dom.viewfinderVideo.muted = true;
        await dom.viewfinderVideo.play().catch(() => {});
        setupMicMeter(combinedStream);
      }

      // Popula ou atualiza a lista de nomes reais de microfones e webcams após permissão concedida
      await populateMediaDevices();
    } catch (err) {
      console.error('Erro ao acessar dispositivo no modo ' + mode, err);
      alert(`Não foi possível acessar seu dispositivo no modo ${mode === 'audio' ? 'apenas microfone' : 'câmera'}. Verifique as permissões do navegador.`);
    }
  }

  async function openRecordingModal(trackId, preferredMode = 'video') {
    await switchViewMode('record', trackId, preferredMode);
  }

  function openQuickRecord() {
    switchViewMode('record');
  }

  function setupMicMeter(stream) {
    disconnectMicMeter();
    try {
      if (!stream || stream.getAudioTracks().length === 0) return;
      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      recordingContext.micSourceNode = source;
      recordingContext.micAnalyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function updateMeter() {
        if (!recordingContext.stream || !recordingContext.micAnalyser) return;
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
    switchViewMode('timeline');
  }

  // Contagem antes da gravação (sempre 1, 2, 3, 4 com agendamento Web Audio de alta precisão)
  async function startPreRollCountdown() {
    if (recordingContext.isCountingDown || recordingContext.isRecording) return;
    if (!recordingContext.stream) {
      await setRecordingMode(recordingContext.captureMode || 'audio');
      if (!recordingContext.stream) {
        alert('Microfone não detectado ou sem permissão ativa.');
        return;
      }
    }

    const ctx = getAudioContext();
    recordingContext.isCountingDown = true;
    recordingContext.aborted = false;

    const totalBeats = 4;
    const secondsPerBeat = 60 / state.bpm;
    let currentBeat = 1;

    dom.btnStartRecord.textContent = '⏹ Cancelar Contagem';
    dom.btnStartRecord.classList.add('is-recording');
    if (dom.btnStudioRecord) dom.btnStudioRecord.classList.add('is-recording');

    dom.countdownOverlay.classList.add('active');
    dom.countdownNumber.textContent = currentBeat;
    dom.countdownSubtext.textContent = 'Contagem: 1, 2, 3, 4...';

    // Agenda os 4 cliques da contagem com precisão de microsegundo via Web Audio
    const startAudioTime = ctx.currentTime + 0.01;
    for (let b = 0; b < totalBeats; b++) {
      playMetronomeClick(b === 0, startAudioTime + b * secondsPerBeat);
    }

    if (recordingContext.countdownTimer) {
      clearInterval(recordingContext.countdownTimer);
    }

    const startPerfTime = performance.now();
    recordingContext.countdownTimer = setInterval(() => {
      const elapsedSec = (performance.now() - startPerfTime) / 1000;
      const beatIdx = Math.floor(elapsedSec / secondsPerBeat) + 1;

      if (beatIdx <= totalBeats) {
        if (beatIdx !== currentBeat) {
          currentBeat = beatIdx;
          dom.countdownNumber.textContent = currentBeat;
        }
      } else {
        clearInterval(recordingContext.countdownTimer);
        recordingContext.countdownTimer = null;
        recordingContext.isCountingDown = false;
        dom.countdownOverlay.classList.remove('active');
        startActualRecording();
      }
    }, 20);
  }

  // Início oficial da gravação com overdub nos fones
  function startActualRecording() {
    if (!recordingContext.stream || recordingContext.aborted) return;

    recordingContext.recordedChunks = [];
    recordingContext.isCountingDown = false;
    recordingContext.isRecording = true;

    // Configura MediaRecorder de acordo com o modo (vídeo ou áudio)
    let mimeType = '';
    let recorderOptions = {};

    if (recordingContext.captureMode === 'audio') {
      const audioTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg'
      ];
      for (const t of audioTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
      }
      recorderOptions = {
        mimeType: mimeType || undefined,
        audioBitsPerSecond: 192000 // 192 kbps estéreo / alta fidelidade para instrumentos vocais
      };
    } else {
      // Para vídeo: preferir vp8,opus para reduzir em ~70% o uso de CPU vs vp9, prevenindo buffer underflow de áudio
      const videoTypes = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
        'video/mp4'
      ];
      for (const t of videoTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
      }
      recorderOptions = {
        mimeType: mimeType || undefined,
        audioBitsPerSecond: 192000, // CRÍTICO: Força 192kbps para o áudio no vídeo (impede queda para 32kbps mono)
        videoBitsPerSecond: 2500000 // 2.5 Mbps de bitrate para vídeo fluido em 720p
      };
    }

    let recorder;
    try {
      recorder = new MediaRecorder(recordingContext.stream, recorderOptions);
    } catch (e) {
      recorder = new MediaRecorder(recordingContext.stream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordingContext.recordedChunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      // Se a gravação foi cancelada ou o modal foi fechado, ignora o review
      if (recordingContext.aborted || state.viewMode !== 'record') {
        recordingContext.recordedChunks = [];
        return;
      }

      const finalMime = recorder.mimeType || mimeType || (recordingContext.captureMode === 'audio' ? 'audio/webm' : 'video/webm');
      const blob = new Blob(recordingContext.recordedChunks, { type: finalMime });
      if (!blob || blob.size === 0) {
        alert('Nenhum dado de áudio foi capturado pelo navegador. Verifique se o microfone selecionado está ativo.');
        discardAndRetry();
        return;
      }
      recordingContext.lastRecordedBlob = blob;
      showRecordingReview(blob);
    };

    recordingContext.mediaRecorder = recorder;
    recordingContext.recordingStartTime = Date.now();
    if (typeof window.requestScreenWakeLock === 'function') {
      window.requestScreenWakeLock();
    }
    // Fatias de 250ms para garantir flush imediato mesmo em breques curtos
    recorder.start(250);

    dom.recLiveIndicator.classList.add('active');
    dom.btnStartRecord.textContent = '⏹ Parar Gravação';
    dom.btnStartRecord.classList.add('is-recording');
    if (dom.btnStudioRecord) dom.btnStudioRecord.classList.add('is-recording');

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
      }, 40);
    } else {
      // Modo Livre: atualiza o cronômetro da gravação em tempo real
      const startTime = Date.now();
      recordingContext.recordingTimer = setInterval(() => {
        const elapsedSec = (Date.now() - startTime) / 1000;
        dom.recLiveIndicator.innerHTML = `<span class="rec-dot"></span> GRAVANDO: <strong>${elapsedSec.toFixed(1)}s</strong>`;
      }, 100);
    }
  }

  // Dispara reprodução de uma faixa respeitando seu offsetMs e cortes (trimStart / trimEnd)
  function triggerTrackAtTimelineOffset(track, timelinePosSec = 0) {
    if (!track || !track.videoElement) return;
    if (track._offsetTimer) {
      clearTimeout(track._offsetTimer);
      track._offsetTimer = null;
    }
    if (track._trimStopTimer) {
      clearTimeout(track._trimStopTimer);
      track._trimStopTimer = null;
    }

    const offsetSec = (track.offsetMs || 0) / 1000;
    const trimStartSec = Math.max(0, track.trimStart || 0);
    const hasDuration = track.duration > 0;
    const effDurSec = hasDuration ? getTrackEffectiveDuration(track) : Infinity;
    const endMediaSec = hasDuration ? getTrackEndMediaTime(track) : Infinity;
    const relTimelineSec = timelinePosSec - offsetSec;

    if (relTimelineSec >= effDurSec) {
      // Já passou do fim cortado desta faixa
      track.videoElement.pause();
      try { track.videoElement.currentTime = trimStartSec; } catch (e) {}
      return;
    }

    const scheduleStopAtTrimEnd = (remainingPlaySec) => {
      if (!isFinite(remainingPlaySec) || remainingPlaySec <= 0) return;
      track._trimStopTimer = setTimeout(() => {
        track._trimStopTimer = null;
        if (track.videoElement) {
          track.videoElement.pause();
          try { track.videoElement.currentTime = endMediaSec; } catch (e) {}
        }
      }, Math.max(20, Math.round(remainingPlaySec * 1000)));
    };

    if (relTimelineSec >= 0) {
      const targetMediaTime = trimStartSec + relTimelineSec;
      const doSeekAndPlay = () => {
        try {
          track.videoElement.currentTime = targetMediaTime;
        } catch (e) {}
        track.videoElement.play().catch(e => console.warn('Play error:', e));
      };
      if (track.videoElement.readyState >= 1) {
        doSeekAndPlay();
      } else {
        track.videoElement.addEventListener('loadedmetadata', doSeekAndPlay, { once: true });
        try { track.videoElement.load(); } catch (_) {}
      }
      scheduleStopAtTrimEnd(effDurSec - relTimelineSec);
    } else {
      // Atraso positivo (offsetMs > 0): aguarda antes de iniciar o elemento de mídia em trimStartSec
      track.videoElement.pause();
      try {
        track.videoElement.currentTime = trimStartSec;
      } catch (e) {}
      const delayMs = Math.round(-relTimelineSec * 1000);
      track._offsetTimer = setTimeout(() => {
        track._offsetTimer = null;
        if (track.videoElement) {
          try { track.videoElement.currentTime = trimStartSec; } catch (e) {}
          track.videoElement.play().catch(e => console.warn('Delayed play error:', e));
          scheduleStopAtTrimEnd(effDurSec);
        }
      }, delayMs);
    }
  }

  // Reprodução simultânea das outras faixas durante a gravação para o fone do usuário
  function startOverdubMonitoring() {
    const activeTrackId = recordingContext.activeTrackId;
    const otherTracks = state.tracks.filter(t => t.id !== activeTrackId);
    const hasSoloOnOthers = otherTracks.some(t => t.solo);

    updateAudioMixRouting();

    otherTracks.forEach(track => {
      if (!track.videoElement || track.muted) return;
      if (hasSoloOnOthers && !track.solo) return;
      triggerTrackAtTimelineOffset(track, 0);
    });

    // Metrônomo durante a gravação (com batida 1 imediata em t = 0)
    if (state.metronomeEnabled) {
      startMetronomeClock();
    }
  }

  function stopCurrentRecording(hasSuccess) {
    recordingContext.aborted = !hasSuccess;
    if (typeof window.releaseScreenWakeLock === 'function') {
      window.releaseScreenWakeLock();
    }

    if (recordingContext.countdownTimer) {
      clearInterval(recordingContext.countdownTimer);
      recordingContext.countdownTimer = null;
    }
    if (recordingContext.recordingTimer) {
      clearInterval(recordingContext.recordingTimer);
      recordingContext.recordingTimer = null;
    }

    const wasRecording = recordingContext.isRecording;
    recordingContext.isCountingDown = false;
    recordingContext.isRecording = false;

    dom.countdownOverlay.classList.remove('active');
    dom.recLiveIndicator.classList.remove('active');
    dom.btnStartRecord.classList.remove('is-recording');
    if (dom.btnStudioRecord) dom.btnStudioRecord.classList.remove('is-recording');

    if (!hasSuccess) {
      dom.btnStartRecord.textContent = '🔴 Iniciar Gravação';
    }

    if (wasRecording) {
      // Calcula o tamanho exato da gravação em segundos
      const now = Date.now();
      const start = recordingContext.recordingStartTime || now;
      recordingContext.recordedDurationSec = Math.max(0.25, (now - start) / 1000);
    }

    if (recordingContext.mediaRecorder && recordingContext.mediaRecorder.state !== 'inactive') {
      try {
        recordingContext.mediaRecorder.stop();
      } catch (e) {}
    }

    // Para o playback das faixas de apoio e o metrônomo
    state.tracks.forEach(t => {
      if (t._offsetTimer) {
        clearTimeout(t._offsetTimer);
        t._offsetTimer = null;
      }
      if (t._trimStopTimer) {
        clearTimeout(t._trimStopTimer);
        t._trimStopTimer = null;
      }
      if (t.videoElement) {
        t.videoElement.pause();
        try { t.videoElement.currentTime = t.trimStart || 0; } catch (e) {}
      }
    });
    stopMetronomeClock();
  }

  function showRecordingReview(blob) {
    cleanupReviewMedia();

    dom.btnStartRecord.style.display = 'none';
    if (dom.recordTipText) dom.recordTipText.style.display = 'none';
    dom.reviewActions.classList.add('active');

    const activeTrack = state.tracks.find(t => t.id === recordingContext.activeTrackId);
    if (dom.recTakeNameInput) {
      const currentName = activeTrack ? activeTrack.name : '';
      const isGenericName = /^Faixa \d+$/i.test(currentName) || /^Instrumento \d+$/i.test(currentName);
      dom.recTakeNameInput.value = isGenericName ? '' : currentName;
      dom.recTakeNameInput.placeholder = `Ex: Guia, Voz, Caixa, Tamborim... (${currentName || 'Faixa 1'})`;
      setTimeout(() => {
        if (dom.recTakeNameInput) {
          dom.recTakeNameInput.focus();
          dom.recTakeNameInput.select();
        }
      }, 60);
    }

    // Reproduz a mídia gravada para o usuário escutar e avaliar
    const mediaUrl = URL.createObjectURL(blob);
    recordingContext.reviewUrl = mediaUrl;

    if (recordingContext.captureMode === 'audio') {
      if (dom.audioOnlyViewfinder) dom.audioOnlyViewfinder.style.display = 'flex';
      dom.viewfinderVideo.style.display = 'none';
      dom.viewfinderVideo.srcObject = null;
      dom.viewfinderVideo.src = mediaUrl;
      dom.viewfinderVideo.muted = false;
      dom.viewfinderVideo.loop = true;
      dom.viewfinderVideo.play().catch(e => console.warn('Review play error:', e));
    } else {
      if (dom.audioOnlyViewfinder) dom.audioOnlyViewfinder.style.display = 'none';
      dom.viewfinderVideo.style.display = 'block';
      dom.viewfinderVideo.srcObject = null;
      dom.viewfinderVideo.src = mediaUrl;
      dom.viewfinderVideo.muted = false;
      dom.viewfinderVideo.loop = true;
      dom.viewfinderVideo.play().catch(e => console.warn('Review play error:', e));
    }
  }

  function keepCurrentTake() {
    if (!recordingContext.lastRecordedBlob) return;
    const track = state.tracks.find(t => t.id === recordingContext.activeTrackId);
    if (track) {
      if (dom.recTakeNameInput && dom.recTakeNameInput.value.trim()) {
        track.name = dom.recTakeNameInput.value.trim();
      }
      if (track._offsetTimer) {
        clearTimeout(track._offsetTimer);
        track._offsetTimer = null;
      }
      if (track._trimStopTimer) {
        clearTimeout(track._trimStopTimer);
        track._trimStopTimer = null;
      }
      if (track.mediaUrl) URL.revokeObjectURL(track.mediaUrl);
      track.mediaBlob = recordingContext.lastRecordedBlob;
      track.mediaUrl = URL.createObjectURL(recordingContext.lastRecordedBlob);
      track.mediaType = recordingContext.captureMode; // 'audio' ou 'video'
      track.duration = recordingContext.recordedDurationSec || 0;
      track.trimStart = 0;
      track.trimEnd = 0;
      track.waveformPeaks = null;

      // COMPENSAÇÃO DE LATÊNCIA AUTOMÁTICA:
      // Puxa o áudio gravado para trás (-offsetMs), eliminando o atraso de round-trip (hardware + fones + microfone)
      const compMs = parseInt(state.latencyCompensationMs, 10) || 80;
      track.offsetMs = -compMs;

      // Decodifica picos reais e duração precisa em background
      extractWaveformPeaks(track).then(() => {
        renderStudioViews();
        saveCurrentSession();
      });
    }
    cleanupReviewMedia();
    recordingContext.lastRecordedBlob = null;
    recordingContext.recordedChunks = [];
    if (dom.reviewActions) dom.reviewActions.classList.remove('active');
    if (dom.recordTipText) dom.recordTipText.style.display = '';
    if (dom.btnStartRecord) {
      dom.btnStartRecord.style.display = 'inline-flex';
      dom.btnStartRecord.textContent = '🔴 Gravar Novo Take';
    }
    if (dom.recProgressBar) dom.recProgressBar.style.width = '0%';
    updateRecTrackPicker();
    renderStudioViews();
    saveCurrentSession();
    if (typeof window.saveActiveBrequeState === 'function') {
      window.saveActiveBrequeState('studio');
    }
    // Envia direto para a timeline Multitrack após salvar o take
    switchViewMode('timeline');
  }

  function discardAndRetry() {
    cleanupReviewMedia();
    recordingContext.lastRecordedBlob = null;
    recordingContext.recordedChunks = [];
    dom.reviewActions.classList.remove('active');
    if (dom.recordTipText) dom.recordTipText.style.display = '';
    dom.btnStartRecord.style.display = 'inline-flex';
    dom.btnStartRecord.textContent = '🔴 Iniciar Gravação';
    dom.recProgressBar.style.width = '0%';
    setRecordingMode(recordingContext.captureMode);
  }

  // --- Sistema de Metrônomo do Studio com Web Audio Scheduler (Lookahead de Alta Precisão) ---
  let metroClock = {
    timer: null,
    beatCount: 0,
    nextBeatAudioTime: 0,
    activeTimeouts: []
  };

  function scheduleLedPulse(isAccent, delayMs) {
    if (!dom.led1 || !dom.led2) return;
    const to = setTimeout(() => {
      if (!metroClock.timer && !state.isPlaying && !recordingContext.isRecording && !recordingContext.isCountingDown) return;
      if (isAccent) {
        dom.led1.classList.add('beat-1');
        dom.led2.classList.remove('beat-sub');
        setTimeout(() => { if (dom.led1) dom.led1.classList.remove('beat-1'); }, 120);
      } else {
        dom.led2.classList.add('beat-sub');
        dom.led1.classList.remove('beat-1');
        setTimeout(() => { if (dom.led2) dom.led2.classList.remove('beat-sub'); }, 120);
      }
    }, Math.max(0, delayMs));
    metroClock.activeTimeouts.push(to);
    if (metroClock.activeTimeouts.length > 40) {
      metroClock.activeTimeouts = metroClock.activeTimeouts.slice(-20);
    }
  }

  function startMetronomeClock(customStartAudioTime = null) {
    stopMetronomeClock();
    const ctx = getAudioContext();
    const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
    const secondsPerBeat = 60 / state.bpm;

    metroClock.beatCount = 0;
    const baseTime = (customStartAudioTime !== null && isFinite(customStartAudioTime))
      ? customStartAudioTime
      : ctx.currentTime + 0.005;

    metroClock.nextBeatAudioTime = baseTime;
    metroClock.activeTimeouts = [];

    const scheduleBeats = () => {
      const scheduleAheadSec = 0.12;
      const now = ctx.currentTime;
      while (metroClock.nextBeatAudioTime < now + scheduleAheadSec) {
        const beatInMeasure = (metroClock.beatCount % beatsPerMeasure) + 1;
        const isAccent = beatInMeasure === 1;

        if (state.metronomeEnabled) {
          playMetronomeClick(isAccent, metroClock.nextBeatAudioTime);
        }

        const delayMs = (metroClock.nextBeatAudioTime - now) * 1000;
        scheduleLedPulse(isAccent, delayMs);

        metroClock.nextBeatAudioTime += secondsPerBeat;
        metroClock.beatCount++;
      }
    };

    scheduleBeats();
    metroClock.timer = setInterval(scheduleBeats, 25);
  }

  function resyncMetronomeToLoop() {
    const ctx = getAudioContext();
    metroClock.beatCount = 0;
    metroClock.nextBeatAudioTime = ctx.currentTime + 0.005;
    if (metroClock.activeTimeouts) {
      metroClock.activeTimeouts.forEach(t => clearTimeout(t));
      metroClock.activeTimeouts = [];
    }
    const beatsPerMeasure = state.meter === '2/4' ? 2 : 4;
    const secondsPerBeat = 60 / state.bpm;
    const now = ctx.currentTime;
    while (metroClock.nextBeatAudioTime < now + 0.12) {
      const beatInMeasure = (metroClock.beatCount % beatsPerMeasure) + 1;
      const isAccent = beatInMeasure === 1;
      if (state.metronomeEnabled) {
        playMetronomeClick(isAccent, metroClock.nextBeatAudioTime);
      }
      const delayMs = (metroClock.nextBeatAudioTime - now) * 1000;
      scheduleLedPulse(isAccent, delayMs);
      metroClock.nextBeatAudioTime += secondsPerBeat;
      metroClock.beatCount++;
    }
  }

  function stopMetronomeClock() {
    if (metroClock.timer) {
      clearInterval(metroClock.timer);
      metroClock.timer = null;
    }
    if (metroClock.activeTimeouts && metroClock.activeTimeouts.length > 0) {
      metroClock.activeTimeouts.forEach(t => clearTimeout(t));
      metroClock.activeTimeouts = [];
    }
    if (dom.led1) dom.led1.classList.remove('beat-1');
    if (dom.led2) dom.led2.classList.remove('beat-sub');
  }

  // --- Sincronização & Playback Master do Mosaico e Linha de Tempo ---
  function startStudioPlayback() {
    getAudioContext();
    if (typeof window.requestScreenWakeLock === 'function') {
      window.requestScreenWakeLock();
    }
    if (state.tracks.length === 0) {
      if (window.appToast) window.appToast('Seu projeto está zerado. Adicione uma faixa ou importe do Pad!', 'warn');
      else alert('Seu projeto está zerado. Adicione ao menos uma faixa para começar!');
      return;
    }
    const hasMedia = state.tracks.some(t => t.videoElement);
    if (!hasMedia && !state.metronomeEnabled) {
      if (window.appToast) window.appToast('Grave pelo menos um instrumento ou ative o metrônomo para ouvir!', 'info');
      else alert('Grave pelo menos um instrumento com a boca ou ative o metrônomo para ouvir!');
      return;
    }

    state.isPlaying = true;
    state.isPaused = false;
    state.playbackStartPosSec = state.playheadPosSec || 0;
    state.playbackStartPerfTime = performance.now();
    if (dom.btnMasterPlay) {
      dom.btnMasterPlay.classList.add('playing');
      dom.btnMasterPlay.innerHTML = `<span>⏸</span> Pausar`;
    }
    if (typeof window.syncGlobalPlayButton === 'function') {
      window.syncGlobalPlayButton();
    }

    updateAudioMixRouting();

    // Duração total calculada com base na gravação real
    const totalDurationSec = getTimelineDurationSec();
    const totalDurationMs = totalDurationSec * 1000;

    // Inicia todos os vídeos/áudios sincronizados respeitando offsetMs a partir da agulha
    state.tracks.forEach(track => {
      if (track.videoElement) {
        triggerTrackAtTimelineOffset(track, state.playbackStartPosSec);

        const card = document.getElementById(`card_${track.id}`);
        if (card) card.classList.add('active-playing');

        const reaperRow = document.getElementById(`reaper_row_${track.id}`);
        if (reaperRow) reaperRow.classList.add('active-playing');
      }
    });

    startMetronomeClock();

    let lastCycleIndex = totalDurationSec > 0 ? Math.floor(state.playbackStartPosSec / totalDurationSec) : 0;

    clearInterval(state.playbackTimer);
    state.playbackTimer = setInterval(() => {
      const elapsedDeltaSec = (performance.now() - state.playbackStartPerfTime) / 1000;
      const totalElapsedSec = state.playbackStartPosSec + elapsedDeltaSec;

      // SE LOOP ESTIVER DESLIGADO: Para automaticamente assim que terminar a gravação!
      if (!state.looping && totalElapsedSec >= totalDurationSec) {
        stopStudioPlayback();
        return;
      }

      const cyclePosSec = totalDurationSec > 0 ? (totalElapsedSec % totalDurationSec) : 0;
      state.playheadPosSec = cyclePosSec;
      const cycleProgress = totalDurationSec > 0 ? (cyclePosSec / totalDurationSec) : 0;
      const currentCycleIndex = totalDurationSec > 0 ? Math.floor(totalElapsedSec / totalDurationSec) : 0;

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
      updateReaperLcdDisplay(cyclePosSec * 1000, totalDurationMs);

      // SE LOOP ESTIVER LIGADO: reseta e reinicia tudo perfeitamente sincronizado a cada ciclo
      if (state.looping && currentCycleIndex > lastCycleIndex) {
        lastCycleIndex = currentCycleIndex;
        state.tracks.forEach(track => {
          if (track.videoElement) {
            triggerTrackAtTimelineOffset(track, 0);
          }
        });
        if (state.metronomeEnabled) {
          resyncMetronomeToLoop();
        }
      }
    }, 30);
  }

  function pauseStudioPlayback() {
    if (!state.isPlaying) return;
    state.isPlaying = false;
    state.isPaused = true;
    if (typeof window.releaseScreenWakeLock === 'function') {
      window.releaseScreenWakeLock();
    }
    clearInterval(state.playbackTimer);
    state.playbackTimer = null;
    stopMetronomeClock();

    if (dom.btnMasterPlay) {
      dom.btnMasterPlay.classList.remove('playing');
      dom.btnMasterPlay.innerHTML = `<span>▶</span> Reproduzir`;
    }
    if (typeof window.syncGlobalPlayButton === 'function') {
      window.syncGlobalPlayButton();
    }

    state.tracks.forEach(track => {
      if (track._offsetTimer) {
        clearTimeout(track._offsetTimer);
        track._offsetTimer = null;
      }
      if (track._trimStopTimer) {
        clearTimeout(track._trimStopTimer);
        track._trimStopTimer = null;
      }
      if (track.videoElement) {
        track.videoElement.pause();
      }
      const card = document.getElementById(`card_${track.id}`);
      if (card) card.classList.remove('active-playing');

      const reaperRow = document.getElementById(`reaper_row_${track.id}`);
      if (reaperRow) reaperRow.classList.remove('active-playing');
    });
  }

  function stopStudioPlayback() {
    state.isPlaying = false;
    state.isPaused = false;
    if (typeof window.releaseScreenWakeLock === 'function') {
      window.releaseScreenWakeLock();
    }
    clearInterval(state.playbackTimer);
    state.playbackTimer = null;
    stopMetronomeClock();

    if (dom.btnMasterPlay) {
      dom.btnMasterPlay.classList.remove('playing');
      dom.btnMasterPlay.innerHTML = `<span>▶</span> Reproduzir`;
    }
    if (typeof window.syncGlobalPlayButton === 'function') {
      window.syncGlobalPlayButton();
    }

    // Reseta Playhead e Visor Digital LCD
    state.playheadPosSec = 0;
    state.playbackStartPosSec = 0;
    if (dom.reaperPlayhead) {
      dom.reaperPlayhead.style.left = '0%';
    }
    updateReaperLcdDisplay(0, 1000);

    state.tracks.forEach(track => {
      if (track._offsetTimer) {
        clearTimeout(track._offsetTimer);
        track._offsetTimer = null;
      }
      if (track._trimStopTimer) {
        clearTimeout(track._trimStopTimer);
        track._trimStopTimer = null;
      }
      if (track.videoElement) {
        track.videoElement.pause();
        try { track.videoElement.currentTime = track.trimStart || 0; } catch (e) {}
      }
      const card = document.getElementById(`card_${track.id}`);
      if (card) card.classList.remove('active-playing');

      const reaperRow = document.getElementById(`reaper_row_${track.id}`);
      if (reaperRow) reaperRow.classList.remove('active-playing');

      const prog = document.getElementById(`prog_${track.id}`);
      if (prog) prog.style.width = '0%';
    });
  }

  // --- Roteamento e Mixagem de Áudio (Web Audio Graph + HTMLMediaElement) ---
  function getEffectiveTrackVolume(track, hasSolo) {
    if (track.muted) return 0;
    if (hasSolo && !track.solo) return 0;
    return track.volume;
  }

  function ensureMediaElementAudioGraph(mediaEl) {
    if (!mediaEl) return null;
    if (mediaEl._webAudioGraph) return mediaEl._webAudioGraph;

    try {
      const ctx = getAudioContext();
      const sourceNode = ctx.createMediaElementSource(mediaEl);
      const gainNode = ctx.createGain();
      sourceNode.connect(gainNode);
      gainNode.connect(ctx.destination);
      mediaEl.volume = 1.0;
      mediaEl._webAudioGraph = { sourceNode, gainNode };
      return mediaEl._webAudioGraph;
    } catch (e) {
      console.warn('Erro ao vincular grafo Web Audio na mídia:', e);
      return null;
    }
  }

  function updateAudioMixRouting() {
    const hasSolo = state.tracks.some(t => t.solo);

    state.tracks.forEach(track => {
      const el = track.videoElement;
      if (!el) return;

      const effectiveVol = getEffectiveTrackVolume(track, hasSolo);

      // Se o elemento já possui nó Web Audio (ou se o volume excede 100% e AudioContext já existe), usa GainNode (suporta 0% a 150%)
      if (el._webAudioGraph || (audioCtx && effectiveVol > 1.0)) {
        const graph = ensureMediaElementAudioGraph(el);
        if (graph && graph.gainNode) {
          el.volume = 1.0;
          graph.gainNode.gain.value = effectiveVol;
          return;
        }
      }

      // Caso contrário, aplica direto no elemento nativo
      el.volume = Math.min(1.0, Math.max(0, effectiveVol));
    });
  }

  // --- Exportação de Vídeo Mosaico Completo (Canvas + MediaRecorder) ---
  async function exportMosaicVideo() {
    const recordedTracks = state.tracks.filter(t => t.videoElement);
    if (recordedTracks.length === 0) {
      alert('Grave ou importe ao menos uma faixa para poder exportar o vídeo mosaico!');
      return;
    }

    stopStudioPlayback();

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

      // Prepara áudio mixado mantendo saída normal para o destination
      const audioContext = getAudioContext();
      const dest = audioContext.createMediaStreamDestination();
      const hasSolo = state.tracks.some(t => t.solo);
      const connectedGainNodes = [];

      recordedTracks.forEach(track => {
        const graph = ensureMediaElementAudioGraph(track.videoElement);
        if (graph && graph.gainNode) {
          graph.gainNode.gain.value = getEffectiveTrackVolume(track, hasSolo);
          graph.gainNode.connect(dest);
          connectedGainNodes.push(graph.gainNode);
        }
      });

      // Stream de vídeo do canvas + áudio
      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 3500000, audioBitsPerSecond: 192000 });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      // Duração real da timeline (respeita modo Livre e Fixo)
      const durationSec = getTimelineDurationSec();
      const durationMs = durationSec * 1000;

      recorder.start(250);

      // Inicia todos os vídeos respeitando offsetMs
      recordedTracks.forEach(t => {
        triggerTrackAtTimelineOffset(t, 0);
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
          recordedTracks.forEach(t => {
            if (t._offsetTimer) {
              clearTimeout(t._offsetTimer);
              t._offsetTimer = null;
            }
            if (t._trimStopTimer) {
              clearTimeout(t._trimStopTimer);
              t._trimStopTimer = null;
            }
            if (t.videoElement) t.videoElement.pause();
          });

          recorder.onstop = () => {
            connectedGainNodes.forEach(gn => {
              try { gn.disconnect(dest); } catch (e) {}
            });
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


  function encodeAudioBufferToWav(audioBuffer) {
    const numCh = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const numSamples = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = numCh * bytesPerSample;
    const dataSize = numSamples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    const channels = [];
    for (let c = 0; c < numCh; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numCh; c++) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // --- Exportação de Áudio Mixado (Renderização WAV de Alta Fidelidade) ---
  async function exportMixedAudio() {
    const recordedTracks = state.tracks.filter(t => t.videoElement);
    if (recordedTracks.length === 0) {
      alert('Nenhuma gravação encontrada para exportar o áudio!');
      return;
    }

    stopStudioPlayback();

    dom.exportModal.classList.add('active');
    dom.exportTitle.textContent = '🎵 Exportando Áudio Master (.wav)...';
    dom.exportStatus.textContent = 'Renderizando mixdown estéreo em alta fidelidade...';
    dom.exportProgressBar.style.width = '30%';

    // 1. Tenta renderização ultra-rápida via OfflineAudioContext em formato WAV puro
    try {
      const audioContext = getAudioContext();
      const durationSec = Math.max(1, getTimelineDurationSec());
      const sampleRate = 44100;
      const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;

      if (OfflineCtx) {
        const offlineCtx = new OfflineCtx(2, Math.ceil(durationSec * sampleRate), sampleRate);
        const hasSolo = state.tracks.some(t => t.solo);
        let decodedCount = 0;

        for (const track of recordedTracks) {
          if (!track.mediaBlob) continue;
          try {
            const arrayBuf = await track.mediaBlob.arrayBuffer();
            const audioBuf = await audioContext.decodeAudioData(arrayBuf.slice(0));
            const src = offlineCtx.createBufferSource();
            src.buffer = audioBuf;

            const gain = offlineCtx.createGain();
            gain.gain.value = getEffectiveTrackVolume(track, hasSolo);

            src.connect(gain);
            gain.connect(offlineCtx.destination);

            const trimStartSec = Math.max(0, track.trimStart || 0);
            const trimEndSec = Math.max(0, track.trimEnd || 0);
            const effDurSec = Math.max(0.05, audioBuf.duration - trimStartSec - trimEndSec);
            const rawOffsetSec = (track.offsetMs || 0) / 1000;

            if (rawOffsetSec >= 0) {
              src.start(rawOffsetSec, trimStartSec, effDurSec);
            } else {
              const skipSec = -rawOffsetSec;
              if (skipSec < effDurSec) {
                src.start(0, trimStartSec + skipSec, effDurSec - skipSec);
              }
            }
            decodedCount++;
          } catch (decErr) {
            console.warn('Decodificação OfflineAudioContext falhou para:', track.name, decErr);
          }
        }

        if (decodedCount > 0) {
          dom.exportProgressBar.style.width = '75%';
          const renderedBuffer = await offlineCtx.startRendering();
          const wavBlob = encodeAudioBufferToWav(renderedBuffer);
          downloadBlob(wavBlob, `naumteria_master_${state.bpm}bpm.wav`);

          dom.exportProgressBar.style.width = '100%';
          dom.exportStatus.textContent = '✅ Áudio Master (.wav) exportado com sucesso!';
          setTimeout(() => dom.exportModal.classList.remove('active'), 1200);
          return;
        }
      }
    } catch (err) {
      console.warn('Tentando fallback para MediaRecorder:', err);
    }

    try {
      const audioContext = getAudioContext();
      const dest = audioContext.createMediaStreamDestination();
      const hasSolo = state.tracks.some(t => t.solo);
      const connectedGainNodes = [];

      recordedTracks.forEach(track => {
        const graph = ensureMediaElementAudioGraph(track.videoElement);
        if (graph && graph.gainNode) {
          graph.gainNode.gain.value = getEffectiveTrackVolume(track, hasSolo);
          graph.gainNode.connect(dest);
          connectedGainNodes.push(graph.gainNode);
        }
      });

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
      }

      const recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType, audioBitsPerSecond: 192000 } : { audioBitsPerSecond: 192000 });
      const chunks = [];

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const durationSec = getTimelineDurationSec();
      const durationMs = durationSec * 1000;

      recorder.start(250);
      recordedTracks.forEach(t => {
        triggerTrackAtTimelineOffset(t, 0);
      });

      setTimeout(() => {
        recorder.stop();
        recordedTracks.forEach(t => {
          if (t._offsetTimer) {
            clearTimeout(t._offsetTimer);
            t._offsetTimer = null;
          }
          if (t._trimStopTimer) {
            clearTimeout(t._trimStopTimer);
            t._trimStopTimer = null;
          }
          if (t.videoElement) t.videoElement.pause();
        });
        recorder.onstop = () => {
          connectedGainNodes.forEach(gn => {
            try { gn.disconnect(dest); } catch (e) {}
          });
          const audioBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
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

  function blobToDataURL(blob) {
    return new Promise((resolve) => {
      if (!blob) return resolve(null);
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  async function dataURLToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    try {
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch (e) {
      console.warn('Erro ao converter DataURL para Blob:', e);
      return null;
    }
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
      viewMode: state.viewMode === 'record' ? 'timeline' : state.viewMode,
      zoomLevel: state.zoomLevel,
      tracks: state.tracks.map((t, i) => ({
        id: t.id,
        name: (typeof t.name === 'string' && !t.name.startsWith('[object')) ? t.name : `Faixa ${i + 1}`,
        mediaType: t.mediaType || 'video',
        volume: t.volume,
        muted: t.muted,
        solo: t.solo,
        offsetMs: t.offsetMs,
        trimStart: t.trimStart || 0,
        trimEnd: t.trimEnd || 0,
        duration: t.duration || 0,
        waveformPeaks: t.waveformPeaks || null,
        mediaBlob: t.mediaBlob
      }))
    };
    await saveProjectToDB(serializable, state.projectId);
    if (typeof window.onStudioSessionUpdated === 'function') {
      window.onStudioSessionUpdated(getProjectSummary());
    }
    if (typeof window.syncGlobalPlayButton === 'function') {
      window.syncGlobalPlayButton();
    }
  }

  async function restoreSession(projectIdOverride, fallbackBpm) {
    const isExplicitLoad = Boolean(projectIdOverride);
    if (projectIdOverride) {
      state.projectId = projectIdOverride;
    }
    const myEpoch = ++sessionEpoch;
    const saved = await loadProjectFromDB(state.projectId);
    if (!isExplicitLoad && myEpoch !== sessionEpoch) {
      return;
    }
    const userAlreadyInRecord = state.viewMode === 'record';

    // Revoga URLs antigas se estiver trocando de projeto
    if (!userAlreadyInRecord && state.tracks.length > 0) {
      state.tracks.forEach(t => {
        if (t.mediaUrl) URL.revokeObjectURL(t.mediaUrl);
      });
    }

    if (saved && Array.isArray(saved.tracks)) {
      // Se continha apenas os 4 dummies originais sem nenhuma gravação, zera:
      const isLegacyDummyTracks = saved.tracks.length === 4 &&
        saved.tracks.every(t => !t.mediaBlob && !t.duration && !t.mediaDataUrl) &&
        typeof saved.tracks[0].name === 'string' && saved.tracks[0].name.startsWith('Surdo 1ª') &&
        typeof saved.tracks[1].name === 'string' && saved.tracks[1].name.startsWith('Surdo 2ª') &&
        typeof saved.tracks[2].name === 'string' && saved.tracks[2].name.startsWith('Caixa') &&
        typeof saved.tracks[3].name === 'string' && saved.tracks[3].name.startsWith('Tamborim');

      if (isLegacyDummyTracks) {
        if (!userAlreadyInRecord) state.tracks = [];
        if (fallbackBpm) state.bpm = fallbackBpm;
      } else {
        state.bpm = saved.bpm || fallbackBpm || 120;
        state.meter = saved.meter || '2/4';
        state.mode = saved.mode || 'free';
        state.measures = saved.measures || 4;
        state.looping = !!saved.looping;
        state.metronomeEnabled = saved.metronomeEnabled !== undefined ? saved.metronomeEnabled : true;
        if (!userAlreadyInRecord) {
          state.viewMode = (saved.viewMode === 'mosaic') ? 'mosaic' : 'timeline';
        }
        state.zoomLevel = saved.zoomLevel || 100;

        const restoredTracks = saved.tracks.map((st, i) => {
          const tr = createTrack(st.name, i);
          tr.id = st.id || tr.id;
          tr.volume = st.volume !== undefined ? st.volume : 1.0;
          tr.muted = !!st.muted;
          tr.solo = !!st.solo;
          tr.offsetMs = st.offsetMs || 0;
          tr.trimStart = st.trimStart || 0;
          tr.trimEnd = st.trimEnd || 0;
          tr.duration = st.duration || 0;
          tr.waveformPeaks = st.waveformPeaks || null;
          if (st.mediaBlob) {
            tr.mediaBlob = st.mediaBlob;
            tr.mediaUrl = URL.createObjectURL(st.mediaBlob);
            tr.mediaType = st.mediaType || (st.mediaBlob.type && st.mediaBlob.type.startsWith('audio') ? 'audio' : 'video');
          } else {
            tr.mediaType = st.mediaType || 'video';
          }
          return tr;
        });

        if (!userAlreadyInRecord || state.tracks.length === 0) {
          state.tracks = restoredTracks;
        }
      }
    } else if (!userAlreadyInRecord) {
      // Primeiro acesso deste Breque no Estúdio: abre ZERADO com o BPM do Breque
      state.tracks = [];
      if (fallbackBpm) state.bpm = fallbackBpm;
      state.viewMode = 'timeline';
    }

    if (dom.zoomLevelVal) dom.zoomLevelVal.textContent = `${state.zoomLevel}%`;
    syncToolbarControls();
    updateLoopUi();
    if (!userAlreadyInRecord) {
      switchViewMode(state.viewMode);
    }
    renderStudioViews();
    if (typeof window.onStudioSessionUpdated === 'function') {
      window.onStudioSessionUpdated(getProjectSummary());
    }
    if (typeof window.syncGlobalPlayButton === 'function') {
      window.syncGlobalPlayButton();
    }
  }

  async function loadBrequeProject(projectId, fallbackBpm = 120) {
    stopStudioPlayback();
    stopRecordingView();
    state.viewMode = 'timeline';
    await restoreSession(projectId || 'current_project', fallbackBpm);
  }

  function syncToolbarControls() {
    if (dom.bpmInput) dom.bpmInput.value = state.bpm;
    if (dom.bpmVal) dom.bpmVal.textContent = state.bpm;
    const mobStatusBpm = document.getElementById('mobStatusBpm');
    if (mobStatusBpm) mobStatusBpm.textContent = `${state.bpm} BPM`;
    if (dom.meterSelect) dom.meterSelect.value = state.meter;
    if (dom.modeSelect) dom.modeSelect.value = state.mode;
    if (dom.measuresSelect) dom.measuresSelect.value = state.measures;
    if (dom.measuresGroup) dom.measuresGroup.style.display = state.mode === 'fixed' ? 'flex' : 'none';
    if (dom.btnToggleMetronome) {
      dom.btnToggleMetronome.classList.toggle('active', state.metronomeEnabled);
    }
  }


  // --- Lógica do Modal de Montagem de Novo Projeto ---
  const modalSelectedInstruments = new Set();

  function openNewProjectModal() {
    if (!dom.newProjectModal) return;

    if (dom.newProjectName) dom.newProjectName.value = 'Novo Projeto Samba';
    if (dom.newProjectBpm) dom.newProjectBpm.value = state.bpm || 120;
    if (dom.newProjectBpmVal) dom.newProjectBpmVal.textContent = `${state.bpm || 120} BPM`;
    if (dom.newProjectMeter) dom.newProjectMeter.value = state.meter || '2/4';
    if (dom.newProjectMode) dom.newProjectMode.value = state.mode || 'free';

    // Por padrão o projeto começa ZERADO (0 faixas)
    modalSelectedInstruments.clear();
    renderModalInstrumentsPicker();
    updateModalBpmChips(state.bpm || 120);

    dom.newProjectModal.classList.add('active');
  }

  function closeNewProjectModal() {
    if (dom.newProjectModal) {
      dom.newProjectModal.classList.remove('active');
    }
  }

  function renderModalInstrumentsPicker() {
    if (!dom.newProjectInstrumentsPicker) return;
    dom.newProjectInstrumentsPicker.innerHTML = '';

    INSTRUMENT_PRESETS.forEach((preset, idx) => {
      const isSelected = modalSelectedInstruments.has(idx);
      const color = INSTRUMENT_COLORS[idx % INSTRUMENT_COLORS.length];

      const chip = document.createElement('div');
      chip.className = `instrument-pick-chip ${isSelected ? 'selected' : ''}`;
      chip.dataset.idx = idx;
      chip.innerHTML = `
        <div class="pick-check">${isSelected ? '✓' : ''}</div>
        <div class="pick-info">
          <span class="preset-color-dot" style="background: ${color};"></span>
          <span class="pick-name" title="${escapeHtml(preset)}">${escapeHtml(preset)}</span>
        </div>
      `;

      chip.onclick = () => {
        if (modalSelectedInstruments.has(idx)) {
          modalSelectedInstruments.delete(idx);
        } else {
          modalSelectedInstruments.add(idx);
        }
        renderModalInstrumentsPicker();
      };

      dom.newProjectInstrumentsPicker.appendChild(chip);
    });

    updateModalTrackCountHint();
  }

  function updateModalTrackCountHint() {
    const count = modalSelectedInstruments.size;
    if (dom.newProjectTrackCountHint) {
      dom.newProjectTrackCountHint.textContent = count === 0
        ? '0 faixas (Projeto Zerado)'
        : `${count} faixa${count > 1 ? 's' : ''} pré-selecionada${count > 1 ? 's' : ''}`;
    }
    if (dom.newProjectConfirmBtn) {
      dom.newProjectConfirmBtn.innerHTML = count === 0
        ? '<span>✨</span> Criar Projeto Zerado'
        : `<span>✨</span> Criar Projeto com ${count} Faixa${count > 1 ? 's' : ''}`;
    }
  }

  function updateModalBpmChips(bpm) {
    if (!dom.newProjectBpmPresets) return;
    dom.newProjectBpmPresets.querySelectorAll('.btn-chip').forEach(btn => {
      const chipBpm = parseInt(btn.dataset.bpm, 10);
      btn.classList.toggle('active', chipBpm === bpm);
    });
  }

  async function confirmNewProject() {
    const hasMedia = state.tracks.some(t => t.mediaUrl || t.mediaBlob);
    if (hasMedia) {
      const ok = window.appConfirm
        ? await window.appConfirm('O projeto atual possui gravações. Deseja iniciar um novo projeto e descartar a sessão atual?', 'Novo Projeto', { isDanger: true, confirmText: 'Descartar e Criar' })
        : confirm('O projeto atual possui gravações. Deseja iniciar um novo projeto e descartar a sessão atual?');
      if (!ok) return;
    }

    stopStudioPlayback();
    sessionEpoch++;

    state.tracks.forEach(tr => {
      if (tr.mediaUrl) URL.revokeObjectURL(tr.mediaUrl);
    });

    const newBpm = parseInt(dom.newProjectBpm ? dom.newProjectBpm.value : 120, 10) || 120;
    const newMeter = dom.newProjectMeter ? dom.newProjectMeter.value : '2/4';
    const newMode = dom.newProjectMode ? dom.newProjectMode.value : 'free';

    state.bpm = newBpm;
    state.meter = newMeter;
    state.mode = newMode;
    state.looping = false;

    // Se nenhuma faixa marcada: o novo projeto fica totalmente ZERADO
    if (modalSelectedInstruments.size === 0) {
      state.tracks = [];
    } else {
      const selectedIndices = Array.from(modalSelectedInstruments).sort((a, b) => a - b);
      state.tracks = selectedIndices.map((presetIdx, i) =>
        createTrack(INSTRUMENT_PRESETS[presetIdx], i)
      );
    }

    syncToolbarControls();
    updateLoopUi();
    renderStudioViews();
    saveCurrentSession();
    closeNewProjectModal();
    if (window.appToast) window.appToast('Novo projeto montado!', 'success');
  }

  async function clearCurrentProjectTracks(skipConfirm = false) {
    if (state.tracks.length === 0) {
      if (window.appToast) window.appToast('O projeto já está sem faixas.', 'info');
      return;
    }
    const hasMedia = state.tracks.some(t => t.mediaUrl || t.mediaBlob);
    if (!skipConfirm && hasMedia) {
      const msg = 'Deseja zerar todas as faixas e apagar as gravações do projeto atual?';
      const ok = window.appConfirm
        ? await window.appConfirm(msg, 'Zerar Projeto', { isDanger: true, confirmText: 'Zerar Projeto' })
        : confirm(msg);
      if (!ok) return;
    }

    stopStudioPlayback();
    sessionEpoch++;
    state.tracks.forEach(tr => {
      if (tr.mediaUrl) URL.revokeObjectURL(tr.mediaUrl);
    });

    state.tracks = [];
    saveCurrentSession();
    renderStudioViews();
    if (window.appToast) window.appToast('Projeto zerado com sucesso.', 'info');
  }

  // --- Lógica de Corte, Aparagem (Trim) e Divisão (Split) de Faixas ---
  let cutModalCtx = {
    trackId: null,
    duration: 0,
    trimStart: 0,
    trimEnd: 0,
    cursorSec: 0,
    previewMedia: null,
    previewTimer: null,
    isPlayingPreview: false
  };

  function stopCutPreview() {
    if (cutModalCtx.previewTimer) {
      clearInterval(cutModalCtx.previewTimer);
      cutModalCtx.previewTimer = null;
    }
    if (cutModalCtx.previewMedia) {
      try { cutModalCtx.previewMedia.pause(); } catch (e) {}
      cutModalCtx.previewMedia = null;
    }
    cutModalCtx.isPlayingPreview = false;
    if (dom.btnCutPreviewPlay) {
      dom.btnCutPreviewPlay.innerHTML = '<span>▶</span> Ouvir Trecho';
    }
  }

  function openTrackCutModal(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track || !track.mediaUrl) return;

    stopStudioPlayback();
    stopCutPreview();

    state.selectedTrackId = track.id;
    const rawDur = track.duration > 0 ? track.duration : getTimelineDurationSec();

    cutModalCtx.trackId = track.id;
    cutModalCtx.duration = Math.max(0.2, rawDur);
    cutModalCtx.trimStart = Math.max(0, Math.min(cutModalCtx.duration - 0.1, track.trimStart || 0));
    cutModalCtx.trimEnd = Math.max(0, Math.min(cutModalCtx.duration - cutModalCtx.trimStart - 0.1, track.trimEnd || 0));

    // Posiciona a agulha inicial do editor na posição correspondente da agulha da timeline (se estiver dentro da faixa)
    const offsetSec = (track.offsetMs || 0) / 1000;
    const relFromTimeline = (state.playheadPosSec - offsetSec) + cutModalCtx.trimStart;
    const endTime = cutModalCtx.duration - cutModalCtx.trimEnd;
    if (relFromTimeline > cutModalCtx.trimStart && relFromTimeline < endTime) {
      cutModalCtx.cursorSec = relFromTimeline;
    } else {
      cutModalCtx.cursorSec = cutModalCtx.trimStart + (endTime - cutModalCtx.trimStart) / 2;
    }

    if (dom.cutModalTrackTitle) {
      dom.cutModalTrackTitle.textContent = `Cortar Faixa: ${track.name}`;
    }

    if (dom.trackCutModal) {
      dom.trackCutModal.classList.add('active');
    }

    requestAnimationFrame(() => {
      drawCutModalWaveform(track);
      updateCutModalUi();
    });
  }

  function closeTrackCutModal() {
    stopCutPreview();
    if (dom.trackCutModal) {
      dom.trackCutModal.classList.remove('active');
    }
    cutModalCtx.trackId = null;
  }

  function drawCutModalWaveform(track) {
    if (!dom.cutWaveformCanvas || !track) return;
    const canvas = dom.cutWaveformCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement?.clientWidth || 640;
    const h = canvas.height = canvas.parentElement?.clientHeight || 140;
    const center = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Linha de centro
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, center - 0.5, w, 1);

    const idx = state.tracks.findIndex(t => t.id === track.id);
    const trackColor = INSTRUMENT_COLORS[(idx >= 0 ? idx : 0) % INSTRUMENT_COLORS.length] || '#E8C31B';

    const renderFullPeaks = (peaks) => {
      if (!canvas.isConnected) return;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, center - 0.5, w, 1);

      const barGap = 3.5;
      const barsCount = Math.max(1, Math.floor(w / barGap));
      ctx.fillStyle = trackColor;

      if (peaks && peaks.length > 0) {
        let maxPeak = 0;
        for (let i = 0; i < peaks.length; i++) {
          if (peaks[i] > maxPeak) maxPeak = peaks[i];
        }
        const normFactor = maxPeak > 0.02 ? (1 / Math.max(0.25, maxPeak)) : 1;

        for (let i = 0; i < barsCount; i++) {
          const x = i * barGap;
          const peakIdx = Math.min(peaks.length - 1, Math.floor((i / barsCount) * peaks.length));
          const scaledAmp = Math.min(1.0, (peaks[peakIdx] || 0) * normFactor);
          const barH = Math.max(2, scaledAmp * (h * 0.84));
          ctx.fillRect(x, center - barH / 2, 2.2, barH);
        }
      } else {
        const seed = hashString(track.id + (track.duration || 1));
        for (let i = 0; i < barsCount; i++) {
          const x = i * barGap;
          const amp = Math.min(1.0, Math.max(0.08, pseudoRandom(seed + i) * 0.65));
          const barH = amp * (h * 0.78);
          ctx.fillRect(x, center - barH / 2, 2.2, barH);
        }
      }
    };

    if (track.waveformPeaks) {
      renderFullPeaks(track.waveformPeaks);
    } else {
      extractWaveformPeaks(track).then(peaks => renderFullPeaks(peaks));
    }
  }

  function updateCutModalUi() {
    const dur = Math.max(0.2, cutModalCtx.duration);
    const tStart = cutModalCtx.trimStart;
    const tEnd = cutModalCtx.trimEnd;
    const endMediaSec = Math.max(tStart + 0.08, dur - tEnd);
    const activeDur = Math.max(0.08, endMediaSec - tStart);

    const startPct = Math.max(0, Math.min(98, (tStart / dur) * 100));
    const endPct = Math.max(startPct + 2, Math.min(100, (endMediaSec / dur) * 100));
    const cursorPct = Math.max(0, Math.min(100, (cutModalCtx.cursorSec / dur) * 100));

    if (dom.cutShadeLeft) dom.cutShadeLeft.style.width = startPct + '%';
    if (dom.cutShadeRight) dom.cutShadeRight.style.width = (100 - endPct) + '%';
    if (dom.cutHandleStart) dom.cutHandleStart.style.left = startPct + '%';
    if (dom.cutHandleEnd) dom.cutHandleEnd.style.left = endPct + '%';
    if (dom.cutCursorLine) dom.cutCursorLine.style.left = cursorPct + '%';

    if (dom.cutBadgeStart) dom.cutBadgeStart.textContent = `${tStart.toFixed(2)}s`;
    if (dom.cutBadgeEnd) dom.cutBadgeEnd.textContent = `${endMediaSec.toFixed(2)}s`;
    if (dom.cutStatStartVal) dom.cutStatStartVal.textContent = `${tStart.toFixed(2)}s`;
    if (dom.cutStatEndVal) dom.cutStatEndVal.textContent = `${endMediaSec.toFixed(2)}s`;
    if (dom.cutStatDurationVal) dom.cutStatDurationVal.textContent = `${activeDur.toFixed(2)}s`;
    if (dom.cutStatCursorVal) dom.cutStatCursorVal.textContent = `${cutModalCtx.cursorSec.toFixed(2)}s`;
  }

  function toggleCutModalPreview() {
    if (cutModalCtx.isPlayingPreview) {
      stopCutPreview();
      return;
    }
    const track = state.tracks.find(t => t.id === cutModalCtx.trackId);
    if (!track || !track.mediaUrl) return;

    const media = document.createElement(track.mediaType === 'video' ? 'video' : 'audio');
    media.src = track.mediaUrl;
    media.volume = Math.min(1, Math.max(0.1, track.volume || 1));

    const startSec = cutModalCtx.trimStart;
    const endSec = Math.max(startSec + 0.08, cutModalCtx.duration - cutModalCtx.trimEnd);

    cutModalCtx.previewMedia = media;
    cutModalCtx.isPlayingPreview = true;
    cutModalCtx.cursorSec = startSec;
    updateCutModalUi();

    if (dom.btnCutPreviewPlay) {
      dom.btnCutPreviewPlay.innerHTML = '<span>⏹</span> Parar Preview';
    }

    try { media.currentTime = startSec; } catch (e) {}
    media.play().catch(err => console.warn('Preview play error:', err));

    cutModalCtx.previewTimer = setInterval(() => {
      if (!cutModalCtx.previewMedia) return;
      const cur = cutModalCtx.previewMedia.currentTime || 0;
      cutModalCtx.cursorSec = cur;
      updateCutModalUi();
      if (cur >= endSec || cutModalCtx.previewMedia.ended) {
        stopCutPreview();
        cutModalCtx.cursorSec = startSec;
        updateCutModalUi();
      }
    }, 30);
  }

  function applyCutModalChanges() {
    const track = state.tracks.find(t => t.id === cutModalCtx.trackId);
    if (!track) return;

    const deltaStartSec = cutModalCtx.trimStart - (track.trimStart || 0);
    track.trimStart = cutModalCtx.trimStart;
    track.trimEnd = cutModalCtx.trimEnd;
    // Ajusta offsetMs proporcionalmente se o início foi alterado para manter a sincronia musical
    if (Math.abs(deltaStartSec) > 0.005) {
      track.offsetMs = Math.round((track.offsetMs || 0) + deltaStartSec * 1000);
    }

    closeTrackCutModal();
    renderStudioViews();
    saveCurrentSession();
  }

  // Divide uma faixa em duas pistas separadas no ponto exato (em segundos da mídia original)
  function splitTrackAtMediaTime(track, splitMediaSec) {
    if (!track || !track.mediaBlob) return false;
    const rawDur = track.duration > 0 ? track.duration : getTimelineDurationSec();
    const curTrimStart = track.trimStart || 0;
    const curTrimEnd = track.trimEnd || 0;
    const endMediaSec = Math.max(curTrimStart + 0.1, rawDur - curTrimEnd);

    if (splitMediaSec <= curTrimStart + 0.08 || splitMediaSec >= endMediaSec - 0.08) {
      alert('Posicione a agulha dentro da área ativa da faixa para dividi-la em 2 partes!');
      return false;
    }

    if (state.tracks.length >= MAX_STUDIO_TRACKS) {
      alert(`O limite máximo de ${MAX_STUDIO_TRACKS} faixas foi atingido. Remova uma faixa para poder dividir em duas.`);
      return false;
    }

    const trackIdx = state.tracks.findIndex(t => t.id === track.id);
    const firstPartDurSec = splitMediaSec - curTrimStart;
    const secondPartOffsetMs = Math.round((track.offsetMs || 0) + firstPartDurSec * 1000);

    // 1ª Parte permanece na faixa atual (terminando na agulha)
    track.trimEnd = Math.max(0, rawDur - splitMediaSec);

    // 2ª Parte é criada logo abaixo começando exatamente onde a 1ª terminou
    const baseName = track.name.replace(/\s*\(Pt\.\s*\d+\)$/i, '');
    const part2Track = createTrack(`${baseName} (Pt. 2)`, trackIdx + 1);
    part2Track.mediaBlob = track.mediaBlob;
    part2Track.mediaUrl = URL.createObjectURL(track.mediaBlob);
    part2Track.mediaType = track.mediaType;
    part2Track.volume = track.volume;
    part2Track.muted = track.muted;
    part2Track.solo = track.solo;
    part2Track.duration = rawDur;
    part2Track.trimStart = splitMediaSec;
    part2Track.trimEnd = curTrimEnd;
    part2Track.offsetMs = secondPartOffsetMs;
    part2Track.waveformPeaks = track.waveformPeaks ? track.waveformPeaks.slice() : null;

    state.tracks.splice(trackIdx + 1, 0, part2Track);
    state.selectedTrackId = part2Track.id;

    renderStudioViews();
    saveCurrentSession();
    return true;
  }

  // Divide a faixa selecionada na posição atual da Agulha da Timeline (Atalho S ou botão Cortar [S])
  function splitSelectedTrackAtPlayhead() {
    let targetTrack = state.tracks.find(t => t.id === state.selectedTrackId && t.mediaUrl);
    if (!targetTrack) {
      targetTrack = state.tracks.find(t => t.mediaUrl);
    }
    if (!targetTrack) {
      alert('Grave ou importe uma faixa primeiro para poder cortá-la!');
      return;
    }

    const offsetSec = (targetTrack.offsetMs || 0) / 1000;
    const trimStartSec = targetTrack.trimStart || 0;
    const effDurSec = getTrackEffectiveDuration(targetTrack);
    const clipStartSec = offsetSec;
    const clipEndSec = offsetSec + effDurSec;

    // Se a agulha estiver dentro do clipe na timeline, divide diretamente na agulha; caso contrário, abre o editor visual de corte!
    if (state.playheadPosSec > clipStartSec + 0.08 && state.playheadPosSec < clipEndSec - 0.08) {
      const splitMediaSec = trimStartSec + (state.playheadPosSec - clipStartSec);
      splitTrackAtMediaTime(targetTrack, splitMediaSec);
    } else {
      openTrackCutModal(targetTrack.id);
    }
  }

  function bindCutModalEvents() {
    if (dom.cutModalCloseBtn) dom.cutModalCloseBtn.onclick = closeTrackCutModal;
    if (dom.btnCutCancel) dom.btnCutCancel.onclick = closeTrackCutModal;
    if (dom.btnCutApply) dom.btnCutApply.onclick = applyCutModalChanges;
    if (dom.btnCutPreviewPlay) dom.btnCutPreviewPlay.onclick = toggleCutModalPreview;
    if (dom.trackCutModal) {
      dom.trackCutModal.onclick = (e) => {
        if (e.target === dom.trackCutModal) closeTrackCutModal();
      };
    }

    // Botões de ajuste fino (-50ms / +50ms) para Início e Fim
    if (dom.btnCutStartMinus) {
      dom.btnCutStartMinus.onclick = () => {
        cutModalCtx.trimStart = Math.max(0, cutModalCtx.trimStart - 0.05);
        updateCutModalUi();
      };
    }
    if (dom.btnCutStartPlus) {
      dom.btnCutStartPlus.onclick = () => {
        const maxStart = Math.max(0, cutModalCtx.duration - cutModalCtx.trimEnd - 0.1);
        cutModalCtx.trimStart = Math.min(maxStart, cutModalCtx.trimStart + 0.05);
        updateCutModalUi();
      };
    }
    if (dom.btnCutEndMinus) {
      dom.btnCutEndMinus.onclick = () => {
        const maxEnd = Math.max(0, cutModalCtx.duration - cutModalCtx.trimStart - 0.1);
        cutModalCtx.trimEnd = Math.min(maxEnd, cutModalCtx.trimEnd + 0.05);
        updateCutModalUi();
      };
    }
    if (dom.btnCutEndPlus) {
      dom.btnCutEndPlus.onclick = () => {
        cutModalCtx.trimEnd = Math.max(0, cutModalCtx.trimEnd - 0.05);
        updateCutModalUi();
      };
    }

    // Ações rápidas na posição da agulha do modal
    if (dom.btnCutTrimToCursorStart) {
      dom.btnCutTrimToCursorStart.onclick = () => {
        const maxStart = Math.max(0, cutModalCtx.duration - cutModalCtx.trimEnd - 0.1);
        cutModalCtx.trimStart = Math.max(0, Math.min(maxStart, cutModalCtx.cursorSec));
        updateCutModalUi();
      };
    }
    if (dom.btnCutTrimToCursorEnd) {
      dom.btnCutTrimToCursorEnd.onclick = () => {
        const newTrimEnd = cutModalCtx.duration - cutModalCtx.cursorSec;
        const maxEnd = Math.max(0, cutModalCtx.duration - cutModalCtx.trimStart - 0.1);
        cutModalCtx.trimEnd = Math.max(0, Math.min(maxEnd, newTrimEnd));
        updateCutModalUi();
      };
    }
    if (dom.btnCutSplitAtCursor) {
      dom.btnCutSplitAtCursor.onclick = () => {
        const track = state.tracks.find(t => t.id === cutModalCtx.trackId);
        if (!track) return;
        track.trimStart = cutModalCtx.trimStart;
        track.trimEnd = cutModalCtx.trimEnd;
        const splitTime = cutModalCtx.cursorSec;
        if (splitTrackAtMediaTime(track, splitTime)) {
          closeTrackCutModal();
        }
      };
    }
    if (dom.btnCutResetFull) {
      dom.btnCutResetFull.onclick = () => {
        cutModalCtx.trimStart = 0;
        cutModalCtx.trimEnd = 0;
        updateCutModalUi();
      };
    }

    // Arraste das alças de início/fim e clique para posicionar a agulha na onda do Modal
    if (dom.cutWaveformStage) {
      const startStageDrag = (e, isTouch = false) => {
        const target = e.target;
        const handleStart = target.closest('#cutHandleStart');
        const handleEnd = target.closest('#cutHandleEnd');
        let mode = 'cursor';
        if (handleStart) mode = 'start';
        else if (handleEnd) mode = 'end';

        const updateFromClientX = (clientX) => {
          const rect = dom.cutWaveformStage.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
          const timeSec = pct * cutModalCtx.duration;

          if (mode === 'start') {
            const maxStart = Math.max(0, cutModalCtx.duration - cutModalCtx.trimEnd - 0.1);
            cutModalCtx.trimStart = Math.max(0, Math.min(maxStart, timeSec));
          } else if (mode === 'end') {
            const maxEnd = Math.max(0, cutModalCtx.duration - cutModalCtx.trimStart - 0.1);
            cutModalCtx.trimEnd = Math.max(0, Math.min(maxEnd, cutModalCtx.duration - timeSec));
          } else {
            cutModalCtx.cursorSec = timeSec;
          }
          updateCutModalUi();
        };

        const initX = isTouch ? e.touches[0].clientX : e.clientX;
        updateFromClientX(initX);

        const onMove = (moveEvt) => {
          const cx = isTouch ? (moveEvt.touches[0] ? moveEvt.touches[0].clientX : initX) : moveEvt.clientX;
          updateFromClientX(cx);
        };
        const onUp = () => {
          if (isTouch) {
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
          } else {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          }
        };

        if (isTouch) {
          window.addEventListener('touchmove', onMove, { passive: false });
          window.addEventListener('touchend', onUp);
        } else {
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }
      };

      dom.cutWaveformStage.addEventListener('mousedown', (e) => startStageDrag(e, false));
      dom.cutWaveformStage.addEventListener('touchstart', (e) => startStageDrag(e, true), { passive: true });
    }
  }

  // =========================================================================
  // CALIBRAÇÃO ACÚSTICA AUTOMÁTICA DE LATÊNCIA (3 PINGS LOOPBACK)
  // =========================================================================
  let calibContext = {
    isRunning: false,
    stream: null,
    audioNodes: []
  };

  function openLatencyCalibrationModal() {
    closeStudioMenus();
    if (!dom.latencyCalibrationModal) return;

    if (dom.calibStatusText) {
      dom.calibStatusText.textContent = 'Pronto para iniciar a calibração acústica';
    }
    if (dom.calibResultCard) {
      dom.calibResultCard.style.display = 'none';
    }
    if (dom.calibVuFill) {
      dom.calibVuFill.style.width = '0%';
    }
    if (dom.btnCalibStart) {
      dom.btnCalibStart.disabled = false;
      dom.btnCalibStart.innerHTML = '<span>🎯</span> Iniciar Calibração (3 Pings)';
    }

    for (let i = 1; i <= 3; i++) {
      const dot = document.getElementById(`calibPingDot${i}`);
      if (dot) dot.classList.remove('pinging', 'success');
    }

    // Identifica se há uma faixa gravada ativa para sugerir sincronizar
    const targetTrack = state.tracks.find(t => t.id === state.selectedTrackId && (t.mediaUrl || t.mediaBlob))
      || state.tracks.find(t => !!(t.mediaUrl || t.mediaBlob));

    if (targetTrack && dom.calibApplyTrackWrap) {
      dom.calibApplyTrackWrap.style.display = 'block';
      if (dom.calibTrackName) dom.calibTrackName.textContent = targetTrack.name;
      if (dom.calibApplyToCurrentTrack) dom.calibApplyToCurrentTrack.checked = true;
    } else if (dom.calibApplyTrackWrap) {
      dom.calibApplyTrackWrap.style.display = 'none';
    }

    dom.latencyCalibrationModal.classList.add('active');
  }

  function closeLatencyCalibrationModal() {
    if (calibContext.isRunning) {
      calibContext.isRunning = false;
      if (calibContext.stream) {
        calibContext.stream.getTracks().forEach(t => t.stop());
        calibContext.stream = null;
      }
      if (calibContext.audioNodes) {
        calibContext.audioNodes.forEach(n => {
          try { n.disconnect(); } catch (_) {}
        });
        calibContext.audioNodes = [];
      }
    }
    if (dom.latencyCalibrationModal) {
      dom.latencyCalibrationModal.classList.remove('active');
    }
  }

  async function runAcousticLatencyCalibration() {
    if (calibContext.isRunning) return;
    calibContext.isRunning = true;

    // Pausa playback se estiver tocando
    if (state.isPlaying) stopStudioPlayback();

    if (dom.btnCalibStart) {
      dom.btnCalibStart.disabled = true;
      dom.btnCalibStart.innerHTML = '<span>⏳</span> Calibrando... Fique em silêncio';
    }
    if (dom.calibResultCard) dom.calibResultCard.style.display = 'none';
    if (dom.calibStatusText) dom.calibStatusText.textContent = 'Iniciando escuta acústica...';

    for (let i = 1; i <= 3; i++) {
      const dot = document.getElementById(`calibPingDot${i}`);
      if (dot) dot.classList.remove('pinging', 'success');
    }

    let stream = null;
    let micSource = null;
    let bandpass = null;
    let processor = null;
    let silentGain = null;

    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      // 1. Obtém stream do microfone sem filtros destrutivos de eco/ruído
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: state.selectedAudioDeviceId ? { exact: state.selectedAudioDeviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1
        }
      });
      calibContext.stream = stream;

      // 2. Grafo Web Audio: Filtro passa-faixa sintonizado no tom do ping (2400 Hz)
      micSource = ctx.createMediaStreamSource(stream);
      bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 2400; // 2.4 kHz
      bandpass.Q.value = 4.0;

      silentGain = ctx.createGain();
      silentGain.gain.value = 0;

      const bufferSize = 1024;
      processor = ctx.createScriptProcessor(bufferSize, 1, 1);
      calibContext.audioNodes = [micSource, bandpass, processor, silentGain];

      const capturedChunks = [];
      let totalSamplesCount = 0;
      let firstChunkAudioTime = null;

      processor.onaudioprocess = (e) => {
        if (!calibContext.isRunning) return;
        const input = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);

        if (firstChunkAudioTime === null) {
          firstChunkAudioTime = ctx.currentTime;
        }

        capturedChunks.push({
          startSample: totalSamplesCount,
          data: copy
        });
        totalSamplesCount += input.length;

        // Medidor VU visual
        let peak = 0;
        for (let i = 0; i < input.length; i++) {
          const abs = Math.abs(input[i]);
          if (abs > peak) peak = abs;
        }
        const pct = Math.min(100, Math.round(peak * 300));
        if (dom.calibVuFill) dom.calibVuFill.style.width = pct + '%';
      };

      micSource.connect(bandpass);
      bandpass.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(ctx.destination);

      // Pequena pausa para estabilização de buffers do driver de áudio (250ms)
      await new Promise(r => setTimeout(r, 250));
      if (!calibContext.isRunning) return;

      const sampleRate = ctx.sampleRate || 48000;

      // 3. Função de emissão de ping sintético curto e penetrante (2400 Hz)
      function playCalibrationBeep(targetAudioTime) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2400, targetAudioTime);

        gain.gain.setValueAtTime(0.0001, targetAudioTime);
        gain.gain.linearRampToValueAtTime(0.85, targetAudioTime + 0.002);
        gain.gain.setValueAtTime(0.85, targetAudioTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, targetAudioTime + 0.020);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(targetAudioTime);
        osc.stop(targetAudioTime + 0.025);
      }

      // 4. Agenda os 3 pings com espaçamento de 450ms
      const baseAudioTime = ctx.currentTime + 0.15;
      const pingInterval = 0.45;
      const scheduledAudioTimes = [
        baseAudioTime,
        baseAudioTime + pingInterval,
        baseAudioTime + pingInterval * 2
      ];

      scheduledAudioTimes.forEach((t, idx) => {
        playCalibrationBeep(t);
        const delayMs = Math.max(0, (t - ctx.currentTime) * 1000);
        setTimeout(() => {
          if (!calibContext.isRunning) return;
          const dot = document.getElementById(`calibPingDot${idx + 1}`);
          if (dot) dot.classList.add('pinging');
          if (dom.calibStatusText) {
            dom.calibStatusText.textContent = `Tocando Ping ${idx + 1} de 3... Escutando retorno...`;
          }
        }, delayMs);
      });

      // Aguarda os 3 pings serem emitidos e captados (+ 400ms após o último)
      const totalWaitMs = Math.round((scheduledAudioTimes[2] + 0.45 - ctx.currentTime) * 1000);
      await new Promise(r => setTimeout(r, Math.max(800, totalWaitMs)));
      if (!calibContext.isRunning) return;

      // 5. Finaliza a captação
      processor.disconnect();
      bandpass.disconnect();
      micSource.disconnect();
      silentGain.disconnect();
      stream.getTracks().forEach(t => t.stop());
      calibContext.stream = null;
      calibContext.audioNodes = [];

      // 6. Constrói o buffer linear contínuo
      const fullBuffer = new Float32Array(totalSamplesCount);
      capturedChunks.forEach(chunk => {
        fullBuffer.set(chunk.data, chunk.startSample);
      });

      // Mede o ruído de fundo médio antes do 1º ping
      const baselineEndSample = Math.min(fullBuffer.length, Math.floor(sampleRate * 0.12));
      let baselineSum = 0;
      for (let s = 0; s < baselineEndSample; s++) {
        baselineSum += Math.abs(fullBuffer[s]);
      }
      const baselineNoise = baselineEndSample > 0 ? (baselineSum / baselineEndSample) : 0.005;
      const detectionThreshold = Math.max(0.035, baselineNoise * 2.8);

      // 7. Detecta a chegada de cada um dos 3 pings
      const detectedLatenciesMs = [];

      scheduledAudioTimes.forEach((pingAudioTime, idx) => {
        // Converte o tempo do ping para índice aproximado de amostra
        const pingSampleOffset = Math.round((pingAudioTime - firstChunkAudioTime) * sampleRate);
        const windowStartSample = pingSampleOffset + Math.round(0.015 * sampleRate); // Pula 15ms de vazamento inicial
        const windowEndSample = Math.min(fullBuffer.length, pingSampleOffset + Math.round(0.550 * sampleRate)); // Janela de até 550ms

        let maxVal = 0;
        let maxSampleIdx = -1;

        for (let s = windowStartSample; s < windowEndSample; s++) {
          const abs = Math.abs(fullBuffer[s]);
          if (abs > maxVal) {
            maxVal = abs;
            maxSampleIdx = s;
          }
        }

        const dot = document.getElementById(`calibPingDot${idx + 1}`);
        if (maxVal >= detectionThreshold && maxSampleIdx > 0) {
          const detectedAudioTime = firstChunkAudioTime + (maxSampleIdx / sampleRate);
          const latencyMs = (detectedAudioTime - pingAudioTime) * 1000;
          if (latencyMs >= 15 && latencyMs <= 500) {
            detectedLatenciesMs.push(latencyMs);
            if (dot) {
              dot.classList.remove('pinging');
              dot.classList.add('success');
            }
          }
        }
      });

      // 8. Avalia o resultado
      if (detectedLatenciesMs.length >= 2) {
        // Ordena para pegar a mediana matemática
        detectedLatenciesMs.sort((a, b) => a - b);
        const medianMs = detectedLatenciesMs[Math.floor(detectedLatenciesMs.length / 2)];
        const finalLatencyMs = Math.round(medianMs);

        // Atualiza estado e storage
        state.latencyCompensationMs = finalLatencyMs;
        localStorage.setItem('samba_latency_compensation', finalLatencyMs);

        // Atualiza os dropdowns de compensação na UI
        const updateSelectOptions = (sel) => {
          if (!sel) return;
          let opt = sel.querySelector(`option[value="${finalLatencyMs}"]`);
          if (!opt) {
            opt = document.createElement('option');
            opt.value = String(finalLatencyMs);
            opt.textContent = `🎯 Calibrado pelo Teste (${finalLatencyMs}ms)`;
            sel.appendChild(opt);
          }
          sel.value = String(finalLatencyMs);
        };
        updateSelectOptions(dom.studioLatencyCompensation);
        updateSelectOptions(dom.recLatencyCompensation);

        // Aplica na faixa atual se solicitado
        const targetTrack = state.tracks.find(t => t.id === state.selectedTrackId && (t.mediaUrl || t.mediaBlob))
          || state.tracks.find(t => !!(t.mediaUrl || t.mediaBlob));

        let appliedTrackMsg = '';
        if (targetTrack && dom.calibApplyToCurrentTrack && dom.calibApplyToCurrentTrack.checked) {
          targetTrack.offsetMs = -finalLatencyMs;
          updateTrackOffsetInPlace(targetTrack);
          saveCurrentSession();
          appliedTrackMsg = ` e sincronizado em "${targetTrack.name}" (-${finalLatencyMs}ms)`;
        }

        if (dom.calibStatusText) {
          dom.calibStatusText.textContent = '🎉 Calibração concluída com sucesso!';
        }
        if (dom.calibResultValue) {
          dom.calibResultValue.textContent = `${finalLatencyMs}ms`;
        }
        if (dom.calibResultDesc) {
          dom.calibResultDesc.textContent = `Latência exata do seu computador cravada${appliedTrackMsg}! O Samba agora compensará este atraso automaticamente.`;
        }
        if (dom.calibResultCard) {
          dom.calibResultCard.style.display = 'flex';
        }
        if (dom.btnCalibStart) {
          dom.btnCalibStart.disabled = false;
          dom.btnCalibStart.innerHTML = '<span>↺</span> Repetir Calibração';
        }

        if (window.appToast) {
          window.appToast(`Latência calibrada com sucesso: ${finalLatencyMs}ms!`, 'success');
        }
      } else {
        // Não detectou pings suficientes
        if (dom.calibStatusText) {
          dom.calibStatusText.innerHTML = `<span style="color: #EF4444;">⚠️ Microfone não captou o som dos bips.</span><br><span style="font-size: 11px; color: #cbd5e1; font-weight: normal;">Aumente o volume dos alto-falantes e certifique-se de que o microfone selecionado está ativo.</span>`;
        }
        if (dom.btnCalibStart) {
          dom.btnCalibStart.disabled = false;
          dom.btnCalibStart.innerHTML = '<span>🎯</span> Tentar Novamente';
        }
      }
    } catch (err) {
      console.warn('Erro durante a calibração de latência:', err);
      if (dom.calibStatusText) {
        dom.calibStatusText.innerHTML = `<span style="color: #EF4444;">Erro ao acessar microfone: ${escapeHtml(err.message || err)}</span>`;
      }
      if (dom.btnCalibStart) {
        dom.btnCalibStart.disabled = false;
        dom.btnCalibStart.innerHTML = '<span>🎯</span> Tentar Novamente';
      }
    } finally {
      calibContext.isRunning = false;
      if (stream) {
        try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      }
    }
  }

  function bindLatencyCalibrationEvents() {
    if (dom.btnCalibTriggerStudio) dom.btnCalibTriggerStudio.onclick = openLatencyCalibrationModal;
    if (dom.btnCalibTriggerRec) dom.btnCalibTriggerRec.onclick = openLatencyCalibrationModal;
    if (dom.btnCalibClose) dom.btnCalibClose.onclick = closeLatencyCalibrationModal;
    if (dom.btnCalibCancel) dom.btnCalibCancel.onclick = closeLatencyCalibrationModal;
    if (dom.btnCalibStart) dom.btnCalibStart.onclick = runAcousticLatencyCalibration;
    if (dom.latencyCalibrationModal) {
      dom.latencyCalibrationModal.onclick = (e) => {
        if (e.target === dom.latencyCalibrationModal) closeLatencyCalibrationModal();
      };
    }
  }

  // Dispara Gravação na Faixa Armada ou Auto-arma a selecionada (Feature 15)
  function triggerMasterRecord() {
    let targetTrack = state.tracks.find(t => t.armed);
    if (!targetTrack && state.selectedTrackId) {
      targetTrack = state.tracks.find(t => t.id === state.selectedTrackId);
      if (targetTrack) {
        targetTrack.armed = true;
        const armBtn = dom.reaperTracksStack?.querySelector(`.btn-rec-arm[data-id="${targetTrack.id}"]`);
        if (armBtn) {
          armBtn.classList.add('armed');
          armBtn.classList.add('active');
        }
      }
    }
    if (!targetTrack && state.tracks.length > 0) {
      targetTrack = state.tracks[0];
      targetTrack.armed = true;
      const armBtn = dom.reaperTracksStack?.querySelector(`.btn-rec-arm[data-id="${targetTrack.id}"]`);
      if (armBtn) {
        armBtn.classList.add('armed');
        armBtn.classList.add('active');
      }
    }
    if (!targetTrack) {
      targetTrack = addTrack('Faixa 1');
      if (targetTrack) {
        targetTrack.armed = true;
        const armBtn = dom.reaperTracksStack?.querySelector(`.btn-rec-arm[data-id="${targetTrack.id}"]`);
        if (armBtn) {
          armBtn.classList.add('armed');
          armBtn.classList.add('active');
        }
      }
    }
    if (targetTrack) {
      selectTrack(targetTrack.id);
      openRecordingModal(targetTrack.id, targetTrack.mediaType || 'video');
    }
  }

  // --- Inicialização e Bind Global ---
  function init() {
    cacheDom();

    // Toolbar Play / Stop / Record Master
    if (dom.btnMasterPlay) {
      dom.btnMasterPlay.onclick = () => {
        if (state.isPlaying) {
          pauseStudioPlayback();
        } else {
          startStudioPlayback();
        }
      };
    }

    if (dom.btnMasterStop) {
      dom.btnMasterStop.onclick = stopStudioPlayback;
    }

    if (dom.btnStudioRecord) {
      dom.btnStudioRecord.onclick = triggerMasterRecord;
    }

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
      dom.btnTimelineAddTrack.onclick = () => addTrack();
    }

    // Clique na Régua da Linha de Tempo para Seek / Reposicionar Cursor
    if (dom.reaperRulerTrack) {
      dom.reaperRulerTrack.onclick = (e) => {
        const rect = dom.reaperRulerTrack.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, clickX / rect.width));

        const loopDurationSec = getTimelineDurationSec();
        const targetTimeSec = percent * loopDurationSec;
        setPlayheadTimeSec(targetTimeSec);
      };
    }

    // Botão de Dividir na Agulha (Split at Playhead)
    if (dom.btnSplitAtPlayhead) {
      dom.btnSplitAtPlayhead.onclick = () => splitSelectedTrackAtPlayhead();
    }

    // Eventos do Modal de Corte de Faixa
    bindCutModalEvents();

    // Eventos da Calibração Automática de Latência
    bindLatencyCalibrationEvents();

    // Fechamento de dropdowns ao clicar fora, rolar ou redimensionar
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tcp-kebab-wrap')) {
        closeAllKebabMenus();
      }
    });
    if (dom.reaperDawScroll) {
      dom.reaperDawScroll.addEventListener('scroll', closeAllKebabMenus, { passive: true });
    }
    window.addEventListener('resize', closeAllKebabMenus, { passive: true });

    // Atalhos de Teclado: Navegação de Pistas, Mute, Solo, Split e Espaço
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.key === 'Escape') {
        // Fecha qualquer menu kebab ou popover aberto (inclusive se o foco estiver em <select> do popover)
        closeStudioMenus();
        if (dom.latencyCalibrationModal && dom.latencyCalibrationModal.classList.contains('active')) {
          e.preventDefault();
          closeLatencyCalibrationModal();
          return;
        }
        if (dom.trackCutModal && dom.trackCutModal.classList.contains('active')) {
          e.preventDefault();
          closeTrackCutModal();
          return;
        }
        if (dom.newProjectModal && dom.newProjectModal.classList.contains('active')) {
          e.preventDefault();
          closeNewProjectModal();
          return;
        }
        if (dom.exportModal && dom.exportModal.classList.contains('active')) {
          e.preventDefault();
          dom.exportModal.classList.remove('active');
          return;
        }
        return;
      }

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const tabBeatbox = document.getElementById('tab-beatbox');
      const isStudioActive = tabBeatbox && tabBeatbox.classList.contains('active');
      if (!isStudioActive) return;

      const hasOpenKebabMenu = Array.from(document.querySelectorAll('.tcp-menu-dropdown')).some(m => m.style.display === 'block');

      if (e.code === 'Space') {
        e.preventDefault();
        if (dom.trackCutModal && dom.trackCutModal.classList.contains('active')) {
          toggleCutModalPreview();
          return;
        }
        if (state.isPlaying) {
          pauseStudioPlayback();
        } else {
          startStudioPlayback();
        }
      } else if ((e.code === 'ArrowDown' || e.code === 'KeyJ') && !hasOpenKebabMenu) {
        if (state.tracks.length > 0) {
          e.preventDefault();
          const curIdx = state.tracks.findIndex(t => t.id === state.selectedTrackId);
          let nextIdx = curIdx + 1;
          if (curIdx === -1) nextIdx = 0;
          if (nextIdx < state.tracks.length) {
            const nextTrack = state.tracks[nextIdx];
            selectTrack(nextTrack.id);
            const row = document.getElementById(`reaper_row_${nextTrack.id}`);
            if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      } else if ((e.code === 'ArrowUp' || e.code === 'KeyK') && !hasOpenKebabMenu) {
        if (state.tracks.length > 0) {
          e.preventDefault();
          const curIdx = state.tracks.findIndex(t => t.id === state.selectedTrackId);
          let prevIdx = curIdx - 1;
          if (curIdx === -1) prevIdx = state.tracks.length - 1;
          if (prevIdx >= 0) {
            const prevTrack = state.tracks[prevIdx];
            selectTrack(prevTrack.id);
            const row = document.getElementById(`reaper_row_${prevTrack.id}`);
            if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      } else if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const targetTrack = state.tracks.find(t => t.id === state.selectedTrackId);
        if (targetTrack) {
          e.preventDefault();
          targetTrack.muted = !targetTrack.muted;
          const row = document.getElementById(`reaper_row_${targetTrack.id}`);
          if (row) {
            row.classList.toggle('is-muted', targetTrack.muted);
            const mBtn = row.querySelector('.tcp-btn-mute');
            if (mBtn) mBtn.classList.toggle('active', targetTrack.muted);
          }
          const mosaicBtn = dom.mosaicGrid ? dom.mosaicGrid.querySelector(`.btn-mute[data-id="${targetTrack.id}"]`) : null;
          if (mosaicBtn) mosaicBtn.classList.toggle('active', targetTrack.muted);
          updateAudioMixRouting();
          saveCurrentSession();
        }
      } else if (e.code === 'KeyS' && e.altKey) {
        // Solo [Alt+S] na faixa selecionada - Não destrutivo (Feature 16)
        const targetTrack = state.tracks.find(t => t.id === state.selectedTrackId);
        if (targetTrack) {
          e.preventDefault();
          toggleTrackSolo(targetTrack.id);
        }
      } else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Cortar na agulha [Tecla S padrão REAPER]
        if (dom.trackCutModal && dom.trackCutModal.classList.contains('active')) return;
        e.preventDefault();
        splitSelectedTrackAtPlayhead();
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Gravar na faixa armada / Master Record (Feature 15)
        if (dom.trackCutModal && dom.trackCutModal.classList.contains('active')) return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
        e.preventDefault();
        triggerMasterRecord();
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
      dom.btnToggleMetronome.classList.toggle('active', state.metronomeEnabled);
      saveCurrentSession();
    };

    // Popovers Discretos da Barra Superior (Ajustes & Projeto/Exportar)
    const btnSettingsPop = document.getElementById('btnToggleSettingsPopover');
    const menuSettingsPop = document.getElementById('studioSettingsPopover');
    const btnProjectPop = document.getElementById('btnToggleProjectPopover');
    const menuProjectPop = document.getElementById('studioProjectPopover');

    const resetStudioPopoverBounds = (popEl) => {
      if (!popEl) return;
      popEl.style.left = '';
      popEl.style.right = '';
      popEl.style.maxHeight = '';
    };

    const clampStudioPopover = (popEl, triggerBtn) => {
      if (!popEl || !triggerBtn) return;
      resetStudioPopoverBounds(popEl);
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
    };

    const closeAllPopovers = () => {
      if (menuSettingsPop) {
        menuSettingsPop.classList.remove('open');
        resetStudioPopoverBounds(menuSettingsPop);
      }
      if (menuProjectPop) {
        menuProjectPop.classList.remove('open');
        resetStudioPopoverBounds(menuProjectPop);
      }
    };

    if (btnSettingsPop && menuSettingsPop) {
      btnSettingsPop.onclick = (e) => {
        e.stopPropagation();
        const isOpen = menuSettingsPop.classList.contains('open');
        closeAllKebabMenus();
        closeAllPopovers();
        if (!isOpen) {
          menuSettingsPop.classList.add('open');
          clampStudioPopover(menuSettingsPop, btnSettingsPop);
        }
      };
      menuSettingsPop.onclick = (e) => e.stopPropagation();
    }

    if (btnProjectPop && menuProjectPop) {
      btnProjectPop.onclick = (e) => {
        e.stopPropagation();
        const isOpen = menuProjectPop.classList.contains('open');
        closeAllKebabMenus();
        closeAllPopovers();
        if (!isOpen) {
          menuProjectPop.classList.add('open');
          clampStudioPopover(menuProjectPop, btnProjectPop);
        }
      };
      menuProjectPop.onclick = (e) => {
        if (e.target.closest('.popover-action-item')) {
          closeAllPopovers();
        } else {
          e.stopPropagation();
        }
      };
    }

    document.addEventListener('click', closeAllPopovers);
    window.addEventListener('resize', () => {
      if (menuSettingsPop && menuSettingsPop.classList.contains('open')) {
        clampStudioPopover(menuSettingsPop, btnSettingsPop);
      }
      if (menuProjectPop && menuProjectPop.classList.contains('open')) {
        clampStudioPopover(menuProjectPop, btnProjectPop);
      }
    });

    // Ações de Montar Novo Projeto & Zerar
    if (dom.btnToolbarNewProject) {
      dom.btnToolbarNewProject.onclick = openNewProjectModal;
    }
    if (dom.btnNewProject) {
      dom.btnNewProject.onclick = openNewProjectModal;
    }
    if (dom.btnClearProject) {
      dom.btnClearProject.onclick = clearCurrentProjectTracks;
    }

    // Modal de Novo Projeto
    if (dom.newProjectCloseBtn) {
      dom.newProjectCloseBtn.onclick = closeNewProjectModal;
    }
    if (dom.newProjectCancelBtn) {
      dom.newProjectCancelBtn.onclick = closeNewProjectModal;
    }
    if (dom.newProjectConfirmBtn) {
      dom.newProjectConfirmBtn.onclick = confirmNewProject;
    }
    if (dom.newProjectModal) {
      dom.newProjectModal.onclick = (e) => {
        if (e.target === dom.newProjectModal) closeNewProjectModal();
      };
    }

    if (dom.newProjectBpm) {
      dom.newProjectBpm.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        if (dom.newProjectBpmVal) dom.newProjectBpmVal.textContent = `${val} BPM`;
        updateModalBpmChips(val);
      };
    }
    if (dom.btnNewProjBpmMinus) {
      dom.btnNewProjBpmMinus.onclick = () => {
        if (!dom.newProjectBpm) return;
        const cur = parseInt(dom.newProjectBpm.value, 10) || 120;
        const next = Math.max(60, cur - 1);
        dom.newProjectBpm.value = next;
        if (dom.newProjectBpmVal) dom.newProjectBpmVal.textContent = `${next} BPM`;
        updateModalBpmChips(next);
      };
    }
    if (dom.btnNewProjBpmPlus) {
      dom.btnNewProjBpmPlus.onclick = () => {
        if (!dom.newProjectBpm) return;
        const cur = parseInt(dom.newProjectBpm.value, 10) || 120;
        const next = Math.min(200, cur + 1);
        dom.newProjectBpm.value = next;
        if (dom.newProjectBpmVal) dom.newProjectBpmVal.textContent = `${next} BPM`;
        updateModalBpmChips(next);
      };
    }
    if (dom.newProjectBpmPresets) {
      dom.newProjectBpmPresets.querySelectorAll('.btn-chip').forEach(btn => {
        btn.onclick = () => {
          const bpm = parseInt(btn.dataset.bpm, 10);
          if (dom.newProjectBpm) dom.newProjectBpm.value = bpm;
          if (dom.newProjectBpmVal) dom.newProjectBpmVal.textContent = `${bpm} BPM`;
          updateModalBpmChips(bpm);
        };
      });
    }

    if (dom.btnPickerClearAll) {
      dom.btnPickerClearAll.onclick = () => {
        modalSelectedInstruments.clear();
        renderModalInstrumentsPicker();
      };
    }
    if (dom.btnPickerSelectClassic) {
      dom.btnPickerSelectClassic.onclick = () => {
        modalSelectedInstruments.clear();
        [0, 1, 2, 4].forEach(i => modalSelectedInstruments.add(i));
        renderModalInstrumentsPicker();
      };
    }
    if (dom.btnPickerSelectAll) {
      dom.btnPickerSelectAll.onclick = () => {
        modalSelectedInstruments.clear();
        INSTRUMENT_PRESETS.forEach((_, i) => modalSelectedInstruments.add(i));
        renderModalInstrumentsPicker();
      };
    }

    // Adicionar Faixa
    if (dom.btnAddTrack) {
      dom.btnAddTrack.onclick = () => addTrack();
    }

    // Exportações
    dom.btnExportVideo.onclick = exportMosaicVideo;
    dom.btnExportAudio.onclick = exportMixedAudio;
    dom.exportCloseBtn.onclick = () => dom.exportModal.classList.remove('active');
    if (dom.exportModal) {
      dom.exportModal.onclick = (e) => {
        if (e.target === dom.exportModal) dom.exportModal.classList.remove('active');
      };
    }

    // Gravação (Aba & Controles)
    if (dom.btnViewRecord) {
      dom.btnViewRecord.onclick = () => switchViewMode('record');
    }
    if (dom.recordBackBtn) {
      dom.recordBackBtn.onclick = () => switchViewMode('timeline');
    }
    if (dom.recordCloseBtn) {
      dom.recordCloseBtn.onclick = () => switchViewMode('timeline');
    }

    // Seletor dinâmico de qual faixa gravar
    if (dom.recTrackSelect) {
      dom.recTrackSelect.onchange = (e) => {
        const val = e.target.value;
        if (val === '__new__') {
          const newTrk = addTrack();
          if (newTrk) {
            recordingContext.activeTrackId = newTrk.id;
            updateRecTrackPicker();
            const trk = state.tracks.find(t => t.id === newTrk.id);
            if (dom.audioViewfinderInstrument && trk) {
              dom.audioViewfinderInstrument.textContent = trk.name;
            }
          }
        } else {
          recordingContext.activeTrackId = val;
          const trk = state.tracks.find(t => t.id === val);
          if (dom.audioViewfinderInstrument && trk) {
            dom.audioViewfinderInstrument.textContent = trk.name;
          }
        }
      };
    }

    if (dom.recModeVideoBtn) {
      dom.recModeVideoBtn.onclick = () => setRecordingMode('video');
    }
    if (dom.recModeAudioBtn) {
      dom.recModeAudioBtn.onclick = () => setRecordingMode('audio');
    }

    // Seletores de Dispositivo & Perfil de Áudio
    if (dom.recAudioDevice) {
      dom.recAudioDevice.onchange = (e) => {
        state.selectedAudioDeviceId = e.target.value;
        localStorage.setItem('samba_selected_audio_dev', state.selectedAudioDeviceId);
        if (state.viewMode === 'record') {
          setRecordingMode(recordingContext.captureMode);
        }
      };
    }
    if (dom.recVideoDevice) {
      dom.recVideoDevice.onchange = (e) => {
        state.selectedVideoDeviceId = e.target.value;
        localStorage.setItem('samba_selected_video_dev', state.selectedVideoDeviceId);
        if (state.viewMode === 'record' && recordingContext.captureMode === 'video') {
          setRecordingMode('video');
        }
      };
    }
    if (dom.recAudioProfile) {
      dom.recAudioProfile.onchange = (e) => {
        state.audioProfile = e.target.value;
        localStorage.setItem('samba_audio_profile', state.audioProfile);
        if (state.viewMode === 'record') {
          setRecordingMode(recordingContext.captureMode);
        }
      };
    }

    // Seletores de Compensação de Latência
    if (dom.recLatencyCompensation) {
      dom.recLatencyCompensation.value = String(state.latencyCompensationMs || 80);
      dom.recLatencyCompensation.onchange = (e) => {
        state.latencyCompensationMs = parseInt(e.target.value, 10) || 0;
        localStorage.setItem('samba_latency_compensation', state.latencyCompensationMs);
        if (dom.studioLatencyCompensation) {
          dom.studioLatencyCompensation.value = String(state.latencyCompensationMs);
        }
      };
    }
    if (dom.studioLatencyCompensation) {
      dom.studioLatencyCompensation.value = String(state.latencyCompensationMs || 80);
      dom.studioLatencyCompensation.onchange = (e) => {
        state.latencyCompensationMs = parseInt(e.target.value, 10) || 0;
        localStorage.setItem('samba_latency_compensation', state.latencyCompensationMs);
        if (dom.recLatencyCompensation) {
          dom.recLatencyCompensation.value = String(state.latencyCompensationMs);
        }
      };
    }

    dom.btnStartRecord.onclick = () => {
      if (recordingContext.isRecording) {
        stopCurrentRecording(true);
      } else if (recordingContext.isCountingDown) {
        stopCurrentRecording(false);
      } else {
        startPreRollCountdown();
      }
    };
    dom.btnKeepTake.onclick = keepCurrentTake;
    dom.btnDiscardTake.onclick = discardAndRetry;
    if (dom.recTakeNameInput) {
      dom.recTakeNameInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          keepCurrentTake();
        }
      };
    }

    // Salvar Projeto em Arquivo JSON (incluindo gravações codificadas em Base64/DataURL)
    dom.btnSaveProject.onclick = async () => {
      const serializedTracks = await Promise.all(
        state.tracks.map(async (t) => ({
          id: t.id,
          name: t.name,
          mediaType: t.mediaType || 'video',
          volume: t.volume,
          muted: t.muted,
          solo: t.solo,
          offsetMs: t.offsetMs,
          trimStart: t.trimStart || 0,
          trimEnd: t.trimEnd || 0,
          duration: t.duration || 0,
          waveformPeaks: t.waveformPeaks || null,
          mediaDataUrl: t.mediaBlob ? await blobToDataURL(t.mediaBlob) : null
        }))
      );

      const exportData = {
        bpm: state.bpm,
        meter: state.meter,
        mode: state.mode,
        measures: state.measures,
        looping: state.looping,
        metronomeEnabled: state.metronomeEnabled,
        viewMode: state.viewMode,
        zoomLevel: state.zoomLevel,
        tracks: serializedTracks
      };
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      downloadBlob(blob, `samba_breque_projeto_${Date.now()}.json`);
    };

    // Carregar Projeto (restaurando gravações Base64/DataURL para Blobs)
    dom.btnLoadProject.onclick = () => dom.projectFileInput.click();
    dom.projectFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            if (data && data.tracks) {
              stopStudioPlayback();
              state.bpm = data.bpm || 120;
              state.meter = data.meter || '2/4';
              state.mode = data.mode || 'free';
              state.measures = data.measures || 4;
              state.looping = !!data.looping;
              state.metronomeEnabled = data.metronomeEnabled !== undefined ? data.metronomeEnabled : true;
              state.viewMode = data.viewMode || 'timeline';
              state.zoomLevel = data.zoomLevel || 100;

              state.tracks.forEach(oldTrack => {
                if (oldTrack.mediaUrl) URL.revokeObjectURL(oldTrack.mediaUrl);
              });

              state.tracks = await Promise.all(
                data.tracks.map(async (t, idx) => {
                  const tr = createTrack(t.name, idx);
                  tr.id = t.id || tr.id;
                  tr.volume = t.volume !== undefined ? t.volume : 1.0;
                  tr.muted = !!t.muted;
                  tr.solo = !!t.solo;
                  tr.offsetMs = t.offsetMs || 0;
                  tr.trimStart = t.trimStart || 0;
                  tr.trimEnd = t.trimEnd || 0;
                  tr.duration = t.duration || 0;
                  tr.waveformPeaks = t.waveformPeaks || null;

                  if (t.mediaDataUrl) {
                    const blob = await dataURLToBlob(t.mediaDataUrl);
                    if (blob) {
                      tr.mediaBlob = blob;
                      tr.mediaUrl = URL.createObjectURL(blob);
                      tr.mediaType = t.mediaType || (blob.type && blob.type.startsWith('audio') ? 'audio' : 'video');
                    }
                  } else {
                    tr.mediaType = t.mediaType || 'video';
                  }
                  return tr;
                })
              );

              syncToolbarControls();
              updateLoopUi();
              switchViewMode(state.viewMode);
              renderStudioViews();
              saveCurrentSession();
              alert('Projeto carregado com sucesso!');
            }
          } catch (err) {
            alert('Arquivo de projeto inválido: ' + err.message);
          } finally {
            dom.projectFileInput.value = '';
          }
        };
        reader.readAsText(file);
      }
    };

    // Restaura ou inicializa sessão padrão
    restoreSession();
  }

  // Importa um arranjo/breque ou instrumento renderizado pelo Sequenciador diretamente como pista no Studio Multitrack
  async function importSequencerBounce(wavBlob, durationSec, bpm, meter, measures, customTrackName) {
    stopStudioPlayback();
    sessionEpoch++;

    if (bpm) state.bpm = bpm;
    if (meter) state.meter = meter;
    if (measures) state.measures = measures;

    const finalTrackName = (typeof customTrackName === 'string' && customTrackName.trim())
      ? customTrackName.trim()
      : 'Bateria (Pad)';

    let targetTrack = state.tracks.find(t => !t.mediaUrl && !t.mediaBlob);
    if (!targetTrack) {
      if (state.tracks.length < MAX_STUDIO_TRACKS) {
        targetTrack = createTrack(finalTrackName, state.tracks.length);
        state.tracks.push(targetTrack);
      } else {
        targetTrack = state.tracks[state.tracks.length - 1];
      }
    }

    targetTrack.name = finalTrackName;
    if (targetTrack._offsetTimer) {
      clearTimeout(targetTrack._offsetTimer);
      targetTrack._offsetTimer = null;
    }
    if (targetTrack.mediaUrl) {
      URL.revokeObjectURL(targetTrack.mediaUrl);
    }

    targetTrack.mediaBlob = wavBlob;
    targetTrack.mediaUrl = URL.createObjectURL(wavBlob);
    targetTrack.mediaType = 'audio';
    targetTrack.duration = durationSec;
    targetTrack.offsetMs = 0;
    targetTrack.trimStart = 0;
    targetTrack.trimEnd = 0;
    targetTrack.waveformPeaks = null;

    syncToolbarControls();
    await extractWaveformPeaks(targetTrack);
    renderStudioViews();
    await saveCurrentSession();
  }

  // Inicia gravação guiada configurando BPM, metrônomo e modo de captura (sem exigir escolha prévia de instrumento)
  async function startGuidedRecording({ instrumentName, mode = 'audio', bpm = 120, metronome = true, autoStartCountdown = false } = {}) {
    stopStudioPlayback();
    sessionEpoch++;

    if (bpm && !isNaN(bpm)) {
      state.bpm = Math.min(200, Math.max(60, parseInt(bpm, 10)));
    }
    if (typeof metronome === 'boolean') {
      state.metronomeEnabled = metronome;
    }
    syncToolbarControls();

    let targetTrack = null;
    if (instrumentName) {
      targetTrack = state.tracks.find(t => !t.mediaUrl && t.name === instrumentName);
      if (!targetTrack) {
        const emptyFirst = state.tracks.find(t => !t.mediaUrl);
        if (emptyFirst && state.tracks.length === 1) {
          emptyFirst.name = instrumentName;
          targetTrack = emptyFirst;
        } else {
          targetTrack = addTrack(instrumentName);
        }
      }
    }
    if (!targetTrack) {
      if (state.tracks.length === 0) {
        targetTrack = addTrack();
      } else {
        targetTrack = state.tracks.find(t => !t.mediaUrl) || addTrack() || state.tracks[0];
      }
    }

    if (targetTrack) {
      recordingContext.activeTrackId = targetTrack.id;
    }

    renderStudioViews();
    await switchViewMode('record', targetTrack ? targetTrack.id : null, mode);

    if (autoStartCountdown) {
      setTimeout(async () => {
        try {
          await startPreRollCountdown();
        } catch (err) {
          console.warn('Erro ao disparar contagem pré-roll automática:', err);
        }
      }, 350);
    }
  }

  function getProjectSummary() {
    const recordedTracks = state.tracks.filter(t => !!t.mediaUrl || !!t.mediaBlob);
    return {
      totalTracks: state.tracks.length,
      recordedCount: recordedTracks.length,
      bpm: state.bpm,
      meter: state.meter,
      viewMode: state.viewMode,
      isPlaying: state.isPlaying,
      isPaused: !!state.isPaused,
      playheadPosSec: state.playheadPosSec || 0,
      trackNames: state.tracks.map(t => t.name)
    };
  }

  // Exporta init para ser chamado pelo orquestrador
  window.BeatboxStudio = {
    init,
    startStudioPlayback,
    pauseStudioPlayback,
    stopStudioPlayback,
    triggerMasterRecord,
    toggleTrackSolo,
    stopRecordingView,
    openQuickRecord,
    startGuidedRecording,
    loadBrequeProject,
    deleteProjectFromDB,
    getProjectSummary,
    renderStudioViews,
    importSequencerBounce,
    switchViewMode,
    openNewProjectModal,
    clearCurrentProjectTracks,
    addTrack,
    duplicateTrack,
    clearTrackMedia,
    removeTrack,
    selectTrack,
    snapTimeToGrid,
    closeStudioMenus,
    openLatencyCalibrationModal,
    closeLatencyCalibrationModal,
    updateTrackOffsetInPlace
  };

})();
