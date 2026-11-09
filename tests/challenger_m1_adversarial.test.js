const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

describe('Milestone 1 Adversarial Challenge Suite', () => {
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

  // =========================================================================
  // Challenge 1: Rapid Track Addition and Deletion Stress Testing
  // =========================================================================
  describe('Challenge 1: Rapid Track Addition and Deletion', () => {
    it('Stress 1.1: Rapid addition up to cap (9 tracks) renders coherent TCPs with sequential numbering', async () => {
      const result = await session.evaluate(() => {
        const added = [];
        for (let i = 1; i <= 9; i++) {
          const t = window.BeatboxStudio.addTrack(`Faixa Stress ${i}`);
          added.push(t ? t.id : null);
        }
        window.BeatboxStudio.renderStudioViews();

        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        const numbers = rows.map(r => r.querySelector('.tcp-track-number')?.textContent?.trim());
        const names = rows.map(r => r.querySelector('.tcp-name-input')?.value);
        const heights = rows.map(r => r.getBoundingClientRect().height);

        return {
          totalAdded: added.filter(Boolean).length,
          rowCount: rows.length,
          numbers,
          names,
          minHeight: Math.min(...heights),
          maxHeight: Math.max(...heights)
        };
      });

      assert.equal(result.totalAdded, 9, 'Should add 9 tracks successfully');
      assert.equal(result.rowCount, 9, 'DOM must render 9 track rows');
      assert.deepEqual(
        result.numbers,
        ['01', '02', '03', '04', '05', '06', '07', '08', '09'],
        'Track numbers must be consecutive two-digit badges'
      );
      assert.ok(result.minHeight >= 60, `Track row height must be compact (~70px), got min ${result.minHeight}`);
    });

    it('Stress 1.2: Adding beyond 9-track limit rejects gracefully without crash or corrupted state', async () => {
      const result = await session.evaluate(() => {
        for (let i = 1; i <= 32; i++) {
          window.BeatboxStudio.addTrack(`Faixa ${i}`);
        }
        const excess1 = window.BeatboxStudio.addTrack('Faixa 33 Excesso');
        const excess2 = window.BeatboxStudio.addTrack('Faixa 34 Excesso');
        window.BeatboxStudio.renderStudioViews();

        const rows = document.querySelectorAll('.reaper-track-row');
        return {
          tenthResult: excess1,
          eleventhResult: excess2,
          rowCount: rows.length
        };
      });

      assert.equal(result.tenthResult, null, 'Overflow track add should return null');
      assert.equal(result.eleventhResult, null, 'Overflow track add should return null');
      assert.equal(result.rowCount, 32, 'Track row count must cap at max limit (32)');
    });

    it('Stress 1.3: Track addition with adversarial names (empty, whitespace, XSS injection, unicode)', async () => {
      const result = await session.evaluate(() => {
        window.BeatboxStudio.addTrack('');
        window.BeatboxStudio.addTrack('   ');
        window.BeatboxStudio.addTrack('<img src=x onerror=alert(1)>');
        window.BeatboxStudio.addTrack('🥁 Batucada 🇧🇷 𝄢');
        window.BeatboxStudio.renderStudioViews();

        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        const names = rows.map(r => r.querySelector('.tcp-name-input')?.value);

        return {
          names,
          rowCount: rows.length
        };
      });

      assert.equal(result.rowCount, 4, 'Must render 4 tracks');
      assert.equal(result.names[0], 'Faixa 1', 'Empty string must fall back to default name');
      assert.equal(result.names[1], 'Faixa 2', 'Whitespace-only string must fall back to default name');
      assert.equal(result.names[2], '<img src=x onerror=alert(1)>', 'XSS payload must be rendered as raw text value without execution');
      assert.equal(result.names[3], '🥁 Batucada 🇧🇷 𝄢', 'Unicode/emojis must be preserved');
    });

    it('Stress 1.4: Arbitrary sequence deletions (middle, selected, and down to zero)', async () => {
      const result = await session.evaluate(() => {
        const ids = [];
        for (let i = 1; i <= 5; i++) {
          const t = window.BeatboxStudio.addTrack(`Faixa ${i}`);
          ids.push(t.id);
        }
        window.BeatboxStudio.renderStudioViews();

        // 1. Delete middle track (Track 3)
        window.BeatboxStudio.removeTrack(ids[2]);

        const rowsAfterMiddle = Array.from(document.querySelectorAll('.reaper-track-row'));
        const numbersAfterMiddle = rowsAfterMiddle.map(r => r.querySelector('.tcp-track-number')?.textContent?.trim());

        // 2. Select Track 2 and delete it
        window.BeatboxStudio.selectTrack(ids[1]);
        window.BeatboxStudio.removeTrack(ids[1]);

        const remainingRows = Array.from(document.querySelectorAll('.reaper-track-row'));
        const remainingSelected = remainingRows.filter(r => r.classList.contains('is-selected'));

        // 3. Delete all remaining tracks down to 0
        const currentRemainingIds = remainingRows.map(r => r.id.replace('reaper_row_', ''));
        currentRemainingIds.forEach(id => window.BeatboxStudio.removeTrack(id));

        const rowsZero = document.querySelectorAll('.reaper-track-row');
        const emptyHero = document.querySelector('.studio-empty-project-hero');

        return {
          numbersAfterMiddle,
          countAfterMiddle: rowsAfterMiddle.length,
          remainingAfterSelectedDelete: remainingRows.length,
          hasSelectedTrack: remainingSelected.length === 1,
          zeroRowCount: rowsZero.length,
          hasEmptyHero: !!emptyHero
        };
      });

      assert.equal(result.countAfterMiddle, 4, 'Deleting middle track leaves 4 tracks');
      assert.deepEqual(result.numbersAfterMiddle, ['01', '02', '03', '04'], 'Track numbers must re-index to 01..04');
      assert.equal(result.remainingAfterSelectedDelete, 3, 'Deleting selected track leaves 3 tracks');
      assert.ok(result.hasSelectedTrack, 'A valid adjacent track should receive selection automatically');
      assert.equal(result.zeroRowCount, 0, 'Project reaches 0 tracks without error');
      assert.ok(result.hasEmptyHero, 'Empty project hero displayed when tracks reach 0');
    });
  });

  // =========================================================================
  // Challenge 2: Kebab Menu Click-Outside & Escape Dismiss
  // =========================================================================
  describe('Challenge 2: Kebab Context Menu Behavior', () => {
    it('Stress 2.1: Opening kebab menu on track B automatically closes kebab menu on track A', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Faixa A');
        window.BeatboxStudio.addTrack('Faixa B');
        window.BeatboxStudio.renderStudioViews();
      });

      const clickResultA = await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        const btnA = rows[0].querySelector('.tcp-btn-more');
        btnA.click();
        const menuA = rows[0].querySelector('.tcp-menu-dropdown');
        const menuB = rows[1].querySelector('.tcp-menu-dropdown');
        return {
          menuAVisible: menuA.style.display === 'block',
          menuBVisible: menuB.style.display === 'block'
        };
      });

      assert.ok(clickResultA.menuAVisible, 'Menu A must be open');
      assert.ok(!clickResultA.menuBVisible, 'Menu B must be closed');

      const clickResultB = await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        const btnB = rows[1].querySelector('.tcp-btn-more');
        btnB.click();
        const menuA = rows[0].querySelector('.tcp-menu-dropdown');
        const menuB = rows[1].querySelector('.tcp-menu-dropdown');
        return {
          menuAVisible: menuA.style.display === 'block',
          menuBVisible: menuB.style.display === 'block'
        };
      });

      assert.ok(!clickResultB.menuAVisible, 'Menu A must be closed after opening Menu B');
      assert.ok(clickResultB.menuBVisible, 'Menu B must now be open');
    });

    it('Stress 2.2: Clicking outside dismisses open kebab menu', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Faixa Dismiss 1');
        window.BeatboxStudio.renderStudioViews();
      });

      await session.evaluate(() => {
        const btn = document.querySelector('.tcp-btn-more');
        btn.click();
      });

      const openState = await session.evaluate(() => {
        const menu = document.querySelector('.tcp-menu-dropdown');
        return menu && menu.style.display === 'block';
      });
      assert.ok(openState, 'Menu should be open before click-outside');

      await session.click('.studio-toolbar');

      const closedState = await session.evaluate(() => {
        const menu = document.querySelector('.tcp-menu-dropdown');
        return menu.style.display === 'none';
      });
      assert.ok(closedState, 'Menu must be closed after clicking toolbar');
    });

    it('Stress 2.3: Pressing Escape dismisses open kebab menu', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Faixa Escape');
        window.BeatboxStudio.renderStudioViews();
      });

      await session.evaluate(() => {
        const btn = document.querySelector('.tcp-btn-more');
        btn.click();
      });

      const openState = await session.evaluate(() => {
        const menu = document.querySelector('.tcp-menu-dropdown');
        return menu && menu.style.display === 'block';
      });
      assert.ok(openState, 'Menu should be open');

      await session.dispatchKey('Escape', 'Escape');

      const closedState = await session.evaluate(() => {
        const menu = document.querySelector('.tcp-menu-dropdown');
        return menu.style.display === 'none';
      });
      assert.ok(closedState, 'Menu must close upon pressing Escape');
    });

    it('Stress 2.4: Duplicating track from kebab menu creates clone, closes menu, and preserves numbering', async () => {
      await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Lead Synth');
        t.offsetMs = 250;
        t.volume = 0.8;
        window.BeatboxStudio.renderStudioViews();
      });

      const dupResult = await session.evaluate(() => {
        const btnMore = document.querySelector('.tcp-btn-more');
        btnMore.click();
        const btnDup = document.querySelector('.tcp-menu-duplicate');
        btnDup.click();

        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        const names = rows.map(r => r.querySelector('.tcp-name-input')?.value);
        const numbers = rows.map(r => r.querySelector('.tcp-track-number')?.textContent?.trim());
        const openMenus = Array.from(document.querySelectorAll('.tcp-menu-dropdown')).filter(m => m.style.display === 'block');

        return {
          rowCount: rows.length,
          names,
          numbers,
          openMenuCount: openMenus.length
        };
      });

      assert.equal(dupResult.rowCount, 2, 'Should have 2 tracks after duplication');
      assert.equal(dupResult.names[1], 'Lead Synth (Cópia)', 'Cloned track name must include (Cópia)');
      assert.deepEqual(dupResult.numbers, ['01', '02'], 'Track numbers must re-index to 01, 02');
      assert.equal(dupResult.openMenuCount, 0, 'All dropdown menus must be closed after duplication');
    });
  });

  // =========================================================================
  // Challenge 3: Rapid Keyboard Navigation (ArrowUp / ArrowDown / KeyJ / KeyK)
  // =========================================================================
  describe('Challenge 3: Keyboard Track Navigation', () => {
    it('Stress 3.1: Rapid ArrowDown cycles through tracks and clamps at bottom', async () => {
      await session.evaluate(() => {
        for (let i = 1; i <= 5; i++) {
          window.BeatboxStudio.addTrack(`Faixa Nav ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();
      });

      await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        window.BeatboxStudio.selectTrack(rows[0].id.replace('reaper_row_', ''));
      });

      for (let i = 0; i < 6; i++) {
        await session.dispatchKey('ArrowDown', 'ArrowDown');
      }

      const finalState = await session.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        const selectedIdx = rows.findIndex(r => r.classList.contains('is-selected'));
        const selectedCount = rows.filter(r => r.classList.contains('is-selected')).length;
        return {
          selectedIdx,
          selectedCount
        };
      });

      assert.equal(finalState.selectedCount, 1, 'Exactly one track must be selected');
      assert.equal(finalState.selectedIdx, 4, 'Selection must clamp at last track (index 4)');
    });

    it('Stress 3.2: Rapid ArrowUp cycles back to top track and clamps at index 0', async () => {
      await session.evaluate(() => {
        for (let i = 1; i <= 4; i++) {
          window.BeatboxStudio.addTrack(`Faixa Up ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();
      });

      await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        window.BeatboxStudio.selectTrack(rows[3].id.replace('reaper_row_', ''));
      });

      for (let i = 0; i < 5; i++) {
        await session.dispatchKey('ArrowUp', 'ArrowUp');
      }

      const finalState = await session.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        const selectedIdx = rows.findIndex(r => r.classList.contains('is-selected'));
        const selectedCount = rows.filter(r => r.classList.contains('is-selected')).length;
        return {
          selectedIdx,
          selectedCount
        };
      });

      assert.equal(finalState.selectedCount, 1, 'Exactly one track must be selected');
      assert.equal(finalState.selectedIdx, 0, 'Selection must clamp at top track (index 0)');
    });

    it('Stress 3.3: Vim-style navigation (KeyJ down, KeyK up)', async () => {
      await session.evaluate(() => {
        for (let i = 1; i <= 3; i++) {
          window.BeatboxStudio.addTrack(`Faixa Vim ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();
      });

      await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row');
        window.BeatboxStudio.selectTrack(rows[0].id.replace('reaper_row_', ''));
      });

      await session.dispatchKey('KeyJ', 'j');
      await session.dispatchKey('KeyJ', 'j');

      const afterJ = await session.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        return rows.findIndex(r => r.classList.contains('is-selected'));
      });
      assert.equal(afterJ, 2, 'KeyJ must move selection down to index 2');

      await session.dispatchKey('KeyK', 'k');

      const afterK = await session.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        return rows.findIndex(r => r.classList.contains('is-selected'));
      });
      assert.equal(afterK, 1, 'KeyK must move selection up to index 1');
    });

    it('Stress 3.4: Input focus immunity — keyboard navigation disabled when typing in inputs', async () => {
      await session.evaluate(() => {
        const t1 = window.BeatboxStudio.addTrack('Faixa Imune 1');
        window.BeatboxStudio.addTrack('Faixa Imune 2');
        window.BeatboxStudio.selectTrack(t1.id);
        window.BeatboxStudio.renderStudioViews();
      });

      // Focus input on track 1
      await session.evaluate(() => {
        const input = document.querySelector('.tcp-name-input');
        input.focus();
      });

      await session.dispatchKey('ArrowDown', 'ArrowDown');

      const stateAfter = await session.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.reaper-track-row'));
        return {
          activeElementTag: document.activeElement.tagName,
          selectedIdx: rows.findIndex(r => r.classList.contains('is-selected'))
        };
      });

      assert.equal(stateAfter.activeElementTag, 'INPUT', 'Focus should remain in input');
      assert.equal(stateAfter.selectedIdx, 0, 'Selection must not change when typing inside input');
    });
  });

  // =========================================================================
  // Challenge 4: Sticky Layout Under Simulated Zoom & Scroll
  // =========================================================================
  describe('Challenge 4: Sticky Layout Under Zoom & Scroll', () => {
    it('Stress 4.1: Desktop computed sticky CSS properties and z-index stacking', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Faixa Sticky 1');
        window.BeatboxStudio.renderStudioViews();
      });

      const styles = await session.evaluate(() => {
        const tcp = document.querySelector('.reaper-tcp');
        const tcpCorner = document.querySelector('.reaper-tcp-corner');
        const ruler = document.querySelector('.reaper-ruler-header');

        const csTcp = window.getComputedStyle(tcp);
        const csCorner = window.getComputedStyle(tcpCorner);
        const csRuler = window.getComputedStyle(ruler);

        return {
          tcpPosition: csTcp.position,
          tcpLeft: csTcp.left,
          tcpZIndex: parseInt(csTcp.zIndex, 10),
          cornerPosition: csCorner.position,
          cornerLeft: csCorner.left,
          cornerZIndex: parseInt(csCorner.zIndex, 10),
          rulerPosition: csRuler.position,
          rulerTop: csRuler.top,
          rulerZIndex: parseInt(csRuler.zIndex, 10)
        };
      });

      assert.equal(styles.tcpPosition, 'sticky', '.reaper-tcp must be position: sticky');
      assert.equal(styles.tcpLeft, '0px', '.reaper-tcp must have left: 0px');
      assert.ok(styles.tcpZIndex >= 25, `.reaper-tcp z-index must be >= 25, got ${styles.tcpZIndex}`);

      assert.equal(styles.cornerPosition, 'sticky', '.reaper-tcp-corner must be position: sticky');
      assert.equal(styles.cornerLeft, '0px', '.reaper-tcp-corner must have left: 0px');
      assert.ok(styles.cornerZIndex >= 25, `.reaper-tcp-corner z-index must be >= 25, got ${styles.cornerZIndex}`);

      assert.equal(styles.rulerPosition, 'sticky', '.reaper-ruler-header must be position: sticky');
      assert.equal(styles.rulerTop, '0px', '.reaper-ruler-header must have top: 0px');
      assert.ok(styles.rulerZIndex >= 30, `.reaper-ruler-header z-index must be >= 30, got ${styles.rulerZIndex}`);
    });

    it('Stress 4.2: Horizontal zoom & scroll preserves TCP visibility at left edge', async () => {
      await session.evaluate(() => {
        const t1 = window.BeatboxStudio.addTrack('Horizontal Scroll 1');
        t1.mediaUrl = 'blob:test1';
        t1.duration = 20.0;
        window.BeatboxStudio.renderStudioViews();
      });

      const stickyResult = await session.evaluate(() => {
        const scrollEl = document.getElementById('reaperDawScroll');
        const btnZoomPlus = document.getElementById('btnZoomPlus');

        if (btnZoomPlus) {
          btnZoomPlus.click();
          btnZoomPlus.click();
          btnZoomPlus.click();
        }

        const tcp = document.querySelector('.reaper-tcp');
        const tcpRectBefore = tcp.getBoundingClientRect();
        const scrollContainerRect = scrollEl.getBoundingClientRect();

        scrollEl.scrollLeft = 400;
        const actualScroll = scrollEl.scrollLeft;
        const tcpRectAfter = tcp.getBoundingClientRect();

        return {
          actualScroll,
          scrollContainerLeft: scrollContainerRect.left,
          tcpLeftBefore: tcpRectBefore.left,
          tcpLeftAfter: tcpRectAfter.left,
          tcpWidth: tcpRectAfter.width
        };
      });

      assert.ok(stickyResult.actualScroll > 0, 'ScrollLeft must be greater than 0');
      const diff = Math.abs(stickyResult.tcpLeftAfter - stickyResult.tcpLeftBefore);
      assert.ok(diff <= 4, `TCP left edge must not move during horizontal scroll (drift: ${diff}px)`);
      assert.ok(stickyResult.tcpWidth >= 280, `TCP must maintain full width (~300px), got ${stickyResult.tcpWidth}`);
    });

    it('Stress 4.3: Vertical track scroll preserves Ruler header at top edge', async () => {
      await session.evaluate(() => {
        for (let i = 1; i <= 8; i++) {
          window.BeatboxStudio.addTrack(`Vertical Scroll ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();
      });

      const verticalResult = await session.evaluate(() => {
        const scrollEl = document.getElementById('reaperDawScroll');
        const ruler = document.querySelector('.reaper-ruler-header');
        const rulerRectBefore = ruler.getBoundingClientRect();

        scrollEl.scrollTop = 200;
        const actualScrollTop = scrollEl.scrollTop;
        const rulerRectAfter = ruler.getBoundingClientRect();

        return {
          actualScrollTop,
          rulerTopBefore: rulerRectBefore.top,
          rulerTopAfter: rulerRectAfter.top
        };
      });

      assert.ok(verticalResult.actualScrollTop > 0, 'ScrollTop must be greater than 0');
      const verticalDiff = Math.abs(verticalResult.rulerTopAfter - verticalResult.rulerTopBefore);
      assert.ok(verticalDiff <= 2, `Ruler header must remain sticky at top (drift: ${verticalDiff}px)`);
    });
  });

  // =========================================================================
  // Challenge 5: KeyS vs Alt+KeyS Shortcut Verification
  // =========================================================================
  describe('Challenge 5: KeyS vs Alt+KeyS Shortcut Verification', () => {
    it('Stress 5.1: Alt+KeyS toggles Solo on selected track without clip cut', async () => {
      await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Violão');
        t.mediaUrl = 'blob:violao';
        t.duration = 6.0;
        window.BeatboxStudio.renderStudioViews();
      });

      await session.dispatchKey('KeyS', 's', 1);

      const afterFirstAltS = await session.evaluate(() => {
        const row = document.querySelector('.reaper-track-row');
        const soloBtn = row.querySelector('.tcp-btn-solo');
        const isSoloed = row.classList.contains('is-soloed');
        const totalRows = document.querySelectorAll('.reaper-track-row').length;
        return {
          isSoloed,
          hasActiveClass: soloBtn.classList.contains('active'),
          totalRows
        };
      });

      assert.ok(afterFirstAltS.isSoloed, 'Track row must have .is-soloed class');
      assert.ok(afterFirstAltS.hasActiveClass, 'Solo button must have .active class');
      assert.equal(afterFirstAltS.totalRows, 1, 'Alt+S must not cut or split track');

      await session.dispatchKey('KeyS', 's', 1);

      const afterSecondAltS = await session.evaluate(() => {
        const row = document.querySelector('.reaper-track-row');
        const soloBtn = row.querySelector('.tcp-btn-solo');
        return {
          isSoloed: row.classList.contains('is-soloed'),
          hasActiveClass: soloBtn.classList.contains('active')
        };
      });

      assert.ok(!afterSecondAltS.isSoloed, 'Track row must not be soloed after second Alt+S');
      assert.ok(!afterSecondAltS.hasActiveClass, 'Solo button must not have .active class');
    });

    it('Stress 5.2: Plain KeyS triggers split / cut without activating Solo', async () => {
      await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Pandeiro');
        t.mediaUrl = 'blob:pandeiro';
        t.duration = 8.0;
        window.BeatboxStudio.renderStudioViews();
      });

      await session.dispatchKey('KeyS', 's', 0);

      const afterPlainS = await session.evaluate(() => {
        const row = document.querySelector('.reaper-track-row');
        const soloBtn = row.querySelector('.tcp-btn-solo');
        const isSoloed = row.classList.contains('is-soloed');
        const cutModalActive = document.getElementById('trackCutModal')?.classList.contains('active');
        return {
          isSoloed,
          hasActiveClass: soloBtn.classList.contains('active'),
          cutModalActive
        };
      });

      assert.ok(!afterPlainS.isSoloed, 'Plain KeyS must NOT solo the track');
      assert.ok(!afterPlainS.hasActiveClass, 'Plain KeyS must NOT activate the solo button');
      assert.ok(afterPlainS.cutModalActive, 'Plain KeyS outside clip bounds must open trackCutModal');

      // Dismiss modal
      await session.dispatchKey('Escape', 'Escape');
      const closedModal = await session.evaluate(() => !document.getElementById('trackCutModal')?.classList.contains('active'));
      assert.ok(closedModal, 'Modal must close on Escape');
    });

    it('Stress 5.3: Solo button title tooltip must accurately advertise [Alt+S]', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Cavaquinho');
        window.BeatboxStudio.renderStudioViews();
      });

      const tooltip = await session.evaluate(() => {
        const soloBtn = document.querySelector('.tcp-btn-solo');
        return soloBtn ? soloBtn.getAttribute('title') : null;
      });

      assert.ok(tooltip, 'Solo button must have a title tooltip');
      assert.ok(tooltip.includes('Alt+S'), `Tooltip should indicate Alt+S, got: "${tooltip}"`);
      assert.ok(!tooltip.match(/\[S\](?![\w+])/), `Tooltip must not indicate plain [S], got: "${tooltip}"`);
    });

    it('Stress 5.4: Keystroke safety — typing S or Alt+S in input does not trigger DAW actions', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Voz');
        window.BeatboxStudio.renderStudioViews();
      });

      await session.evaluate(() => {
        const input = document.querySelector('.tcp-name-input');
        input.focus();
      });

      await session.dispatchKey('KeyS', 's', 0);
      await session.dispatchKey('KeyS', 's', 1);

      const safetyResult = await session.evaluate(() => {
        const row = document.querySelector('.reaper-track-row');
        const cutModalActive = document.getElementById('trackCutModal')?.classList.contains('active');
        return {
          isSoloed: row.classList.contains('is-soloed'),
          cutModalActive
        };
      });

      assert.ok(!safetyResult.isSoloed, 'Typing in input must not trigger Solo');
      assert.ok(!safetyResult.cutModalActive, 'Typing in input must not trigger Cut modal');
    });
  });
});
