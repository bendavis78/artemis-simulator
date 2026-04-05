import * as THREE from 'three';
import { createEarth, getGreenwichSiderealAngle } from './bodies/earth';
import { createMoon } from './bodies/moon';
import { createSunLight } from './bodies/sun';
import { createSpacecraft } from './bodies/spacecraft';
import { getSunDirection } from './astro/sun-position';
import { getMoonPosition, getMoonOrbitPoints } from './astro/moon-position';
import { createIcrfPlane, createEclipticPlane, createMoonOrbitalPlane } from './astro/reference-planes';
import { generateTrajectory } from './trajectory/data';
import { TrajectoryInterpolator } from './trajectory/interpolate';
import { createFlightPath } from './trajectory/path';
import { CameraController, type ReferencePlane } from './controls/camera';
import { Timeline } from './controls/timeline';
import { createOverlay, updateOverlay } from './ui/overlay';
import { EARTH_RADIUS, MOON_RADIUS } from './constants';

// --- Loading Manager ---
const loadingManager = new THREE.LoadingManager();
const loadingBar = document.getElementById('loading-bar')!;
const loadingScreen = document.getElementById('loading')!;

loadingManager.onProgress = (_url, loaded, total) => {
  const pct = (loaded / total) * 100;
  loadingBar.style.width = `${pct}%`;
};
loadingManager.onLoad = () => {
  loadingScreen.classList.add('hidden');
  setTimeout(() => loadingScreen.remove(), 600);
};

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  logarithmicDepthBuffer: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('app')!.appendChild(renderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005);

// --- Stars ---
const starCount = 12000;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 2000 + Math.random() * 500;
  starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPositions[i * 3 + 2] = r * Math.cos(phi);
}
const starGeom = new THREE.BufferGeometry();
starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.8,
  sizeAttenuation: true,
});
const stars = new THREE.Points(starGeom, starMat);
scene.add(stars);

// --- Camera ---
const cameraController = new CameraController(renderer.domElement);
const camera = cameraController.camera;

// --- Lighting ---
const { directional: sunLight, ambient } = createSunLight();
scene.add(sunLight);
scene.add(ambient);

// --- Earth ---
const { mesh: earthMesh, material: earthMaterial } =
  createEarth(loadingManager);
scene.add(earthMesh);

// --- Moon ---
const moonMesh = createMoon(loadingManager);
scene.add(moonMesh);

// Low-res geometries for wireframe mode
const earthHighResGeom = earthMesh.geometry;
const earthLowResGeom = new THREE.SphereGeometry(EARTH_RADIUS, 32, 16);
const moonHighResGeom = moonMesh.geometry;
const moonLowResGeom = new THREE.SphereGeometry(MOON_RADIUS, 32, 16);
const moonNormalMat = moonMesh.material as THREE.MeshStandardMaterial;
const moonWireframeMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
  transparent: true,
  opacity: 0.05,
});

// --- Moon Orbit Path ---
{
  const orbitPoints = getMoonOrbitPoints(128);
  const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  const orbitMat = new THREE.LineBasicMaterial({ color: 0x555566, opacity: 0.5, transparent: true });
  const moonOrbitLine = new THREE.Line(orbitGeom, orbitMat);
  moonOrbitLine.visible = false;
  moonOrbitLine.name = 'moonOrbit';
  scene.add(moonOrbitLine);
}

// --- Reference Planes ---
const { group: icrfPlane, update: updateIcrfPlane } = createIcrfPlane();
icrfPlane.visible = false;
scene.add(icrfPlane);

const { group: eclipticPlane, update: updateEclipticPlane } = createEclipticPlane();
eclipticPlane.visible = false;
scene.add(eclipticPlane);

const { group: moonOrbitalPlane, update: updateMoonOrbitalPlane } = createMoonOrbitalPlane();
moonOrbitalPlane.visible = false;
scene.add(moonOrbitalPlane);
const moonOrbitLine = scene.getObjectByName('moonOrbit') as THREE.Line;

// --- Trajectory ---
let trajectoryPoints = generateTrajectory();
let interpolator = new TrajectoryInterpolator(trajectoryPoints);
let flightPath = createFlightPath(interpolator);
scene.add(flightPath.fullPath);
scene.add(flightPath.progressPath);

// --- Spacecraft ---
const { group: spacecraftGroup, marker: spacecraftMarker } =
  createSpacecraft();
scene.add(spacecraftGroup);
scene.add(spacecraftMarker);
let orionVisible = true;

// --- Timeline ---
const timeline = new Timeline();

// --- UI ---
createOverlay(timeline, cameraController, {
  onWireframeToggle(enabled) {
    earthMaterial.wireframe = enabled;
    earthMaterial.uniforms.uWireframe.value = enabled ? 1.0 : 0.0;
    earthMesh.geometry = enabled ? earthLowResGeom : earthHighResGeom;

    moonMesh.material = enabled ? moonWireframeMat : moonNormalMat;
    moonMesh.geometry = enabled ? moonLowResGeom : moonHighResGeom;
  },
  onMoonOrbitToggle(enabled) {
    moonOrbitLine.visible = enabled;
  },
  onStarsToggle(enabled) {
    stars.visible = enabled;
  },
  onFlightPathToggle(enabled) {
    flightPath.fullPath.visible = enabled;
  },
  onProgressPathToggle(enabled) {
    flightPath.progressPath.visible = enabled;
  },
  onOrionToggle(enabled) {
    orionVisible = enabled;
  },
  onIcrfPlaneToggle(enabled) {
    icrfPlane.visible = enabled;
  },
  onEclipticPlaneToggle(enabled) {
    eclipticPlane.visible = enabled;
  },
  onMoonOrbitalPlaneToggle(enabled) {
    moonOrbitalPlane.visible = enabled;
  },
  onReferencePlaneChange(plane: ReferencePlane) {
    cameraController.setReferencePlane(plane);
  },
});

// --- Click to focus ---
renderer.domElement.addEventListener('dblclick', (event) => {
  const hit = cameraController.raycastBodies(event, [
    earthMesh,
    moonMesh,
    spacecraftGroup,
  ]);
  if (hit) {
    cameraController.setFocus(hit);
    // Update UI focus buttons
    document
      .querySelectorAll('.focus-btn')
      .forEach((b) => b.classList.remove('active'));
    document
      .querySelector(`.focus-btn[data-focus="${hit}"]`)
      ?.classList.add('active');
  }
});

// --- Resize ---
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  cameraController.handleResize();
});

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // Update timeline
  timeline.update(delta);
  const simDate = timeline.getSimDate();
  const met = timeline.state.currentMET;

  // Update Sun direction
  const sunDir = getSunDirection(simDate);
  sunLight.position.copy(sunDir.clone().multiplyScalar(1000));
  earthMaterial.uniforms.sunDirection.value.copy(sunDir);

  // Update log depth buffer uniform
  earthMaterial.uniforms.logDepthBufFC.value =
    2.0 / (Math.log(camera.far + 1.0) / Math.LN2);

  // Update Earth rotation
  earthMesh.rotation.y = getGreenwichSiderealAngle(simDate);

  // Update Moon position
  const moonPos = getMoonPosition(met);
  moonMesh.position.copy(moonPos);
  // Tidal locking: Moon's near side faces Earth
  moonMesh.lookAt(0, 0, 0);

  // Update spacecraft
  const scPos = interpolator.getPosition(met);
  spacecraftGroup.position.copy(scPos);
  spacecraftMarker.position.copy(scPos);

  // Orient spacecraft along velocity vector
  const velDir = interpolator.getVelocityDirection(met);
  const lookTarget = scPos.clone().add(velDir);
  spacecraftGroup.lookAt(lookTarget);

  // Spacecraft visibility: show model when close, marker when far
  const camDist = camera.position.distanceTo(scPos);
  spacecraftGroup.visible = orionVisible && camDist < 10;
  spacecraftMarker.visible = orionVisible && camDist >= 2;
  // Scale marker based on distance
  const markerScale = Math.max(0.5, Math.min(camDist * 0.02, 3));
  spacecraftMarker.scale.set(markerScale, markerScale, 1);

  // Update flight path progress
  const curveFrac = interpolator.getCurveFraction(met);
  flightPath.update(curveFrac);

  // Update body positions and camera first so controls.target is current
  cameraController.updateBodyPosition('earth', new THREE.Vector3(0, 0, 0));
  cameraController.updateBodyPosition('moon', moonPos);
  cameraController.updateBodyPosition('orion', scPos);
  cameraController.update();

  // Update reference plane grid resolution and distance fade based on camera
  const focusPos = cameraController.controls.target;
  const camDistFromFocus = camera.position.distanceTo(focusPos);
  updateIcrfPlane(camDistFromFocus, camera.position, focusPos);
  updateEclipticPlane(camDistFromFocus, camera.position, focusPos);
  updateMoonOrbitalPlane(camDistFromFocus, camera.position, focusPos);

  // Update UI
  const distEarth = scPos.length() - EARTH_RADIUS;
  const distMoon = scPos.distanceTo(moonPos) - 1.7374;
  const speed = interpolator.getSpeed(met);
  updateOverlay(timeline, { distEarth, distMoon, speed });

  renderer.render(scene, camera);
}

animate();
