import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Orion MPCV (Artemis II configuration).
 *
 * CM and SM bodies are loaded from GLB models extracted from NASA's AROW simulator.
 * Solar wings, nozzle, and docking adapter remain procedural.
 *
 * Orientation: lookAt() aligns -Z toward the target, so:
 *   -Z = nose (docking adapter, velocity direction)
 *   +Z = aft  (engine nozzle)
 *
 * All parts are built along the Y axis (Three.js convention for cylinders),
 * then the entire inner group is rotated so +Y → -Z.
 * GLB models have their axis along Z, so they get rotation.x = Math.PI/2
 * to bring +Z → +Y (nose direction) before the inner group rotation.
 */
export function createSpacecraft(loadingManager: THREE.LoadingManager): {
  group: THREE.Group;
  marker: THREE.Sprite;
} {
  const group = new THREE.Group();
  group.name = 'orion';

  // Inner group built along +Y (nose at top), then rotated so +Y maps to -Z
  const inner = new THREE.Group();

  // --- Dimensions ---
  const S = 0.15;
  const m = S / 9.5; // 1 real meter in Three.js units

  const cmH = 3.3 * m;
  const cmaH = 0.8 * m;
  const esmR = 2.05 * m;
  const esmH = 4.0 * m;
  const nozzleThroatR = 0.25 * m;
  const nozzleExitR = 0.6 * m;
  const nozzleH = 1.1 * m;
  const dockR = 0.6 * m;
  const dockH = 0.3 * m;

  // Solar wings
  const wingLength = 7.375 * m;
  const wingWidth = 1.92 * m;
  const wingThick = 0.02 * m;
  const wingSplay = 0.30;

  // --- Y positions (nose at top, engine at bottom) ---
  const stackTop = S / 2;
  const dockTop = stackTop;
  const dockBot = dockTop - dockH;
  const cmTop = dockBot;
  const cmBot = cmTop - cmH;
  const cmaTop = cmBot;
  const cmaBot = cmaTop - cmaH;
  const esmTop = cmaBot;
  const esmBot = esmTop - esmH;
  const nozzleTop = esmBot;
  const nozzleBot = nozzleTop - nozzleH;

  // --- Engine Nozzle ---
  const matNozzle = new THREE.MeshStandardMaterial({
    color: 0x808080, metalness: 0.7, roughness: 0.25, side: THREE.DoubleSide,
  });
  const nozzleGeom = new THREE.CylinderGeometry(
    nozzleThroatR, nozzleExitR, nozzleH, 12, 1, true,
  );
  const nozzleMesh = new THREE.Mesh(nozzleGeom, matNozzle);
  nozzleMesh.position.y = (nozzleTop + nozzleBot) / 2;
  inner.add(nozzleMesh);

  // --- Docking Adapter ---
  const matDocking = new THREE.MeshStandardMaterial({
    color: 0xb0b0b0, metalness: 0.6, roughness: 0.3,
  });
  const dockGeom = new THREE.CylinderGeometry(dockR, dockR, dockH, 12);
  const dockMesh = new THREE.Mesh(dockGeom, matDocking);
  dockMesh.position.y = (dockTop + dockBot) / 2;
  inner.add(dockMesh);

  const ringGeom = new THREE.TorusGeometry(dockR, 0.002 * S / 0.15, 6, 16);
  const ringMesh = new THREE.Mesh(ringGeom, matDocking);
  ringMesh.position.y = dockTop;
  ringMesh.rotation.x = Math.PI / 2;
  inner.add(ringMesh);

  // --- Solar Wings x4 (X-wing, procedural) ---
  const matSolarFront = new THREE.MeshStandardMaterial({
    color: 0xb08868, metalness: 0.4, roughness: 0.45,
  });
  const matSolarBack = new THREE.MeshStandardMaterial({
    color: 0x0a1638, metalness: 0.15, roughness: 0.5,
  });
  const matSolarFrame = new THREE.MeshStandardMaterial({
    color: 0xe8e8e8, metalness: 0.3, roughness: 0.5,
  });

  const solarMountY = esmBot + esmH * 0.3;
  const panelCount = 3;
  const panelGap = 0.3 * m;
  const frameThick = 0.08 * m;
  const singlePanelLen = (wingLength - panelGap * (panelCount - 1)) / panelCount;
  const cellLen = singlePanelLen - frameThick * 2;
  const cellWidth = wingWidth - frameThick * 2;

  function buildWing(): THREE.Group {
    const wingGroup = new THREE.Group();
    for (let p = 0; p < panelCount; p++) {
      const panelX = p * (singlePanelLen + panelGap) + singlePanelLen / 2;
      const frameGeom = new THREE.BoxGeometry(singlePanelLen, wingThick, wingWidth);
      const frame = new THREE.Mesh(frameGeom, matSolarFrame);
      frame.position.x = panelX;
      wingGroup.add(frame);

      const frontGeom = new THREE.BoxGeometry(cellLen, wingThick * 0.3, cellWidth);
      const front = new THREE.Mesh(frontGeom, matSolarFront);
      front.position.set(panelX, wingThick * 0.5, 0);
      wingGroup.add(front);

      const backGeom = new THREE.BoxGeometry(cellLen, wingThick * 0.3, cellWidth);
      const back = new THREE.Mesh(backGeom, matSolarBack);
      back.position.set(panelX, -wingThick * 0.5, 0);
      wingGroup.add(back);
    }
    return wingGroup;
  }

  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    pivot.position.y = solarMountY;
    const wing = buildWing();
    wing.position.x = esmR;
    wing.rotation.z = -wingSplay;
    pivot.add(wing);
    pivot.rotation.y = (Math.PI / 4) + (Math.PI / 2) * i;
    inner.add(pivot);
  }

  // --- Load GLB models ---
  const loader = new GLTFLoader(loadingManager);

  // Crew Module — GLB axis is along Z; rotation.x = π/2 brings +Z → +Y (nose up)
  loader.load('/models/orion-command-module.glb', (gltf) => {
    const model = gltf.scene;
    model.rotation.x = Math.PI / 2;

    // Scale to span CM + CMA adapter height
    const targetH = cmH + cmaH;
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = targetH / size.y;
    model.scale.setScalar(scale);

    // Center vertically between cmTop and cmaBot
    box.setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.y = (cmTop + cmaBot) / 2 - center.y;

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.layers.enable(1);
    });

    inner.add(model);
  });

  // Service Module — same Z-axis convention
  loader.load('/models/orion-service-module.glb', (gltf) => {
    const model = gltf.scene;
    model.rotation.x = Math.PI / 2;

    const targetH = esmH;
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = targetH / size.y;
    model.scale.setScalar(scale);

    box.setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.y = (esmTop + esmBot) / 2 - center.y;

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.layers.enable(1);
    });

    inner.add(model);
  });

  // --- Rotate inner group: +Y → -Z (nose forward for lookAt) ---
  inner.rotation.x = Math.PI / 2;
  group.add(inner);

  // --- Sprite marker for long-distance visibility ---
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.2, 'rgba(100, 180, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(100, 180, 255, 0.0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const spriteTex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: spriteTex,
    transparent: true,
    depthWrite: false,
  });
  const marker = new THREE.Sprite(spriteMat);
  marker.scale.set(1.5, 1.5, 1);
  marker.name = 'orionMarker';

  return { group, marker };
}
