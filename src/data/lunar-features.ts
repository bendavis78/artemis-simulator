/**
 * Lunar surface features for the targeting HUD overlay.
 * Coordinates use standard selenographic conventions:
 *   latitude:  -90 (south pole) to +90 (north pole)
 *   longitude: -180 (west) to +180 (east)
 * Diameters in km.
 */

export type FeatureType = 'crater' | 'mare' | 'basin' | 'site';

export interface LunarFeature {
  name: string;
  lat: number;
  lon: number;
  diameterKm: number;
  type: FeatureType;
}

export const LUNAR_FEATURES: LunarFeature[] = [
  // ── Artemis targets ──────────────────────────────────────────
  { name: 'Shackleton',       lat: -89.54, lon:    0.0, diameterKm:  21, type: 'crater' },
  { name: 'Nobile',           lat: -85.28, lon:   53.3, diameterKm:  79, type: 'crater' },
  { name: 'Orientale Basin',  lat: -19.0,  lon:  -93.0, diameterKm: 930, type: 'basin'  },
  { name: 'Hertzsprung',      lat:   1.4,  lon: -128.7, diameterKm: 536, type: 'basin'  },

  // ── Major maria ──────────────────────────────────────────────
  { name: 'Mare Imbrium',         lat:  32.8, lon:  -15.6, diameterKm: 1123, type: 'mare' },
  { name: 'Mare Serenitatis',     lat:  28.0, lon:   17.5, diameterKm:  707, type: 'mare' },
  { name: 'Mare Tranquillitatis', lat:   8.5, lon:   31.4, diameterKm:  873, type: 'mare' },
  { name: 'Mare Crisium',         lat:  17.0, lon:   59.1, diameterKm:  556, type: 'mare' },
  { name: 'Mare Fecunditatis',    lat:  -7.8, lon:   51.3, diameterKm:  909, type: 'mare' },
  { name: 'Mare Nectaris',        lat: -15.2, lon:   35.5, diameterKm:  333, type: 'mare' },
  { name: 'Mare Humorum',         lat: -24.4, lon:  -38.6, diameterKm:  389, type: 'mare' },
  { name: 'Mare Nubium',          lat: -21.3, lon:  -16.6, diameterKm:  715, type: 'mare' },
  { name: 'Mare Frigoris',        lat:  56.0, lon:    1.4, diameterKm: 1596, type: 'mare' },
  { name: 'Oceanus Procellarum',  lat:  18.4, lon:  -57.4, diameterKm: 2568, type: 'mare' },

  // ── Notable craters ──────────────────────────────────────────
  { name: 'Tycho',        lat: -43.3, lon:  -11.2, diameterKm:  85, type: 'crater' },
  { name: 'Copernicus',   lat:   9.6, lon:  -20.1, diameterKm:  93, type: 'crater' },
  { name: 'Aristarchus',  lat:  23.7, lon:  -47.4, diameterKm:  40, type: 'crater' },
  { name: 'Kepler',       lat:   8.1, lon:  -38.0, diameterKm:  32, type: 'crater' },
  { name: 'Plato',        lat:  51.6, lon:   -9.4, diameterKm: 101, type: 'crater' },
  { name: 'Clavius',      lat: -58.4, lon:  -14.4, diameterKm: 225, type: 'crater' },
  { name: 'Grimaldi',     lat:  -5.2, lon:  -68.6, diameterKm: 172, type: 'crater' },
  { name: 'Langrenus',    lat:  -8.9, lon:   61.1, diameterKm: 132, type: 'crater' },
  { name: 'Petavius',     lat: -25.3, lon:   60.4, diameterKm: 177, type: 'crater' },
  { name: 'Theophilus',   lat: -11.4, lon:   26.4, diameterKm: 100, type: 'crater' },
  { name: 'Eratosthenes', lat:  14.5, lon:  -11.3, diameterKm:  59, type: 'crater' },
  { name: 'Archimedes',   lat:  29.7, lon:   -4.0, diameterKm:  83, type: 'crater' },

  // ── South Pole-Aitken Basin (far side) ───────────────────────
  { name: 'South Pole-Aitken', lat: -53.0, lon: -169.0, diameterKm: 2500, type: 'basin' },

  // ── Apollo landing sites ─────────────────────────────────────
  { name: 'Apollo 11',  lat:   0.67, lon:  23.47, diameterKm: 0, type: 'site' },
  { name: 'Apollo 12',  lat:  -3.01, lon: -23.42, diameterKm: 0, type: 'site' },
  { name: 'Apollo 14',  lat:  -3.65, lon: -17.47, diameterKm: 0, type: 'site' },
  { name: 'Apollo 15',  lat:  26.13, lon:   3.63, diameterKm: 0, type: 'site' },
  { name: 'Apollo 16',  lat:  -8.97, lon:  15.50, diameterKm: 0, type: 'site' },
  { name: 'Apollo 17',  lat:  20.19, lon:  30.77, diameterKm: 0, type: 'site' },
];
