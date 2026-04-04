import * as THREE from 'three';

export interface StageWaypoint {
  id: number;        // stage number (1-15)
  label: string;
  met: number;       // mission elapsed time in hours
  position: THREE.Vector3; // scene units (ICRF)
  editable: boolean; // false for stages on the Horizons path
}

/**
 * Default positions for the early mission waypoints (stages 1-5).
 * These cover MET 0-3.5h before Horizons data begins.
 *
 * The positions are rough initial guesses — the user adjusts them
 * via the in-app editor to match the real trajectory shape.
 *
 * Coordinate system: ICRF geocentric, 1 unit = 1,000 km.
 * First Horizons point: MET 3.5h at (-25.13, -13.94, -7.58).
 */
// Positions are in Three.js scene units (1 unit = 1000 km), equatorial coords:
// Three.js X = ICRF X, Three.js Y = ICRF Z (north = up), Three.js Z = -ICRF Y
// First Horizons point (MET 3.5h) remapped: (-25.13, -7.58, 13.94)
const DEFAULT_EDITABLE_WAYPOINTS: (Omit<StageWaypoint, 'position'> & { position: [number, number, number] })[] = [
  // Stage 1: Launch from KSC
  { id: 1, label: 'Launch', met: 0.00, position: [1.0, 1.5, -6.2], editable: true },

  // Stage 2: Jettison boosters/fairings/LAS (~2 min)
  { id: 2, label: 'Jettison', met: 0.04, position: [2.5, 2.5, -5.5], editable: true },

  // Stage 3: Core stage MECO + separation (~8 min)
  { id: 3, label: 'Core Stage Sep.', met: 0.15, position: [4.5, 3.5, -3.5], editable: true },

  // LEO coast - intermediate point (half orbit)
  { id: 101, label: 'LEO Coast', met: 0.75, position: [1.0, -3.0, 5.5], editable: true },

  // Stage 4: Perigee raise maneuver (~1.5h)
  { id: 4, label: 'Perigee Raise', met: 1.50, position: [-5.0, -1.0, -2.0], editable: true },

  // Stage 5: Apogee raise burn (~2h)
  { id: 5, label: 'Apogee Raise', met: 2.00, position: [-2.0, 2.0, -5.5], editable: true },

  // Climbing toward first Horizons point
  { id: 102, label: 'Climbing', met: 2.75, position: [-10.0, -2.0, 2.0], editable: true },

  // Near-join to Horizons data
  { id: 103, label: 'Coast', met: 3.25, position: [-20.0, -6.0, 10.0], editable: true },
];

/**
 * Stage markers on the Horizons path (non-editable).
 * Placed at approximate MET times.
 */
export const HORIZONS_STAGE_MARKERS: Omit<StageWaypoint, 'position'>[] = [
  { id: 6, label: 'Prox Ops Demo', met: 24.0, editable: false },
  { id: 7, label: 'TLI Burn', met: 25.5, editable: false },
  { id: 8, label: 'ICPS Disposal', met: 27.0, editable: false },
  { id: 9, label: 'HEO Checkout', met: 40.0, editable: false },
  { id: 10, label: 'Outbound Transit', met: 72.0, editable: false },
  { id: 11, label: 'Lunar Flyby', met: 120.5, editable: false },
  { id: 12, label: 'Trans-Earth Return', met: 155.0, editable: false },
  { id: 13, label: 'CM/SM Separation', met: 214.0, editable: false },
  { id: 14, label: 'Entry Interface', met: 215.5, editable: false },
  { id: 15, label: 'Splashdown', met: 216.5, editable: false },
];

const STORAGE_KEY = 'artemis-waypoints-v1';

/**
 * Load editable waypoints from localStorage, or use defaults.
 */
export function loadWaypoints(): StageWaypoint[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as { id: number; met: number; position: [number, number, number] }[];
      // Merge saved positions with the default labels/editability
      return DEFAULT_EDITABLE_WAYPOINTS.map((def) => {
        const override = parsed.find((p) => p.id === def.id);
        const pos = override ? override.position : def.position;
        return {
          id: def.id,
          label: def.label,
          met: override ? override.met : def.met,
          position: new THREE.Vector3(pos[0], pos[1], pos[2]),
          editable: true,
        };
      });
    } catch {
      // Fall through to defaults
    }
  }

  return DEFAULT_EDITABLE_WAYPOINTS.map((def) => ({
    id: def.id,
    label: def.label,
    met: def.met,
    position: new THREE.Vector3(def.position[0], def.position[1], def.position[2]),
    editable: true,
  }));
}

/**
 * Save editable waypoint positions to localStorage.
 */
export function saveWaypoints(waypoints: StageWaypoint[]): void {
  const data = waypoints
    .filter((w) => w.editable)
    .map((w) => ({
      id: w.id,
      met: w.met,
      position: [w.position.x, w.position.y, w.position.z] as [number, number, number],
    }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Reset waypoints to defaults and clear localStorage.
 */
export function resetWaypoints(): StageWaypoint[] {
  localStorage.removeItem(STORAGE_KEY);
  return loadWaypoints();
}
