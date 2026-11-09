const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, stopSpawnedServer } = require('./harness.js');

describe('Milestone 1 Adversarial & Empirical Stress Verification', () => {
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
  // Challenge Dimension 1: Rapid Track Addition and Deletion Stress Testing
  // =========================================================================
  describe('Dimension 1: Rapid Track Addition & Deletion Stress', () => {
    it('1.1 should rapidly create 8 tracks with correct 01..08 indices and clean TCP structure', async () => {
      const result = await session.evaluate(() => {
        const addedIds = [];
        for (let i = 1; i <= 8; i++) {
          const t = window.BeatboxStudio.addTrack(`Stress Track ${i}`);
          if (t) addedIds.push(t.id);
        }
        window.BeatboxStudio.renderStudioViews();

        const rows = document.querySelectorAll('.reaper-track-row');
        const indices = Array.from(document.querySelectorAll('.tcp-track-number')).map(el => el.textContent.trim());
        const redundantNudges = document.querySelectorAll('.reaper-tcp .tcp-sync-btn, .reaper-tcp [data-delta]').length;
        const redundantRecs = document.querySelectorAll('.reaper-tcp .btn-tcp-rec').length;
        const syncPills = document.querySelectorAll('.reaper-tcp .tcp-sync-pill').length;

        return {
          addedCount: addedIds.length,
          rowCount: rows.length,
          indices,
          redundantNudges,
          redundantRecs,
          syncPills
        };
      });

      assert.equal(result.addedCount, 8, 'Must successfully add 8 tracks rapidly');
      assert.equal(result.rowCount, 8, 'Must render exactly 8 track rows');
      assert.deepEqual(result.indices, ['01', '02', '03', '04', '05', '06', '07', '08'], 'Track badges must be formatted 01 through 08');
      assert.equal(result.redundantNudges, 0, 'No redundant discrete nudge buttons (-50, +50) in any TCP');
      assert.equal(result.redundantRecs, 0, 'No redundant quick rec buttons in any TCP');
      assert.equal(result.syncPills, 8, 'All 8 TCPs must feature a compact sync pill');
    });

    it('1.2 should gracefully handle track limit boundary (32nd allowed, 33rd rejected without crash)', async () => {
      const boundaryResult = await session.evaluate(() => {
        // Fill up to max limit (32)
        for (let i = 1; i <= 32; i++) {
          window.BeatboxStudio.addTrack(`Track ${i}`);
        }
        const countAtMax = document.querySelectorAll('.reaper-track-row').length;

        // Try adding beyond limit
        const overflow = window.BeatboxStudio.addTrack('Track 33 - Overflow');
        const countAfterAttempt = document.querySelectorAll('.reaper-track-row').length;

        return {
          countAtMax,
          overflowIsNull: overflow === null,
          countAfterAttempt
        };
      });

      assert.equal(boundaryResult.countAtMax, 32, 'Project must support up to 32 tracks');
      assert.equal(boundaryResult.overflowIsNull, true, 'Track beyond limit must return null');
      assert.equal(boundaryResult.countAfterAttempt, 32, 'DOM row count must remain 32 without crashing');
    });

    it('1.3 should handle rapid deletion of selected track without dangling references or errors', async () => {
      const res = await session.evaluate(() => {
        const t1 = window.BeatboxStudio.addTrack('Alpha');
        const t2 = window.BeatboxStudio.addTrack('Beta');
        const t3 = window.BeatboxStudio.addTrack('Gamma');
        window.BeatboxStudio.renderStudioViews();

        // Select middle track Beta
        window.BeatboxStudio.selectTrack(t2.id);

        // Delete selected track
        window.BeatboxStudio.removeTrack(t2.id);

        const rowsAfter = Array.from(document.querySelectorAll('.reaper-track-row')).map(r => r.id);
        const selectedRow = document.querySelector('.reaper-track-row.is-selected');

        return {
          rowIds: rowsAfter,
          selectedRowId: selectedRow ? selectedRow.id : null
        };
      });

      assert.equal(res.rowIds.length, 2, 'Must have 2 tracks remaining');
      assert.ok(!res.rowIds.includes('reaper_row_Beta'), 'Deleted track row must be removed');
      // Visual selection should transfer to an existing track (Alpha or Gamma)
      assert.ok(res.selectedRowId !== null, 'A valid surviving track must be selected');
    });

    it('1.4 should handle rapid deletion down to 0 tracks and survive keyboard navigation without error', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('T1');
        window.BeatboxStudio.addTrack('T2');
        window.BeatboxStudio.renderStudioViews();
        // Remove all
        const allIds = Array.from(document.querySelectorAll('.reaper-track-row')).map(r => r.id.replace('reaper_row_', ''));
        allIds.forEach(id => window.BeatboxStudio.removeTrack(id));
      });

      const zeroCount = await session.evaluate(() => document.querySelectorAll('.reaper-track-row').length);
      assert.equal(zeroCount, 0, 'Tracks stack must have 0 rows');

      // Dispatch ArrowDown / ArrowUp when 0 tracks exist — should not throw or crash
      await session.dispatchKey('ArrowDown', 'ArrowDown');
      await session.dispatchKey('ArrowUp', 'ArrowUp');

      // Now re-add a track after reaching 0
      const readdResult = await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Fresh Track');
        window.BeatboxStudio.renderStudioViews();
        const badge = document.querySelector('.tcp-track-number');
        const isSel = document.querySelector('.reaper-track-row').classList.contains('is-selected');
        return {
          badgeText: badge ? badge.textContent.trim() : null,
          isSelected: isSel
        };
      });

      assert.equal(readdResult.badgeText, '01', 'First track created after empty state must be indexed 01');
      assert.equal(readdResult.isSelected, true, 'Newly added track must be selected');
    });

    it('1.5 should duplicate track including state and insert duplicate immediately adjacent', async () => {
      const dupResult = await session.evaluate(() => {
        const t1 = window.BeatboxStudio.addTrack('Vocal Lead');
        const t2 = window.BeatboxStudio.addTrack('Backing Track');
        t1.volume = 0.85;
        t1.offsetMs = 120;
        window.BeatboxStudio.renderStudioViews();

        // Duplicate Vocal Lead
        const clone = window.BeatboxStudio.duplicateTrack(t1.id);
        const rows = Array.from(document.querySelectorAll('.reaper-track-row')).map(r => ({
          id: r.id,
          name: r.querySelector('.tcp-name-input').value
        }));

        return {
          cloneId: clone ? clone.id : null,
          cloneVolume: clone ? clone.volume : null,
          cloneOffset: clone ? clone.offsetMs : null,
          cloneName: clone ? clone.name : null,
          rowCount: rows.length,
          order: rows.map(r => r.name)
        };
      });

      assert.equal(dupResult.rowCount, 3, 'Duplication must increase track count to 3');
      assert.equal(dupResult.cloneName, 'Vocal Lead (Cópia)', 'Duplicate must be named with (Cópia)');
      assert.equal(dupResult.cloneVolume, 0.85, 'Duplicate must clone volume');
      assert.equal(dupResult.cloneOffset, 120, 'Duplicate must clone timeline offset');
      // Position order should be: Vocal Lead, Vocal Lead (Cópia), Backing Track
      assert.deepEqual(dupResult.order, ['Vocal Lead', 'Vocal Lead (Cópia)', 'Backing Track'], 'Duplicate must be inserted directly adjacent to source');
    });
  });

  // =========================================================================
  // Challenge Dimension 2: Kebab Menu Click-Outside & Escape Dismiss
  // =========================================================================
  describe('Dimension 2: Kebab Menu Interaction & Dismissal', () => {
    it('2.1 should toggle kebab menu open and closed when clicking the same ⋯ button', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Tamborim');
        window.BeatboxStudio.renderStudioViews();
      });

      // Click kebab button to open
      await session.click('.tcp-btn-more');
      let isVisible = await session.evaluate(() => {
        const menu = document.querySelector('.tcp-menu-dropdown');
        return menu && menu.style.display === 'block';
      });
      assert.equal(isVisible, true, 'First click on ⋯ must open dropdown');

      // Click kebab button again to close (toggle)
      await session.click('.tcp-btn-more');
      isVisible = await session.evaluate(() => {
        const menu = document.querySelector('.tcp-menu-dropdown');
        return menu && menu.style.display === 'none';
      });
      assert.equal(isVisible, true, 'Second click on ⋯ must close dropdown');
    });

    it('2.2 should dismiss open kebab menu when clicking outside on scroll container or track row', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Repique');
        window.BeatboxStudio.renderStudioViews();
      });

      // Open menu
      await session.click('.tcp-btn-more');
      let isOpen = await session.evaluate(() => {
        const menu = document.querySelector('.tcp-menu-dropdown');
        return menu && menu.style.display === 'block';
      });
      assert.equal(isOpen, true, 'Menu must be open');

      // Click outside: click on #reaperDawScroll
      await session.evaluate(() => {
        document.getElementById('reaperDawScroll').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await new Promise(r => setTimeout(r, 50));

      const isDismissed = await session.evaluate(() => {
        const menu = document.querySelector('.tcp-menu-dropdown');
        return menu && menu.style.display === 'none';
      });
      assert.equal(isDismissed, true, 'Clicking outside container must dismiss open kebab menu');
    });

    it('2.3 should dismiss open kebab menu when pressing Escape key', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Cuíca');
        window.BeatboxStudio.renderStudioViews();
      });

      // Open menu
      await session.click('.tcp-btn-more');
      let isOpen = await session.evaluate(() => {
        const menu = document.querySelector('.tcp-menu-dropdown');
        return menu && menu.style.display === 'block';
      });
      assert.equal(isOpen, true, 'Menu must be open');

      // Dispatch Escape key
      await session.dispatchKey('Escape', 'Escape');
      await new Promise(r => setTimeout(r, 50));

      const isDismissed = await session.evaluate(() => {
        const menu = document.querySelector('.tcp-menu-dropdown');
        return menu && menu.style.display === 'none';
      });
      assert.equal(isDismissed, true, 'Pressing Escape must dismiss open kebab menu');
    });

    it('2.4 should enforce mutual exclusivity: opening Track 2 menu must close Track 1 menu', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Agogô 1');
        window.BeatboxStudio.addTrack('Agogô 2');
        window.BeatboxStudio.renderStudioViews();
      });

      // Open Track 1 menu
      const moreBtns = await session.evaluate(() => {
        return Array.from(document.querySelectorAll('.tcp-btn-more')).map(b => b.dataset.id);
      });
      assert.equal(moreBtns.length, 2);

      await session.click(`button.tcp-btn-more[data-id="${moreBtns[0]}"]`);
      let menu1State = await session.evaluate((id) => {
        const m = document.getElementById(`tcp_menu_${id}`);
        return m ? m.style.display : null;
      }, moreBtns[0]);
      assert.equal(menu1State, 'block', 'Track 1 menu must be open');

      // Click Track 2 kebab button
      await session.click(`button.tcp-btn-more[data-id="${moreBtns[1]}"]`);
      const menusState = await session.evaluate((id1, id2) => {
        const m1 = document.getElementById(`tcp_menu_${id1}`);
        const m2 = document.getElementById(`tcp_menu_${id2}`);
        return {
          m1: m1 ? m1.style.display : null,
          m2: m2 ? m2.style.display : null
        };
      }, moreBtns[0], moreBtns[1]);

      assert.equal(menusState.m1, 'none', 'Track 1 menu must be closed when Track 2 menu opens');
      assert.equal(menusState.m2, 'block', 'Track 2 menu must be open');
    });

    it('2.5 should execute Delete Track from kebab menu and leave no orphaned dropdowns', async () => {
      const deleteResult = await session.evaluate(async () => {
        const t1 = window.BeatboxStudio.addTrack('Faixa A');
        const t2 = window.BeatboxStudio.addTrack('Faixa B');
        window.BeatboxStudio.renderStudioViews();

        // Open menu for Faixa A
        const moreBtn = document.querySelector(`button.tcp-btn-more[data-id="${t1.id}"]`);
        moreBtn.click();

        // Click delete item in dropdown
        const delBtn = document.querySelector(`.tcp-menu-delete[data-id="${t1.id}"]`);
        delBtn.click();

        return {
          totalRows: document.querySelectorAll('.reaper-track-row').length,
          totalDropdowns: document.querySelectorAll('.tcp-menu-dropdown').length,
          remainingRowId: document.querySelector('.reaper-track-row').id
        };
      });

      assert.equal(deleteResult.totalRows, 1, 'Only 1 track row should remain');
      assert.equal(deleteResult.totalDropdowns, 1, 'Only 1 dropdown should remain in DOM');
      assert.ok(deleteResult.remainingRowId.includes('Faixa B') || deleteResult.remainingRowId.startsWith('reaper_row_'), 'Surviving row is present');
    });
  });

  // =========================================================================
  // Challenge Dimension 3: Rapid Keyboard Navigation Stress
  // =========================================================================
  describe('Dimension 3: Rapid Keyboard Navigation', () => {
    it('3.1 should cycle down with ArrowDown and up with ArrowUp through 4 tracks', async () => {
      const trackIds = await session.evaluate(() => {
        const ids = [];
        for (let i = 1; i <= 4; i++) {
          const t = window.BeatboxStudio.addTrack(`Nav Track ${i}`);
          ids.push(t.id);
        }
        window.BeatboxStudio.renderStudioViews();
        // Clear selection to start from neutral
        window.BeatboxStudio.selectTrack(null);
        return ids;
      });

      // Press ArrowDown with no selection -> should select track 0
      await session.dispatchKey('ArrowDown', 'ArrowDown');
      let selId = await session.evaluate(() => {
        const row = document.querySelector('.reaper-track-row.is-selected');
        return row ? row.id.replace('reaper_row_', '') : null;
      });
      assert.equal(selId, trackIds[0], 'ArrowDown from neutral must select first track');

      // Press ArrowDown 3 more times -> should reach track 3
      for (let i = 1; i <= 3; i++) {
        await session.dispatchKey('ArrowDown', 'ArrowDown');
      }
      selId = await session.evaluate(() => {
        const row = document.querySelector('.reaper-track-row.is-selected');
        return row ? row.id.replace('reaper_row_', '') : null;
      });
      assert.equal(selId, trackIds[3], 'Stepping down 3 times must select last track (index 3)');

      // Press ArrowUp 2 times -> should reach track 1
      await session.dispatchKey('ArrowUp', 'ArrowUp');
      await session.dispatchKey('ArrowUp', 'ArrowUp');
      selId = await session.evaluate(() => {
        const row = document.querySelector('.reaper-track-row.is-selected');
        return row ? row.id.replace('reaper_row_', '') : null;
      });
      assert.equal(selId, trackIds[1], 'Stepping up 2 times must select track at index 1');
    });

    it('3.2 should clamp safely at top and bottom boundaries without wrapping or errors', async () => {
      const trackIds = await session.evaluate(() => {
        const ids = [];
        for (let i = 1; i <= 3; i++) {
          const t = window.BeatboxStudio.addTrack(`Clamp Track ${i}`);
          ids.push(t.id);
        }
        window.BeatboxStudio.renderStudioViews();
        window.BeatboxStudio.selectTrack(ids[2]); // select last track
        return ids;
      });

      // Dispatch 6 rapid ArrowDown at bottom
      for (let i = 0; i < 6; i++) {
        await session.dispatchKey('ArrowDown', 'ArrowDown');
      }

      let selId = await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row.is-selected');
        return {
          count: rows.length,
          id: rows[0] ? rows[0].id.replace('reaper_row_', '') : null
        };
      });
      assert.equal(selId.count, 1, 'Exactly one track must remain selected');
      assert.equal(selId.id, trackIds[2], 'Selection must remain clamped at bottom track');

      // Now dispatch 8 rapid ArrowUp to hit top boundary
      for (let i = 0; i < 8; i++) {
        await session.dispatchKey('ArrowUp', 'ArrowUp');
      }

      selId = await session.evaluate(() => {
        const rows = document.querySelectorAll('.reaper-track-row.is-selected');
        return {
          count: rows.length,
          id: rows[0] ? rows[0].id.replace('reaper_row_', '') : null
        };
      });
      assert.equal(selId.count, 1, 'Exactly one track must remain selected');
      assert.equal(selId.id, trackIds[0], 'Selection must remain clamped at top track');
    });

    it('3.3 should withstand rapid alternating keystrokes (40 keys) maintaining 1:1 selection consistency', async () => {
      await session.evaluate(() => {
        for (let i = 1; i <= 5; i++) {
          window.BeatboxStudio.addTrack(`Stress ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();
      });

      // Fire 40 alternating rapid ArrowDown and ArrowUp keystrokes
      for (let i = 0; i < 20; i++) {
        await session.dispatchKey('ArrowDown', 'ArrowDown');
        await session.dispatchKey('ArrowUp', 'ArrowUp');
      }

      const consistency = await session.evaluate(() => {
        const selectedRows = document.querySelectorAll('.reaper-track-row.is-selected');
        return {
          selectedRowCount: selectedRows.length,
          selectedId: selectedRows[0] ? selectedRows[0].id : null,
          hasGoldBorder: selectedRows[0] ? window.getComputedStyle(selectedRows[0]).borderLeftWidth : null
        };
      });

      assert.equal(consistency.selectedRowCount, 1, 'Must have strictly 1 selected track row after stress test');
      assert.ok(consistency.selectedId !== null, 'Selected track ID must be non-null');
      assert.equal(consistency.hasGoldBorder, '3px', 'Selected track must display 3px gold left border');
    });

    it('3.4 should not hijack Arrow keys or shortcuts when typing inside .tcp-name-input', async () => {
      const trackId = await session.evaluate(() => {
        const t1 = window.BeatboxStudio.addTrack('Pandeiro');
        const t2 = window.BeatboxStudio.addTrack('Surdo');
        window.BeatboxStudio.renderStudioViews();
        window.BeatboxStudio.selectTrack(t1.id);
        return t1.id;
      });

      // Focus name input of Track 1
      await session.evaluate((id) => {
        const input = document.querySelector(`.tcp-name-input[data-id="${id}"]`);
        input.focus();
      }, trackId);

      // Dispatch ArrowDown while input is focused
      await session.dispatchKey('ArrowDown', 'ArrowDown');

      const isStillTrack1 = await session.evaluate((id) => {
        const row = document.querySelector('.reaper-track-row.is-selected');
        return row && row.id === `reaper_row_${id}`;
      }, trackId);

      assert.equal(isStillTrack1, true, 'Arrow navigation must not hijack keyboard while typing in text input');
    });

    it('3.5 should toggle Mute with KeyM on selected track', async () => {
      const trackId = await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Ganza');
        window.BeatboxStudio.renderStudioViews();
        window.BeatboxStudio.selectTrack(t.id);
        return t.id;
      });

      // Dispatch KeyM
      await session.dispatchKey('KeyM', 'm');
      let isMuted = await session.evaluate((id) => {
        const row = document.getElementById(`reaper_row_${id}`);
        return row && row.classList.contains('is-muted');
      }, trackId);
      assert.equal(isMuted, true, 'KeyM must toggle Mute ON for selected track');

      // Dispatch KeyM again
      await session.dispatchKey('KeyM', 'm');
      isMuted = await session.evaluate((id) => {
        const row = document.getElementById(`reaper_row_${id}`);
        return row && row.classList.contains('is-muted');
      }, trackId);
      assert.equal(isMuted, false, 'KeyM must toggle Mute OFF on second press');
    });
  });

  // =========================================================================
  // Challenge Dimension 4: Sticky Layout Under Simulated Zoom & Scroll
  // =========================================================================
  describe('Dimension 4: Sticky Layout Under Zoom & Scroll', () => {
    it('4.1 should compute sticky positioning for TCP, TCP corner, and Ruler header', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Caixa');
        window.BeatboxStudio.renderStudioViews();
      });

      const styles = await session.evaluate(() => {
        const tcp = document.querySelector('.reaper-tcp');
        const corner = document.querySelector('.reaper-tcp-corner');
        const ruler = document.querySelector('.reaper-ruler-header');
        return {
          tcpPos: window.getComputedStyle(tcp).position,
          tcpLeft: window.getComputedStyle(tcp).left,
          cornerPos: window.getComputedStyle(corner).position,
          cornerLeft: window.getComputedStyle(corner).left,
          rulerPos: window.getComputedStyle(ruler).position,
          rulerTop: window.getComputedStyle(ruler).top
        };
      });

      assert.equal(styles.tcpPos, 'sticky', 'TCP must compute position: sticky');
      assert.equal(styles.tcpLeft, '0px', 'TCP must compute left: 0px');
      assert.equal(styles.cornerPos, 'sticky', 'TCP corner must compute position: sticky');
      assert.equal(styles.cornerLeft, '0px', 'TCP corner must compute left: 0px');
      assert.equal(styles.rulerPos, 'sticky', 'Ruler header must compute position: sticky');
      assert.equal(styles.rulerTop, '0px', 'Ruler header must compute top: 0px');
    });

    it('4.2 should keep TCP fixed at viewport left edge under horizontal scroll with simulated zoom', async () => {
      await session.evaluate(() => {
        for (let i = 1; i <= 3; i++) {
          window.BeatboxStudio.addTrack(`Track ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();
      });

      const scrollRes = await session.evaluate(() => {
        const scrollContainer = document.getElementById('reaperDawScroll');
        const mainEl = document.querySelector('.reaper-daw-main');
        const tcp = document.querySelector('.reaper-tcp');
        if (!scrollContainer || !mainEl || !tcp) return null;

        const initialTcpRect = tcp.getBoundingClientRect();
        const initialContainerRect = scrollContainer.getBoundingClientRect();

        // Simulate 200% zoom on timeline canvas
        mainEl.style.width = '200%';
        scrollContainer.scrollLeft = 400;

        const scrolledTcpRect = tcp.getBoundingClientRect();
        const scrolledContainerRect = scrollContainer.getBoundingClientRect();

        return {
          containerScrolled: scrollContainer.scrollLeft > 0,
          tcpLeftDiff: Math.abs((scrolledTcpRect.left - scrolledContainerRect.left) - (initialTcpRect.left - initialContainerRect.left)),
          tcpVisibleWidth: scrolledTcpRect.width
        };
      });

      assert.ok(scrollRes.containerScrolled, 'Container must scroll horizontally under simulated zoom');
      assert.ok(scrollRes.tcpLeftDiff <= 3, `TCP left edge must remain anchored (diff was ${scrollRes.tcpLeftDiff}px)`);
      assert.equal(scrollRes.tcpVisibleWidth, 300, 'TCP width must remain 300px');
    });

    it('4.3 should keep ruler header fixed at viewport top edge under vertical scroll', async () => {
      await session.evaluate(() => {
        for (let i = 1; i <= 8; i++) {
          window.BeatboxStudio.addTrack(`Vertical Track ${i}`);
        }
        window.BeatboxStudio.renderStudioViews();
      });

      const vScrollRes = await session.evaluate(() => {
        const scrollContainer = document.getElementById('reaperDawScroll');
        if (!scrollContainer) return null;

        const initialRulerRect = document.querySelector('.reaper-ruler-header').getBoundingClientRect();

        // Scroll down 250px
        scrollContainer.scrollTop = 250;

        const scrolledRulerRect = document.querySelector('.reaper-ruler-header').getBoundingClientRect();

        return {
          containerVScrolled: scrollContainer.scrollTop > 0,
          rulerTopDiff: Math.abs(scrolledRulerRect.top - initialRulerRect.top)
        };
      });

      assert.ok(vScrollRes.containerVScrolled, 'Container must scroll vertically with 8 tracks');
      assert.ok(vScrollRes.rulerTopDiff <= 2, `Ruler header must remain sticky at top (diff was ${vScrollRes.rulerTopDiff}px)`);
    });
  });

  // =========================================================================
  // Challenge Dimension 5: KeyS vs Alt+KeyS Shortcut Verification
  // =========================================================================
  describe('Dimension 5: KeyS vs Alt+KeyS Shortcut Collision Verification', () => {
    it('5.1 should display "Solo [Alt+S]" tooltip on Solo button', async () => {
      await session.evaluate(() => {
        window.BeatboxStudio.addTrack('Repique Solo');
        window.BeatboxStudio.renderStudioViews();
      });

      const soloTitle = await session.evaluate(() => {
        const soloBtn = document.querySelector('.tcp-btn-solo');
        return soloBtn ? soloBtn.getAttribute('title') : null;
      });

      assert.equal(soloTitle, 'Solo [Alt+S]', 'Solo button title must reflect Alt+S shortcut');
    });

    it('5.2 should toggle Solo when Alt+KeyS is dispatched', async () => {
      const trackId = await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Solo Subject');
        window.BeatboxStudio.renderStudioViews();
        window.BeatboxStudio.selectTrack(t.id);
        return t.id;
      });

      // Alt modifier in CDP is 1
      await session.dispatchKey('KeyS', 's', 1);
      await new Promise(r => setTimeout(r, 60));

      let soloState = await session.evaluate((id) => {
        const row = document.getElementById(`reaper_row_${id}`);
        return row && row.classList.contains('is-soloed');
      }, trackId);
      assert.equal(soloState, true, 'Alt+KeyS must toggle Solo ON');

      // Dispatch Alt+KeyS again
      await session.dispatchKey('KeyS', 's', 1);
      await new Promise(r => setTimeout(r, 60));

      soloState = await session.evaluate((id) => {
        const row = document.getElementById(`reaper_row_${id}`);
        return row && row.classList.contains('is-soloed');
      }, trackId);
      assert.equal(soloState, false, 'Alt+KeyS must toggle Solo OFF on second invocation');
    });

    it('5.3 should NOT toggle Solo when KeyS (without Alt) is dispatched', async () => {
      const trackId = await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Normal Track');
        window.BeatboxStudio.renderStudioViews();
        window.BeatboxStudio.selectTrack(t.id);
        return t.id;
      });

      // Dispatch KeyS without modifiers (modifiers = 0)
      await session.dispatchKey('KeyS', 's', 0);
      await new Promise(r => setTimeout(r, 60));

      const isSoloed = await session.evaluate((id) => {
        const row = document.getElementById(`reaper_row_${id}`);
        return row && row.classList.contains('is-soloed');
      }, trackId);

      assert.equal(isSoloed, false, 'KeyS without Alt must NEVER activate Solo');
    });

    it('5.4 should isolate text typing: KeyS inside .tcp-name-input must not trigger Solo or Split', async () => {
      const trackId = await session.evaluate(() => {
        const t = window.BeatboxStudio.addTrack('Base');
        window.BeatboxStudio.renderStudioViews();
        window.BeatboxStudio.selectTrack(t.id);
        return t.id;
      });

      // Focus the name input
      await session.evaluate((id) => {
        const input = document.querySelector(`.tcp-name-input[data-id="${id}"]`);
        input.focus();
      }, trackId);

      // Dispatch KeyS and Alt+KeyS while focused in input
      await session.dispatchKey('KeyS', 's', 0);
      await session.dispatchKey('KeyS', 's', 1);

      const status = await session.evaluate((id) => {
        const row = document.getElementById(`reaper_row_${id}`);
        return {
          isSoloed: row ? row.classList.contains('is-soloed') : false,
          trackCount: document.querySelectorAll('.reaper-track-row').length
        };
      });

      assert.equal(status.isSoloed, false, 'Typing in name input must not trigger Solo');
      assert.equal(status.trackCount, 1, 'Typing in name input must not split track');
    });
  });
});
