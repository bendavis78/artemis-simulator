import type { Timeline, PlaybackSpeed } from '../controls/timeline';
import type { CameraController, FocusTarget, ReferencePlane, CameraMode } from '../controls/camera';
import { MISSION_DURATION_HOURS, MISSION_START_UTC } from '../constants';
import { TimelineScrubController } from '../controls/timeline-scrub';

let currentTimezone = 'UTC';
let currentClockFormat: '24' | '12' = '24';
let scrubController: TimelineScrubController | null = null;

export function createOverlay(
  timeline: Timeline,
  cameraController: CameraController,
  { onWireframeToggle, onMoonOrbitToggle, onStarsToggle, onSunToggle, onFlightPathToggle, onProgressPathToggle, onOrionToggle, onLunarLabelsToggle, onIcrfPlaneToggle, onMoonOrbitalPlaneToggle, onReferencePlaneChange }: {
    onWireframeToggle: (enabled: boolean) => void;
    onMoonOrbitToggle: (enabled: boolean) => void;
    onStarsToggle: (enabled: boolean) => void;
    onSunToggle: (enabled: boolean) => void;
    onFlightPathToggle: (enabled: boolean) => void;
    onProgressPathToggle: (enabled: boolean) => void;
    onOrionToggle: (enabled: boolean) => void;
    onLunarLabelsToggle: (enabled: boolean) => void;
    onIcrfPlaneToggle: (enabled: boolean) => void;
    onMoonOrbitalPlaneToggle: (enabled: boolean) => void;
    onReferencePlaneChange: (plane: ReferencePlane) => void;
  },
): { overlay: HTMLDivElement; liveState: { isLive: boolean }; updatePovMenu: (focus: FocusTarget) => void } {
  const overlay = document.createElement('div');
  overlay.id = 'overlay';
  overlay.innerHTML = `
    <style>
      #overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        pointer-events: none;
        font-family: 'Courier New', monospace;
        color: #ccc;
        z-index: 100;
        user-select: none;
      }
      #overlay button, #overlay input, #overlay select, #overlay label,
      #overlay .dropup-menu { pointer-events: auto; }

      .top-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
      }
      .title {
        font-size: 1.1em;
        letter-spacing: 3px;
        color: #fff;
        font-weight: bold;
      }
      .phase {
        color: #4a9eff;
        font-size: 0.85em;
      }

      .bottom-panel {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        padding: 12px 20px 16px;
        background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%);
      }

      .time-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.8em;
        margin-bottom: 8px;
      }
      .met { color: #fff; }
      .utc { color: #888; }

      .slider-row {
        margin-bottom: 10px;
        position: relative;
      }
      .granularity-label {
        position: absolute;
        top: calc(100% + 4px);
        padding: 2px 8px;
        background: rgba(0, 0, 0, 0.8);
        color: #4a9eff;
        font-size: 11px;
        font-family: monospace;
        border-radius: 4px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s;
      }
      .granularity-label.visible {
        opacity: 1;
      }
      .timeline-slider.scrubbing::-webkit-slider-thumb {
        width: 20px;
        height: 20px;
        background: #6ab5ff;
      }
      .timeline-slider.scrubbing::-moz-range-thumb {
        width: 20px;
        height: 20px;
        background: #6ab5ff;
      }
      .timeline-slider {
        width: 100%;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: #333;
        border-radius: 2px;
        outline: none;
        cursor: pointer;
      }
      .timeline-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #4a9eff;
        cursor: pointer;
        border: 2px solid #fff;
      }
      .timeline-slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #4a9eff;
        cursor: pointer;
        border: 2px solid #fff;
      }

      .controls-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .btn {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: #ccc;
        padding: 4px 10px;
        font-family: 'Courier New', monospace;
        font-size: 0.75em;
        cursor: pointer;
        border-radius: 3px;
        transition: all 0.15s;
      }
      .btn:hover { background: rgba(255,255,255,0.2); color: #fff; }
      .btn.active {
        background: rgba(74,158,255,0.3);
        border-color: #4a9eff;
        color: #4a9eff;
      }
      .btn-play { font-size: 0.9em; min-width: 32px; }
      .btn-live {
        display: flex;
        align-items: center;
        gap: 5px;
        letter-spacing: 1px;
      }
      .btn-live.live-active {
        background: rgba(220,50,50,0.15);
        border-color: rgba(220,50,50,0.4);
        color: #e05555;
      }
      .btn-live.live-active:hover { background: rgba(220,50,50,0.3); color: #ff6b6b; border-color: rgba(220,50,50,0.7); }
      .btn-live .live-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
      .btn-live.live-active .live-dot {
        animation: pulse-live 1.5s ease-in-out infinite;
      }
      @keyframes pulse-live {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      .separator {
        width: 1px;
        height: 20px;
        background: rgba(255,255,255,0.2);
        margin: 0 4px;
      }
      .group-label {
        font-size: 0.6em;
        color: rgba(255,255,255,0.35);
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-right: -2px;
      }

      .info-row {
        display: flex;
        gap: 20px;
        font-size: 0.7em;
        color: #666;
        margin-top: 8px;
      }
      .info-row span { white-space: nowrap; }
      .info-value { color: #999; }
      .debug-values {
        display: none;
        flex-direction: column;
        gap: 2px;
        font-size: 0.7em;
        color: #4a7;
        pointer-events: none;
        text-align: right;
      }
      .debug-values.visible { display: flex; }
      .debug-values .debug-val { color: #6c9; }

      .settings-wrap {
        position: relative;
        margin-left: auto;
      }
      .settings-toggle {
        width: 28px;
        height: 28px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 50%;
        color: #888;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
      }
      .settings-toggle:hover { background: rgba(255,255,255,0.15); color: #ccc; }

      .settings-panel {
        position: absolute;
        bottom: 36px;
        right: 0;
        background: rgba(0,0,0,0.85);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px;
        padding: 10px 14px;
        font-size: 0.75em;
        display: none;
        white-space: nowrap;
      }
      .settings-panel.open { display: block; }
      .settings-panel label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        color: #aaa;
      }
      .settings-panel label:hover { color: #fff; }
      .settings-panel input[type="checkbox"] { accent-color: #4a9eff; }
      .settings-select {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.2);
        color: #ccc;
        font-family: 'Courier New', monospace;
        font-size: 1em;
        padding: 2px 4px;
        border-radius: 3px;
        margin-left: 8px;
        cursor: pointer;
        outline: none;
      }
      .settings-select:hover { border-color: rgba(255,255,255,0.4); }
      .settings-select:focus { border-color: #4a9eff; }
      .settings-select option { background: #1a1a1a; color: #ccc; }

      /* Drop-up menus for mobile */
      .dropup {
        position: relative;
        display: none;
      }
      .dropup-trigger {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: #ccc;
        padding: 4px 10px;
        font-family: 'Courier New', monospace;
        font-size: 0.75em;
        cursor: pointer;
        border-radius: 3px;
        transition: all 0.15s;
        white-space: nowrap;
      }
      .dropup-trigger::after {
        content: ' \u25B4';
      }
      .dropup-trigger:hover { background: rgba(255,255,255,0.2); color: #fff; }
      .dropup-menu {
        display: none;
        position: absolute;
        bottom: calc(100% + 4px);
        left: 0;
        background: rgba(0,0,0,0.9);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 4px;
        padding: 4px 0;
        z-index: 200;
        min-width: 100%;
      }
      .dropup-menu.open { display: block; }
      .dropup-item {
        display: block;
        width: 100%;
        background: none;
        border: none;
        color: #ccc;
        padding: 6px 14px;
        font-family: 'Courier New', monospace;
        font-size: 0.75em;
        cursor: pointer;
        text-align: left;
        white-space: nowrap;
      }
      .dropup-item:hover { background: rgba(255,255,255,0.1); color: #fff; }
      .dropup-item.active { color: #4a9eff; }

      /* Keyboard reference modal */
      .kb-modal-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.6);
        z-index: 10000;
        justify-content: center;
        align-items: center;
      }
      .kb-modal-backdrop.open { display: flex; }
      .kb-modal {
        background: #1a1a2e;
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        padding: 20px 28px;
        max-width: 420px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        color: #ccc;
        font-family: 'Courier New', monospace;
        font-size: 0.8em;
      }
      .kb-modal h3 {
        margin: 0 0 12px;
        color: #fff;
        font-size: 1.1em;
      }
      .kb-modal table { width: 100%; border-collapse: collapse; }
      .kb-modal td { padding: 3px 0; }
      .kb-modal td:first-child { color: #4a9eff; white-space: nowrap; padding-right: 16px; }
      .kb-modal .kb-section { color: #6c9; margin: 10px 0 4px; font-size: 0.9em; }

      /* Desktop: show inline buttons, hide dropups */
      .speed-inline, .focus-inline { display: contents; }

      /* Mobile layout */
      @media (max-width: 600px) {
        .speed-inline, .focus-inline { display: none; }
        .dropup { display: inline-block; }
        .separator { display: none; }
        .info-row { flex-wrap: wrap; gap: 8px; }
      }
    </style>

    <div class="top-bar">
      <span class="title">ARTEMIS II</span>
      <div style="display:flex;flex-direction:column;align-items:flex-end;">
        <span class="phase" id="phase">—</span>
        <div class="debug-values" id="debug-values"></div>
      </div>
    </div>

    <div class="bottom-panel">
      <div class="time-row">
        <span class="met" id="met">Day 0 / 00:00</span>
        <span class="utc" id="utc">—</span>
      </div>

      <div class="slider-row">
        <input type="range" class="timeline-slider" id="timeline-slider"
               min="0" max="${MISSION_DURATION_HOURS}" step="0.01" value="0">
      </div>

      <div class="controls-row">
        <button class="btn btn-play" id="btn-play">&#9654;</button>
        <button class="btn btn-live" id="btn-live"><span class="live-dot"></span>LIVE</button>
        <div class="separator"></div>
        <span class="speed-inline">
          <span class="group-label">SPEED</span>
          <button class="btn speed-btn" data-speed="1">1x</button>
          <button class="btn speed-btn" data-speed="10">10x</button>
          <button class="btn speed-btn" data-speed="100">100x</button>
          <button class="btn speed-btn" data-speed="1000">1Kx</button>
          <button class="btn speed-btn active" data-speed="10000">10Kx</button>
        </span>
        <div class="dropup" id="speed-dropup">
          <button class="dropup-trigger" id="speed-dropup-trigger">10Kx</button>
          <div class="dropup-menu" id="speed-dropup-menu">
            <button class="dropup-item speed-btn" data-speed="1">1x</button>
            <button class="dropup-item speed-btn" data-speed="10">10x</button>
            <button class="dropup-item speed-btn" data-speed="100">100x</button>
            <button class="dropup-item speed-btn" data-speed="1000">1Kx</button>
            <button class="dropup-item speed-btn active" data-speed="10000">10Kx</button>
          </div>
        </div>
        <div class="separator"></div>
        <span class="focus-inline">
          <span class="group-label">FOCUS</span>
          <button class="btn focus-btn" data-focus="earth">Earth</button>
          <button class="btn focus-btn" data-focus="moon">Moon</button>
          <button class="btn focus-btn" data-focus="orion">Orion</button>
        </span>
        <div class="dropup" id="focus-dropup">
          <button class="dropup-trigger" id="focus-dropup-trigger">Earth</button>
          <div class="dropup-menu" id="focus-dropup-menu">
            <button class="dropup-item focus-btn" data-focus="earth">Earth</button>
            <button class="dropup-item focus-btn" data-focus="moon">Moon</button>
            <button class="dropup-item focus-btn" data-focus="orion">Orion</button>
          </div>
        </div>
        <div class="separator"></div>
        <div class="dropup" id="pov-dropup" style="display:inline-block;">
          <button class="dropup-trigger" id="pov-dropup-trigger">Free</button>
          <div class="dropup-menu" id="pov-dropup-menu"></div>
        </div>
        <div class="settings-wrap">
          <div class="settings-panel" id="settings-panel">
            <label><input type="checkbox" id="wireframe-toggle"> Wireframe</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="moon-orbit-toggle"> Moon Orbit</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="stars-toggle" checked> Stars</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="sun-toggle" checked> Sun</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="flight-path-toggle" checked> Flight Path</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="progress-path-toggle" checked> Progress Path</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="orion-toggle" checked> Orion</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="lunar-labels-toggle"> Lunar Labels</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="icrf-plane-toggle"> ICRF Plane</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="moon-orbital-plane-toggle"> Moon Orbital Plane</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="debug-values-toggle"> Debug Values</label>
            <label style="margin-top: 10px;">
              Ref. Plane
              <select id="ref-plane-select" class="settings-select">
                <option value="icrf">ICRF</option>
                <option value="lunar">Lunar</option>
              </select>
            </label>
            <label style="margin-top: 6px;">
              Time Zone
              <select id="timezone-select" class="settings-select">
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern</option>
                <option value="America/Chicago">Central</option>
                <option value="America/Denver">Mountain</option>
                <option value="America/Los_Angeles">Pacific</option>
                <option value="America/Anchorage">Alaska</option>
                <option value="Pacific/Honolulu">Hawaii</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Europe/Berlin">Berlin</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Australia/Sydney">Sydney</option>
                <option value="local">Local</option>
              </select>
            </label>
            <label style="margin-top: 6px;">
              Clock
              <select id="clock-format-select" class="settings-select">
                <option value="24">24h</option>
                <option value="12">12h</option>
              </select>
            </label>
            <button class="btn" id="show-kb-ref" style="margin-top: 12px; width: 100%;">Keyboard Shortcuts</button>
            <button class="btn" id="reset-state" style="margin-top: 8px; width: 100%; color: #e05555; border-color: rgba(220,50,50,0.3);">Reset Settings</button>
          </div>
          <button class="settings-toggle" id="settings-toggle" title="Settings">&#9881;</button>
        </div>
      </div>

      <div class="info-row">
        <span>Earth: <span class="info-value" id="dist-earth">—</span></span>
        <span>Moon: <span class="info-value" id="dist-moon">—</span></span>
        <span>Speed: <span class="info-value" id="velocity">—</span></span>
        <span>Phase: <span class="info-value" id="moon-phase">—</span></span>
      </div>
    </div>

    <div class="kb-modal-backdrop" id="kb-modal-backdrop">
      <div class="kb-modal">
        <h3>Keyboard Shortcuts</h3>
        <div class="kb-section">Playback</div>
        <table>
          <tr><td>Space</td><td>Play / Pause</td></tr>
          <tr><td>L</td><td>Toggle live mode</td></tr>
          <tr><td>&uarr; / &darr;</td><td>Increase / decrease speed</td></tr>
        </table>
        <div class="kb-section">Timeline</div>
        <table>
          <tr><td>&larr; / &rarr;</td><td>Scrub (step scales with speed)</td></tr>
          <tr><td>Shift + &larr;/&rarr;</td><td>Scrub in 1-min increments</td></tr>
        </table>
        <div class="kb-section">Camera</div>
        <table>
          <tr><td>E</td><td>Focus Earth</td></tr>
          <tr><td>M</td><td>Focus Moon</td></tr>
          <tr><td>O</td><td>Focus Orion</td></tr>
          <tr><td>Shift+E</td><td>Toggle Earth POV</td></tr>
          <tr><td>Shift+O</td><td>Toggle Orion POV</td></tr>
        </table>
        <div class="kb-section">Zoom</div>
        <table>
          <tr><td>PgUp / PgDn</td><td>Zoom in / out</td></tr>
          <tr><td>Shift+PgUp/PgDn</td><td>Fine-grain zoom</td></tr>
          <tr><td>Home / End</td><td>Zoom min / max</td></tr>
        </table>
        <div class="kb-section">Other</div>
        <table>
          <tr><td>?</td><td>This reference</td></tr>
        </table>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Reflect restored camera state in buttons
  overlay.querySelectorAll(`.focus-btn[data-focus="${cameraController.focusTarget}"]`).forEach((b) => b.classList.add('active'));
  overlay.querySelectorAll(`.mode-btn[data-mode="${cameraController.cameraMode}"]`).forEach((b) => b.classList.add('active'));

  const LIVE_KEY = 'artemis-live-v1';
  const savedLive = localStorage.getItem(LIVE_KEY) === 'true';
  const liveState = { isLive: savedLive };

  // Wire up events
  const slider = overlay.querySelector('#timeline-slider') as HTMLInputElement;
  slider.addEventListener('input', () => {
    liveState.isLive = false;
    if (timeline.state.isPlaying) timeline.togglePlayPause();
    timeline.setMET(parseFloat(slider.value));
  });

  // Fine-grain touch scrubbing (iOS-style vertical offset)
  const sliderRow = overlay.querySelector('.slider-row') as HTMLElement;
  scrubController = new TimelineScrubController({ timeline, liveState, sliderEl: slider, sliderRow });
  scrubController.attach();

  const playBtn = overlay.querySelector('#btn-play') as HTMLButtonElement;
  playBtn.addEventListener('click', () => {
    liveState.isLive = false;
    timeline.togglePlayPause();
  });

  const liveBtn = overlay.querySelector('#btn-live') as HTMLButtonElement;
  liveBtn.addEventListener('click', () => {
    liveState.isLive = true;
    timeline.setSpeed(1);
    overlay.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
    overlay.querySelectorAll('.speed-btn[data-speed="1"]').forEach((b) => b.classList.add('active'));
    speedDropupTrigger.textContent = '1x';
    const nowMET = (Date.now() - MISSION_START_UTC.getTime()) / 3600000;
    timeline.setMET(Math.max(0, Math.min(nowMET, MISSION_DURATION_HOURS)));
    if (!timeline.state.isPlaying) {
      timeline.togglePlayPause();
    }
  });

  // Drop-up menu toggling
  const speedDropupTrigger = overlay.querySelector('#speed-dropup-trigger') as HTMLButtonElement;
  const speedDropupMenu = overlay.querySelector('#speed-dropup-menu') as HTMLDivElement;
  const focusDropupTrigger = overlay.querySelector('#focus-dropup-trigger') as HTMLButtonElement;
  const focusDropupMenu = overlay.querySelector('#focus-dropup-menu') as HTMLDivElement;

  const povDropupTrigger = overlay.querySelector('#pov-dropup-trigger') as HTMLButtonElement;
  const povDropupMenu = overlay.querySelector('#pov-dropup-menu') as HTMLDivElement;

  // Sync dropup trigger labels with restored state
  const focusLabel: Record<FocusTarget, string> = { earth: 'Earth', moon: 'Moon', orion: 'Orion' };
  const modeLabel: Record<CameraMode, string> = { free: 'Free', 'earth-pov': 'Earth POV', 'orion-pov': 'Orion POV' };
  focusDropupTrigger.textContent = focusLabel[cameraController.focusTarget];
  povDropupTrigger.textContent = modeLabel[cameraController.cameraMode];

  const allDropupMenus = [speedDropupMenu, focusDropupMenu, povDropupMenu];
  function closeAllDropups(except?: HTMLElement): void {
    for (const menu of allDropupMenus) {
      if (menu !== except) menu.classList.remove('open');
    }
  }

  speedDropupTrigger.addEventListener('click', () => {
    closeAllDropups(speedDropupMenu);
    speedDropupMenu.classList.toggle('open');
  });
  focusDropupTrigger.addEventListener('click', () => {
    closeAllDropups(focusDropupMenu);
    focusDropupMenu.classList.toggle('open');
  });
  povDropupTrigger.addEventListener('click', () => {
    closeAllDropups(povDropupMenu);
    povDropupMenu.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('#speed-dropup')) speedDropupMenu.classList.remove('open');
    if (!target.closest('#focus-dropup')) focusDropupMenu.classList.remove('open');
    if (!target.closest('#pov-dropup')) povDropupMenu.classList.remove('open');
  });

  const SPEED_LABELS: Record<string, string> = { '1': '1x', '10': '10x', '100': '100x', '1000': '1Kx', '10000': '10Kx' };

  overlay.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const speed = parseInt(
        (btn as HTMLElement).dataset.speed!
      ) as PlaybackSpeed;
      if (speed !== 1) liveState.isLive = false;
      timeline.setSpeed(speed);
      overlay.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
      // Activate all matching speed buttons (inline + dropup)
      overlay.querySelectorAll(`.speed-btn[data-speed="${speed}"]`).forEach((b) => b.classList.add('active'));
      speedDropupTrigger.textContent = SPEED_LABELS[String(speed)] ?? `${speed}x`;
      speedDropupMenu.classList.remove('open');
    });
  });

  // POV modes available per focus target
  const POV_MODES: Record<FocusTarget, { mode: CameraMode; label: string }[]> = {
    earth: [
      { mode: 'free', label: 'Free' },
      { mode: 'orion-pov', label: 'Orion POV' },
    ],
    moon: [
      { mode: 'free', label: 'Free' },
      { mode: 'earth-pov', label: 'Earth POV' },
      { mode: 'orion-pov', label: 'Orion POV' },
    ],
    orion: [
      { mode: 'free', label: 'Free' },
    ],
  };

  const povDropup = overlay.querySelector('#pov-dropup') as HTMLDivElement;

  function updatePovMenu(focus: FocusTarget): void {
    const modes = POV_MODES[focus];
    // Hide dropdown when only Free is available
    povDropup.style.display = modes.length <= 1 ? 'none' : 'inline-block';
    // Rebuild menu items
    povDropupMenu.innerHTML = modes
      .map((m) => `<button class="dropup-item mode-btn" data-mode="${m.mode}">${m.label}</button>`)
      .join('');
    // If current camera mode isn't available for this focus, reset to free
    if (!modes.some((m) => m.mode === cameraController.cameraMode)) {
      cameraController.setCameraMode('free');
    }
    // Sync active state and trigger label
    povDropupMenu.querySelectorAll('.mode-btn').forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.mode === cameraController.cameraMode);
    });
    povDropupTrigger.textContent = modeLabel[cameraController.cameraMode];
    // Wire click handlers on new buttons
    povDropupMenu.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.mode as CameraMode;
        cameraController.setCameraMode(mode);
        povDropupMenu.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        povDropupTrigger.textContent = modeLabel[mode];
        povDropupMenu.classList.remove('open');
      });
    });
  }

  // Initialize POV menu for current focus
  updatePovMenu(cameraController.focusTarget);

  overlay.querySelectorAll('.focus-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const focus = (btn as HTMLElement).dataset.focus as FocusTarget;
      cameraController.setFocus(focus);
      // setFocus exits POV mode, so sync everything
      overlay.querySelectorAll('.focus-btn').forEach((b) => b.classList.remove('active'));
      overlay.querySelectorAll(`.focus-btn[data-focus="${focus}"]`).forEach((b) => b.classList.add('active'));
      focusDropupTrigger.textContent = focusLabel[focus];
      focusDropupMenu.classList.remove('open');
      updatePovMenu(focus);
    });
  });

  // Reference plane dropdown
  const refPlaneSelect = overlay.querySelector('#ref-plane-select') as HTMLSelectElement;
  refPlaneSelect.value = cameraController.referencePlane;
  refPlaneSelect.addEventListener('change', () => {
    onReferencePlaneChange(refPlaneSelect.value as ReferencePlane);
  });

  // Time zone selection
  const TIMEZONE_KEY = 'artemis-timezone-v1';
  const timezoneSelect = overlay.querySelector('#timezone-select') as HTMLSelectElement;
  const savedTZ = localStorage.getItem(TIMEZONE_KEY);
  if (savedTZ) timezoneSelect.value = savedTZ;
  currentTimezone = timezoneSelect.value;
  timezoneSelect.addEventListener('change', () => {
    currentTimezone = timezoneSelect.value;
    localStorage.setItem(TIMEZONE_KEY, timezoneSelect.value);
  });

  // Clock format selection
  const CLOCK_FORMAT_KEY = 'artemis-clock-format-v1';
  const clockFormatSelect = overlay.querySelector('#clock-format-select') as HTMLSelectElement;
  const savedClock = localStorage.getItem(CLOCK_FORMAT_KEY) as '24' | '12' | null;
  if (savedClock) clockFormatSelect.value = savedClock;
  currentClockFormat = clockFormatSelect.value as '24' | '12';
  clockFormatSelect.addEventListener('change', () => {
    currentClockFormat = clockFormatSelect.value as '24' | '12';
    localStorage.setItem(CLOCK_FORMAT_KEY, clockFormatSelect.value);
  });

  // Keyboard shortcuts
  const ARROW_INTERVALS: Record<number, number> = {
    1: 15 / 60,     // 15 minutes
    10: 1,          // 1 hour
    100: 6,         // 6 hours
    1000: 24,       // 1 day
    10000: 24,      // 1 day
  };

  const SPEEDS: PlaybackSpeed[] = [1, 10, 100, 1000, 10000];

  function setSpeedAndSync(speed: PlaybackSpeed): void {
    timeline.setSpeed(speed);
    overlay.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
    overlay.querySelectorAll(`.speed-btn[data-speed="${speed}"]`).forEach((b) => b.classList.add('active'));
    speedDropupTrigger.textContent = SPEED_LABELS[String(speed)] ?? `${speed}x`;
  }

  function setFocusAndSync(focus: FocusTarget): void {
    cameraController.setFocus(focus);
    overlay.querySelectorAll('.focus-btn').forEach((b) => b.classList.remove('active'));
    overlay.querySelectorAll(`.focus-btn[data-focus="${focus}"]`).forEach((b) => b.classList.add('active'));
    focusDropupTrigger.textContent = focusLabel[focus];
    updatePovMenu(focus);
  }

  function setModeAndSync(mode: CameraMode): void {
    cameraController.setCameraMode(mode);
    povDropupMenu.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    povDropupMenu.querySelectorAll(`.mode-btn[data-mode="${mode}"]`).forEach((b) => b.classList.add('active'));
    povDropupTrigger.textContent = modeLabel[mode];
  }

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    // Left/Right: timeline scrubbing
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      liveState.isLive = false;
      if (timeline.state.isPlaying) timeline.togglePlayPause();
      const baseInterval = ARROW_INTERVALS[timeline.state.playbackSpeed] ?? 1;
      const interval = e.shiftKey ? Math.min(baseInterval, 1 / 60) : baseInterval;
      const cur = timeline.state.currentMET;
      const newMET = e.key === 'ArrowRight'
        ? Math.floor(cur / interval + 1e-9) * interval + interval
        : Math.ceil(cur / interval - 1e-9) * interval - interval;
      timeline.setMET(newMET);
      return;
    }

    // Up/Down: speed increment/decrement
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const curIdx = SPEEDS.indexOf(timeline.state.playbackSpeed as PlaybackSpeed);
      const newIdx = e.key === 'ArrowUp'
        ? Math.min(curIdx + 1, SPEEDS.length - 1)
        : Math.max(curIdx - 1, 0);
      if (SPEEDS[newIdx] !== 1) liveState.isLive = false;
      setSpeedAndSync(SPEEDS[newIdx]);
      return;
    }

    // Space: play/pause
    if (e.key === ' ') {
      e.preventDefault();
      liveState.isLive = false;
      timeline.togglePlayPause();
      return;
    }

    // L: toggle live
    if (e.key === 'l') {
      liveState.isLive = !liveState.isLive;
      if (liveState.isLive) {
        setSpeedAndSync(1);
        const nowMET = (Date.now() - MISSION_START_UTC.getTime()) / 3600000;
        timeline.setMET(Math.max(0, Math.min(nowMET, MISSION_DURATION_HOURS)));
        if (!timeline.state.isPlaying) timeline.togglePlayPause();
      }
      return;
    }

    // Shift+E: toggle Earth POV (only when moon focused)
    if (e.key === 'E' && e.shiftKey) {
      const modes = POV_MODES[cameraController.focusTarget];
      if (modes.some((m) => m.mode === 'earth-pov')) {
        const mode = cameraController.cameraMode === 'earth-pov' ? 'free' : 'earth-pov';
        setModeAndSync(mode);
      }
      return;
    }

    // Shift+O: toggle Orion POV (when moon or earth focused)
    if (e.key === 'O' && e.shiftKey) {
      const modes = POV_MODES[cameraController.focusTarget];
      if (modes.some((m) => m.mode === 'orion-pov')) {
        const mode = cameraController.cameraMode === 'orion-pov' ? 'free' : 'orion-pov';
        setModeAndSync(mode);
      }
      return;
    }

    // PageUp/PageDown: zoom in/out
    if (e.key === 'PageUp') { e.preventDefault(); cameraController.zoom(e.shiftKey ? -0.5 : -3); return; }
    if (e.key === 'PageDown') { e.preventDefault(); cameraController.zoom(e.shiftKey ? 0.5 : 3); return; }
    // Home/End: zoom all the way in/out
    if (e.key === 'Home') { e.preventDefault(); cameraController.zoomToLimit('in'); return; }
    if (e.key === 'End') { e.preventDefault(); cameraController.zoomToLimit('out'); return; }

    // e: focus earth
    if (e.key === 'e') { setFocusAndSync('earth'); return; }
    // m: focus moon
    if (e.key === 'm') { setFocusAndSync('moon'); return; }
    // o: focus orion
    if (e.key === 'o') { setFocusAndSync('orion'); return; }

    // ?: keyboard reference
    if (e.key === '?') { kbModal.classList.toggle('open'); return; }
  });

  // Keyboard reference modal
  const kbModal = overlay.querySelector('#kb-modal-backdrop') as HTMLDivElement;
  kbModal.addEventListener('click', (e) => {
    if (e.target === kbModal) kbModal.classList.remove('open');
  });
  overlay.querySelector('#show-kb-ref')!.addEventListener('click', () => {
    kbModal.classList.add('open');
  });

  // Settings gear
  const settingsToggle = overlay.querySelector('#settings-toggle') as HTMLButtonElement;
  const settingsPanel = overlay.querySelector('#settings-panel') as HTMLDivElement;
  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.settings-wrap')) {
      settingsPanel.classList.remove('open');
    }
  });

  overlay.querySelector('#reset-state')!.addEventListener('click', () => {
    localStorage.removeItem('artemis-camera-v1');
    localStorage.removeItem('artemis-settings-v1');
    localStorage.removeItem('artemis-timeline-v1');
    localStorage.removeItem('artemis-live-v1');
    localStorage.removeItem('artemis-timezone-v1');
    localStorage.removeItem('artemis-clock-format-v1');
    window.location.reload();
  });

  const SETTINGS_KEY = 'artemis-settings-v1';
  const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Record<string, boolean>;

  function saveSetting(key: string, value: boolean): void {
    const current = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Record<string, boolean>;
    current[key] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  }

  const wireframeToggle = overlay.querySelector('#wireframe-toggle') as HTMLInputElement;
  wireframeToggle.checked = savedSettings.wireframe ?? false;
  wireframeToggle.addEventListener('change', () => {
    saveSetting('wireframe', wireframeToggle.checked);
    onWireframeToggle(wireframeToggle.checked);
  });

  const moonOrbitToggle = overlay.querySelector('#moon-orbit-toggle') as HTMLInputElement;
  moonOrbitToggle.checked = savedSettings.moonOrbit ?? false;
  moonOrbitToggle.addEventListener('change', () => {
    saveSetting('moonOrbit', moonOrbitToggle.checked);
    onMoonOrbitToggle(moonOrbitToggle.checked);
  });

  const starsToggle = overlay.querySelector('#stars-toggle') as HTMLInputElement;
  starsToggle.checked = savedSettings.stars ?? true;
  starsToggle.addEventListener('change', () => {
    saveSetting('stars', starsToggle.checked);
    onStarsToggle(starsToggle.checked);
  });

  const sunToggle = overlay.querySelector('#sun-toggle') as HTMLInputElement;
  sunToggle.checked = savedSettings.sun ?? true;
  sunToggle.addEventListener('change', () => {
    saveSetting('sun', sunToggle.checked);
    onSunToggle(sunToggle.checked);
  });

  const flightPathToggle = overlay.querySelector('#flight-path-toggle') as HTMLInputElement;
  flightPathToggle.checked = savedSettings.flightPath ?? true;
  flightPathToggle.addEventListener('change', () => {
    saveSetting('flightPath', flightPathToggle.checked);
    onFlightPathToggle(flightPathToggle.checked);
  });

  const progressPathToggle = overlay.querySelector('#progress-path-toggle') as HTMLInputElement;
  progressPathToggle.checked = savedSettings.progressPath ?? true;
  progressPathToggle.addEventListener('change', () => {
    saveSetting('progressPath', progressPathToggle.checked);
    onProgressPathToggle(progressPathToggle.checked);
  });

  const orionToggle = overlay.querySelector('#orion-toggle') as HTMLInputElement;
  orionToggle.checked = savedSettings.orion ?? true;
  orionToggle.addEventListener('change', () => {
    saveSetting('orion', orionToggle.checked);
    onOrionToggle(orionToggle.checked);
  });

  const lunarLabelsToggle = overlay.querySelector('#lunar-labels-toggle') as HTMLInputElement;
  lunarLabelsToggle.checked = savedSettings.lunarLabels ?? false;
  lunarLabelsToggle.addEventListener('change', () => {
    saveSetting('lunarLabels', lunarLabelsToggle.checked);
    onLunarLabelsToggle(lunarLabelsToggle.checked);
  });

  const icrfPlaneToggle = overlay.querySelector('#icrf-plane-toggle') as HTMLInputElement;
  icrfPlaneToggle.checked = savedSettings.icrfPlane ?? false;
  icrfPlaneToggle.addEventListener('change', () => {
    saveSetting('icrfPlane', icrfPlaneToggle.checked);
    onIcrfPlaneToggle(icrfPlaneToggle.checked);
  });

  const moonOrbitalPlaneToggle = overlay.querySelector('#moon-orbital-plane-toggle') as HTMLInputElement;
  moonOrbitalPlaneToggle.checked = savedSettings.moonOrbitalPlane ?? false;
  moonOrbitalPlaneToggle.addEventListener('change', () => {
    saveSetting('moonOrbitalPlane', moonOrbitalPlaneToggle.checked);
    onMoonOrbitalPlaneToggle(moonOrbitalPlaneToggle.checked);
  });

  const debugValuesToggle = overlay.querySelector('#debug-values-toggle') as HTMLInputElement;
  const debugValuesContainer = overlay.querySelector('#debug-values') as HTMLDivElement;
  debugValuesToggle.checked = savedSettings.debugValues ?? false;
  debugValuesToggle.addEventListener('change', () => {
    saveSetting('debugValues', debugValuesToggle.checked);
    debugValuesContainer.classList.toggle('visible', debugValuesToggle.checked);
  });

  // Apply persisted settings to scene on load
  if (wireframeToggle.checked) onWireframeToggle(true);
  if (moonOrbitToggle.checked) onMoonOrbitToggle(true);
  if (!starsToggle.checked) onStarsToggle(false);
  if (!sunToggle.checked) onSunToggle(false);
  if (!flightPathToggle.checked) onFlightPathToggle(false);
  if (!progressPathToggle.checked) onProgressPathToggle(false);
  if (!orionToggle.checked) onOrionToggle(false);
  onLunarLabelsToggle(lunarLabelsToggle.checked);
  if (icrfPlaneToggle.checked) onIcrfPlaneToggle(true);
  if (moonOrbitalPlaneToggle.checked) onMoonOrbitalPlaneToggle(true);
  debugValuesContainer.classList.toggle('visible', debugValuesToggle.checked);

  // Sync UI to restored timeline state
  const restoredSpeed = String(timeline.state.playbackSpeed);
  overlay.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
  overlay.querySelectorAll(`.speed-btn[data-speed="${restoredSpeed}"]`).forEach((b) => b.classList.add('active'));
  speedDropupTrigger.textContent = SPEED_LABELS[restoredSpeed] ?? `${restoredSpeed}x`;

  // If live mode was saved, restore it
  if (liveState.isLive) {
    const nowMET = (Date.now() - MISSION_START_UTC.getTime()) / 3600000;
    timeline.setMET(Math.max(0, Math.min(nowMET, MISSION_DURATION_HOURS)));
    timeline.setSpeed(1);
    overlay.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
    overlay.querySelectorAll('.speed-btn[data-speed="1"]').forEach((b) => b.classList.add('active'));
    speedDropupTrigger.textContent = '1x';
    if (!timeline.state.isPlaying) timeline.togglePlayPause();
  }

  return { overlay, liveState, updatePovMenu };
}

let saveCounter = 0;

export function updateOverlay(
  timeline: Timeline,
  liveState: { isLive: boolean },
  {
    distEarth,
    distMoon,
    speed,
    phaseAngle,
  }: {
    distEarth: number;
    distMoon: number;
    speed: number;
    phaseAngle: number;
  }
): void {
  // Save control state every ~60 frames (~1s at 60fps)
  if (++saveCounter >= 60) {
    saveCounter = 0;
    timeline.saveState();
    localStorage.setItem('artemis-live-v1', String(liveState.isLive));
  }
  if (liveState.isLive) {
    const nowMET = (Date.now() - MISSION_START_UTC.getTime()) / 3600000;
    timeline.setMET(Math.max(0, Math.min(nowMET, MISSION_DURATION_HOURS)));
    if (!timeline.state.isPlaying) timeline.togglePlayPause();
  }

  document.getElementById('btn-live')!.classList.toggle('live-active', liveState.isLive);

  const met = timeline.state.currentMET;
  const days = Math.floor(met / 24);
  const hours = Math.floor(met % 24);
  const mins = Math.floor((met % 1) * 60);

  const metStr = `Day ${days} / ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  document.getElementById('met')!.textContent = metStr;

  const simDate = timeline.getSimDate();
  const hour12 = currentClockFormat === '12';
  if (currentTimezone === 'UTC' && !hour12) {
    document.getElementById('utc')!.textContent = simDate
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19) + ' UTC';
  } else {
    const tz = currentTimezone === 'local' ? undefined : currentTimezone;
    const formatted = simDate.toLocaleString('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12,
    });
    const label = currentTimezone === 'local'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()!
      : simDate.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop()!;
    document.getElementById('utc')!.textContent = `${formatted} ${label}`;
  }

  document.getElementById('phase')!.textContent = timeline.getMissionPhase();

  // Update play button
  document.getElementById('btn-play')!.innerHTML = timeline.state.isPlaying
    ? '&#9646;&#9646;'
    : '&#9654;';

  // Update slider (skip during active touch scrub to prevent fighting)
  if (!scrubController?.isScrubbing()) {
    (document.getElementById('timeline-slider') as HTMLInputElement).value =
      String(met);
  }

  // Update info
  document.getElementById('dist-earth')!.textContent = formatDistance(
    distEarth * 1000
  );
  document.getElementById('dist-moon')!.textContent = formatDistance(
    distMoon * 1000
  );
  document.getElementById('velocity')!.textContent = formatSpeed(speed);
  document.getElementById('moon-phase')!.textContent = `${getMoonPhaseName(phaseAngle)} (${Math.round(phaseAngle)}°)`;
}

function formatDistance(km: number): string {
  if (km < 1000) return `${Math.round(km)} km`;
  return `${(km / 1000).toFixed(1)}K km`;
}

function formatSpeed(kmPerHour: number): string {
  if (kmPerHour < 1000) return `${Math.round(kmPerHour)} km/h`;
  return `${(kmPerHour / 1000).toFixed(1)}K km/h`;
}

function getMoonPhaseName(phaseAngle: number): string {
  // Phase angle: 0° = New Moon (Sun & Moon same direction from Earth)
  //            180° = Full Moon (Sun & Moon opposite sides)
  if (phaseAngle < 10) return 'New';
  if (phaseAngle < 80) return 'Crescent';
  if (phaseAngle < 100) return 'Quarter';
  if (phaseAngle < 170) return 'Gibbous';
  return 'Full';
}

export function setDebugValues(values: Record<string, string | number>): void {
  const container = document.getElementById('debug-values');
  if (!container) return;
  container.innerHTML = Object.entries(values)
    .map(([k, v]) => `<span>${k}: <span class="debug-val">${v}</span></span>`)
    .join('');
}
