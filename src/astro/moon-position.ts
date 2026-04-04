import * as THREE from 'three';
import { MOON_EPHEMERIS } from './moon-ephemeris';

export interface MoonPoint {
  met: number;
  position: THREE.Vector3;
}

export class MoonInterpolator {
  private metValues: number[];
  private positions: THREE.Vector3[];
  private curve: THREE.CatmullRomCurve3;
  private numPoints: number;

  constructor() {
    const points: MoonPoint[] = MOON_EPHEMERIS.map((row) => ({
      met: row[0],
      position: new THREE.Vector3(row[1], row[3], -row[2]),
    }));

    this.metValues = points.map((p) => p.met);
    this.positions = points.map((p) => p.position.clone());
    this.numPoints = points.length;

    const curvePoints = this.positions.map((p) => p.clone());
    this.curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.5);
  }

  getPosition(met: number): THREE.Vector3 {
    const clamped = Math.max(
      this.metValues[0],
      Math.min(met, this.metValues[this.metValues.length - 1])
    );

    let i = 0;
    for (; i < this.metValues.length - 1; i++) {
      if (this.metValues[i + 1] >= clamped) break;
    }

    const t0 = this.metValues[i];
    const t1 = this.metValues[Math.min(i + 1, this.metValues.length - 1)];
    const segFrac = t1 > t0 ? (clamped - t0) / (t1 - t0) : 0;

    const t = (i + segFrac) / (this.numPoints - 1);
    return this.curve.getPoint(t);
  }

  getPoints(segments: number = 500): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      points.push(this.curve.getPoint(i / segments));
    }
    return points;
  }

  getMetRange(): { start: number; end: number } {
    return {
      start: this.metValues[0],
      end: this.metValues[this.metValues.length - 1],
    };
  }
}

let moonInterpolator: MoonInterpolator | null = null;

function getMoonInterpolator(): MoonInterpolator {
  if (!moonInterpolator) {
    moonInterpolator = new MoonInterpolator();
  }
  return moonInterpolator;
}

export function getMoonPosition(met: number): THREE.Vector3 {
  return getMoonInterpolator().getPosition(met);
}

export function getMoonOrbitPoints(segments?: number): THREE.Vector3[] {
  return getMoonInterpolator().getPoints(segments);
}

export function getMoonMetRange(): { start: number; end: number } {
  return getMoonInterpolator().getMetRange();
}
