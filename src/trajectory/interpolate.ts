import * as THREE from 'three';
import type { TrajectoryPoint } from './data';

/**
 * Trajectory interpolator using Catmull-Rom splines with
 * uniform parameterization (passes through all control points).
 */
export class TrajectoryInterpolator {
  private curve: THREE.CatmullRomCurve3;
  private metValues: number[];
  private numPoints: number;

  constructor(points: TrajectoryPoint[]) {
    this.metValues = points.map((p) => p.met);
    this.numPoints = points.length;

    const positions = points.map((p) => p.position.clone());
    this.curve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 0.5);
  }

  /**
   * Get spacecraft position at a given MET (hours).
   */
  getPosition(met: number): THREE.Vector3 {
    const clamped = Math.max(this.metValues[0], Math.min(met, this.metValues[this.metValues.length - 1]));

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

  /**
   * Get velocity direction (tangent) at a given MET.
   */
  getVelocityDirection(met: number): THREE.Vector3 {
    const clamped = Math.max(this.metValues[0], Math.min(met, this.metValues[this.metValues.length - 1]));

    let i = 0;
    for (; i < this.metValues.length - 1; i++) {
      if (this.metValues[i + 1] >= clamped) break;
    }

    const t0 = this.metValues[i];
    const t1 = this.metValues[Math.min(i + 1, this.metValues.length - 1)];
    const segFrac = t1 > t0 ? (clamped - t0) / (t1 - t0) : 0;

    const t = (i + segFrac) / (this.numPoints - 1);
    return this.curve.getTangent(t);
  }

  /**
   * Get approximate velocity magnitude (km/h) at a given MET.
   */
  getSpeed(met: number): number {
    const dt = 0.01;
    const p1 = this.getPosition(met);
    const p2 = this.getPosition(met + dt);
    const distSceneUnits = p1.distanceTo(p2);
    return (distSceneUnits * 1000) / dt;
  }

  /**
   * Get all curve points for visualization.
   */
  getCurvePoints(segments: number = 2000): THREE.Vector3[] {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      pts.push(this.curve.getPoint(i / segments));
    }
    return pts;
  }

  /**
   * Get the fraction [0, 1] along the curve for a given MET.
   */
  getCurveFraction(met: number): number {
    const clamped = Math.max(this.metValues[0], Math.min(met, this.metValues[this.metValues.length - 1]));

    let i = 0;
    for (; i < this.metValues.length - 1; i++) {
      if (this.metValues[i + 1] >= clamped) break;
    }

    const t0 = this.metValues[i];
    const t1 = this.metValues[Math.min(i + 1, this.metValues.length - 1)];
    const segFrac = t1 > t0 ? (clamped - t0) / (t1 - t0) : 0;

    return (i + segFrac) / (this.numPoints - 1);
  }
}
