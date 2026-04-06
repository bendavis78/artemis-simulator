import type { Timeline, PlaybackSpeed } from '../controls/timeline';
import type { CameraController, FocusTarget, ReferencePlane, CameraMode } from '../controls/camera';
import { MISSION_DURATION_HOURS, MISSION_START_UTC } from '../constants';

export function createOverlay(
  timeline: Timeline,
  cameraController: CameraController,
  { onWireframeToggle, onMoonOrbitToggle, onStarsToggle, onFlightPathToggle, onProgressPathToggle, onOrionToggle, onIcrfPlaneToggle, onMoonOrbitalPlaneToggle, onGridFadeToggle, onReferencePlaneChange }: {
    onWireframeToggle: (enabled: boolean) => void;
    onMoonOrbitToggle: (enabled: boolean) => void;
    onStarsToggle: (enabled: boolean) => void;
    onFlightPathToggle: (enabled: boolean) => void;
    onProgressPathToggle: (enabled: boolean) => void;
    onOrionToggle: (enabled: boolean) => void;
    onIcrfPlaneToggle: (enabled: boolean) => void;
    onMoonOrbitalPlaneToggle: (enabled: boolean) => void;
    onGridFadeToggle: (enabled: boolean) => void;
    onReferencePlaneChange: (plane: ReferencePlane) => void;
  },
): { overlay: HTMLDivElement; liveState: { isLive: boolean } } {
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
      #overlay * { pointer-events: auto; }

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

      .pov-group {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .separator {
        width: 1px;
        height: 20px;
        background: rgba(255,255,255,0.2);
        margin: 0 4px;
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
    </style>

    <div class="top-bar">
      <span class="title">ARTEMIS II</span>
      <span class="phase" id="phase">—</span>
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
        <button class="btn speed-btn" data-speed="1">1x</button>
        <button class="btn speed-btn" data-speed="10">10x</button>
        <button class="btn speed-btn active" data-speed="100">100x</button>
        <button class="btn speed-btn" data-speed="1000">1Kx</button>
        <button class="btn speed-btn" data-speed="10000">10Kx</button>
        <div class="separator"></div>
        <button class="btn focus-btn" data-focus="earth">Earth</button>
        <button class="btn focus-btn" data-focus="moon">Moon</button>
        <button class="btn focus-btn" data-focus="orion">Orion</button>
        <span class="pov-group" id="pov-group" style="display:none;">
          <div class="separator"></div>
          <button class="btn mode-btn" data-mode="earth-pov">Earth POV</button>
          <button class="btn mode-btn" data-mode="orion-pov">Orion POV</button>
        </span>
        <div class="separator"></div>
        <button class="btn plane-btn" data-plane="icrf">ICRF</button>
        <button class="btn plane-btn" data-plane="lunar">Lunar</button>
        <div class="settings-wrap">
          <div class="settings-panel" id="settings-panel">
            <label><input type="checkbox" id="wireframe-toggle"> Wireframe</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="moon-orbit-toggle"> Moon Orbit</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="stars-toggle" checked> Stars</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="flight-path-toggle" checked> Flight Path</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="progress-path-toggle" checked> Progress Path</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="orion-toggle" checked> Orion</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="icrf-plane-toggle"> ICRF Plane</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="moon-orbital-plane-toggle"> Moon Orbital Plane</label>
            <label style="margin-top: 6px;"><input type="checkbox" id="grid-fade-toggle" checked> Grid Fade</label>
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
  `;

  document.body.appendChild(overlay);

  // Reflect restored camera state in buttons
  const povGroup = overlay.querySelector('#pov-group') as HTMLElement;
  overlay.querySelector(`.focus-btn[data-focus="${cameraController.focusTarget}"]`)?.classList.add('active');
  overlay.querySelector(`.plane-btn[data-plane="${cameraController.referencePlane}"]`)?.classList.add('active');
  if (cameraController.cameraMode !== 'free') {
    overlay.querySelector(`.mode-btn[data-mode="${cameraController.cameraMode}"]`)?.classList.add('active');
  }
  povGroup.style.display = cameraController.focusTarget === 'moon' ? '' : 'none';

  const liveState = { isLive: false };

  // Wire up events
  const slider = overlay.querySelector('#timeline-slider') as HTMLInputElement;
  slider.addEventListener('input', () => {
    liveState.isLive = false;
    timeline.setMET(parseFloat(slider.value));
  });

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
    overlay.querySelector('.speed-btn[data-speed="1"]')!.classList.add('active');
    const nowMET = (Date.now() - MISSION_START_UTC.getTime()) / 3600000;
    timeline.setMET(Math.max(0, Math.min(nowMET, MISSION_DURATION_HOURS)));
    if (!timeline.state.isPlaying) {
      timeline.togglePlayPause();
    }
  });

  overlay.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const speed = parseInt(
        (btn as HTMLElement).dataset.speed!
      ) as PlaybackSpeed;
      if (speed !== 1) liveState.isLive = false;
      timeline.setSpeed(speed);
      overlay.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  overlay.querySelectorAll('.focus-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const focus = (btn as HTMLElement).dataset.focus as FocusTarget;
      cameraController.setFocus(focus);
      overlay.querySelectorAll('.focus-btn').forEach((b) => b.classList.remove('active'));
      overlay.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      povGroup.style.display = focus === 'moon' ? '' : 'none';
    });
  });

  overlay.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = (btn as HTMLElement).dataset.mode as CameraMode;
      const isActive = btn.classList.contains('active');
      if (isActive) {
        // Toggle off: return to free mode, keep focus on the mode's body
        cameraController.setCameraMode('free');
        overlay.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
        // Sync focus button with current focus target
        overlay.querySelectorAll('.focus-btn').forEach((b) => b.classList.remove('active'));
        overlay.querySelector(`.focus-btn[data-focus="${cameraController.focusTarget}"]`)?.classList.add('active');
      } else {
        cameraController.setCameraMode(mode);
        overlay.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
        overlay.querySelectorAll('.focus-btn').forEach((b) => b.classList.remove('active'));
        // Highlight the focus body that the mode locked to
        overlay.querySelector(`.focus-btn[data-focus="${cameraController.focusTarget}"]`)?.classList.add('active');
        btn.classList.add('active');
      }
    });
  });

  overlay.querySelectorAll('.plane-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const plane = (btn as HTMLElement).dataset.plane as ReferencePlane;
      onReferencePlaneChange(plane);
      overlay.querySelectorAll('.plane-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Arrow key timeline scrubbing
  const ARROW_INTERVALS: Record<number, number> = {
    1: 15 / 60,     // 15 minutes
    10: 1,          // 1 hour
    100: 6,         // 6 hours
    1000: 24,       // 1 day
    10000: 24,      // 1 day
  };

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    liveState.isLive = false;
    const interval = ARROW_INTERVALS[timeline.state.playbackSpeed] ?? 1;
    const cur = timeline.state.currentMET;
    const newMET = e.key === 'ArrowRight'
      ? Math.floor(cur / interval + 1e-9) * interval + interval
      : Math.ceil(cur / interval - 1e-9) * interval - interval;
    timeline.setMET(newMET);
  });

  // Settings gear
  const settingsToggle = overlay.querySelector('#settings-toggle') as HTMLButtonElement;
  const settingsPanel = overlay.querySelector('#settings-panel') as HTMLDivElement;
  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
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

  const gridFadeToggle = overlay.querySelector('#grid-fade-toggle') as HTMLInputElement;
  gridFadeToggle.checked = savedSettings.gridFade ?? true;
  gridFadeToggle.addEventListener('change', () => {
    saveSetting('gridFade', gridFadeToggle.checked);
    onGridFadeToggle(gridFadeToggle.checked);
  });

  // Apply persisted settings to scene on load
  if (wireframeToggle.checked) onWireframeToggle(true);
  if (moonOrbitToggle.checked) onMoonOrbitToggle(true);
  if (!starsToggle.checked) onStarsToggle(false);
  if (!flightPathToggle.checked) onFlightPathToggle(false);
  if (!progressPathToggle.checked) onProgressPathToggle(false);
  if (!orionToggle.checked) onOrionToggle(false);
  if (icrfPlaneToggle.checked) onIcrfPlaneToggle(true);
  if (moonOrbitalPlaneToggle.checked) onMoonOrbitalPlaneToggle(true);
  if (!gridFadeToggle.checked) onGridFadeToggle(false);

  return { overlay, liveState };
}

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
  document.getElementById('utc')!.textContent = simDate
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19) + ' UTC';

  document.getElementById('phase')!.textContent = timeline.getMissionPhase();

  // Update play button
  document.getElementById('btn-play')!.innerHTML = timeline.state.isPlaying
    ? '&#9646;&#9646;'
    : '&#9654;';

  // Update slider
  (document.getElementById('timeline-slider') as HTMLInputElement).value =
    String(met);

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
