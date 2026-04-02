import { MISSION_START_UTC, MISSION_DURATION_HOURS } from '../constants';

export type PlaybackSpeed = 1 | 10 | 100 | 1000 | 10000;

export interface TimelineState {
  currentMET: number; // mission elapsed time in hours
  playbackSpeed: PlaybackSpeed;
  isPlaying: boolean;
}

export class Timeline {
  state: TimelineState;

  constructor() {
    this.state = {
      currentMET: 0,
      playbackSpeed: 100,
      isPlaying: false,
    };
  }

  update(deltaSeconds: number): void {
    if (!this.state.isPlaying) return;

    this.state.currentMET += (deltaSeconds / 3600) * this.state.playbackSpeed;
    this.state.currentMET = Math.max(
      0,
      Math.min(this.state.currentMET, MISSION_DURATION_HOURS)
    );

    if (this.state.currentMET >= MISSION_DURATION_HOURS) {
      this.state.isPlaying = false;
    }
  }

  setMET(met: number): void {
    this.state.currentMET = Math.max(
      0,
      Math.min(met, MISSION_DURATION_HOURS)
    );
  }

  togglePlayPause(): void {
    this.state.isPlaying = !this.state.isPlaying;
    // If at end, restart
    if (
      this.state.isPlaying &&
      this.state.currentMET >= MISSION_DURATION_HOURS
    ) {
      this.state.currentMET = 0;
    }
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.state.playbackSpeed = speed;
  }

  getSimDate(): Date {
    return new Date(
      MISSION_START_UTC.getTime() + this.state.currentMET * 3600000
    );
  }

  getMissionPhase(): string {
    const met = this.state.currentMET;
    if (met < 0.15) return 'Launch / Ascent';
    if (met < 2) return 'LEO Parking Orbit';
    if (met < 4) return 'Orbit Raising Burns';
    if (met < 5) return 'ICPS Separation';
    if (met < 25.5) return 'High Earth Orbit';
    if (met < 26) return 'Trans-Lunar Injection';
    if (met < 120) return 'Trans-Lunar Coast';
    if (met < 130) return 'Lunar Approach';
    if (met < 138) return 'Lunar Flyby (Far Side)';
    if (met < 145) return 'Lunar Departure';
    if (met < 228) return 'Trans-Earth Coast';
    if (met < 231) return 'Earth Approach';
    if (met < 233) return 'Entry & Descent';
    return 'Splashdown';
  }
}
