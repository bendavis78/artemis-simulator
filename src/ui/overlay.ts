import type { Timeline, PlaybackSpeed } from '../controls/timeline';
import type { CameraController, FocusTarget } from '../controls/camera';
import { MISSION_DURATION_HOURS } from '../constants';

export function createOverlay(
  timeline: Timeline,
  cameraController: CameraController,
): HTMLDivElement {
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
    </style>

    <div class="top-bar">
      <span class="title">ARTEMIS II</span>
      <span class="phase" id="phase">—</span>
    </div>

    <div class="bottom-panel">
      <div class="time-row">
        <span class="met" id="met">MET 000:00:00</span>
        <span class="utc" id="utc">—</span>
      </div>

      <div class="slider-row">
        <input type="range" class="timeline-slider" id="timeline-slider"
               min="0" max="${MISSION_DURATION_HOURS}" step="0.01" value="0">
      </div>

      <div class="controls-row">
        <button class="btn btn-play" id="btn-play">&#9654;</button>
        <div class="separator"></div>
        <button class="btn speed-btn" data-speed="1">1x</button>
        <button class="btn speed-btn" data-speed="10">10x</button>
        <button class="btn speed-btn active" data-speed="100">100x</button>
        <button class="btn speed-btn" data-speed="1000">1Kx</button>
        <button class="btn speed-btn" data-speed="10000">10Kx</button>
        <div class="separator"></div>
        <button class="btn focus-btn active" data-focus="earth">Earth</button>
        <button class="btn focus-btn" data-focus="moon">Moon</button>
        <button class="btn focus-btn" data-focus="orion">Orion</button>
      </div>

      <div class="info-row">
        <span>Earth: <span class="info-value" id="dist-earth">—</span></span>
        <span>Moon: <span class="info-value" id="dist-moon">—</span></span>
        <span>Speed: <span class="info-value" id="velocity">—</span></span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Wire up events
  const slider = overlay.querySelector('#timeline-slider') as HTMLInputElement;
  slider.addEventListener('input', () => {
    timeline.setMET(parseFloat(slider.value));
  });

  const playBtn = overlay.querySelector('#btn-play') as HTMLButtonElement;
  playBtn.addEventListener('click', () => {
    timeline.togglePlayPause();
  });

  overlay.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const speed = parseInt(
        (btn as HTMLElement).dataset.speed!
      ) as PlaybackSpeed;
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
      btn.classList.add('active');
    });
  });

  return overlay;
}

export function updateOverlay(
  timeline: Timeline,
  {
    distEarth,
    distMoon,
    speed,
  }: {
    distEarth: number;
    distMoon: number;
    speed: number;
  }
): void {
  const met = timeline.state.currentMET;
  const h = Math.floor(met);
  const m = Math.floor((met - h) * 60);
  const s = Math.floor(((met - h) * 60 - m) * 60);

  const metStr = `MET ${String(h).padStart(3, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
}

function formatDistance(km: number): string {
  if (km < 1000) return `${Math.round(km)} km`;
  return `${(km / 1000).toFixed(1)}K km`;
}

function formatSpeed(kmPerHour: number): string {
  if (kmPerHour < 1000) return `${Math.round(kmPerHour)} km/h`;
  return `${(kmPerHour / 1000).toFixed(1)}K km/h`;
}
