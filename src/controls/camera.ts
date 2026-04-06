import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EARTH_RADIUS, MOON_RADIUS } from '../constants';
import { getIcrfNormal, getEclipticNormal, getMoonOrbitalNormal } from '../astro/reference-planes';

export type FocusTarget = 'earth' | 'moon' | 'orion';
export type ReferencePlane = 'icrf' | 'ecliptic' | 'lunar';
export type CameraMode = 'free' | 'moon-near-side';

const CAMERA_STORAGE_KEY = 'artemis-camera-v1';

interface CameraState {
  focusTarget: FocusTarget;
  referencePlane: ReferencePlane;
  cameraMode: CameraMode;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  targetDistance: number;
}

interface FocusConfig {
  defaultDistance: number;
  minDistance: number;
  maxDistance: number;
}

const FOCUS_CONFIGS: Record<FocusTarget, FocusConfig> = {
  earth: { defaultDistance: 30, minDistance: EARTH_RADIUS + 0.5, maxDistance: 1200 },
  moon: { defaultDistance: 10, minDistance: MOON_RADIUS + 0.2, maxDistance: 200 },
  orion: { defaultDistance: 2, minDistance: 0.05, maxDistance: 100 },
};

const PLANE_NORMALS: Record<ReferencePlane, () => THREE.Vector3> = {
  icrf: getIcrfNormal,
  ecliptic: getEclipticNormal,
  lunar: getMoonOrbitalNormal,
};

export class CameraController {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  focusTarget: FocusTarget = 'earth';
  referencePlane: ReferencePlane = 'icrf';
  cameraMode: CameraMode = 'free';

  // Current positions of focusable bodies
  private bodyPositions: Record<FocusTarget, THREE.Vector3> = {
    earth: new THREE.Vector3(),
    moon: new THREE.Vector3(),
    orion: new THREE.Vector3(),
  };

  // Track previous body position to compute frame-to-frame delta
  private lastBodyPos = new THREE.Vector3();

  // Smooth zoom state
  private targetDistance: number = 0;
  private readonly ZOOM_SPEED = 0.15;
  private readonly ZOOM_LERP = 0.12;

  // Deferred restore applied on first update() after body positions are set
  private pendingRestore: CameraState | null = null;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(canvas: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.001,
      5000
    );
    this.camera.position.set(0, 15, 25);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = false;
    this.controls.minDistance = FOCUS_CONFIGS.earth.minDistance;
    this.controls.maxDistance = FOCUS_CONFIGS.earth.maxDistance;

    this.targetDistance = this.camera.position.length();
    canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    this.controls.addEventListener('change', () => this.scheduleSave());
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer !== null) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => this.saveState(), 500);
  }

  saveState(): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const state: CameraState = {
      focusTarget: this.focusTarget,
      referencePlane: this.referencePlane,
      cameraMode: this.cameraMode,
      offsetX: offset.x,
      offsetY: offset.y,
      offsetZ: offset.z,
      targetDistance: this.targetDistance,
    };
    localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(state));
  }

  restoreState(): void {
    const raw = localStorage.getItem(CAMERA_STORAGE_KEY);
    if (!raw) return;
    let state: CameraState;
    try {
      state = JSON.parse(raw) as CameraState;
    } catch {
      return;
    }
    this.focusTarget = state.focusTarget;
    this.referencePlane = state.referencePlane;
    this.cameraMode = state.cameraMode ?? 'free';
    this.camera.up.copy(PLANE_NORMALS[state.referencePlane]());
    if (this.cameraMode === 'moon-near-side') {
      this.controls.enableRotate = false;
      this.controls.enablePan = false;
    }
    this.pendingRestore = state;
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 1 : -1;
    const factor = Math.pow(1 + this.ZOOM_SPEED, delta);
    const config = FOCUS_CONFIGS[this.focusTarget];
    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance * factor,
      config.minDistance,
      config.maxDistance
    );
  }

  updateBodyPosition(body: FocusTarget, position: THREE.Vector3): void {
    this.bodyPositions[body].copy(position);
  }

  setFocus(target: FocusTarget): void {
    // Changing focus target always exits near-side lock
    if (this.cameraMode === 'moon-near-side') {
      this.setCameraMode('free');
    }

    if (target === this.focusTarget) return;

    const config = FOCUS_CONFIGS[target];
    const bodyPos = this.bodyPositions[target];

    // Move camera to default distance from the new target,
    // keeping the current viewing direction
    const viewDir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(bodyPos).add(viewDir.multiplyScalar(config.defaultDistance));
    this.controls.target.copy(bodyPos);

    this.focusTarget = target;
    this.lastBodyPos.copy(bodyPos);

    this.controls.minDistance = config.minDistance;
    this.controls.maxDistance = config.maxDistance;
    this.targetDistance = config.defaultDistance;
    this.saveState();
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    if (mode === 'moon-near-side') {
      // Focus on moon and lock rotation
      if (this.focusTarget !== 'moon') {
        const config = FOCUS_CONFIGS.moon;
        const moonPos = this.bodyPositions.moon;
        this.controls.target.copy(moonPos);
        this.focusTarget = 'moon';
        this.lastBodyPos.copy(moonPos);
        this.controls.minDistance = config.minDistance;
        this.controls.maxDistance = config.maxDistance;
        this.targetDistance = config.defaultDistance;
      }
      this.controls.enableRotate = false;
      this.controls.enablePan = false;
    } else {
      this.controls.enableRotate = true;
      this.controls.enablePan = true;
    }
    this.saveState();
  }

  setReferencePlane(plane: ReferencePlane): void {
    this.referencePlane = plane;
    this.camera.up.copy(PLANE_NORMALS[plane]());
    this.controls.update();
    this.saveState();
  }

  update(): void {
    if (this.pendingRestore) {
      const state = this.pendingRestore;
      this.pendingRestore = null;
      const bodyPos = this.bodyPositions[state.focusTarget];
      const offset = new THREE.Vector3(state.offsetX, state.offsetY, state.offsetZ);
      this.controls.target.copy(bodyPos);
      this.camera.position.copy(bodyPos).add(offset);
      this.lastBodyPos.copy(bodyPos);
      this.targetDistance = state.targetDistance;
      this.controls.minDistance = FOCUS_CONFIGS[state.focusTarget].minDistance;
      this.controls.maxDistance = FOCUS_CONFIGS[state.focusTarget].maxDistance;
    }

    // Move camera + target with the body so orbiting stays centered
    const bodyPos = this.bodyPositions[this.focusTarget];
    const delta = bodyPos.clone().sub(this.lastBodyPos);

    if (delta.lengthSq() > 0) {
      this.controls.target.add(delta);
      this.camera.position.add(delta);
      this.lastBodyPos.copy(bodyPos);
    }

    this.controls.update();

    // Moon near-side lock: force camera onto Earth-Moon line (Earth-facing side)
    if (this.cameraMode === 'moon-near-side') {
      const moonPos = this.bodyPositions.moon;
      // Earth is at origin; direction from moon toward earth
      const moonToEarth = moonPos.clone().negate().normalize();
      const currentDistance = this.camera.position.distanceTo(moonPos);
      this.controls.target.copy(moonPos);
      this.camera.position.copy(moonPos).addScaledVector(moonToEarth, currentDistance);
    }

    // Smooth zoom: lerp current distance toward targetDistance
    const currentDistance = this.camera.position.distanceTo(this.controls.target);
    if (Math.abs(currentDistance - this.targetDistance) > 1e-6) {
      const newDistance = THREE.MathUtils.lerp(currentDistance, this.targetDistance, this.ZOOM_LERP);
      const dir = this.camera.position.clone().sub(this.controls.target).normalize();
      this.camera.position.copy(this.controls.target).addScaledVector(dir, newDistance);
    }
  }

  handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  raycastBodies(
    event: MouseEvent,
    bodies: THREE.Object3D[]
  ): FocusTarget | null {
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObjects(bodies, true);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      let obj: THREE.Object3D | null = hit;
      while (obj) {
        if (obj.name === 'earth') return 'earth';
        if (obj.name === 'moon') return 'moon';
        if (obj.name === 'orion') return 'orion';
        obj = obj.parent;
      }
    }
    return null;
  }
}
