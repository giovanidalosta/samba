    /* =========================================================================
       1. DEFINIÇÃO DE INSTRUMENTOS, ARTICULAÇÕES E CORES (PALETA MATTE NAUMTERIA)
       ========================================================================= */
    const INSTRUMENTS = [
      {
        id: 'surdo1',
        name: 'Surdo de 1ª',
        category: 'Surdos',
        sub: 'Marcação Grave (Tempo 2 • 22"/24")',
        color: '#C84B4B',
        articulations: [
          { id: 'aberto', name: 'Toque Aberto (Marcação)', label: 'AB', css: 'note-aberto' },
          { id: 'mao', name: 'Mão na Pele (Apoio Suave)', label: 'MP', css: 'note-mao' },
          { id: 'abafado', name: 'Toque Abafado (Seco)', label: 'AF', css: 'note-abafado' }
        ]
      },
      {
        id: 'surdo2',
        name: 'Surdo de 2ª',
        category: 'Surdos',
        sub: 'Resposta Médio (Tempo 1 • 20"/22")',
        color: '#D4843E',
        articulations: [
          { id: 'aberto', name: 'Toque Aberto (Resposta)', label: 'AB', css: 'note-aberto' },
          { id: 'mao', name: 'Mão na Pele (Apoio Suave)', label: 'MP', css: 'note-mao' },
          { id: 'abafado', name: 'Toque Abafado (Seco)', label: 'AF', css: 'note-abafado' }
        ]
      },
      {
        id: 'surdo3',
        name: 'Surdo de 3ª',
        category: 'Surdos',
        sub: 'Centrador / Corte (16" / 18")',
        color: '#E8C31B',
        articulations: [
          { id: 'aberto', name: 'Toque Aberto', label: 'AB', css: 'note-aberto' },
          { id: 'abafado', name: 'Toque Abafado', label: 'AF', css: 'note-abafado' },
          { id: 'corte', name: 'Corte Seco', label: 'CT', css: 'note-corte' },
          { id: 'aro', name: 'Aro / Casco (Exclusivo 3ª)', label: 'AR', css: 'note-aro' },
          { id: 'rulo', name: 'Rulo / Subida (Exclusivo 3ª)', label: 'RL', css: 'note-rulo' }
        ]
      },
      {
        id: 'caixa',
        name: 'Caixa de Guerra',
        category: 'Caixas',
        sub: 'Com Esteira (14")',
        color: '#247BB8',
        articulations: [
          { id: 'forte', name: 'Toque Forte (Acento)', label: 'FT', css: 'note-forte' },
          { id: 'fraco', name: 'Toque Fraco (Fantasma)', label: 'FR', css: 'note-fraco' },
          { id: 'ringshot', name: 'Rimshot (Aro + Pele)', label: 'RS', css: 'note-ringshot' },
          { id: 'rufado', name: 'Rufado / Flam (Subida)', label: 'RF', css: 'note-rufado' }
        ]
      },
      {
        id: 'repique',
        name: 'Repique / Repinique',
        category: 'Repiques',
        sub: 'Baqueta e Mão (10" / 12")',
        color: '#3898A6',
        articulations: [
          { id: 'meio', name: 'Centro / Meio (Baqueta)', label: 'CE', css: 'note-meio' },
          { id: 'intermedio', name: 'Intermédio / Fraco (Baqueta)', label: 'FR', css: 'note-intermedio' },
          { id: 'ringshot', name: 'Rimshot (Estalo de Aro)', label: 'RS', css: 'note-ringshot' },
          { id: 'open', name: 'Mão Aberta (Ressonante)', label: 'MA', css: 'note-open' },
          { id: 'rufado', name: 'Rufado / Subida (Rulo)', label: 'RF', css: 'note-rufado' }
        ]
      },
      {
        id: 'tamborim',
        name: 'Tamborim',
        category: 'Agudos',
        sub: 'Baqueta de Nylon (6")',
        color: '#4A9E75',
        articulations: [
          { id: 'forte', name: 'Toque Forte (Acento)', label: 'FT', css: 'note-forte' },
          { id: 'medio', name: 'Toque Médio', label: 'MD', css: 'note-intermedio-ta' },
          { id: 'fraco', name: 'Toque Fraco (Fantasma)', label: 'FR', css: 'note-fraco' },
          { id: 'agudo', name: 'Nota Aguda (Dedo por Baixo)', label: 'AG', css: 'note-agudo-ta' }
        ]
      },
      {
        id: 'agogo',
        name: 'Agogô',
        category: 'Agudos',
        sub: '4 Bocas (Grave ao Agudo)',
        color: '#8868B8',
        articulations: [
          { id: 'boca1', name: 'Boca 1 (Mais Grave)', label: 'B1', css: 'note-boca1' },
          { id: 'boca2', name: 'Boca 2 (Médio-Grave)', label: 'B2', css: 'note-boca2' },
          { id: 'boca3', name: 'Boca 3 (Médio-Aguda)', label: 'B3', css: 'note-boca3' },
          { id: 'boca4', name: 'Boca 4 (Mais Aguda)', label: 'B4', css: 'note-boca4' }
        ]
      },
      {
        id: 'ganza',
        name: 'Ganzá / Chocalho',
        category: 'Agudos',
        sub: 'Rocar de Platinelas',
        color: '#B85D88',
        articulations: [
          { id: 'forte', name: 'Toque Forte (Acento)', label: 'FT', css: 'note-forte' },
          { id: 'fraco', name: 'Toque Fraco (Condução)', label: 'FR', css: 'note-fraco' }
        ]
      }
    ];

    /* =========================================================================
       1B. LEVADAS CARACTERÍSTICAS POR INSTRUMENTO (8 SUBDIVISÕES POR COMPASSO 2/4)
       ========================================================================= */
    // Metadados da Levada Base de Caixa (Império Serrano: acento/médio e dinâmica MIDI 0-127)
    const CAIXA_IMPERIO_SERRANO_STEPS = [
      { step: 0, tipo: 'acento', vel: 125 },
      { step: 1, tipo: 'medio', vel: 70 },
      { step: 2, tipo: 'acento', vel: 110 },
      { step: 3, tipo: 'acento', vel: 115 },
      { step: 4, tipo: 'medio', vel: 75 },
      { step: 5, tipo: 'medio', vel: 70 },
      { step: 6, tipo: 'acento', vel: 120 },
      { step: 7, tipo: 'medio', vel: 65 },
      { step: 8, tipo: 'acento', vel: 125 },
      { step: 9, tipo: 'medio', vel: 70 },
      { step: 10, tipo: 'acento', vel: 110 },
      { step: 11, tipo: 'acento', vel: 115 },
      { step: 12, tipo: 'medio', vel: 75 },
      { step: 13, tipo: 'medio', vel: 70 },
      { step: 14, tipo: 'acento', vel: 120 },
      { step: 15, tipo: 'medio', vel: 65 }
    ];

    const INSTRUMENT_GROOVES = {
      surdo1: [
        { id: 'surdo1_base', name: 'Levada Base — Surdo de 1ª', pattern: ['abafado', null, null, null, 'aberto', null, null, null] }
      ],
      surdo2: [
        { id: 'surdo2_base', name: 'Levada Base — Surdo de 2ª', pattern: ['aberto', null, null, null, 'abafado', null, null, null] }
      ],
      surdo3: [
        {
          id: 'surdo3_base',
          name: 'Levada Base — Surdo de 3ª (Naumteria)',
          pattern: [
            // Compasso 1
            'corte', null, null, null, 'aberto', null, 'aberto', null,
            // Compasso 2
            'corte', null, null, null, 'aberto', 'aberto', null, 'aberto',
            // Compasso 3
            'corte', null, null, null, 'aberto', null, 'aberto', null,
            // Compasso 4
            'corte', null, 'aberto', null, 'corte', 'aberto', 'corte', 'aberto'
          ]
        }
      ],
      caixa: [
        {
          id: 'caixa_base',
          name: 'Levada Base — Caixa (Naumteria)',
          pattern: [
            // Compasso 1
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'forte', 'fraco',
            // Compasso 2
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'rufado', 'rufado', 'fraco',
            // Compasso 3
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'forte', 'fraco',
            // Compasso 4
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'rufado', 'fraco', 'fraco'
          ]
        }
      ],
      repique: [
        {
          id: 'naumteria_repique_base',
          name: 'Levada Base — Repique (Naumteria)',
          pattern: ['meio', 'intermedio', 'ringshot', 'open', 'meio', 'intermedio', 'ringshot', 'open']
        }
      ],
      tamborim: [
        {
          id: 'carreteiro',
          name: 'Levada Base — Tamborim (Carreteiro)',
          pattern: ['forte', 'medio', 'fraco', 'medio', 'forte', 'medio', 'fraco', 'medio']
        }
      ],
      agogo: [
        {
          id: 'naumteria_agogo_base',
          name: 'Levada Base — Agogô (Naumteria)',
          pattern: [
            // Compasso 1 & 2
            'boca1', null, null, 'boca1', 'boca3', null, 'boca4', null,
            'boca3', null, 'boca3', null, 'boca2', 'boca2', null, 'boca1',
            // Compasso 3 & 4
            null, 'boca1', null, 'boca1', 'boca3', null, 'boca4', null,
            'boca3', null, 'boca3', null, 'boca2', 'boca2', null, 'boca1'
          ]
        }
      ],
      ganza: [
        {
          id: 'ganza_base',
          name: 'Levada Base — Ganzá (Condução)',
          pattern: ['forte', 'fraco', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'fraco']
        }
      ]
    };

    /* =========================================================================
       1C. PRESETS DE BATERIA COMPLETA E BREQUES (MÚLTIPLOS COMPASSOS)
       ========================================================================= */
    const BATERIA_PRESETS = {
      samba_reto_naumteria: {
        name: 'Samba Reto Naumteria',
        measures: 4,
        bpm: 130,
        volumes: {
          surdo1: 1.0,
          surdo2: 0.92,
          surdo3: 0.88,
          caixa: 1.05,
          repique: 0.92,
          tamborim: 0.98,
          agogo: 0.80,
          ganza: 0.68
        },
        tracks: {
          surdo1: [
            'abafado', null, null, null, 'aberto', null, null, null,
            'abafado', null, null, null, 'aberto', null, null, null,
            'abafado', null, null, null, 'aberto', null, null, null,
            'abafado', null, null, null, 'aberto', null, null, null
          ],
          surdo2: [
            'aberto', null, null, null, 'abafado', null, null, null,
            'aberto', null, null, null, 'abafado', null, null, null,
            'aberto', null, null, null, 'abafado', null, null, null,
            'aberto', null, null, null, 'abafado', null, null, null
          ],
          surdo3: [
            'corte', null, null, null, 'aberto', null, 'aberto', null,
            'corte', null, null, null, 'aberto', 'aberto', null, 'aberto',
            'corte', null, null, null, 'aberto', null, 'aberto', null,
            'corte', null, 'aberto', null, 'corte', 'aberto', 'corte', 'aberto'
          ],
          caixa: [
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'forte', 'fraco',
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'rufado', 'rufado', 'fraco',
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'forte', 'fraco',
            'forte', 'fraco', 'fraco', 'forte', 'fraco', 'rufado', 'fraco', 'fraco'
          ],
          repique: [
            'meio', 'intermedio', 'ringshot', 'open', 'meio', 'intermedio', 'ringshot', 'open',
            'meio', 'intermedio', 'ringshot', 'open', 'meio', 'intermedio', 'ringshot', 'open',
            'meio', 'intermedio', 'ringshot', 'open', 'meio', 'intermedio', 'ringshot', 'open',
            'meio', 'intermedio', 'ringshot', 'open', 'meio', 'intermedio', 'ringshot', 'open'
          ],
          tamborim: [
            'forte', 'medio', 'fraco', 'medio', 'forte', 'medio', 'fraco', 'medio',
            'forte', 'medio', 'fraco', 'medio', 'forte', 'medio', 'fraco', 'medio',
            'forte', 'medio', 'fraco', 'medio', 'forte', 'medio', 'fraco', 'medio',
            'forte', 'medio', 'fraco', 'medio', 'forte', 'medio', 'fraco', 'medio'
          ],
          agogo: [
            null, 'boca1', null, 'boca1', 'boca3', null, 'boca4', null,
            'boca3', null, 'boca3', null, 'boca2', 'boca2', null, 'boca1',
            null, 'boca1', null, 'boca1', 'boca3', null, 'boca4', null,
            'boca3', null, 'boca3', null, 'boca2', 'boca2', null, 'boca1'
          ],
          ganza: [
            'forte', 'fraco', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'fraco',
            'forte', 'fraco', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'fraco',
            'forte', 'fraco', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'fraco',
            'forte', 'fraco', 'fraco', 'fraco', 'forte', 'fraco', 'fraco', 'fraco'
          ]
        }
      }
    };
