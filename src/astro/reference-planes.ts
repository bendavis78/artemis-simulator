import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { getMoonOrbitPoints } from './moon-position';

// --- Tuning constants ---
const GRID_SIZE = 1000;          // total extent of each plane (scene units)
const GRID_MIN_DIVISIONS = 20;   // minimum grid divisions (maximum step size)
const GRID_DENSITY = 0.08;       // rawStep = cameraDist * GRID_DENSITY; lower = more lines
const GRID_OPACITY = 0.18;       // faint grid lines
const CENTER_OPACITY = 0.5;      // bold center axis lines
const CENTER_LINEWIDTH = 2;      // pixels (Line2)

/** Snap a raw step value to the nearest 1-2-2.5-5 sequence number. */
function niceStep(raw: number): number {
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const frac = raw / base;
  if (frac < 1.5)  return base;
  if (frac < 2.25) return 2 * base;
  if (frac < 3.5)  return 2.5 * base;
  if (frac < 7.5)  return 5 * base;
  return 10 * base;
}

function buildGridPositions(step: number): Float32Array {
  const half = GRID_SIZE / 2;
  const verts: number[] = [];
  for (let t = -half; t <= half + step * 0.01; t += step) {
    if (Math.abs(t) < step * 0.01) continue; // center drawn separately
    verts.push(-half, t, 0,  half, t, 0);
    verts.push(t, -half, 0,  t,  half, 0);
  }
  return new Float32Array(verts);
}

interface ReferencePlane {
  group: THREE.Group;
  update: (cameraDist: number) => void;
}

function createGridGroup(normal: THREE.Vector3, color: number): ReferencePlane {
  const group = new THREE.Group();
  const half = GRID_SIZE / 2;

  // Faint grid lines — geometry rebuilt on zoom change
  const gridMat = new THREE.LineBasicMaterial({ color, opacity: GRID_OPACITY, transparent: true });
  const gridLines = new THREE.LineSegments(new THREE.BufferGeometry(), gridMat);
  group.add(gridLines);

  // Bold center axes (Line2 for actual linewidth)
  const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
  const boldMat = new LineMaterial({ color, linewidth: CENTER_LINEWIDTH, transparent: true, opacity: CENTER_OPACITY, resolution });

  const hGeo = new LineGeometry();
  hGeo.setPositions([-half, 0, 0, half, 0, 0]);
  group.add(new Line2(hGeo, boldMat));

  const vGeo = new LineGeometry();
  vGeo.setPositions([0, -half, 0, 0, half, 0]);
  group.add(new Line2(vGeo, boldMat));

  window.addEventListener('resize', () => {
    boldMat.resolution.set(window.innerWidth, window.innerHeight);
  });

  // Orient local Z to the plane normal (grid is built in local XY plane)
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());

  let currentStep = -1;

  function update(cameraDist: number): void {
    const maxStep = GRID_SIZE / GRID_MIN_DIVISIONS;
    const raw = Math.min(Math.max(cameraDist * GRID_DENSITY, 0.1), maxStep);
    const step = niceStep(raw);
    if (step === currentStep) return;
    currentStep = step;
    const positions = buildGridPositions(step);
    const newGeo = new THREE.BufferGeometry();
    newGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    gridLines.geometry.dispose();
    gridLines.geometry = newGeo;
  }

  return { group, update };
}

export function createIcrfPlane(): ReferencePlane {
  return createGridGroup(new THREE.Vector3(0, 1, 0), 0x3366aa);
}

export function createEclipticPlane(): ReferencePlane {
  const obliquity = 23.4393 * (Math.PI / 180);
  const normal = new THREE.Vector3(0, Math.cos(obliquity), Math.sin(obliquity));
  return createGridGroup(normal, 0xccaa44);
}

export function createMoonOrbitalPlane(): ReferencePlane {
  const points = getMoonOrbitPoints(256);
  const normal = new THREE.Vector3();
  for (let i = 0; i < points.length - 1; i++) {
    normal.addScaledVector(points[i].clone().cross(points[i + 1]), 1);
  }
  normal.normalize();
  return createGridGroup(normal, 0xcccccc);
}
