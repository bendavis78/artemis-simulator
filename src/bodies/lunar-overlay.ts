/**
 * Generates a transparent overlay sphere that draws lunar feature outlines
 * and labels in equirectangular projection. Added as a child of the Moon mesh
 * so it inherits position and rotation. Uses additive blending for the HUD glow.
 */

import * as THREE from 'three';
import { MOON_RADIUS, MOON_TEXTURE_OFFSET } from '../constants';
import { LUNAR_FEATURES, type LunarFeature } from '../data/lunar-features';

const CANVAS_W = 4096;
const CANVAS_H = 2048;
const MOON_CIRCUMFERENCE_KM = 2 * Math.PI * 1737.4;
const PX_PER_KM = CANVAS_W / MOON_CIRCUMFERENCE_KM;
const DEG2RAD = Math.PI / 180;

// HUD color palette
const CYAN = 'rgba(0, 210, 210, 0.8)';
const CYAN_DIM = 'rgba(0, 210, 210, 0.35)';
const CYAN_LABEL = 'rgba(0, 230, 230, 0.9)';
const CYAN_SITE = 'rgba(0, 255, 200, 0.9)';

/** Convert selenographic lat/lon to canvas pixel coords. */
function latLonToCanvas(lat: number, lon: number): { x: number; y: number } {
  const adjustedLon = (((lon + 180) % 360) + 360) % 360;
  const x = (adjustedLon / 360) * CANVAS_W;
  // SphereGeometry: v=0 at north pole, v=1 at south pole
  // CanvasTexture flipY=true: canvas row 0 → v=0 (north pole)
  // So north (+90) → y=0 (top), south (-90) → y=CANVAS_H (bottom)
  const y = ((90 - lat) / 180) * CANVAS_H;
  return { x, y };
}

/** Radius in canvas pixels for a feature, accounting for equirectangular stretch. */
function featureRadiusPx(diameterKm: number, lat: number): { rx: number; ry: number } {
  const rKm = diameterKm / 2;
  const ry = rKm * PX_PER_KM;
  const cosLat = Math.cos(lat * DEG2RAD);
  const rx = cosLat > 0.01 ? ry / cosLat : ry / 0.01;
  return { rx, ry };
}

function drawCrater(ctx: CanvasRenderingContext2D, f: LunarFeature): void {
  const { x, y } = latLonToCanvas(f.lat, f.lon);
  const { rx, ry } = featureRadiusPx(f.diameterKm, f.lat);

  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Small tick marks at cardinal points for larger craters
  if (rx > 20) {
    const tickLen = Math.min(rx * 0.15, 12);
    ctx.beginPath();
    ctx.moveTo(x, y - ry);
    ctx.lineTo(x, y - ry - tickLen);
    ctx.moveTo(x, y + ry);
    ctx.lineTo(x, y + ry + tickLen);
    ctx.moveTo(x - rx, y);
    ctx.lineTo(x - rx - tickLen, y);
    ctx.moveTo(x + rx, y);
    ctx.lineTo(x + rx + tickLen, y);
    ctx.stroke();
  }
}

function drawMare(ctx: CanvasRenderingContext2D, f: LunarFeature): void {
  const { x, y } = latLonToCanvas(f.lat, f.lon);
  const { rx, ry } = featureRadiusPx(f.diameterKm, f.lat);

  ctx.strokeStyle = CYAN_DIM;
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBasin(ctx: CanvasRenderingContext2D, f: LunarFeature): void {
  const { x, y } = latLonToCanvas(f.lat, f.lon);
  const { rx, ry } = featureRadiusPx(f.diameterKm, f.lat);

  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Inner concentric ring (~60% of outer)
  ctx.strokeStyle = CYAN_DIM;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.6, ry * 0.6, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSite(ctx: CanvasRenderingContext2D, f: LunarFeature): void {
  const { x, y } = latLonToCanvas(f.lat, f.lon);
  const size = 8;

  ctx.strokeStyle = CYAN_SITE;
  ctx.lineWidth = 2;

  // Crosshair
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();

  // Small diamond
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.6);
  ctx.lineTo(x + size * 0.6, y);
  ctx.lineTo(x, y + size * 0.6);
  ctx.lineTo(x - size * 0.6, y);
  ctx.closePath();
  ctx.stroke();
}

function drawLabel(ctx: CanvasRenderingContext2D, f: LunarFeature): void {
  const { x, y } = latLonToCanvas(f.lat, f.lon);

  let fontSize: number;
  switch (f.type) {
    case 'basin': fontSize = 26; break;
    case 'mare':  fontSize = 22; break;
    case 'site':  fontSize = 18; break;
    default:      fontSize = f.diameterKm > 100 ? 20 : 16; break;
  }

  ctx.fillStyle = CYAN_LABEL;
  ctx.font = `${fontSize}px 'Courier New', monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let offsetX: number;
  if (f.diameterKm > 0) {
    const { rx } = featureRadiusPx(f.diameterKm, f.lat);
    offsetX = rx + 10;
  } else {
    offsetX = 14;
  }

  if (f.type === 'mare' || f.type === 'basin') {
    ctx.textAlign = 'center';
    ctx.fillText(f.name, x, y - 8);
  } else {
    ctx.fillText(f.name, x + offsetX, y);
  }
}

function createOverlayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // DEBUG: draw equator (lat=0) and prime meridian (lon=0) for alignment
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
  ctx.lineWidth = 3;
  // Equator: horizontal line at lat=0
  const eqY = latLonToCanvas(0, 0).y;
  ctx.beginPath();
  ctx.moveTo(0, eqY);
  ctx.lineTo(CANVAS_W, eqY);
  ctx.stroke();
  // Prime meridian: vertical line at lon=0
  const pmX = latLonToCanvas(0, 0).x;
  ctx.beginPath();
  ctx.moveTo(pmX, 0);
  ctx.lineTo(pmX, CANVAS_H);
  ctx.stroke();

  // Draw features by type (back to front for layering)
  for (const f of LUNAR_FEATURES) {
    if (f.type === 'basin') drawBasin(ctx, f);
  }
  for (const f of LUNAR_FEATURES) {
    if (f.type === 'mare') drawMare(ctx, f);
  }
  for (const f of LUNAR_FEATURES) {
    if (f.type === 'crater') drawCrater(ctx, f);
  }
  for (const f of LUNAR_FEATURES) {
    if (f.type === 'site') drawSite(ctx, f);
  }
  for (const f of LUNAR_FEATURES) {
    drawLabel(ctx, f);
  }

  const texture = new THREE.CanvasTexture(canvas);
  // Match the Moon color texture's UV offset so features align
  texture.offset.set(MOON_TEXTURE_OFFSET, 0);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/**
 * Creates a transparent overlay sphere to be added as a child of the Moon mesh.
 * Uses additive blending so the cyan HUD lines glow over the Moon surface.
 */
export function createLunarOverlay(): THREE.Mesh {
  const texture = createOverlayTexture();

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // Slightly larger than Moon so it renders on top without z-fighting
  const geometry = new THREE.SphereGeometry(MOON_RADIUS * 1.001, 64, 32);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'lunarOverlay';

  return mesh;
}
