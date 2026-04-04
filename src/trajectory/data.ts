import * as THREE from 'three';
import { HORIZONS_TRAJECTORY } from './horizons-data';
import type { StageWaypoint } from './waypoints';

export interface TrajectoryPoint {
  met: number; // mission elapsed time in hours
  position: THREE.Vector3; // scene units (ECI/ICRF)
}

/**
 * Build trajectory from editable waypoints + JPL Horizons data.
 *
 * The early waypoints (user-editable) are prepended to the Horizons
 * data, which covers MET 3.5h onward.
 */
export function generateTrajectory(editableWaypoints: StageWaypoint[]): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];

  // Add editable waypoints (sorted by MET)
  const sorted = [...editableWaypoints].sort((a, b) => a.met - b.met);
  for (const wp of sorted) {
    points.push({ met: wp.met, position: wp.position.clone() });
  }

  // Add Horizons data
  for (const row of HORIZONS_TRAJECTORY) {
    points.push({
      met: row[0],
      // ICRF (X,Y,Z) → match moon ECI coordinate system: (X, Z, -Y)
      position: new THREE.Vector3(row[1], row[3], -row[2]),
    });
  }

  return points;
}
