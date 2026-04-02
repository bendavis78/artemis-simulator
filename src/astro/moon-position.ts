import * as THREE from 'three';
import { SCALE } from '../constants';

/**
 * Compute the Moon's position in ECI coordinates using Schlyter's
 * simplified lunar ephemeris. Accurate to ~1 arcmin, sufficient for
 * visualization over a 10-day mission window.
 *
 * Returns position in scene units (1 unit = 1000 km).
 */
export function getMoonPosition(date: Date): THREE.Vector3 {
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

  // Convert from Earth radii to km, then to scene units
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

  // Three.js: X=right, Y=up, Z=toward camera
  // ECI: X=vernal equinox, Y=in equatorial plane, Z=north pole
  // Map ECI (x,y,z) -> Three.js (x, z, -y) so Y=up=north pole
  return new THREE.Vector3(xEq * SCALE, zEq * SCALE, -yEq * SCALE);
}

function daysSinceJ2000(date: Date): number {
  const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  return (date.getTime() - j2000) / 86400000;
}

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
