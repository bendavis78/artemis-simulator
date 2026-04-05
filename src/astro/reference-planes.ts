import * as THREE from 'three';
import { getMoonOrbitPoints } from './moon-position';

// --- Tuning constants ---
const GRID_SIZE = 1000;          // total extent of each plane (scene units)
const GRID_MIN_DIVISIONS = 20;   // minimum grid divisions (maximum step size)
const GRID_DENSITY = 0.08;       // rawStep = cameraDist * GRID_DENSITY; lower = more lines
const GRID_OPACITY = 0.5;
const CENTER_OPACITY = 0.9;
const FADE_NEAR_FACTOR = 0.8;    // fadeNear = camDist * factor (full opacity within this)
const FADE_FAR_FACTOR = 2.5;     // fadeFar  = camDist * factor (zero opacity beyond this)

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
  uniform vec3 uCameraPos;
  varying vec3 vWorldPos;
  void main() {
    float dist = length(vWorldPos - uCameraPos);
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
      uCameraPos: { value: new THREE.Vector3() },
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
  update: (cameraDist: number, cameraPos: THREE.Vector3, focusPos: THREE.Vector3) => void;
}

function createGridGroup(normal: THREE.Vector3, color: number): ReferencePlane {
  const group = new THREE.Group();

  // Faint grid lines — geometry rebuilt on zoom change; shader fades distant lines
  const gridMat = createGridMaterial(color, GRID_OPACITY);
  const gridLines = new THREE.LineSegments(new THREE.BufferGeometry(), gridMat);
  group.add(gridLines);

  // Center axes — same shader, higher opacity, fixed geometry
  const centerMat = createGridMaterial(color, CENTER_OPACITY);
  const centerGeo = new THREE.BufferGeometry();
  centerGeo.setAttribute('position', new THREE.Float32BufferAttribute(buildCenterPositions(), 3));
  group.add(new THREE.LineSegments(centerGeo, centerMat));

  // Orient local Z to the plane normal (grid is built in local XY plane)
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());

  let currentStep = -1;

  function update(cameraDist: number, cameraPos: THREE.Vector3, focusPos: THREE.Vector3): void {
    // Center the grid on the current focus target
    group.position.copy(focusPos);

    // Update grid density
    const maxStep = GRID_SIZE / GRID_MIN_DIVISIONS;
    const raw = Math.min(Math.max(cameraDist * GRID_DENSITY, 0.1), maxStep);
    const step = niceStep(raw);
    if (step !== currentStep) {
      currentStep = step;
      const positions = buildGridPositions(step);
      const newGeo = new THREE.BufferGeometry();
      newGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      gridLines.geometry.dispose();
      gridLines.geometry = newGeo;
    }

    // Update distance fade — fade starts at FADE_NEAR_FACTOR * camDist, gone by FADE_FAR_FACTOR * camDist
    const fadeNear = cameraDist * FADE_NEAR_FACTOR;
    const fadeFar  = cameraDist * FADE_FAR_FACTOR;
    for (const mat of [gridMat, centerMat]) {
      mat.uniforms.uCameraPos.value.copy(cameraPos);
      mat.uniforms.uFadeNear.value = fadeNear;
      mat.uniforms.uFadeFar.value  = fadeFar;
    }
  }

  return { group, update };
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
  return createGridGroup(getIcrfNormal(), 0x3366aa);
}

export function createEclipticPlane(): ReferencePlane {
  return createGridGroup(getEclipticNormal(), 0xccaa44);
}

export function createMoonOrbitalPlane(): ReferencePlane {
  return createGridGroup(getMoonOrbitalNormal(), 0xcccccc);
}
