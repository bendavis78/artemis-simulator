import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import type { TrajectoryInterpolator } from './interpolate';

/**
 * Create the flight path visualization:
 * - Full path as a faint dashed line
 * - Progress path (up to current MET) as a bright solid line
 */
export function createFlightPath(interpolator: TrajectoryInterpolator): {
  fullPath: Line2;
  progressPath: Line2;
  update: (fraction: number) => void;
} {
  const allPoints = interpolator.getCurvePoints(50000);

  // Flatten positions for LineGeometry
  const positions = new Float32Array(allPoints.length * 3);
  for (let i = 0; i < allPoints.length; i++) {
    positions[i * 3] = allPoints[i].x;
    positions[i * 3 + 1] = allPoints[i].y;
    positions[i * 3 + 2] = allPoints[i].z;
  }

  // Full path - faint dashed line
  const fullGeom = new LineGeometry();
  fullGeom.setPositions(positions);
  const fullMat = new LineMaterial({
    color: 0x4a6a9f,
    linewidth: 1.5,
    dashed: true,
    dashSize: 1,
    gapSize: 0.5,
    transparent: true,
    opacity: 0.5,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
  });
  const fullPath = new Line2(fullGeom, fullMat);
  fullPath.computeLineDistances();
  fullPath.name = 'flightPathFull';

  // Progress path - bright colored line
  const progressGeom = new LineGeometry();
  progressGeom.setPositions(positions);

  // Create color array for gradient effect
  const colors = new Float32Array(allPoints.length * 3);
  for (let i = 0; i < allPoints.length; i++) {
    const frac = i / (allPoints.length - 1);
    // Blue near Earth -> gold near Moon -> green on return
    if (frac < 0.45) {
      const t = frac / 0.45;
      colors[i * 3] = 0.3 + t * 0.7;
      colors[i * 3 + 1] = 0.5 + t * 0.3;
      colors[i * 3 + 2] = 1.0 - t * 0.8;
    } else {
      const t = (frac - 0.45) / 0.55;
      colors[i * 3] = 1.0 - t * 0.7;
      colors[i * 3 + 1] = 0.8 + t * 0.2;
      colors[i * 3 + 2] = 0.2 + t * 0.3;
    }
  }
  progressGeom.setColors(colors);

  const progressMat = new LineMaterial({
    vertexColors: true,
    linewidth: 3,
    transparent: true,
    opacity: 0.9,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
  });
  const progressPath = new Line2(progressGeom, progressMat);
  progressPath.name = 'flightPathProgress';

  function update(fraction: number) {
    const count = Math.max(1, Math.floor(fraction * (allPoints.length - 1)) + 1);
    progressPath.geometry.instanceCount = Math.min(count, allPoints.length - 1);
  }

  // Update resolution on resize
  window.addEventListener('resize', () => {
    const res = new THREE.Vector2(window.innerWidth, window.innerHeight);
    fullMat.resolution.copy(res);
    progressMat.resolution.copy(res);
  });

  return { fullPath, progressPath, update };
}
