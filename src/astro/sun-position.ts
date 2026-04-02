import * as THREE from 'three';

/**
 * Compute the Sun's direction vector in ECI (equatorial) coordinates.
 * Uses simplified solar position from Schlyter's formulae.
 * Returns a normalized direction vector (Sun is effectively at infinity).
 */
export function getSunDirection(date: Date): THREE.Vector3 {
  // Days since J2000.0 (2000 Jan 1.5 TT ≈ 12:00 UTC)
  const d = daysSinceJ2000(date);

  // Mean anomaly of the Sun (degrees)
  const M = normalizeAngle(356.0470 + 0.9856002585 * d);
  // Argument of perihelion (degrees)
  const w = normalizeAngle(282.9404 + 4.70935e-5 * d);

  const Mrad = M * (Math.PI / 180);

  // Equation of center (approximate)
  const C =
    (1.9146 - 0.004817 * (d / 36525) - 0.000014 * (d / 36525) ** 2) *
      Math.sin(Mrad) +
    0.019993 * Math.sin(2 * Mrad) +
    0.00029 * Math.sin(3 * Mrad);

  // Sun's true longitude in ecliptic
  const sunLon = (w + M + C) * (Math.PI / 180);

  // Ecliptic coordinates (Sun in ecliptic plane, latitude ≈ 0)
  const xEcl = Math.cos(sunLon);
  const yEcl = Math.sin(sunLon);

  // Rotate from ecliptic to equatorial (by obliquity ε ≈ 23.4393°)
  const obliquity = 23.4393 * (Math.PI / 180);
  const xEq = xEcl;
  const yEq = yEcl * Math.cos(obliquity);
  const zEq = yEcl * Math.sin(obliquity);

  return new THREE.Vector3(xEq, zEq, -yEq).normalize();
}

function daysSinceJ2000(date: Date): number {
  const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  return (date.getTime() - j2000) / 86400000;
}

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
