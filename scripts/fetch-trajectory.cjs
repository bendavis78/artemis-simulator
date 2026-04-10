#!/usr/bin/env node

/**
 * Fetches Artemis II trajectory data and Moon ephemeris from JPL Horizons API
 * and generates TypeScript data files.
 *
 * Horizons provides geocentric ICRF state vectors (km, km/s)
 * starting ~3.5h after launch (after ICPS separation).
 *
 * Output:
 *   - src/trajectory/horizons-data.ts (spacecraft)
 *   - src/astro/moon-ephemeris.ts (moon)
 */

const fs = require('fs');
const path = require('path');

const MISSION_START = new Date('2026-04-01T22:35:00Z');
const MISSION_END = new Date('2026-04-11T11:05:00Z');
const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

const baseParams = {
  format: 'text',
  OBJ_DATA: "'NO'",
  MAKE_EPHEM: "'YES'",
  EPHEM_TYPE: "'VECTORS'",
  CENTER: "'500@399'",
  REF_PLANE: "'FRAME'",
  REF_SYSTEM: "'ICRF'",
  OUT_UNITS: "'KM-S'",
  VEC_TABLE: "'2'",
  VEC_LABELS: "'NO'",
  CSV_FORMAT: "'YES'",
};

// Split spacecraft query: coarse 30-min steps + fine 2-min steps around perigee (TLI burn)
const PERIGEE_START = '2026-04-02 21:30'; // MET ~23h
const PERIGEE_END   = '2026-04-03 03:30'; // MET ~29h

const spacecraftCoarseBeforeParams = new URLSearchParams({
  ...baseParams,
  COMMAND: "'-1024'",
  START_TIME: "'2026-04-02 02:05'",
  STOP_TIME: `'${PERIGEE_START}'`,
  STEP_SIZE: "'30 min'",
});

const spacecraftFineParams = new URLSearchParams({
  ...baseParams,
  COMMAND: "'-1024'",
  START_TIME: `'${PERIGEE_START}'`,
  STOP_TIME: `'${PERIGEE_END}'`,
  STEP_SIZE: "'2 min'",
});

const spacecraftCoarseAfterParams = new URLSearchParams({
  ...baseParams,
  COMMAND: "'-1024'",
  START_TIME: `'${PERIGEE_END}'`,
  STOP_TIME: "'2026-04-10 21:00'",
  STEP_SIZE: "'30 min'",
});

// Fine steps for final approach/reentry (Horizons ephemeris ends ~MET 217.3h at ~180 km alt)
const spacecraftReentryParams = new URLSearchParams({
  ...baseParams,
  COMMAND: "'-1024'",
  START_TIME: "'2026-04-10 21:00'",
  STOP_TIME: "'2026-04-10 23:54'",
  STEP_SIZE: "'2 min'",
});

const moonParams = new URLSearchParams({
  ...baseParams,
  COMMAND: "'301'",
  START_TIME: "'2026-04-01T22:35'",
  STOP_TIME: "'2026-04-11T11:05'",
  STEP_SIZE: "'30 min'",
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchHorizonsData(params, label, retries = 3) {
  const url = `${HORIZONS_API}?${params}`;
  console.log(`Fetching ${label} from JPL Horizons...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.status === 503 && attempt < retries) {
      console.log(`  503 — retrying in ${attempt * 2}s (attempt ${attempt}/${retries})...`);
      await sleep(attempt * 2000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Horizons API returned ${res.status}`);
    }
    const text = await res.text();

    const soeIdx = text.indexOf('$$SOE');
    const eoeIdx = text.indexOf('$$EOE');
    if (soeIdx === -1 || eoeIdx === -1) {
      if (text.includes('No ephemeris')) {
        throw new Error('Horizons has no ephemeris for this target/time range');
      }
      throw new Error('Could not find data markers in Horizons response');
    }

    const dataBlock = text.slice(soeIdx + 5, eoeIdx).trim();
    const lines = dataBlock.split('\n').filter(l => l.trim());

    const points = [];
    for (const line of lines) {
      const parts = line.trim().replace(/,\s*$/, '').split(',').map(s => s.trim());
      const dateStr = parts[1];

      const match = dateStr.match(/(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
      if (!match) {
        console.warn(`Skipping unparseable date: ${dateStr}`);
        continue;
      }
      const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      const dt = new Date(Date.UTC(
        parseInt(match[1]),
        months[match[2]],
        parseInt(match[3]),
        parseInt(match[4]),
        parseInt(match[5]),
        parseInt(match[6])
      ));

      const metHours = (dt.getTime() - MISSION_START.getTime()) / 3600000;

      const x = parseFloat(parts[2]) / 1000;
      const y = parseFloat(parts[3]) / 1000;
      const z = parseFloat(parts[4]) / 1000;
      const vx = parseFloat(parts[5]) / 1000;
      const vy = parseFloat(parts[6]) / 1000;
      const vz = parseFloat(parts[7]) / 1000;

      points.push({ met: metHours, x, y, z, vx, vy, vz });
    }

    console.log(`  Parsed ${points.length} ${label} points`);
    console.log(`  MET range: ${points[0].met.toFixed(1)}h — ${points[points.length - 1].met.toFixed(1)}h`);
    return points;
  }
  throw new Error(`Horizons API failed after ${retries} attempts`);
}

function parseHorizonsData(text, label) {
  const soeIdx = text.indexOf('$$SOE');
  const eoeIdx = text.indexOf('$$EOE');
  if (soeIdx === -1 || eoeIdx === -1) {
    if (text.includes('No ephemeris')) {
      throw new Error('Horizons has no ephemeris for this target/time range');
    }
    throw new Error('Could not find data markers in Horizons response');
  }

  const dataBlock = text.slice(soeIdx + 5, eoeIdx).trim();
  const lines = dataBlock.split('\n').filter(l => l.trim());

  const points = [];
  for (const line of lines) {
    const parts = line.trim().replace(/,\s*$/, '').split(',').map(s => s.trim());
    const dateStr = parts[1];

    const match = dateStr.match(/(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!match) {
      console.warn(`Skipping unparseable date: ${dateStr}`);
      continue;
    }
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const dt = new Date(Date.UTC(
      parseInt(match[1]),
      months[match[2]],
      parseInt(match[3]),
      parseInt(match[4]),
      parseInt(match[5]),
      parseInt(match[6])
    ));

    const metHours = (dt.getTime() - MISSION_START.getTime()) / 3600000;

    const x = parseFloat(parts[2]) / 1000;
    const y = parseFloat(parts[3]) / 1000;
    const z = parseFloat(parts[4]) / 1000;
    const vx = parseFloat(parts[5]) / 1000;
    const vy = parseFloat(parts[6]) / 1000;
    const vz = parseFloat(parts[7]) / 1000;

    points.push({ met: metHours, x, y, z, vx, vy, vz });
  }

  console.log(`  Parsed ${points.length} ${label} points`);
  console.log(`  MET range: ${points[0].met.toFixed(1)}h — ${points[points.length - 1].met.toFixed(1)}h`);
  return points;
}

function writeSpacecraftData(points) {
  const dataLines = points.map(p =>
    `  [${p.met.toFixed(4)}, ${p.x.toFixed(6)}, ${p.y.toFixed(6)}, ${p.z.toFixed(6)}, ${p.vx.toFixed(9)}, ${p.vy.toFixed(9)}, ${p.vz.toFixed(9)}],`
  );

  const ts = `// Auto-generated by scripts/fetch-trajectory.cjs
// Source: JPL Horizons API, spacecraft -1024 (Artemis II)
// Geocentric ICRF coordinates, 1 unit = 1,000 km
// Format: [MET (hours), X, Y, Z, VX, VY, VZ] (velocity in scene units/s)
// Generated: ${new Date().toISOString()}

export const HORIZONS_TRAJECTORY: [number, number, number, number, number, number, number][] = [
${dataLines.join('\n')}
];
`;

  const outPath = path.join(__dirname, '..', 'src', 'trajectory', 'horizons-data.ts');
  fs.writeFileSync(outPath, ts);
  console.log(`Wrote ${outPath}`);
}

function writeMoonData(points) {
  const dataLines = points.map(p =>
    `  [${p.met.toFixed(4)}, ${p.x.toFixed(6)}, ${p.y.toFixed(6)}, ${p.z.toFixed(6)}],`
  );

  const ts = `// Auto-generated by scripts/fetch-trajectory.cjs
// Source: JPL Horizons API, target 301 (Moon)
// Geocentric ICRF coordinates, 1 unit = 1,000 km
// Format: [MET (hours), X, Y, Z]
// Generated: ${new Date().toISOString()}

export const MOON_EPHEMERIS: [number, number, number, number][] = [
${dataLines.join('\n')}
];
`;

  const outPath = path.join(__dirname, '..', 'src', 'astro', 'moon-ephemeris.ts');
  fs.writeFileSync(outPath, ts);
  console.log(`Wrote ${outPath}`);
}

async function main() {
  // Fetch sequentially to avoid Horizons 503 rate limits
  const coarseBefore = await fetchHorizonsData(spacecraftCoarseBeforeParams, 'spacecraft (pre-perigee)');
  const fine = await fetchHorizonsData(spacecraftFineParams, 'spacecraft (perigee, 2-min)');
  const coarseAfter = await fetchHorizonsData(spacecraftCoarseAfterParams, 'spacecraft (post-perigee)');
  const reentry = await fetchHorizonsData(spacecraftReentryParams, 'spacecraft (reentry, 2-min)');
  const moonData = await fetchHorizonsData(moonParams, 'moon ephemeris');

  // Merge segments, removing duplicate timestamps at boundaries
  const seen = new Set();
  const spacecraftData = [];
  for (const segment of [coarseBefore, fine, coarseAfter, reentry]) {
    for (const pt of segment) {
      const key = pt.met.toFixed(4);
      if (!seen.has(key)) {
        seen.add(key);
        spacecraftData.push(pt);
      }
    }
  }
  spacecraftData.sort((a, b) => a.met - b.met);
  console.log(`  Merged: ${spacecraftData.length} total spacecraft points`);

  writeSpacecraftData(spacecraftData);
  writeMoonData(moonData);
}

main().catch(err => {
  console.error('Failed to fetch trajectory:', err.message);
  process.exit(1);
});
