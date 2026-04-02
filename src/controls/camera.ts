import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EARTH_RADIUS, MOON_RADIUS } from '../constants';

export type FocusTarget = 'earth' | 'moon' | 'orion';

interface FocusConfig {
  defaultDistance: number;
  minDistance: number;
  maxDistance: number;
}

const FOCUS_CONFIGS: Record<FocusTarget, FocusConfig> = {
  earth: { defaultDistance: 30, minDistance: EARTH_RADIUS + 0.5, maxDistance: 500 },
  moon: { defaultDistance: 10, minDistance: MOON_RADIUS + 0.2, maxDistance: 200 },
  orion: { defaultDistance: 2, minDistance: 0.05, maxDistance: 100 },
};

export class CameraController {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  focusTarget: FocusTarget = 'earth';

  private targetPosition = new THREE.Vector3();
  private isTransitioning = false;
  private transitionStart = 0;
  private transitionDuration = 1.0; // seconds
  private fromTarget = new THREE.Vector3();
  private toTarget = new THREE.Vector3();
  private fromCamera = new THREE.Vector3();
  private toCamera = new THREE.Vector3();

  // Current positions of focusable bodies
  private bodyPositions: Record<FocusTarget, THREE.Vector3> = {
    earth: new THREE.Vector3(),
    moon: new THREE.Vector3(),
    orion: new THREE.Vector3(),
  };

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
    this.controls.minDistance = FOCUS_CONFIGS.earth.minDistance;
    this.controls.maxDistance = FOCUS_CONFIGS.earth.maxDistance;
  }

  updateBodyPosition(body: FocusTarget, position: THREE.Vector3): void {
    this.bodyPositions[body].copy(position);
  }

  setFocus(target: FocusTarget): void {
    if (target === this.focusTarget && !this.isTransitioning) {
      // Already focused, just ensure constraints are right
      return;
    }

    const config = FOCUS_CONFIGS[target];

    this.fromTarget.copy(this.controls.target);
    this.fromCamera.copy(this.camera.position);

    this.toTarget.copy(this.bodyPositions[target]);

    // Compute camera position: maintain current viewing angle but adjust distance
    const currentDir = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    this.toCamera
      .copy(this.toTarget)
      .add(currentDir.multiplyScalar(config.defaultDistance));

    this.focusTarget = target;
    this.isTransitioning = true;
    this.transitionStart = performance.now() / 1000;

    this.controls.minDistance = config.minDistance;
    this.controls.maxDistance = config.maxDistance;
  }

  update(): void {
    const now = performance.now() / 1000;

    if (this.isTransitioning) {
      const elapsed = now - this.transitionStart;
      const t = Math.min(elapsed / this.transitionDuration, 1);
      // Smooth ease-in-out
      const eased = t * t * (3 - 2 * t);

      // Update target positions for the transition (bodies move)
      this.toTarget.copy(this.bodyPositions[this.focusTarget]);

      this.controls.target.lerpVectors(this.fromTarget, this.toTarget, eased);

      if (t < 0.8) {
        // Animate camera position during most of the transition
        const camTarget = this.toCamera.clone();
        // Adjust for body movement
        const config = FOCUS_CONFIGS[this.focusTarget];
        const dir = this.fromCamera
          .clone()
          .sub(this.fromTarget)
          .normalize();
        camTarget
          .copy(this.toTarget)
          .add(dir.multiplyScalar(config.defaultDistance));
        this.camera.position.lerpVectors(this.fromCamera, camTarget, eased);
      }

      if (t >= 1) {
        this.isTransitioning = false;
      }
    } else {
      // Follow the focused body
      const bodyPos = this.bodyPositions[this.focusTarget];
      const delta = bodyPos.clone().sub(this.targetPosition);
      if (delta.length() > 0.0001) {
        this.controls.target.add(delta);
        this.camera.position.add(delta);
        this.targetPosition.copy(bodyPos);
      }
    }

    this.controls.update();
  }

  handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Raycast to check if user clicked on a body.
   */
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
      // Walk up to find named parent
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
