// Scale: 1 Three.js unit = 1,000 km
export const SCALE = 1 / 1000; // km -> scene units

export const EARTH_RADIUS = 6.371; // scene units (6,371 km)
export const MOON_RADIUS = 1.7374; // scene units (1,737.4 km)
export const EARTH_MOON_MEAN_DIST = 384.4; // scene units (384,400 km)

// Earth's axial tilt (obliquity of ecliptic) in radians
export const EARTH_OBLIQUITY = 23.4393 * (Math.PI / 180);

// Mission timeline
export const MISSION_START_UTC = new Date('2026-04-01T22:35:00Z');
export const MISSION_DURATION_HOURS = 233; // ~10 days

// Texture paths (Solar System Scope, CC-BY-4.0)
export const TEXTURES = {
  earthDay: '/textures/2k_earth_daymap.jpg',
  earthNight: '/textures/2k_earth_nightmap.jpg',
  earthClouds: '/textures/2k_earth_clouds.jpg',
  earthSpecular: '/textures/2k_earth_specular_map.jpg',
  moonColor: '/textures/2k_moon.jpg',
};
