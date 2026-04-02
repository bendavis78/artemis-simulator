import * as THREE from 'three';

export function createSunLight(): {
  directional: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
} {
  const directional = new THREE.DirectionalLight(0xffffff, 2.0);
  directional.name = 'sunLight';

  const ambient = new THREE.AmbientLight(0x111122, 0.15);

  return { directional, ambient };
}
