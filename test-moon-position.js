// Test moon position vs trajectory
const MISSION_START_UTC = new Date('2026-04-01T22:35:00Z');

// Simplified version of getMoonPosition
function daysSinceJ2000(date) {
  const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  return (date.getTime() - j2000) / 86400000;
}

function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

function getMoonPosition(date) {
  const d = daysSinceJ2000(date);

  // Orbital elements (degrees, except a in Earth radii)
  const N = normalizeAngle(125.1228 - 0.0529538083 * d); // long. ascending node
  const i = 5.1454; // inclination
  const w = normalizeAngle(318.0634 + 0.1643573223 * d); // arg. of perigee
  const a = 60.2666; // semi-major axis in Earth radii
  const e = 0.054900; // eccentricity
  const M = normalizeAngle(115.3654 + 13.0649929509 * d); // mean anomaly

  // Solve Kepler's equation: E - e*sin(E) = M
  const Mrad = M * (Math.PI / 180);
  let E = Mrad + e * Math.sin(Mrad) * (1 + e * Math.cos(Mrad));
  for (let iter = 0; iter < 10; iter++) {
    const dE = (E - e * Math.sin(E) - Mrad) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-8) break;
  }

  // Position in orbital plane
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // True anomaly and distance
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv); // in Earth radii

  // Convert to ecliptic coordinates
  const Nrad = N * (Math.PI / 180);
  const irad = i * (Math.PI / 180);
  const wrad = w * (Math.PI / 180);

  const cosN = Math.cos(Nrad);
  const sinN = Math.sin(Nrad);
  const cosI = Math.cos(irad);
  const sinI = Math.sin(irad);
  const cosVW = Math.cos(v + wrad);
  const sinVW = Math.sin(v + wrad);

  const xEcl = r * (cosN * cosVW - sinN * sinVW * cosI);
  const yEcl = r * (sinN * cosVW + cosN * sinVW * cosI);
  const zEcl = r * sinVW * sinI;

  // Convert from Earth radii to km
  const earthRadiusKm = 6371;
  const xKm = xEcl * earthRadiusKm;
  const yKm = yEcl * earthRadiusKm;
  const zKm = zEcl * earthRadiusKm;

  // Rotate from ecliptic to equatorial (obliquity ε)
  const obliquity = 23.4393 * (Math.PI / 180);
  const cosObl = Math.cos(obliquity);
  const sinObl = Math.sin(obliquity);

  const xEq = xKm;
  const yEq = yKm * cosObl - zKm * sinObl;
  const zEq = yKm * sinObl + zKm * cosObl;

  // Apply scale: 1 scene unit = 1000 km
  const SCALE = 1 / 1000;
  return { x: xEq * SCALE, y: zEq * SCALE, z: -yEq * SCALE };
}

// Test at MET 130 (5.4167 days after launch)
const met = 130;
const date = new Date(MISSION_START_UTC.getTime() + met * 3600000);
console.log('Date at MET 130:', date.toISOString());

const moonPos = getMoonPosition(date);
console.log('Moon position at MET 130:');
console.log(`  X: ${moonPos.x.toFixed(2)} (${(moonPos.x * 1000).toFixed(0)} km)`);
console.log(`  Y: ${moonPos.y.toFixed(2)} (${(moonPos.y * 1000).toFixed(0)} km)`);
console.log(`  Z: ${moonPos.z.toFixed(2)} (${(moonPos.z * 1000).toFixed(0)} km)`);

const distance = Math.sqrt(moonPos.x**2 + moonPos.y**2 + moonPos.z**2);
console.log(`Distance from Earth: ${distance.toFixed(2)} units (${(distance * 1000).toFixed(0)} km)`);

// Compare with spacecraft position at MET 130 from horizons-data.ts
// Spacecraft: (-130.58, -329.88, -183.95)
const scDistance = Math.sqrt(130.58**2 + 329.88**2 + 183.95**2);
console.log('\nSpacecraft distance from Earth at MET 130:', scDistance.toFixed(2), 'units');
console.log('Expected Earth-Moon distance: ~384.4 units');