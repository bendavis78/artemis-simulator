import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EARTH_RADIUS, MOON_RADIUS } from '../constants';
import { getIcrfNormal, getEclipticNormal, getMoonOrbitalNormal } from '../astro/reference-planes';

export type FocusTarget = 'earth' | 'moon' | 'orion';
export type ReferencePlane = 'icrf' | 'ecliptic' | 'lunar';

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
  }

  setReferencePlane(plane: ReferencePlane): void {
    this.referencePlane = plane;
    this.camera.up.copy(PLANE_NORMALS[plane]());
    this.controls.update();
  }

  update(): void {
    // Move camera + target with the body so orbiting stays centered
    const bodyPos = this.bodyPositions[this.focusTarget];
    const delta = bodyPos.clone().sub(this.lastBodyPos);

    if (delta.lengthSq() > 0) {
      this.controls.target.add(delta);
      this.camera.position.add(delta);
      this.lastBodyPos.copy(bodyPos);
    }

    this.controls.update();

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
