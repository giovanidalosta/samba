# Project: Samba Multitrack Studio Refactoring & UX Optimization

## Architecture
- **Tech Stack**: Vanilla JavaScript (ES6+), Web Audio API, HTML5 Canvas 2D, Modern CSS3 with custom properties and responsive media queries, Node.js test runner (`node --test`), Headless Chrome/Edge browser verification (`tests/browser-verify.js` via CDP).
- **Core Application Files**:
  - `samba/index.html`: Global application shell, navigation header, tab routing (`tab-home`, `tab-sequencer`, `tab-beatbox`), modals, sequencer pad grid.
  - `samba/beatbox_studio.js`: Multitrack DAW state machine, audio engine, timeline rendering, track control panel (TCP), clip drag-and-drop, playhead, mosaic stage, recording workspace.
  - `samba/beatbox_studio.css`: Visual styling, DAW layout, responsive breakpoints, color palette, custom controls.
- **Data Flow**:
  - `state.tracks` represents the active project tracks (id, name, volume, muted, solo, armed, offsetMs, trimStart, trimEnd, duration, mediaType, mediaBlob, mediaUrl, waveformPeaks).
  - UI events mutate state and trigger in-place DOM updates or targeted re-renders without breaking audio playback or context.
  - Sticky TCP (`.reaper-tcp`) remains pinned left while Arrange Lane (`.reaper-arrange-lane`) scrolls horizontally in `#reaperDawScroll`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1.1: Sequencer Toolbar Menu Consolidation | Consolidate secondary action buttons (Export JSON, Import JSON, Print, Share) into an actions popover menu matching Studio design; prevent multi-row toolbar sprawl on smaller screens. | M1 | explorer_survey_1 |
| 2 | R1.2: Sequencer Pad Header Streamlining | Remove redundant audition button ('🔊') from instrument track headers in Pad Sequencer; instrument name header already triggers audition. | M1 | explorer_survey_1 |
| 3 | R1.3: Mosaic View Sync Control Harmonization | Replace legacy 4-button nudge layout (-50, -10, +10, +50) in Mosaic cards with unified `.tcp-sync-pill` (`‹ +0ms ›`) and streamline card action buttons. | M1 | explorer_survey_1 |
| 4 | R1.4: Global Header Responsive Hierarchy | Declutter and optimize global navigation header; ensure brand, project breadcrumb/switcher, and actions do not wrap awkwardly or collide on 768px-1150px viewports. | M1 | explorer_survey_1 |
| 5 | R2.1: TCP Control Streamlining & Fader Row Optimization | Re-style and widen `.tcp-fader-slider` flex layout, compact `.tcp-sync-pill`, eliminate dead visual noise in `.tcp-media-pip`, and add double-click volume reset to 100%. | M2 | explorer_survey_2 |
| 6 | R2.2: Track Addition Limit & Timeline Clutter Elimination | Add disabled/capped state to `.reaper-add-track-lane` when 9 tracks are reached; streamline clip header badges (hide 0ms sync offset, compact cut button) to prevent waveform clipping. | M2 | explorer_survey_2 |
| 7 | R2.3: Track Selection & Navigation Focus Overhaul | Fix track selection when clicking/focusing `.tcp-name-input`; enhance active track visual focus (box-shadow outline, TCP active glow, distinct background); isolate arrow key navigation from open kebab menus. | M2 | explorer_survey_2 |
| 8 | R3.1: Active Container Scroll Lock During Clip Drag | Prevent unwanted horizontal scrolling by capturing and strictly locking `#reaperDawScroll.scrollLeft` during clip interaction, preventing default gesture pan. | M3 | explorer_survey_3 |
| 9 | R3.2: Eliminate Flex Shift Layout Jerk on Track Selection | Add `border-left: 3px solid transparent;` to `.reaper-track-row` default state so applying `.is-selected` does not shift child elements by 3px. | M3 | explorer_survey_3 |
| 10 | R3.3: Timeline Grid & Playhead Synchronization on Drop Extension | Update `.lane-grid-overlay` columns across all tracks and update `dom.reaperPlayhead.style.left` when clip drop extends timeline duration, eliminating grid desync and snapback visual jumping. | M3 | explorer_survey_3 |
| 11 | R3.4: Accurate Clip Positioning & Clamp Normalization | Remove arbitrary 96% clamp (`Math.min(96, ...)`) in drag/drop and rendering, ensuring exact mathematical offset alignment across the timeline. | M3 | explorer_survey_3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Application-Wide Menu and Navigation Optimization | R1.1, R1.2, R1.3, R1.4 | none | DONE |
| 2 | M2: Multitrack Studio Usability and Track Navigation | R2.1, R2.2, R2.3 | none | DONE |
| 3 | M3: Audio Clip Positioning and Scroll Behavior | R3.1, R3.2, R3.3, R3.4 | none | DONE |
| 4 | M4: Final Acceptance & E2E Test Suite Pass | 100% E2E test suite pass + Tier 5 adversarial coverage hardening | M1, M2, M3 | DONE |

## Interface Contracts & Test Preservation
1. **DOM Selectors & Classes (Mandatory Preservation)**:
   - Multitrack TCP: `.reaper-track-row`, `.reaper-tcp`, `.reaper-tcp-corner`, `.reaper-ruler-header`, `.tcp-track-number`, `.tcp-name-input`, `.tcp-kebab-wrap`, `.tcp-btn-more`, `.tcp-menu-dropdown`, `.btn-rec-arm`, `.tcp-btn-mute`, `.tcp-btn-solo`, `.tcp-fader-slider`, `.tcp-vol-db`, `.tcp-sync-pill`, `.tcp-sync-step`, `.tcp-sync-val`, `.tcp-media-pip`.
   - Arrange Lane: `.reaper-arrange-lane`, `.reaper-media-item`, `.media-item-header`, `.item-title`, `.item-meta-tag`, `.clip-trim-handle`, `.reaper-empty-lane`, `.btn-empty-record`, `.reaper-add-track-lane`.
   - Sequencer / Pad: `#tracksWrapper`, `.track-header`, `.track-info`, `#btnPlay`, `#btnStop`, `#btnSaveToMyBreques`, `#btnSendToStudio`, `#btnShareLink`, `#btnExportJSON`, `#btnImportJSON`, `#btnPrint`.
   - Global Navigation: `#headerBrandLogo`, `#projectHeaderBar`, `#projectModeSwitch`, `#btnHeaderNewBreque`.
2. **Sticky Layout Contract**:
   - `.reaper-tcp` and `.reaper-tcp-corner` MUST have `position: sticky; left: 0px;`.
3. **Scroll Contract**:
   - Audio clip drag interactions MUST maintain `#reaperDawScroll.scrollLeft` invariant.

## Code Layout
- `samba/index.html`: Layout, DOM containers, popover menus, global navigation.
- `samba/beatbox_studio.js`: Logic, event handlers, rendering functions, audio graph.
- `samba/beatbox_studio.css`: Styles, layouts, responsive rules.
- `samba/tests/`: Automated unit, integration, and CDP browser tests.

## Revisão 2026-11-10
- Achados: `docs/superpowers/specs/2026-11-10-revisao-app.md`
- Plano (tarefas executadas e pendentes de aprovação): `docs/superpowers/plans/2026-11-10-revisao-app.md`
- Testes novos: `tests/review_persistence.test.js`, `tests/review_a11y.test.js`, `tests/review_server.test.js`
