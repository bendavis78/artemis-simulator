import * as THREE from 'three';

export function createSunLight(): {
  directional: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  fill: THREE.HemisphereLight;
} {
  const directional = new THREE.DirectionalLight(0xffffff, 2.0);
  directional.name = 'sunLight';

  const ambient = new THREE.AmbientLight(0x334466, 0.6);

  // Hemisphere fill light: brighter sky color + dim ground
  // Helps illuminate the shadow side of objects in deep space
  const fill = new THREE.HemisphereLight(0x4466aa, 0x222233, 1.0);

  return { directional, ambient, fill };
}
