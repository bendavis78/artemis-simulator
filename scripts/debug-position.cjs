#!/usr/bin/env node

/**
 * Debug CLI for Artemis Simulator position calculations.
 * Outputs moon and spacecraft positions at a given MET.
 *
 * Usage: node scripts/debug-position.cjs <MET_hours>
 * Example: node scripts/debug-position.cjs 102
 */

const fs = require('fs');
const path = require('path');

const MISSION_START = new Date('2026-04-01T22:35:00Z');
const SCALE = 1 / 1000;
const EARTH_RADIUS_KM = 6371;

function parseMoonEphemeris() {
  const dataPath = path.join(__dirname, '..', 'src', 'astro', 'moon-ephemeris.ts');
  const content = fs.readFileSync(dataPath, 'utf-8');

  const match = content.match(/export const MOON_EPHEMERIS[^[]*\[([\s\S]*?)\];/);
  if (!match) {
    throw new Error('Could not parse moon-ephemeris.ts');
  }

  const arrayContent = match[1];
  const points = [];

  const lineMatches = arrayContent.matchAll(/\[\s*([\d.]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\]/g);
  for (const m of lineMatches) {
    points.push({
      met: parseFloat(m[1]),
      x: parseFloat(m[2]),
      y: parseFloat(m[4]),
      z: -parseFloat(m[3])
    });
  }

  return points;
}

function parseHorizonsData() {
  const dataPath = path.join(__dirname, '..', 'src', 'trajectory', 'horizons-data.ts');
  const content = fs.readFileSync(dataPath, 'utf-8');

  const match = content.match(/export const HORIZONS_TRAJECTORY[^[]*\[([\s\S]*?)\];/);
  if (!match) {
    throw new Error('Could not parse horizons-data.ts');
  }

  const arrayContent = match[1];
  const points = [];

  const lineMatches = arrayContent.matchAll(/\[\s*([\d.]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\]/g);
  for (const m of lineMatches) {
    points.push({
      met: parseFloat(m[1]),
      x: parseFloat(m[2]),
      y: parseFloat(m[4]),
      z: -parseFloat(m[3]),
      vx: parseFloat(m[5]),
      vy: parseFloat(m[7]),
      vz: -parseFloat(m[6])
    });
  }

  return points;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getPosition(points, met) {
  if (points.length === 0) return null;

  if (met <= points[0].met) {
    const p = points[0];
    return { x: p.x, y: p.y, z: p.z, vx: p.vx || 0, vy: p.vy || 0, vz: p.vz || 0 };
  }
  if (met >= points[points.length - 1].met) {
    const last = points[points.length - 1];
    return { x: last.x, y: last.y, z: last.z, vx: last.vx || 0, vy: last.vy || 0, vz: last.vz || 0 };
  }

  let i = 0;
  for (; i < points.length - 1; i++) {
    if (points[i + 1].met >= met) break;
  }

  const p0 = points[i];
  const p1 = points[i + 1];
  const t = (met - p0.met) / (p1.met - p0.met);

  return {
    x: lerp(p0.x, p1.x, t),
    y: lerp(p0.y, p1.y, t),
    z: lerp(p0.z, p1.z, t),
    vx: lerp(p0.vx || 0, p1.vx || 0, t),
    vy: lerp(p0.vy || 0, p1.vy || 0, t),
    vz: lerp(p0.vz || 0, p1.vz || 0, t)
  };
}

function normalize(v) {
  const len = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function formatVector(v) {
  return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
}

function formatVectorKm(v) {
  return `(${v.x.toFixed(0)}, ${v.y.toFixed(0)}, ${v.z.toFixed(0)}) km`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node scripts/debug-position.cjs <MET_hours>');
    console.log('Example: node scripts/debug-position.cjs 102');
    process.exit(1);
  }

  const met = parseFloat(args[0]);
  if (isNaN(met)) {
    console.error('Error: MET must be a number');
    process.exit(1);
  }

  const date = new Date(MISSION_START.getTime() + met * 3600000);

  console.log('='.repeat(60));
  console.log(`MET: ${met.toFixed(2)} hours (${(met * 60).toFixed(0)} minutes)`);
  console.log(`UTC: ${date.toISOString()}`);
  console.log('='.repeat(60));

  const moonPoints = parseMoonEphemeris();
  const moonPos = getPosition(moonPoints, met);

  if (moonPos) {
    console.log('\n--- MOON POSITION ---');
    console.log(`Scene units:  ${formatVector(moonPos)}`);
    const moonKm = {
      x: moonPos.x / SCALE,
      y: moonPos.y / SCALE,
      z: moonPos.z / SCALE
    };
    console.log(`ECI (km):     ${formatVectorKm(moonKm)}`);
    const moonDist = Math.sqrt(moonPos.x ** 2 + moonPos.y ** 2 + moonPos.z ** 2);
    console.log(`Distance from Earth center: ${(moonDist / SCALE).toFixed(0)} km (${moonDist.toFixed(2)} Earth radii)`);
  }

  const horizonsPoints = parseHorizonsData();
  const editablePoints = [
    { id: 1, met: 0.00, x: 1.0, y: 1.5, z: -6.2 },
    { id: 2, met: 0.04, x: 2.5, y: 2.5, z: -5.5 },
    { id: 3, met: 0.15, x: 4.5, y: 3.5, z: -3.5 },
    { id: 101, met: 0.75, x: 1.0, y: -3.0, z: 5.5 },
    { id: 4, met: 1.50, x: -5.0, y: -1.0, z: -2.0 },
    { id: 5, met: 2.00, x: -2.0, y: 2.0, z: -5.5 },
    { id: 102, met: 2.75, x: -10.0, y: -2.0, z: 2.0 },
    { id: 103, met: 3.25, x: -20.0, y: -6.0, z: 10.0 },
  ];

  const allPoints = [
    ...editablePoints.map(p => ({
      met: p.met,
      x: p.x,
      y: p.y,
      z: p.z
    })),
    ...horizonsPoints
  ].sort((a, b) => a.met - b.met);

  const scPos = getPosition(allPoints, met);

  if (scPos && moonPos) {
    console.log('\n--- SPACECRAFT POSITION ---');
    console.log(`Scene units:  ${formatVector(scPos)}`);
    const scKm = {
      x: scPos.x / SCALE,
      y: scPos.y / SCALE,
      z: scPos.z / SCALE
    };
    console.log(`ECI (km):     ${formatVectorKm(scKm)}`);
    const scDist = Math.sqrt(scPos.x ** 2 + scPos.y ** 2 + scPos.z ** 2);
    console.log(`Distance from Earth center: ${(scDist / SCALE).toFixed(0)} km (${scDist.toFixed(2)} Earth radii)`);

    const relX = moonPos.x - scPos.x;
    const relY = moonPos.y - scPos.y;
    const relZ = moonPos.z - scPos.z;
    const relDist = Math.sqrt(relX ** 2 + relY ** 2 + relZ ** 2);

    console.log('\n--- MOON RELATIVE TO SPACECRAFT ---');
    console.log(`Relative position (scene): (${relX.toFixed(2)}, ${relY.toFixed(2)}, ${relZ.toFixed(2)})`);
    console.log(`Distance: ${(relDist / SCALE).toFixed(0)} km (${relDist.toFixed(2)} scene units)`);
    console.log(`Distance in Moon radii: ${(relDist / 1.7374).toFixed(2)}`);
    console.log(`Distance in Earth radii: ${(relDist / 6.371).toFixed(2)}`);

    if (scPos.vx !== undefined) {
      const velMag = Math.sqrt(scPos.vx ** 2 + scPos.vy ** 2 + scPos.vz ** 2);
      const velKmS = velMag * 1000;
      console.log('\n--- VELOCITY ---');
      console.log(`Direction (scene): (${normalize({x: scPos.vx, y: scPos.vy, z: scPos.vz}).x.toFixed(3)}, ${normalize({x: scPos.vx, y: scPos.vy, z: scPos.vz}).y.toFixed(3)}, ${normalize({x: scPos.vx, y: scPos.vy, z: scPos.vz}).z.toFixed(3)})`);
      console.log(`Speed: ${velKmS.toFixed(2)} km/s (${(velKmS * 3600).toFixed(0)} km/h)`);

      const toMoon = normalize({ x: relX, y: relY, z: relZ });
      const velDir = normalize({ x: scPos.vx, y: scPos.vy, z: scPos.vz });
      const approachDot = dot(toMoon, velDir);
      const angleDeg = Math.acos(Math.max(-1, Math.min(1, approachDot))) * 180 / Math.PI;

      console.log(`\nAngle to moon: ${angleDeg.toFixed(1)}°`);
      if (approachDot > 0.1) {
        console.log(`Status: APPROACHING moon (velocity pointing toward moon)`);
      } else if (approachDot < -0.1) {
        console.log(`Status: DEPARTING moon (velocity pointing away from moon)`);
      } else {
        console.log(`Status: FLYBY (velocity perpendicular to moon direction)`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
}

try {
  main();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
