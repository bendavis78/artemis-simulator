import * as THREE from 'three';

/**
 * Procedural Orion MPCV (Artemis I configuration).
 *
 * Built from Three.js primitives — no external model files.
 * Real full-stack height is ~9.5 m; we map that to S = 0.15 Three.js units.
 *
 * Orientation: lookAt() aligns -Z toward the target, so:
 *   -Z = nose (docking adapter, velocity direction)
 *   +Z = aft  (engine nozzle)
 *
 * All parts are built along the Y axis (Three.js convention for cylinders),
 * then the entire inner group is rotated so +Y → -Z.
 */
export function createSpacecraft(): {
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

  // Crew Module — straight truncated cone
  const cmBaseR = 2.51 * m;   // 5.02m diameter
  const cmTopR = 1.0 * m;     // ~2.0m diameter
  const cmH = 3.3 * m;

  // Heat shield
  const heatShieldR = cmBaseR;
  const heatShieldThick = 0.15 * m;

  // CMA ring (adapter between CM and ESM)
  const cmaBotR = 2.05 * m;   // 4.1m diameter
  const cmaH = 0.8 * m;

  // ESM — uniform silver cylinder
  const esmR = cmaBotR;
  const esmH = 4.0 * m;

  // Engine nozzle
  const nozzleThroatR = 0.25 * m;
  const nozzleExitR = 0.6 * m;
  const nozzleH = 1.1 * m;

  // Docking adapter
  const dockR = 0.6 * m;
  const dockH = 0.3 * m;

  // Solar wings
  const wingLength = 7.375 * m;
  const wingWidth = 1.92 * m;
  const wingThick = 0.02 * m;
  const wingSplay = 0.30; // radians (~17°), aft tilt

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

  // --- Materials (silver/metallic body matching reference images) ---
  const matBody = new THREE.MeshStandardMaterial({
    color: 0xc0b8b0, metalness: 0.5, roughness: 0.35,
  });
  const matHeatShield = new THREE.MeshStandardMaterial({
    color: 0x1a1008, metalness: 0.05, roughness: 0.9,
  });
  const matEsm = new THREE.MeshStandardMaterial({
    color: 0xf0ece8, metalness: 0.3, roughness: 0.5,
  });
  const matNozzle = new THREE.MeshStandardMaterial({
    color: 0x808080, metalness: 0.7, roughness: 0.25, side: THREE.DoubleSide,
  });
  const matDocking = new THREE.MeshStandardMaterial({
    color: 0xb0b0b0, metalness: 0.6, roughness: 0.3,
  });
  const matSolarFront = new THREE.MeshStandardMaterial({
    color: 0xb08868, metalness: 0.4, roughness: 0.45,
  });
  const matSolarBack = new THREE.MeshStandardMaterial({
    color: 0x0a1638, metalness: 0.15, roughness: 0.5,
  });
  const matSolarFrame = new THREE.MeshStandardMaterial({
    color: 0xe8e8e8, metalness: 0.3, roughness: 0.5,
  });

  // --- Part 1: Crew Module (straight truncated cone, closed) ---
  // CylinderGeometry(radiusTop, radiusBottom, height, segments)
  // Top of cylinder = narrow end (nose side), bottom = wide base
  const cmGeom = new THREE.CylinderGeometry(cmTopR, cmBaseR, cmH, 24);
  const cmMesh = new THREE.Mesh(cmGeom, matBody);
  cmMesh.position.y = (cmTop + cmBot) / 2;
  inner.add(cmMesh);

  // --- Part 2: Heat Shield (flat disc at CM base) ---
  const hsGeom = new THREE.CylinderGeometry(
    heatShieldR, heatShieldR, heatShieldThick, 24,
  );
  const hsMesh = new THREE.Mesh(hsGeom, matHeatShield);
  hsMesh.position.y = cmBot - heatShieldThick / 2;
  inner.add(hsMesh);

  // --- Part 3: CMA Ring (tapered adapter) ---
  const cmaGeom = new THREE.CylinderGeometry(cmBaseR, cmBaseR, cmaH, 16);
  const cmaMesh = new THREE.Mesh(cmaGeom, matEsm);
  cmaMesh.position.y = (cmaTop + cmaBot) / 2;
  inner.add(cmaMesh);

  // --- Part 4: ESM Body (single silver cylinder) ---
  const esmGeom = new THREE.CylinderGeometry(esmR, esmR, esmH, 16);
  const esmMesh = new THREE.Mesh(esmGeom, matEsm);
  esmMesh.position.y = (esmTop + esmBot) / 2;
  inner.add(esmMesh);

  // --- Part 5: Engine Nozzle (open-ended truncated cone) ---
  const nozzleGeom = new THREE.CylinderGeometry(
    nozzleThroatR, nozzleExitR, nozzleH, 12, 1, true,
  );
  const nozzleMesh = new THREE.Mesh(nozzleGeom, matNozzle);
  nozzleMesh.position.y = (nozzleTop + nozzleBot) / 2;
  inner.add(nozzleMesh);

  // --- Part 6: Docking Adapter ---
  const dockGeom = new THREE.CylinderGeometry(dockR, dockR, dockH, 12);
  const dockMesh = new THREE.Mesh(dockGeom, matDocking);
  dockMesh.position.y = (dockTop + dockBot) / 2;
  inner.add(dockMesh);

  // Docking ring (torus at the very nose)
  const ringGeom = new THREE.TorusGeometry(dockR, 0.002 * S / 0.15, 6, 16);
  const ringMesh = new THREE.Mesh(ringGeom, matDocking);
  ringMesh.position.y = dockTop;
  ringMesh.rotation.x = Math.PI / 2;
  inner.add(ringMesh);

  // --- Part 7: Solar Wings x4 (X-wing) ---
  // Each wing has 3 rectangular panels with white frame borders
  const solarMountY = esmBot + esmH * 0.3; // aft third of ESM
  const panelCount = 3;
  const panelGap = 0.3 * m;     // gap between panels
  const frameThick = 0.08 * m;  // border width around each panel
  const singlePanelLen = (wingLength - panelGap * (panelCount - 1)) / panelCount;
  const cellLen = singlePanelLen - frameThick * 2;
  const cellWidth = wingWidth - frameThick * 2;

  function buildWing(): THREE.Group {
    const wingGroup = new THREE.Group();

    for (let p = 0; p < panelCount; p++) {
      const panelX = p * (singlePanelLen + panelGap) + singlePanelLen / 2;

      // White frame (full panel rectangle, slightly thinner than cells)
      const frameGeom = new THREE.BoxGeometry(
        singlePanelLen, wingThick, wingWidth,
      );
      const frame = new THREE.Mesh(frameGeom, matSolarFrame);
      frame.position.x = panelX;
      wingGroup.add(frame);

      // Front face cell (copper) — sits slightly above frame
      const frontGeom = new THREE.BoxGeometry(cellLen, wingThick * 0.3, cellWidth);
      const front = new THREE.Mesh(frontGeom, matSolarFront);
      front.position.set(panelX, wingThick * 0.5, 0);
      wingGroup.add(front);

      // Back face cell (dark blue) — sits slightly below frame
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
    wing.position.x = esmR; // root starts at ESM surface
    // Splay: tilt wing tip toward -Y (aft direction)
    wing.rotation.z = -wingSplay;
    pivot.add(wing);

    // Rotate pivot around Y for 4-wing X arrangement (45°, 135°, 225°, 315°)
    pivot.rotation.y = (Math.PI / 4) + (Math.PI / 2) * i;
    inner.add(pivot);
  }

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
