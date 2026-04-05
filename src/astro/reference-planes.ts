import * as THREE from 'three';
import { getMoonOrbitPoints } from './moon-position';

// --- Tuning constants ---
const GRID_SIZE = 4000;          // total extent of each plane (scene units)
const GRID_MIN_DIVISIONS = 20;   // minimum grid divisions (maximum step size)
const GRID_DENSITY = 0.2;       // rawStep = cameraDist * GRID_DENSITY; lower = more lines
const FADE_NEAR_FACTOR = 0.8;    // fadeNear = camDist * factor (full opacity within this)
const FADE_FAR_FACTOR = 2.5;     // fadeFar  = camDist * factor (zero opacity beyond this)

// --- Per-plane styles ---
interface PlaneStyle {
  color: number;
  gridOpacity: number;
  centerOpacity: number;
}

const ICRF_STYLE: PlaneStyle     = { color: 0x3366aa, gridOpacity: 0.5, centerOpacity: 0.9 };
const ECLIPTIC_STYLE: PlaneStyle = { color: 0xccaa44, gridOpacity: 0.5, centerOpacity: 0.9 };
const MOON_STYLE: PlaneStyle     = { color: 0xcccccc, gridOpacity: 0.3, centerOpacity: 0.6 };

const GRID_VERT = /* glsl */`
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const GRID_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uFadeNear;
  uniform float uFadeFar;
  uniform vec3 uFocusPos;
  varying vec3 vWorldPos;
  void main() {
    float dist = length(vWorldPos - uFocusPos);
    float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, dist);
    gl_FragColor = vec4(uColor, uOpacity * fade);
  }
`;

function createGridMaterial(color: number, opacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: GRID_VERT,
    fragmentShader: GRID_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor:     { value: new THREE.Color(color) },
      uOpacity:   { value: opacity },
      uFadeNear:  { value: 1.0 },
      uFadeFar:   { value: 10.0 },
      uFocusPos:  { value: new THREE.Vector3() },
    },
  });
}

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

function buildCenterPositions(): Float32Array {
  const half = GRID_SIZE / 2;
  return new Float32Array([
    -half, 0, 0,  half, 0, 0,
     0, -half, 0,  0,  half, 0,
  ]);
}

interface ReferencePlane {
  group: THREE.Group;
  update: (cameraPos: THREE.Vector3, centerPos: THREE.Vector3, fadePos: THREE.Vector3) => void;
  setFadeEnabled: (enabled: boolean) => void;
}

function createGridGroup(normal: THREE.Vector3, style: PlaneStyle): ReferencePlane {
  const group = new THREE.Group();

  // Faint grid lines — geometry rebuilt on zoom change; shader fades distant lines
  const gridMat = createGridMaterial(style.color, style.gridOpacity);
  const gridLines = new THREE.LineSegments(new THREE.BufferGeometry(), gridMat);
  group.add(gridLines);

  // Center axes — same shader, higher opacity, fixed geometry
  const centerMat = createGridMaterial(style.color, style.centerOpacity);
  const centerGeo = new THREE.BufferGeometry();
  centerGeo.setAttribute('position', new THREE.Float32BufferAttribute(buildCenterPositions(), 3));
  group.add(new THREE.LineSegments(centerGeo, centerMat));

  // Orient local Z to the plane normal (grid is built in local XY plane)
  const unitNormal = normal.clone().normalize();
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unitNormal);

  let currentStep = -1;
  let fadeEnabled = true;
  const _tmp = new THREE.Vector3();

  function update(cameraPos: THREE.Vector3, centerPos: THREE.Vector3, fadePos: THREE.Vector3): void {
    // Position the grid at centerPos (e.g. Earth for ICRF, focus target for others)
    group.position.copy(centerPos);

    // Perpendicular distance from camera to the plane surface — drives grid LOD.
    // This correctly handles the case where the focus body is far from the plane
    // (e.g. Moon focused but ICRF plane centered on Earth).
    const perpDist = Math.abs(unitNormal.dot(_tmp.copy(cameraPos).sub(centerPos)));

    // Update grid density
    const maxStep = GRID_SIZE / GRID_MIN_DIVISIONS;
    const raw = Math.min(Math.max(perpDist * GRID_DENSITY, 0.1), maxStep);
    const step = niceStep(raw);
    if (step !== currentStep) {
      currentStep = step;
      const positions = buildGridPositions(step);
      const newGeo = new THREE.BufferGeometry();
      newGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      gridLines.geometry.dispose();
      gridLines.geometry = newGeo;
    }

    // Fade radius scales with camera distance to the grid center (not focus body),
    // so the fade range always encompasses the grid regardless of which body is focused.
    const distToCenter = cameraPos.distanceTo(centerPos);
    const fadeNear = fadeEnabled ? distToCenter * FADE_NEAR_FACTOR : 1e9;
    const fadeFar  = fadeEnabled ? distToCenter * FADE_FAR_FACTOR  : 1e9;
    for (const mat of [gridMat, centerMat]) {
      mat.uniforms.uFocusPos.value.copy(fadePos);
      mat.uniforms.uFadeNear.value = fadeNear;
      mat.uniforms.uFadeFar.value  = fadeFar;
    }
  }

  function setFadeEnabled(enabled: boolean): void {
    fadeEnabled = enabled;
  }

  return { group, update, setFadeEnabled };
}

export function getIcrfNormal(): THREE.Vector3 {
  return new THREE.Vector3(0, 1, 0);
}

export function getEclipticNormal(): THREE.Vector3 {
  const obliquity = 23.4393 * (Math.PI / 180);
  return new THREE.Vector3(0, Math.cos(obliquity), Math.sin(obliquity));
}

export function getMoonOrbitalNormal(): THREE.Vector3 {
  const points = getMoonOrbitPoints(256);
  const normal = new THREE.Vector3();
  for (let i = 0; i < points.length - 1; i++) {
    normal.addScaledVector(points[i].clone().cross(points[i + 1]), 1);
  }
  return normal.normalize();
}

export function createIcrfPlane(): ReferencePlane {
  return createGridGroup(getIcrfNormal(), ICRF_STYLE);
}

export function createEclipticPlane(): ReferencePlane {
  return createGridGroup(getEclipticNormal(), ECLIPTIC_STYLE);
}

export function createMoonOrbitalPlane(): ReferencePlane {
  return createGridGroup(getMoonOrbitalNormal(), MOON_STYLE);
}
