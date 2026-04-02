import * as THREE from 'three';
import { MOON_RADIUS, TEXTURES } from '../constants';

export function createMoon(loadingManager: THREE.LoadingManager): THREE.Mesh {
  const textureLoader = new THREE.TextureLoader(loadingManager);

  const colorTex = textureLoader.load(TEXTURES.moonColor);
  colorTex.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshStandardMaterial({
    map: colorTex,
    roughness: 1.0,
    metalness: 0.0,
  });

  const geometry = new THREE.SphereGeometry(MOON_RADIUS, 64, 32);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'moon';

  return mesh;
}
