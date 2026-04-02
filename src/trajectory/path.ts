import * as THREE from 'three';
import type { TrajectoryInterpolator } from './interpolate';

/**
 * Create the flight path visualization:
 * - Full path as a faint dashed line
 * - Progress path (up to current MET) as a bright solid line
 */
export function createFlightPath(interpolator: TrajectoryInterpolator): {
  fullPath: THREE.Line;
  progressPath: THREE.Line;
  update: (fraction: number) => void;
} {
  const allPoints = interpolator.getCurvePoints(2000);

  // Full path - faint dashed line
  const fullGeom = new THREE.BufferGeometry().setFromPoints(allPoints);
  const fullMat = new THREE.LineDashedMaterial({
    color: 0x334466,
    dashSize: 1,
    gapSize: 0.5,
    transparent: true,
    opacity: 0.4,
  });
  const fullPath = new THREE.Line(fullGeom, fullMat);
  fullPath.computeLineDistances();
  fullPath.name = 'flightPathFull';

  // Progress path - bright line showing where the spacecraft has been
  // We'll use a draw range to show only part of it
  const progressGeom = new THREE.BufferGeometry().setFromPoints(allPoints);

  // Create color array for gradient effect
  const colors = new Float32Array(allPoints.length * 3);
  for (let i = 0; i < allPoints.length; i++) {
    const frac = i / (allPoints.length - 1);
    // Blue near Earth -> gold near Moon -> green on return
    if (frac < 0.45) {
      // Blue to gold
      const t = frac / 0.45;
      colors[i * 3] = 0.3 + t * 0.7; // R
      colors[i * 3 + 1] = 0.5 + t * 0.3; // G
      colors[i * 3 + 2] = 1.0 - t * 0.8; // B
    } else {
      // Gold to green
      const t = (frac - 0.45) / 0.55;
      colors[i * 3] = 1.0 - t * 0.7; // R
      colors[i * 3 + 1] = 0.8 + t * 0.2; // G
      colors[i * 3 + 2] = 0.2 + t * 0.3; // B
    }
  }
  progressGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const progressMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
  });
  const progressPath = new THREE.Line(progressGeom, progressMat);
  progressPath.name = 'flightPathProgress';

  function update(fraction: number) {
    const count = Math.floor(fraction * allPoints.length);
    progressPath.geometry.setDrawRange(0, count);
  }

  return { fullPath, progressPath, update };
}
