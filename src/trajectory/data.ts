import * as THREE from 'three';
import { HORIZONS_TRAJECTORY } from './horizons-data';

export interface TrajectoryPoint {
  met: number;
  position: THREE.Vector3;
}

export function generateTrajectory(): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];

  for (const row of HORIZONS_TRAJECTORY) {
    points.push({
      met: row[0],
      position: new THREE.Vector3(row[1], row[3], -row[2]),
    });
  }

  return points;
}
