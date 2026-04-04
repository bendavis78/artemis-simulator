import * as THREE from 'three';
import type { StageWaypoint } from '../trajectory/waypoints';
import { saveWaypoints } from '../trajectory/waypoints';

const HANDLE_COLOR = 0x00ff88;
const HANDLE_SELECTED_COLOR = 0xff4488;
const LABEL_OFFSET_Y = 0.8;

export class WaypointEditor {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLElement;
  private waypoints: StageWaypoint[];

  private handleGroup = new THREE.Group();
  private handles: THREE.Mesh[] = [];
  private labels: THREE.Sprite[] = [];

  private selectedIndex = -1;
  private isDragging = false;
  private dragPlane = new THREE.Plane();
  private dragOffset = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  private _enabled = false;
  private _onUpdate: (() => void) | null = null;

  private infoPanel: HTMLDivElement | null = null;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    canvas: HTMLElement,
    waypoints: StageWaypoint[],
  ) {
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.waypoints = waypoints;

    this.handleGroup.name = 'waypointHandles';
    this.handleGroup.visible = false;
    this.scene.add(this.handleGroup);

    this.buildHandles();
    this.createInfoPanel();

    // Bind events
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
  }

  set onUpdate(fn: () => void) {
    this._onUpdate = fn;
  }

  get enabled() {
    return this._enabled;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.handleGroup.visible = enabled;
    if (this.infoPanel) {
      this.infoPanel.style.display = enabled ? 'block' : 'none';
    }

    if (enabled) {
      this.canvas.addEventListener('mousedown', this.onMouseDown);
      this.canvas.addEventListener('mousemove', this.onMouseMove);
      this.canvas.addEventListener('mouseup', this.onMouseUp);
      this.updateHandleScales();
    } else {
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      this.canvas.removeEventListener('mousemove', this.onMouseMove);
      this.canvas.removeEventListener('mouseup', this.onMouseUp);
      this.selectedIndex = -1;
      this.isDragging = false;
      this.updateInfoPanel();
    }
  }

  /**
   * Rebuild handles after waypoints change externally (e.g. reset).
   */
  setWaypoints(waypoints: StageWaypoint[]): void {
    this.waypoints = waypoints;
    // Clear old handles
    this.handleGroup.clear();
    this.handles = [];
    this.labels = [];
    this.selectedIndex = -1;
    this.buildHandles();
    this.updateInfoPanel();
  }

  /**
   * Call each frame to keep handle sizes consistent on screen.
   */
  update(): void {
    if (!this._enabled) return;
    this.updateHandleScales();
  }

  private buildHandles(): void {
    const geom = new THREE.SphereGeometry(1, 16, 12);

    for (let i = 0; i < this.waypoints.length; i++) {
      const wp = this.waypoints[i];

      // Handle sphere
      const mat = new THREE.MeshBasicMaterial({
        color: HANDLE_COLOR,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(wp.position);
      mesh.renderOrder = 999;
      mesh.userData.waypointIndex = i;
      this.handleGroup.add(mesh);
      this.handles.push(mesh);

      // Label sprite
      const sprite = this.createLabel(wp.label, wp.id);
      sprite.position.copy(wp.position);
      sprite.position.y += LABEL_OFFSET_Y;
      sprite.renderOrder = 1000;
      this.handleGroup.add(sprite);
      this.labels.push(sprite);
    }
  }

  private createLabel(text: string, id: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.roundRect(0, 0, 256, 64, 8);
    ctx.fill();

    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#00ff88';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayId = id > 100 ? '·' : String(id);
    ctx.fillText(`${displayId} ${text}`, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(4, 1, 1);
    return sprite;
  }

  private updateHandleScales(): void {
    for (let i = 0; i < this.handles.length; i++) {
      const handle = this.handles[i];
      const dist = this.camera.position.distanceTo(handle.position);
      const scale = Math.max(0.15, Math.min(dist * 0.02, 1.5));
      handle.scale.setScalar(scale);

      // Keep labels readable
      const labelScale = Math.max(0.5, Math.min(dist * 0.03, 3));
      this.labels[i].scale.set(labelScale * 4, labelScale, 1);
      this.labels[i].position.copy(handle.position);
      this.labels[i].position.y += scale * LABEL_OFFSET_Y + 0.3;
    }
  }

  private setMouseFromEvent(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;

    this.setMouseFromEvent(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.handles);
    if (intersects.length > 0) {
      event.stopPropagation();
      event.preventDefault();

      const idx = intersects[0].object.userData.waypointIndex as number;
      this.selectHandle(idx);

      // Set up drag plane perpendicular to camera through the waypoint
      const camDir = this.camera.getWorldDirection(new THREE.Vector3());
      this.dragPlane.setFromNormalAndCoplanarPoint(camDir, this.waypoints[idx].position);

      // Calculate offset so handle doesn't jump to cursor
      const intersection = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
      this.dragOffset.subVectors(this.waypoints[idx].position, intersection);

      this.isDragging = true;
    } else {
      this.selectedIndex = -1;
      this.updateHandleColors();
      this.updateInfoPanel();
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging || this.selectedIndex === -1) return;

    event.stopPropagation();
    event.preventDefault();

    this.setMouseFromEvent(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersection = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) {
      const newPos = intersection.add(this.dragOffset);
      this.waypoints[this.selectedIndex].position.copy(newPos);
      this.handles[this.selectedIndex].position.copy(newPos);
      this.labels[this.selectedIndex].position.copy(newPos);
      this.labels[this.selectedIndex].position.y += LABEL_OFFSET_Y + 0.3;

      this.updateInfoPanel();

      if (this._onUpdate) {
        this._onUpdate();
      }
    }
  }

  private onMouseUp(event: MouseEvent): void {
    if (this.isDragging) {
      event.stopPropagation();
      this.isDragging = false;
      saveWaypoints(this.waypoints);
    }
  }

  private selectHandle(index: number): void {
    this.selectedIndex = index;
    this.updateHandleColors();
    this.updateInfoPanel();
  }

  private updateHandleColors(): void {
    for (let i = 0; i < this.handles.length; i++) {
      const mat = this.handles[i].material as THREE.MeshBasicMaterial;
      mat.color.setHex(i === this.selectedIndex ? HANDLE_SELECTED_COLOR : HANDLE_COLOR);
    }
  }

  private createInfoPanel(): void {
    this.infoPanel = document.createElement('div');
    this.infoPanel.id = 'waypoint-info';
    this.infoPanel.style.cssText = `
      position: fixed;
      top: 60px;
      left: 20px;
      background: rgba(0, 0, 0, 0.85);
      border: 1px solid rgba(0, 255, 136, 0.3);
      border-radius: 8px;
      padding: 14px 18px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #ccc;
      display: none;
      z-index: 200;
      min-width: 220px;
      pointer-events: auto;
    `;
    document.body.appendChild(this.infoPanel);
  }

  private updateInfoPanel(): void {
    if (!this.infoPanel) return;

    if (!this._enabled || this.selectedIndex === -1) {
      this.infoPanel.innerHTML = `
        <div style="color: #00ff88; font-weight: bold; margin-bottom: 8px;">
          EDIT MODE
        </div>
        <div style="color: #888; font-size: 11px;">
          Click a waypoint to select.<br>
          Drag to reposition.<br>
          Changes auto-save.
        </div>
      `;
      return;
    }

    const wp = this.waypoints[this.selectedIndex];
    const dist = wp.position.length();
    const displayId = wp.id > 100 ? '—' : String(wp.id);

    const days = Math.floor(wp.met / 24);
    const hours = Math.floor(wp.met % 24);
    const mins = Math.floor((wp.met % 1) * 60);
    const metStr = `Day ${days} / ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    this.infoPanel.innerHTML = `
      <div style="color: #ff4488; font-weight: bold; margin-bottom: 8px;">
        Stage ${displayId}: ${wp.label}
      </div>
      <div style="margin-bottom: 4px;">${metStr}</div>
      <div style="color: #999; font-size: 11px;">
        X: ${wp.position.x.toFixed(2)}<br>
        Y: ${wp.position.y.toFixed(2)}<br>
        Z: ${wp.position.z.toFixed(2)}<br>
        Dist: ${(dist * 1000).toFixed(0)} km
      </div>
    `;
  }
}
