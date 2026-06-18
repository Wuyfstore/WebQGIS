import type { DirtyTile, GeometryBbox } from "../types.js";

const defaultMinZoom = 0;
const defaultMaxZoom = 14;
const maxTilesPerZoom = 512;
const mercatorLatitudeLimit = 85.05112878;

export type DirtyTileOptions = {
  minZoom?: number;
  maxZoom?: number;
};

export function mergeBboxes(...bboxes: Array<GeometryBbox | null | undefined>): GeometryBbox | null {
  const valid = bboxes.filter((bbox): bbox is GeometryBbox => Boolean(bbox));
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce<GeometryBbox>((merged, bbox) => [
    Math.min(merged[0], bbox[0]),
    Math.min(merged[1], bbox[1]),
    Math.max(merged[2], bbox[2]),
    Math.max(merged[3], bbox[3])
  ], valid[0]);
}

export function dirtyTilesForBbox(bbox: GeometryBbox | null, options: DirtyTileOptions = {}): DirtyTile[] {
  if (!bbox) {
    return [];
  }
  const minZoom = clampInteger(options.minZoom ?? defaultMinZoom, 0, 30);
  const maxZoom = clampInteger(options.maxZoom ?? defaultMaxZoom, minZoom, 30);
  const normalized = normalizeBbox(bbox);
  if (!normalized) {
    return [];
  }
  const tiles: DirtyTile[] = [];
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const minTile = lonLatToTile(normalized[0], normalized[3], z);
    const maxTile = lonLatToTile(normalized[2], normalized[1], z);
    const minX = Math.min(minTile.x, maxTile.x);
    const maxX = Math.max(minTile.x, maxTile.x);
    const minY = Math.min(minTile.y, maxTile.y);
    const maxY = Math.max(minTile.y, maxTile.y);
    const count = (maxX - minX + 1) * (maxY - minY + 1);
    if (count > maxTilesPerZoom) {
      continue;
    }
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

function normalizeBbox(bbox: GeometryBbox): GeometryBbox | null {
  const values = bbox.map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const minLon = clamp(Math.min(values[0], values[2]), -180, 180);
  const maxLon = clamp(Math.max(values[0], values[2]), -180, 180);
  const minLat = clamp(Math.min(values[1], values[3]), -mercatorLatitudeLimit, mercatorLatitudeLimit);
  const maxLat = clamp(Math.max(values[1], values[3]), -mercatorLatitudeLimit, mercatorLatitudeLimit);
  return [minLon, minLat, maxLon, maxLat];
}

function lonLatToTile(lon: number, lat: number, z: number) {
  const tilesPerAxis = 2 ** z;
  const x = clampInteger(Math.floor(((lon + 180) / 360) * tilesPerAxis), 0, tilesPerAxis - 1);
  const latRad = (lat * Math.PI) / 180;
  const y = clampInteger(
    Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * tilesPerAxis),
    0,
    tilesPerAxis - 1
  );
  return { x, y };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number) {
  return Math.round(clamp(value, min, max));
}
