import * as THREE from 'three';
import { getMoonPosition } from '../astro/moon-position';
import { MISSION_START_UTC, EARTH_RADIUS, SCALE } from '../constants';

export interface TrajectoryPoint {
  met: number; // mission elapsed time in hours
  position: THREE.Vector3; // scene units (ECI)
}

/**
 * Generate the Artemis II trajectory waypoints.
 *
 * The trajectory is a free-return figure-eight:
 * 1. LEO parking orbits (~185 km altitude, ~28.5 deg inclination)
 * 2. High Earth orbits (perigee raise + apogee raise to ~70,000 km)
 * 3. TLI burn at ~25.5h MET
 * 4. Translunar coast (~4 days)
 * 5. Lunar far-side flyby (closest approach ~6,500 km from surface)
 * 6. Trans-Earth coast (~4 days)
 * 7. Entry and splashdown
 *
 * Positions are approximate but physically plausible. The Moon's
 * actual computed position is used for the flyby geometry.
 */
export function generateTrajectory(): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];

  // Moon position at flyby time (~134h MET)
  const flybyDate = new Date(MISSION_START_UTC.getTime() + 134 * 3600000);
  const moonAtFlyby = getMoonPosition(flybyDate);

  // Moon position at TLI time (~25.5h MET) for departure direction
  const tliDate = new Date(MISSION_START_UTC.getTime() + 25.5 * 3600000);
  getMoonPosition(tliDate); // used implicitly for trajectory shape

  // --- Phase 1: LEO (MET 0-2h) ---
  // 185 km altitude, inclined 28.5 degrees
  // Orbital period at 185 km: ~88 minutes
  const leoRadius = EARTH_RADIUS + 185 * SCALE;
  const leoInclination = 28.5 * (Math.PI / 180);
  const leoPeriod = 88 / 60; // hours

  for (let t = 0; t <= 2; t += 0.05) {
    const angle = (t / leoPeriod) * 2 * Math.PI;
    const x = leoRadius * Math.cos(angle);
    const yFlat = leoRadius * Math.sin(angle);
    // Apply inclination (rotate around x-axis)
    const y = yFlat * Math.cos(leoInclination);
    const z = yFlat * Math.sin(leoInclination);
    points.push({ met: t, position: new THREE.Vector3(x, z, -y) });
  }

  // --- Phase 2: Orbit raising burns (MET 2-25.5h) ---
  // Transition from LEO to high elliptical orbit
  // Apogee grows from ~2,200 km to ~70,000 km over several orbits
  const heoCount = 40;
  for (let i = 0; i <= heoCount; i++) {
    const t = 2 + (i / heoCount) * 23.5;
    const frac = i / heoCount;

    // Apogee grows from 2200 km to 70000 km
    const apogee = (2200 + frac * 67800) * SCALE;
    const perigee = leoRadius;

    // Current angle in orbit (multiple orbits, period increasing)
    // Approximate with a decelerating angular rate
    const periodHours = leoPeriod * Math.pow(1 + frac * 15, 1.5);
    const elapsedInPhase = t - 2;
    const angle = (elapsedInPhase / periodHours) * 2 * Math.PI + Math.PI; // continue from LEO

    // Elliptical orbit: r = a(1-e^2) / (1 + e*cos(theta))
    const a = (perigee + EARTH_RADIUS + apogee) / 2;
    const e = (apogee - perigee) / (apogee + perigee + 2 * EARTH_RADIUS);
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(angle));

    const x = r * Math.cos(angle);
    const yFlat = r * Math.sin(angle);
    const y = yFlat * Math.cos(leoInclination);
    const z = yFlat * Math.sin(leoInclination);
    points.push({ met: t, position: new THREE.Vector3(x, z, -y) });
  }

  // --- Phase 3: TLI and translunar coast (MET 25.5-130h) ---
  // Departure direction: roughly toward where the Moon will be at flyby,
  // but leading it (the Moon moves ~13 deg/day, ~5.5 days travel = ~72 deg)
  const tliPos = points[points.length - 1].position.clone();

  // The trajectory curves due to Earth's gravity - generate as a smooth arc
  const coastPoints = 60;
  for (let i = 1; i <= coastPoints; i++) {
    const frac = i / coastPoints;
    const t = 25.5 + frac * 104.5; // MET 25.5 to 130

    // Distance from Earth increases: fast initially, slowing near Moon
    // Use a power curve for gravity deceleration
    const maxDist = moonAtFlyby.length() + 10; // slightly past Moon distance
    const dist = frac * frac * (3 - 2 * frac) * maxDist * 0.95; // smoothstep-ish

    // Direction: interpolate from departure direction toward Moon
    // with a curve (not straight line - gravity bends it)
    const departDir = tliPos.clone().normalize();
    const arriveDir = moonAtFlyby.clone().normalize();

    // Slerp with some offset for the figure-eight shape
    // The trajectory curves below/above the Earth-Moon line
    const slerpFrac = frac * frac; // accelerating turn toward Moon
    const dir = departDir.clone().lerp(arriveDir, slerpFrac).normalize();

    // Add a perpendicular offset for the curve (gravity bending)
    const perp = new THREE.Vector3()
      .crossVectors(departDir, arriveDir)
      .normalize();
    const bendAmount = Math.sin(frac * Math.PI) * maxDist * 0.08;
    dir.add(perp.multiplyScalar(bendAmount / (dist + 1)));
    dir.normalize();

    const pos = dir.multiplyScalar(dist);
    points.push({ met: t, position: pos });
  }

  // --- Phase 4: Lunar flyby (MET 130-138h) ---
  // Close approach on the far side of the Moon
  // The spacecraft swings behind the Moon (side away from Earth)
  const moonToEarth = moonAtFlyby.clone().negate().normalize();
  const flybyAltitude = 6500 * SCALE; // 6,500 km from surface
  const flybyRadius = 1.7374 + flybyAltitude; // Moon radius + altitude

  // Create a hyperbolic-like arc around the Moon
  // Approach from the Earth-facing side, swing around far side, depart
  const flybyUpDir = new THREE.Vector3(0, 1, 0);
  const flybyRightDir = new THREE.Vector3()
    .crossVectors(moonToEarth, flybyUpDir)
    .normalize();
  // Recalculate up to ensure orthogonality
  flybyUpDir.crossVectors(flybyRightDir, moonToEarth).normalize();

  const flybyPoints = 30;
  for (let i = 0; i <= flybyPoints; i++) {
    const frac = i / flybyPoints;
    const t = 130 + frac * 8; // MET 130-138

    // Angle sweeps from approaching (0) through far side (PI) to departing (2*PI)
    // but only ~180 degrees of arc for a flyby
    const angle = -Math.PI * 0.6 + frac * Math.PI * 1.2;

    // Distance varies: closest at angle = 0 (far side)
    const closestDist = flybyRadius;
    const dist = closestDist + Math.abs(Math.sin(angle * 0.5)) * flybyRadius * 3;

    // Position relative to Moon
    const localX = Math.sin(angle) * dist;
    const localZ = -Math.cos(angle) * dist;

    const pos = moonAtFlyby.clone();
    pos.add(moonToEarth.clone().multiplyScalar(localZ));
    pos.add(flybyRightDir.clone().multiplyScalar(localX));

    points.push({ met: t, position: pos });
  }

  // --- Phase 5: Trans-Earth coast (MET 138-230h) ---
  // Return trajectory - the free-return bends back toward Earth
  // The Moon has moved since flyby, so return path is offset
  const postFlybyPos = points[points.length - 1].position.clone();
  const returnPoints = 60;

  for (let i = 1; i <= returnPoints; i++) {
    const frac = i / returnPoints;
    const t = 138 + frac * 92; // MET 138-230

    // Distance from Earth: starts at Moon distance, comes back to Earth
    const startDist = postFlybyPos.length();
    // Use smoothstep for gravity acceleration on return
    const returnFrac = frac * frac * (3 - 2 * frac);
    const dist = startDist * (1 - returnFrac);

    // Direction: from post-flyby direction toward Earth
    // with an offset from the outbound path (figure-eight shape)
    const departDir = postFlybyPos.clone().normalize();

    // Interpolate direction, curving back
    const dir = departDir.clone().lerp(
      // Aim slightly offset from straight back to Earth for figure-eight
      new THREE.Vector3(-departDir.x, departDir.y * 0.5, -departDir.z * 0.3)
        .normalize(),
      frac
    ).normalize();

    // Add perpendicular offset for the return curve
    // This creates the asymmetry of the figure-eight
    const returnPerp = new THREE.Vector3(0, 1, 0);
    const returnBend = Math.sin(frac * Math.PI) * startDist * 0.15;
    dir.add(returnPerp.clone().multiplyScalar(returnBend / (dist + 1)));
    dir.normalize();

    const pos = dir.multiplyScalar(Math.max(dist, EARTH_RADIUS + 0.12));
    points.push({ met: t, position: pos });
  }

  // --- Phase 6: Entry and splashdown (MET 230-233h) ---
  const entryStart = points[points.length - 1].position.clone();
  for (let i = 1; i <= 10; i++) {
    const frac = i / 10;
    const t = 230 + frac * 3;
    const dist = entryStart.length() * (1 - frac) + EARTH_RADIUS * frac;
    const dir = entryStart.clone().normalize();
    points.push({ met: t, position: dir.multiplyScalar(dist) });
  }

  return points;
}
