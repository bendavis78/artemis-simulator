import * as THREE from 'three';
import type { TrajectoryPoint } from './data';

/**
 * Trajectory interpolator using Catmull-Rom splines with
 * time-aware parameterization.
 */
export class TrajectoryInterpolator {
  private curve: THREE.CatmullRomCurve3;
  private metValues: number[];
  private curveParams: number[]; // maps each waypoint to a [0,1] curve parameter

  constructor(points: TrajectoryPoint[]) {
    this.metValues = points.map((p) => p.met);

    // Build arc-length parameterized curve
    const positions = points.map((p) => p.position.clone());
    this.curve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 0.5);

    // Compute curve parameter for each waypoint based on cumulative arc length
    const totalLength = this.curve.getLength();
    const lengths = this.curve.getLengths(points.length - 1);
    this.curveParams = lengths.map((l) => l / totalLength);
  }

  /**
   * Get spacecraft position at a given MET (hours).
   */
  getPosition(met: number): THREE.Vector3 {
    const clamped = Math.max(this.metValues[0], Math.min(met, this.metValues[this.metValues.length - 1]));

    // Find the two waypoints bracketing this MET
    let i = 0;
    for (; i < this.metValues.length - 1; i++) {
      if (this.metValues[i + 1] >= clamped) break;
    }

    const t0 = this.metValues[i];
    const t1 = this.metValues[Math.min(i + 1, this.metValues.length - 1)];

    // Linear interpolation of MET within this segment
    const segFrac = t1 > t0 ? (clamped - t0) / (t1 - t0) : 0;

    // Map to curve parameter
    const p0 = this.curveParams[i];
    const p1 = this.curveParams[Math.min(i + 1, this.curveParams.length - 1)];
    const curveT = p0 + segFrac * (p1 - p0);

    return this.curve.getPointAt(curveT);
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

    const p0 = this.curveParams[i];
    const p1 = this.curveParams[Math.min(i + 1, this.curveParams.length - 1)];
    const curveT = p0 + segFrac * (p1 - p0);

    return this.curve.getTangentAt(curveT);
  }

  /**
   * Get approximate velocity magnitude (km/h) at a given MET.
   */
  getSpeed(met: number): number {
    const dt = 0.01; // hours
    const p1 = this.getPosition(met);
    const p2 = this.getPosition(met + dt);
    const distSceneUnits = p1.distanceTo(p2);
    return (distSceneUnits * 1000) / dt; // km/h
  }

  /**
   * Get all curve points for visualization (arc-length parameterized).
   */
  getCurvePoints(segments: number = 2000): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      points.push(this.curve.getPointAt(i / segments));
    }
    return points;
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

    const p0 = this.curveParams[i];
    const p1 = this.curveParams[Math.min(i + 1, this.curveParams.length - 1)];
    return p0 + segFrac * (p1 - p0);
  }
}
