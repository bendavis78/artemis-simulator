import * as THREE from 'three';

/**
 * Create a simplified Orion spacecraft:
 * - Command module (cone)
 * - Service module (cylinder)
 * - Solar panels (thin boxes)
 *
 * At 1 unit = 1000 km, the real spacecraft (~5m) would be invisible.
 * We scale it up dramatically for visibility and also provide a
 * sprite marker for when the camera is far away.
 */
export function createSpacecraft(): {
  group: THREE.Group;
  marker: THREE.Sprite;
} {
  const group = new THREE.Group();
  group.name = 'orion';

  // Scale the model to be visible: ~0.15 units = 150 km apparent size
  // This is unrealistic but necessary for visibility
  const s = 0.15;

  // Command module (cone)
  const cmGeom = new THREE.ConeGeometry(s * 0.4, s * 0.8, 8);
  const cmMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.6,
    roughness: 0.3,
  });
  const cm = new THREE.Mesh(cmGeom, cmMat);
  cm.position.y = s * 0.4;
  group.add(cm);

  // Service module (cylinder)
  const smGeom = new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.6, 8);
  const smMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    metalness: 0.5,
    roughness: 0.4,
  });
  const sm = new THREE.Mesh(smGeom, smMat);
  sm.position.y = -s * 0.1;
  group.add(sm);

  // Solar panels (two thin boxes extending to sides)
  const panelGeom = new THREE.BoxGeometry(s * 1.5, s * 0.02, s * 0.4);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a6a,
    metalness: 0.3,
    roughness: 0.5,
  });
  const panelLeft = new THREE.Mesh(panelGeom, panelMat);
  panelLeft.position.set(-s * 0.95, -s * 0.1, 0);
  group.add(panelLeft);

  const panelRight = new THREE.Mesh(panelGeom, panelMat);
  panelRight.position.set(s * 0.95, -s * 0.1, 0);
  group.add(panelRight);

  // Sprite marker for long-distance visibility
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
