    /* =========================================================================
       2. MOTOR HÍBRIDO DE ÁUDIO WEB AUDIO API (SAMPLES REAIS + RENDER WAV OFFLINE)
       ========================================================================= */
    class SambaAudioEngine {
      constructor() {
        this.ctx = null;
        this.isInitialized = false;
        this.sampleBuffers = {};
        this.loadingPromises = {};
        this.activeVoices = [];
        this.activeChokeVoices = {};
        this.activeRufadaVoices = [];
        this.rufadaAnalysisCache = new WeakMap();
        this.masterGain = null;
        this.masterLimiter = null;

        // Mapeamento autêntico de cada instrumento e articulação para os samples reais
        // com choke groups dedicados por naipe para evitar acúmulo de caudas e sobreposição embolada
        this.sampleConfig = {
          // Surdo 1ª (ls = low surdo): Aberto (_58), Mão na Pele (_68), Abafado (_30)
          'surdo1:aberto': { url: 'assets/audio/ls_58.mp3', vol: 0.95, rate: 1.0, chokeGroup: 'surdo1' },
          'surdo1:mao': { url: 'assets/audio/ls_68.mp3', vol: 0.80, rate: 1.0, chokeGroup: 'surdo1' },
          'surdo1:abafado': { url: 'assets/audio/ls_30.mp3', vol: 0.85, rate: 1.0, chokeGroup: 'surdo1' },

          // Surdo 2ª (ms = mid surdo): Aberto (_58), Mão na Pele (_68), Abafado (_30)
          'surdo2:aberto': { url: 'assets/audio/ms_58.mp3', vol: 0.78, rate: 1.0, chokeGroup: 'surdo2' },
          'surdo2:mao': { url: 'assets/audio/ms_68.mp3', vol: 0.68, rate: 1.0, chokeGroup: 'surdo2' },
          'surdo2:abafado': { url: 'assets/audio/ms_30.mp3', vol: 0.74, rate: 1.0, chokeGroup: 'surdo2' },

          // Surdo 3ª (hs = high surdo): Aberto (_58), Abafado (_30), Corte (_73), Aro (_74), Rulo (_72)
          'surdo3:aberto': { url: 'assets/audio/hs_58.mp3', vol: 0.78, rate: 1.0, chokeGroup: 'surdo3' },
          'surdo3:abafado': { url: 'assets/audio/hs_30.mp3', vol: 0.70, rate: 1.0, chokeGroup: 'surdo3' },
          'surdo3:corte': { url: 'assets/audio/hs_73.mp3', vol: 0.78, rate: 1.0, chokeGroup: 'surdo3' },
          'surdo3:aro': { url: 'assets/audio/hs_74.mp3', vol: 0.78, rate: 1.0, chokeGroup: 'surdo3' },
          'surdo3:rulo': { url: 'assets/audio/hs_72.mp3', vol: 0.78, rate: 1.0, chokeGroup: 'surdo3' },

          // Caixa de Guerra: Forte (_58), Fraco (_2e), Rimshot (_72), Rufado/Flam (_66)
          'caixa:forte': { url: 'assets/audio/sn_58.mp3', vol: 1.05, rate: 1.0, chokeGroup: 'caixa' },
          'caixa:fraco': { url: 'assets/audio/sn_2e.mp3', vol: 0.68, rate: 1.0, chokeGroup: 'caixa' },
          'caixa:ringshot': { url: 'assets/audio/sn_72.mp3', vol: 1.15, rate: 1.0, chokeGroup: 'caixa' },
          'caixa:rufado': { url: 'assets/audio/sn_66.mp3', vol: 0.95, rate: 1.0, chokeGroup: 'caixa' },

          // Repique / Repinique: Kit Oficial Gabriel Policarpo + Rufada (RF)
          'repique:meio': { url: 'assets/audio/re_policarpo_meio.wav', vol: 0.82, rate: 1.0, chokeGroup: 'repique' },
          'repique:intermedio': { url: 'assets/audio/re_policarpo_intermedio.wav', vol: 0.52, rate: 1.0, chokeGroup: 'repique' },
          'repique:ringshot': { url: 'assets/audio/re_policarpo_ringshot.wav', vol: 0.88, rate: 1.0, chokeGroup: 'repique' },
          'repique:open': { url: 'assets/audio/re_policarpo_open.wav', vol: 0.82, rate: 1.0, chokeGroup: 'repique' },
          'repique:rufado': { url: 'assets/audio/sn_66.mp3', vol: 0.95, rate: 1.0, chokeGroup: 'repique' },

          // Tamborim: Kit Thalita Santos como padrão oficial
          'tamborim:forte': { url: 'assets/audio/ta_thalita_grave_forte.wav', vol: 0.88, rate: 1.0, chokeGroup: 'tamborim' },
          'tamborim:medio': { url: 'assets/audio/ta_thalita_grave_medio.wav', vol: 0.52, rate: 1.0, chokeGroup: 'tamborim' },
          'tamborim:intermedio': { url: 'assets/audio/ta_thalita_grave_medio.wav', vol: 0.52, rate: 1.0, chokeGroup: 'tamborim' },
          'tamborim:fraco': { url: 'assets/audio/ta_thalita_grave_fraco.wav', vol: 0.35, rate: 1.0, chokeGroup: 'tamborim' },
          'tamborim:aro': { url: 'assets/audio/ta_72.mp3', vol: 0.78, rate: 1.0, chokeGroup: 'tamborim' },
          'tamborim:agudo': { url: 'assets/audio/ta_thalita_agudo.wav', vol: 0.72, rate: 1.0, chokeGroup: 'tamborim' },

          // Agogô: 4 Bocas (Grave ao Agudo) com volume equilibrado e choke monofônico por campana
          'agogo:boca1': { url: 'assets/audio/ag_6f.mp3', vol: 0.65, rate: 0.89, chokeGroup: 'agogo' },
          'agogo:boca2': { url: 'assets/audio/ag_6f.mp3', vol: 0.65, rate: 1.05, chokeGroup: 'agogo' },
          'agogo:boca3': { url: 'assets/audio/ag_61.mp3', vol: 0.65, rate: 0.95, chokeGroup: 'agogo' },
          'agogo:boca4': { url: 'assets/audio/ag_61.mp3', vol: 0.65, rate: 1.18, chokeGroup: 'agogo' },

          // Ganzá / Chocalho: Forte e Fraco
          'ganza:forte': { url: 'assets/audio/sh_58.mp3', vol: 0.62, rate: 1.0, chokeGroup: 'ganza' },
          'ganza:fraco': { url: 'assets/audio/sh_2e.mp3', vol: 0.40, rate: 1.0, chokeGroup: 'ganza' },
          'ganza:frente': { url: 'assets/audio/sh_58.mp3', vol: 0.62, rate: 1.0, chokeGroup: 'ganza' },
          'ganza:tras': { url: 'assets/audio/sh_2e.mp3', vol: 0.40, rate: 1.0, chokeGroup: 'ganza' }
        };

        // Kits únicos oficiais fixos: Tamborim (Thalita Santos) e Repique (Gabriel Policarpo)
        this.tamborimKit = 'thalita';
        this.repiqueKit = 'policarpo';
      }

      // Compatibilidade retroativa
      setRepiqueKit(kitId) { return true; }
      setTamborimKit(kitId) { return true; }

      getDecoderContext() {
        if (!this.decoderCtx) {
          const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
          this.decoderCtx = new OfflineCtx(1, 44100, 44100);
        }
        return this.decoderCtx;
      }

      init() {
        if (!this.ctx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AudioContext();
          this.isInitialized = true;
          this.initNoiseBuffer();
          this.initMasterBus();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => { });
        }
      }

      initMasterBus() {
        if (!this.ctx || this.masterGain) return;
        try {
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(0.68, this.ctx.currentTime);

          this.masterLimiter = this.ctx.createDynamicsCompressor();
          this.masterLimiter.threshold.setValueAtTime(-1.5, this.ctx.currentTime);
          this.masterLimiter.knee.setValueAtTime(3.0, this.ctx.currentTime);
          this.masterLimiter.ratio.setValueAtTime(16.0, this.ctx.currentTime);
          this.masterLimiter.attack.setValueAtTime(0.002, this.ctx.currentTime);
          this.masterLimiter.release.setValueAtTime(0.08, this.ctx.currentTime);

          this.masterGain.connect(this.masterLimiter);
          this.masterLimiter.connect(this.ctx.destination);
        } catch (e) { }
      }

      getMasterDestination(targetCtx = null) {
        if (targetCtx && targetCtx !== this.ctx) {
          if (targetCtx._masterBus) return targetCtx._masterBus;
          try {
            const mg = targetCtx.createGain();
            mg.gain.setValueAtTime(0.68, 0);

            const lim = targetCtx.createDynamicsCompressor();
            lim.threshold.setValueAtTime(-1.5, 0);
            lim.knee.setValueAtTime(3.0, 0);
            lim.ratio.setValueAtTime(16.0, 0);
            lim.attack.setValueAtTime(0.002, 0);
            lim.release.setValueAtTime(0.08, 0);

            mg.connect(lim);
            lim.connect(targetCtx.destination);
            targetCtx._masterBus = mg;
            return mg;
          } catch (e) {
            return targetCtx.destination;
          }
        }
        if (!this.masterGain) this.initMasterBus();
        return this.masterGain || (this.ctx ? this.ctx.destination : null);
      }

      initNoiseBuffer() {
        if (this.noiseBuffer || !this.ctx) return;
        try {
          const rate = this.ctx.sampleRate || 44100;
          this.noiseBuffer = this.ctx.createBuffer(1, rate, rate);
          const out = this.noiseBuffer.getChannelData(0);
          for (let i = 0; i < rate; i++) {
            out[i] = Math.random() * 2 - 1;
          }
        } catch (e) { }
      }

      preloadSamples() {
        // Pré-carrega todos os samples imediatamente via decoder offline
        // Não depende do AudioContext estar 'running', decodifica 100% no carregamento da página!
        if (typeof window !== 'undefined' && window.SAMBA_SOUNDBANK) {
          for (const url of Object.keys(window.SAMBA_SOUNDBANK)) {
            this.loadSample(url);
          }
        }
      }

      decodeAudio(arrayBuffer, targetCtx = null) {
        // Usa OfflineAudioContext para decodificação instantânea sem bloqueio por autoplay
        const ctx = targetCtx || this.getDecoderContext();
        if (!ctx) return Promise.reject(new Error('Contexto de decodificação indisponível'));
        const copy = arrayBuffer.slice(0);
        return new Promise((resolve, reject) => {
          let settled = false;
          const onSuccess = (decoded) => {
            if (!settled) { settled = true; resolve(decoded); }
          };
          const onError = (err) => {
            if (!settled) { settled = true; reject(err || new Error('decodeAudioData falhou')); }
          };
          try {
            const p = ctx.decodeAudioData(copy, onSuccess, onError);
            if (p && typeof p.then === 'function') {
              p.then(onSuccess, onError);
            }
          } catch (e) {
            onError(e);
          }
        });
      }

      async loadSample(url, targetCtx = null) {
        if (this.sampleBuffers[url]) return this.sampleBuffers[url];
        if (this.loadingPromises[url]) return this.loadingPromises[url];

        this.loadingPromises[url] = (async () => {
          // 1. Tenta decodificar do Soundbank Base64 embutido (100% offline, file:/// sem CORS)
          if (typeof window !== 'undefined' && window.SAMBA_SOUNDBANK && window.SAMBA_SOUNDBANK[url]) {
            try {
              const dataUri = window.SAMBA_SOUNDBANK[url];
              const commaIdx = dataUri.indexOf(',');
              const base64 = commaIdx !== -1 ? dataUri.substring(commaIdx + 1) : dataUri;
              const binaryString = atob(base64);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const decoded = await this.decodeAudio(bytes.buffer, targetCtx);
              if (decoded) {
                this.sampleBuffers[url] = decoded;
                return decoded;
              }
            } catch (err) {
              console.warn(`Aviso no soundbank para ${url}:`, err);
            }
          }

          // 2. Fallback de rede (quando em servidor web HTTP/HTTPS)
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const arrayBuf = await res.arrayBuffer();
            const decoded = await this.decodeAudio(arrayBuf, targetCtx);
            if (decoded) {
              this.sampleBuffers[url] = decoded;
              return decoded;
            }
          } catch (err) { }

          return null;
        })();

        return this.loadingPromises[url];
      }

      playSample(cfg, volMult = 1.0, targetCtx = null, startTime = null) {
        this.init();
        const ctx = targetCtx || this.ctx;
        if (!ctx) return false;
        const url = typeof cfg === 'string' ? cfg : cfg.url;
        const volume = Math.min(2.0, (cfg.vol ?? 1.0) * volMult);
        const playbackRate = cfg.rate ?? 1.0;

        const buffer = this.sampleBuffers[url];
        if (!buffer) {
          this.loadSample(url, ctx);
          return false;
        }

        const now = ctx.currentTime;
        const t = startTime !== null ? Math.max(now, startTime) : (now + 0.003);

        // Choke monofônico por naipe: interrompe a ressonância da nota anterior sem estalo
        if (cfg.chokeGroup) {
          const chokeMap = (ctx === this.ctx) ? this.activeChokeVoices : (ctx._activeChokeVoices = ctx._activeChokeVoices || {});
          const prev = chokeMap[cfg.chokeGroup];
          if (prev && prev.gainNode) {
            try {
              const chokeFadeSec = cfg.chokeGroup.startsWith('surdo') ? 0.022 : 0.010;
              prev.gainNode.gain.cancelScheduledValues(t);
              prev.gainNode.gain.setValueAtTime(prev.gainNode.gain.value, t);
              prev.gainNode.gain.linearRampToValueAtTime(0.0001, t + chokeFadeSec);
              if (prev.source) prev.source.stop(t + chokeFadeSec + 0.004);
            } catch (e) { }
          }
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = playbackRate;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(volume, t);

        const dest = this.getMasterDestination(ctx);
        gainNode.connect(dest);
        source.connect(gainNode);
        source.start(t);

        const voice = { source, gainNode, chokeGroup: cfg.chokeGroup };
        if (ctx === this.ctx) {
          this.activeVoices.push(voice);
          source.onended = () => {
            const idx = this.activeVoices.indexOf(voice);
            if (idx !== -1) this.activeVoices.splice(idx, 1);
          };
          if (cfg.chokeGroup) {
            this.activeChokeVoices[cfg.chokeGroup] = voice;
          }
        } else if (cfg.chokeGroup && ctx._activeChokeVoices) {
          ctx._activeChokeVoices[cfg.chokeGroup] = voice;
        }
        return true;
      }

      /* Analisa o AudioBuffer de rufada (sn_66.mp3) para identificar ataque, corpo denso de rulo e cauda */
      analyzeRufadaBuffer(buffer) {
        if (this.rufadaAnalysisCache.has(buffer)) {
          return this.rufadaAnalysisCache.get(buffer);
        }
        const sr = buffer.sampleRate || 44100;
        const data = buffer.getChannelData(0);
        const len = data.length;

        let maxPeak = 0;
        for (let i = 0; i < len; i++) {
          const abs = Math.abs(data[i]);
          if (abs > maxPeak) maxPeak = abs;
        }
        if (maxPeak < 0.0001) maxPeak = 1.0;

        // Encontra o início real do som (ignorando silêncio inicial do MP3)
        let onsetIdx = 0;
        const onsetThresh = maxPeak * 0.06;
        for (let i = 0; i < len; i++) {
          if (Math.abs(data[i]) >= onsetThresh) {
            onsetIdx = Math.max(0, i - Math.floor(0.0015 * sr));
            break;
          }
        }

        // Calcula envelope RMS em janelas de 8ms para achar o núcleo denso da rufada
        const winSize = Math.max(64, Math.floor(0.008 * sr));
        let maxRms = 0;
        const rmsList = [];
        for (let start = onsetIdx; start + winSize <= len; start += winSize) {
          let sumSq = 0;
          for (let j = 0; j < winSize; j++) {
            const v = data[start + j];
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / winSize);
          if (rms > maxRms) maxRms = rms;
          rmsList.push({ start, end: start + winSize, rms });
        }

        // O corpo sustentável da rufada começa logo após o transiente inicial (~22ms após onset)
        let bodyStartIdx = Math.min(len - 1, onsetIdx + Math.floor(0.022 * sr));
        let bodyEndIdx = Math.min(len, onsetIdx + Math.floor(0.16 * sr));

        const bodyRmsThresh = maxRms * 0.36;
        for (let k = rmsList.length - 1; k >= 0; k--) {
          if (rmsList[k].rms >= bodyRmsThresh) {
            bodyEndIdx = rmsList[k].end;
            break;
          }
        }

        const minBodySamples = Math.floor(0.05 * sr);
        if (bodyEndIdx - bodyStartIdx < minBodySamples) {
          bodyStartIdx = Math.min(len - 1, onsetIdx + Math.floor(0.015 * sr));
          bodyEndIdx = Math.min(len, Math.max(bodyStartIdx + minBodySamples, Math.floor(len * 0.65)));
        }

        const info = { onsetIdx, bodyStartIdx, bodyEndIdx, sr, len };
        this.rufadaAnalysisCache.set(buffer, info);
        return info;
      }

      /* Constrói um AudioBuffer contínuo unindo N células RF em sequência sem novo ataque e mantendo o rulo sustentado */
      buildExtendedRufadaBuffer(ctx, baseBuffer, durationSec, runCount = 1) {
        const { onsetIdx, bodyStartIdx, bodyEndIdx } = this.analyzeRufadaBuffer(baseBuffer);
        const sr = baseBuffer.sampleRate || 44100;
        const numCh = baseBuffer.numberOfChannels || 1;
        const srcLen = baseBuffer.length;

        const safeDurSec = Math.max(0.045, durationSec || 0.11);
        const sustainSamples = Math.max(Math.floor(0.045 * sr), Math.floor(safeDurSec * sr));
        // Quando 2 ou mais RF estão em sequência, preserva a cauda natural ao final da última nota
        const releaseSamples = runCount >= 2 ? Math.floor(0.065 * sr) : Math.floor(0.026 * sr);
        const totalOutSamples = sustainSamples + releaseSamples;

        const outBuffer = ctx.createBuffer(numCh, totalOutSamples, sr);
        const bodyLen = Math.max(128, bodyEndIdx - bodyStartIdx);
        const xfadeLen = Math.min(Math.floor(0.016 * sr), Math.floor(bodyLen * 0.35));

        for (let ch = 0; ch < numCh; ch++) {
          const src = baseBuffer.getChannelData(ch);
          const out = outBuffer.getChannelData(ch);

          // 1. Copia o ataque inicial + primeiro ciclo do corpo da rufada
          const initialCopyLen = Math.min(totalOutSamples, Math.max(1, bodyEndIdx - onsetIdx));
          for (let i = 0; i < initialCopyLen; i++) {
            out[i] = src[Math.min(srcLen - 1, onsetIdx + i)];
          }

          let writePos = initialCopyLen;
          let cycleIdx = 0;

          // 2. Estende o corpo denso da rufada com crossfade de potência constante (cos/sin) sem emendas nem re-ataque
          while (writePos < sustainSamples && bodyLen > xfadeLen + 16) {
            // Pequeno deslocamento alternado para evitar repetição mecânica idêntica
            const jitter = (cycleIdx % 2 === 1 && bodyLen > xfadeLen * 2 + 64)
              ? Math.floor(bodyLen * 0.12)
              : 0;
            const segStart = bodyStartIdx + jitter;
            const segLen = Math.max(xfadeLen + 16, bodyEndIdx - segStart);

            // Crossfade suave sobre os últimos xfadeLen samples já escritos
            const fadeBase = Math.max(0, writePos - xfadeLen);
            const actualXfade = writePos - fadeBase;
            for (let k = 0; k < actualXfade; k++) {
              const theta = (k / Math.max(1, actualXfade)) * (Math.PI * 0.5);
              const wPrev = Math.cos(theta);
              const wNext = Math.sin(theta);
              out[fadeBase + k] = out[fadeBase + k] * wPrev + src[Math.min(srcLen - 1, segStart + k)] * wNext;
            }

            // Copia o restante do segmento do corpo
            for (let k = actualXfade; k < segLen && writePos < totalOutSamples; k++) {
              out[writePos++] = src[Math.min(srcLen - 1, segStart + k)];
            }
            cycleIdx++;
          }

          // 3. Preenche e aplica a cauda natural ao final da extensão total das rufadas
          for (let i = 0; i < releaseSamples; i++) {
            const pos = sustainSamples + i;
            if (pos >= totalOutSamples) break;
            if (pos >= writePos) {
              const tailSrcIdx = Math.min(srcLen - 1, bodyEndIdx + i);
              out[pos] = src[tailSrcIdx];
            }
            // Envelope de saída em cosseno suave para finalizar a rufada limpa
            const relEnv = 0.5 * (1 + Math.cos(Math.PI * (i / Math.max(1, releaseSamples))));
            out[pos] *= relEnv;
          }

          // 4. Quando duas ou mais rufadas RF estão unidas, aplica leve sustentação/crescendo orgânico de subida
          if (runCount >= 2) {
            for (let i = 0; i < sustainSamples; i++) {
              const prog = i / Math.max(1, sustainSamples);
              const swell = 0.95 + 0.12 * prog;
              out[i] *= swell;
            }
          }
        }

        return outBuffer;
      }

      playExtendedRufada(cfg, volMult = 1.0, durationSec = 0.11, runCount = 1, targetCtx = null, startTime = null) {
        this.init();
        const ctx = targetCtx || this.ctx;
        if (!ctx) return false;
        const url = typeof cfg === 'string' ? cfg : cfg.url;
        const volume = Math.min(2.0, (cfg.vol ?? 1.0) * volMult);
        const playbackRate = cfg.rate ?? 1.0;

        const baseBuffer = this.sampleBuffers[url];
        if (!baseBuffer) {
          this.loadSample(url, ctx);
          return false;
        }

        const now = ctx.currentTime;
        const t = startTime !== null ? Math.max(now, startTime) : (now + 0.003);

        if (cfg.chokeGroup) {
          const chokeMap = (ctx === this.ctx) ? this.activeChokeVoices : (ctx._activeChokeVoices = ctx._activeChokeVoices || {});
          const prev = chokeMap[cfg.chokeGroup];
          if (prev && prev.gainNode) {
            try {
              prev.gainNode.gain.cancelScheduledValues(t);
              prev.gainNode.gain.setValueAtTime(prev.gainNode.gain.value, t);
              prev.gainNode.gain.linearRampToValueAtTime(0.0001, t + 0.010);
              if (prev.source) prev.source.stop(t + 0.014);
            } catch (e) { }
          }
        }

        const extBuffer = this.buildExtendedRufadaBuffer(ctx, baseBuffer, durationSec * playbackRate, runCount);
        const source = ctx.createBufferSource();
        source.buffer = extBuffer;
        source.playbackRate.value = playbackRate;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(volume, t);

        const dest = this.getMasterDestination(ctx);
        gainNode.connect(dest);
        source.connect(gainNode);
        source.start(t);

        const voice = { source, gainNode, chokeGroup: cfg.chokeGroup };
        if (ctx === this.ctx) {
          this.activeVoices.push(voice);
          this.activeRufadaVoices.push(voice);
          source.onended = () => {
            const idxV = this.activeVoices.indexOf(voice);
            if (idxV !== -1) this.activeVoices.splice(idxV, 1);
            const idxR = this.activeRufadaVoices.indexOf(voice);
            if (idxR !== -1) this.activeRufadaVoices.splice(idxR, 1);
          };
          if (cfg.chokeGroup) {
            this.activeChokeVoices[cfg.chokeGroup] = voice;
          }
        }
        return true;
      }

      stopAll(fadeTimeSec = 0.012) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const voices = [
          ...(this.activeVoices || []),
          ...Object.values(this.activeChokeVoices || {}),
          ...(this.activeRufadaVoices || [])
        ];
        const seen = new Set();
        voices.forEach(v => {
          if (!v || seen.has(v)) return;
          seen.add(v);
          try {
            if (v.gainNode) {
              v.gainNode.gain.cancelScheduledValues(now);
              v.gainNode.gain.setValueAtTime(v.gainNode.gain.value, now);
              v.gainNode.gain.linearRampToValueAtTime(0.0001, now + fadeTimeSec);
            }
            if (v.source) {
              v.source.stop(now + fadeTimeSec + 0.004);
            }
          } catch (e) { }
        });
        this.activeVoices = [];
        this.activeChokeVoices = {};
        this.activeRufadaVoices = [];
      }

      stopActiveRufadas() {
        this.stopAll();
      }

      /* =======================================================================
         SÍNTESE PROCEDURAL DE ALTA FIDELIDADE (ZERO LATÊNCIA E NUNCA FALHA)
         Garante áudio perfeito e encorpado para TODOS os 8 naipes da bateria.
         ======================================================================= */
      playFallbackInstrument(instrumentId, articulationId, volMult = 1.0, startTime = null, durationSec = null, runCount = 1) {
        this.init();
        const ctx = this.ctx;
        if (!ctx) return;

        const now = ctx.currentTime;
        const t = startTime !== null ? Math.max(now, startTime) : (now + 0.003);
        const vol = Math.min(1.8, Math.max(0.1, volMult));

        const outDest = this.getMasterDestination(ctx);

        // Helper para ruído percussivo (esteira de caixa, ganzá, estalo de repique)
        const playNoise = (filterFreq, durationSec, gainAmt = 0.7, filterType = 'bandpass', qVal = 1.5) => {
          try {
            if (!this.noiseBuffer) this.initNoiseBuffer();
            const noise = ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            noise.loop = true;

            const filter = ctx.createBiquadFilter();
            filter.type = filterType;
            filter.frequency.setValueAtTime(filterFreq, t);
            filter.Q.value = qVal;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(gainAmt * vol, t);
            gain.gain.linearRampToValueAtTime(0.0001, t + durationSec);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(outDest);

            noise.start(t);
            noise.stop(t + durationSec + 0.02);

            const v = { source: noise, gainNode: gain };
            this.activeVoices.push(v);
            noise.onended = () => {
              const idx = this.activeVoices.indexOf(v);
              if (idx !== -1) this.activeVoices.splice(idx, 1);
            };
          } catch (e) { }
        };

        // Helper para tom percussivo ressonante de metal/pele
        const playTone = (startFreq, endFreq, durationSec, gainAmt = 0.8, oscType = 'triangle') => {
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = oscType;
            osc.frequency.setValueAtTime(startFreq, t);
            if (endFreq && endFreq !== startFreq) {
              osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + durationSec * 0.4);
            }
            gain.gain.setValueAtTime(gainAmt * vol, t);
            gain.gain.linearRampToValueAtTime(0.0001, t + durationSec);

            osc.connect(gain);
            gain.connect(outDest);
            osc.start(t);
            osc.stop(t + durationSec + 0.02);

            const v = { source: osc, gainNode: gain };
            this.activeVoices.push(v);
            osc.onended = () => {
              const idx = this.activeVoices.indexOf(v);
              if (idx !== -1) this.activeVoices.splice(idx, 1);
            };
          } catch (e) { }
        };

        // Helper para campanas/sinos metálicos harmônicos (Agogô)
        const playBell = (fundamentalFreq, durationSec = 0.35, gainAmt = 0.75) => {
          try {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(fundamentalFreq, t);

            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(fundamentalFreq * 2.02, t);

            gain.gain.setValueAtTime(gainAmt * vol, t);
            gain.gain.linearRampToValueAtTime(0.0001, t + durationSec);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(outDest);

            osc1.start(t);
            osc2.start(t);
            osc1.stop(t + durationSec + 0.02);
            osc2.stop(t + durationSec + 0.02);

            const v1 = { source: osc1, gainNode: gain };
            const v2 = { source: osc2, gainNode: gain };
            this.activeVoices.push(v1, v2);
            osc1.onended = () => {
              const idx = this.activeVoices.indexOf(v1);
              if (idx !== -1) this.activeVoices.splice(idx, 1);
            };
            osc2.onended = () => {
              const idx = this.activeVoices.indexOf(v2);
              if (idx !== -1) this.activeVoices.splice(idx, 1);
            };
          } catch (e) { }
        };

        switch (instrumentId) {
          case 'surdo1': {
            const isMuted = articulationId === 'abafado' || articulationId === 'mao';
            const dur = isMuted ? 0.14 : 0.65;
            playTone(95, 58, dur, 1.0, 'sine');
            playTone(190, 116, dur * 0.7, 0.5, 'triangle');
            playNoise(250, 0.03, 0.4, 'lowpass', 1.0);
            break;
          }

          case 'surdo2': {
            const isMuted = articulationId === 'abafado' || articulationId === 'mao';
            const dur = isMuted ? 0.14 : 0.55;
            playTone(135, 82, dur, 0.95, 'sine');
            playTone(270, 164, dur * 0.7, 0.45, 'triangle');
            playNoise(320, 0.03, 0.35, 'lowpass', 1.0);
            break;
          }

          case 'surdo3': {
            const isCut = articulationId === 'corte';
            const isAro = articulationId === 'aro';
            if (isAro) {
              playTone(1100, 950, 0.08, 0.85, 'square');
              playNoise(2800, 0.04, 0.5, 'bandpass', 2.0);
              return;
            }
            const dur = isCut ? 0.08 : (articulationId === 'abafado' ? 0.15 : 0.45);
            playTone(175, 115, dur, 0.95, 'sine');
            playTone(350, 230, dur * 0.6, 0.4, 'triangle');
            playNoise(450, 0.03, 0.4, 'lowpass', 1.0);
            break;
          }

          case 'caixa': {
            const isRim = articulationId === 'ringshot';
            const isGhost = articulationId === 'fraco';
            const isRufado = articulationId === 'rufado';
            if (isRufado) {
              const dur = Math.max(0.08, durationSec || (runCount >= 2 ? 0.22 : 0.14));
              playTone(240, 160, dur * 0.7, 0.75, 'triangle');
              playNoise(3400, dur, 0.9, 'bandpass', 1.4);
              break;
            }
            const dur = isGhost ? 0.07 : (isRim ? 0.20 : 0.15);
            const amt = isGhost ? 0.35 : (isRim ? 1.1 : 0.85);

            playTone(isRim ? 320 : 220, 140, dur * 0.6, amt * 0.6, 'triangle');
            playNoise(isRim ? 3400 : 2800, dur, amt * 0.9, 'bandpass', 1.4);
            if (isRim) {
              playTone(1250, 900, 0.06, 0.7, 'sine');
            }
            break;
          }

          case 'repique': {
            const isRim = articulationId === 'ringshot';
            const isOpenMao = articulationId === 'open';
            const isRufado = articulationId === 'rufado';
            if (isRufado) {
              const dur = Math.max(0.08, durationSec || (runCount >= 2 ? 0.22 : 0.14));
              playTone(480, 360, dur * 0.7, 0.8, 'triangle');
              playNoise(3800, dur, 0.85, 'bandpass', 1.8);
              break;
            }

            if (isOpenMao) {
              playTone(410, 360, 0.32, 0.9, 'sine');
              playTone(820, 720, 0.20, 0.4, 'triangle');
            } else if (isRim) {
              playTone(1500, 1200, 0.12, 1.0, 'triangle');
              playTone(460, 380, 0.15, 0.7, 'sine');
              playNoise(3800, 0.08, 0.8, 'bandpass', 2.0);
            } else {
              playTone(450, 370, 0.18, 0.85, 'triangle');
              playTone(900, 740, 0.10, 0.4, 'sine');
              playNoise(2200, 0.04, 0.45, 'bandpass', 1.2);
            }
            break;
          }

          case 'tamborim': {
            const isAro = articulationId === 'aro';
            if (isAro) {
              playTone(2200, 1800, 0.05, 0.85, 'square');
              return;
            }
            const isForte = articulationId === 'forte';
            const isFraco = articulationId === 'fraco';
            const dur = isFraco ? 0.04 : (isForte ? 0.08 : 0.06);
            const amt = isFraco ? 0.4 : (isForte ? 1.0 : 0.75);

            playTone(1080, 920, dur, amt, 'triangle');
            playTone(2160, 1840, dur * 0.5, amt * 0.5, 'sine');
            playNoise(3800, 0.025, amt * 0.6, 'highpass', 1.8);
            break;
          }

          case 'agogo': {
            const agogoFreqs = {
              boca1: 523,
              boca2: 659,
              boca3: 830,
              boca4: 1046
            };
            const f = agogoFreqs[articulationId] || 659;
            playBell(f, 0.35, 0.85);
            break;
          }

          case 'ganza': {
            const isForte = articulationId === 'forte' || articulationId === 'frente';
            const dur = isForte ? 0.09 : 0.055;
            const amt = isForte ? 0.85 : 0.5;
            playNoise(5200, dur, amt, 'highpass', 1.2);
            break;
          }
        }
      }

      playMetronome(isDownbeat, startTime = null) {
        this.init();
        const ctx = this.ctx;
        if (!ctx) return;
        const now = ctx.currentTime;
        const t = startTime !== null ? Math.max(now, startTime) : now;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(isDownbeat ? 1200 : 800, t);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
      }

      triggerInstrument(instrumentId, articulationId, volMult = 1.0, startTime = null, durationSec = null, runCount = 1, targetCtx = null) {
        this.init();
        const ctx = targetCtx || this.ctx;
        const key = `${instrumentId}:${articulationId}`;
        const cfg = this.sampleConfig[key];

        // Se for rufada (RF) na caixa ou no repique, usa motor de extensão contínua de rufada
        if (articulationId === 'rufado' && (instrumentId === 'caixa' || instrumentId === 'repique')) {
          const dur = durationSec || 0.12;
          if (cfg && this.playExtendedRufada(cfg, volMult, dur, runCount, ctx, startTime)) {
            return;
          }
        } else {
          // Se o sample real já estiver carregado, toca o sample de estúdio normal
          if (cfg && this.playSample(cfg, volMult, ctx, startTime)) {
            return;
          }
        }

        // Caso o sample ainda não tenha terminado de decodificar ou falhe,
        // dispara imediatamente a síntese procedural fiel para nunca haver atraso ou silêncio!
        this.playFallbackInstrument(instrumentId, articulationId, volMult, startTime, durationSec, runCount);
      }

      /* Renderiza a sequência programada em um Blob WAV estéreo usando OfflineAudioContext */
      async renderSequenceToWavBlob(seqState, instrumentsList, totalSteps, stepsPerMeasure) {
        this.init();
        await this.preloadSamples();

        const beatsPerMeasure = seqState.meter === '2/4' ? 2 : 4;
        const stepsPerBeat = stepsPerMeasure / beatsPerMeasure;
        const beatDurationSec = 60 / seqState.bpm;
        const totalBeats = Math.round(totalSteps / stepsPerBeat);
        const loopDurationSec = totalBeats * beatDurationSec;

        const sampleRate = 44100;
        const totalFrames = Math.max(1, Math.ceil(loopDurationSec * sampleRate));
        const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const offlineCtx = new OfflineCtx(2, totalFrames, sampleRate);

        const hasAnySolo = Object.values(seqState.solos).some(v => v === true);

        for (let s = 0; s < totalSteps; s++) {
          const globalBeatIdx = Math.floor(s / stepsPerBeat);
          const offsetInBeat = s % stepsPerBeat;
          const rawTuplet = seqState.beatTuplets?.[globalBeatIdx];
          const tuplet = (rawTuplet === 6 && seqState.subdivision !== 'fusa') ? 3 : (rawTuplet || null);
          const activeStepsInBeat = tuplet || stepsPerBeat;
          if (offsetInBeat >= activeStepsInBeat) continue;

          const stepTime = (globalBeatIdx * beatDurationSec) + (offsetInBeat * (beatDurationSec / activeStepsInBeat));
          instrumentsList.forEach(inst => {
            if (seqState.mutes[inst.id]) return;
            if (hasAnySolo && !seqState.solos[inst.id]) return;
            const note = seqState.gridData[inst.id]?.[s];
            if (!note) return;

            const cfg = this.sampleConfig[`${inst.id}:${note}`];
            const baseVol = seqState.volumes[inst.id] ?? 1.0;
            const meta = seqState.stepMeta?.[inst.id]?.[s];
            const velMult = computeStepVelMultiplier(note, meta);
            const volMult = baseVol * velMult;
            if (cfg && volMult > 0) {
              if (note === 'rufado' && (inst.id === 'caixa' || inst.id === 'repique')) {
                const runInfo = getRufadaRunInfo(seqState.gridData[inst.id], s, totalSteps);
                if (runInfo.isRufado && !runInfo.isStart) {
                  return; // Já renderizada na primeira nota da sequência contínua
                }
                const dur = runInfo.durationSec || (beatDurationSec / activeStepsInBeat);
                this.triggerInstrument(inst.id, note, volMult, stepTime, dur, runInfo.count || 1, offlineCtx);
              } else {
                this.playSample(cfg, volMult, offlineCtx, stepTime);
              }
            }
          });
        }

        const renderedBuffer = await offlineCtx.startRendering();

        // Limiter/Ceiling de segurança (-0.35 dBFS / 0.96) para prevenir inter-sample clipping no arquivo de áudio
        let maxPeak = 0;
        for (let c = 0; c < renderedBuffer.numberOfChannels; c++) {
          const chData = renderedBuffer.getChannelData(c);
          for (let i = 0; i < chData.length; i++) {
            const abs = Math.abs(chData[i]);
            if (abs > maxPeak) maxPeak = abs;
          }
        }
        if (maxPeak > 0.96) {
          const ceilingGain = 0.96 / maxPeak;
          for (let c = 0; c < renderedBuffer.numberOfChannels; c++) {
            const chData = renderedBuffer.getChannelData(c);
            for (let i = 0; i < chData.length; i++) {
              chData[i] *= ceilingGain;
            }
          }
        }

        const wavBlob = this.encodeAudioBufferToWav(renderedBuffer);
        return { wavBlob, durationSec: loopDurationSec };
      }

      playPreRollClick(beatIndex, isDownbeat = false) {
        if (!this.ctx) this.init();
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isDownbeat ? 1400 : 950, ctx.currentTime);
        gain.gain.setValueAtTime(0.75, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.09);
      }

      encodeAudioBufferToWav(audioBuffer) {
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
    }
