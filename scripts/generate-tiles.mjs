import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  const layerId = requiredOption(options, "layer-id");
  const minZoom = Number(options.minZoom ?? 0);
  const maxZoom = Number(options.maxZoom ?? minZoom);
  const bounds = parseBounds(requiredOption(options, "bounds"));
  const apiBase = options.apiBase ?? "http://127.0.0.1:3000/api";
  const outputDir = options.outputDir ?? join("apps", "api", "data", "tile-packages", layerId, `z${minZoom}_${maxZoom}`);
  const execute = Boolean(options.execute);
  const plan = buildTilePlan({ layerId, minZoom, maxZoom, bounds, apiBase, outputDir });

  if (!execute) {
    console.log(JSON.stringify({
      mode: "dry-run",
      layerId,
      minZoom,
      maxZoom,
      bounds,
      outputDir,
      tileCount: plan.tiles.length,
      sample: plan.tiles.slice(0, 5)
    }, null, 2));
    process.exit(0);
  }

  for (const tile of plan.tiles) {
    const response = await fetch(tile.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${tile.url}: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const targetDir = join(outputDir, String(tile.z), String(tile.x));
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, `${tile.y}.mvt`), buffer);
  }

  const packageMeta = {
    id: `${layerId}-directory-z${minZoom}-${maxZoom}-${Date.now()}`,
    layerId,
    version: Number(options.version ?? Date.now()),
    minZoom,
    maxZoom,
    bounds,
    format: "mvt",
    sourceType: "directory",
    storagePath: outputDir,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  console.log(JSON.stringify({
    mode: "execute",
    tileCount: plan.tiles.length,
    package: packageMeta
  }, null, 2));
}

export function buildTilePlan(config) {
  assertZoomRange(config.minZoom, config.maxZoom);
  const tiles = [];
  for (let z = config.minZoom; z <= config.maxZoom; z += 1) {
    const range = tileRangeForBounds(config.bounds, z);
    for (let x = range.minX; x <= range.maxX; x += 1) {
      for (let y = range.minY; y <= range.maxY; y += 1) {
        tiles.push({
          z,
          x,
          y,
          url: `${config.apiBase.replace(/\/$/, "")}/layers/${encodeURIComponent(config.layerId)}/tile/${z}/${x}/${y}.mvt`,
          outputPath: join(config.outputDir, String(z), String(x), `${y}.mvt`)
        });
      }
    }
  }
  return { tiles };
}

export function tileRangeForBounds(bounds, z) {
  const [minLon, minLat, maxLon, maxLat] = normalizeBounds(bounds);
  const min = lonLatToTile(minLon, maxLat, z);
  const max = lonLatToTile(maxLon, minLat, z);
  return {
    minX: Math.min(min.x, max.x),
    maxX: Math.max(min.x, max.x),
    minY: Math.min(min.y, max.y),
    maxY: Math.max(min.y, max.y)
  };
}

function lonLatToTile(lon, lat, z) {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const tilesPerAxis = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * tilesPerAxis);
  const latRad = (clampedLat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * tilesPerAxis);
  return {
    x: clamp(x, 0, tilesPerAxis - 1),
    y: clamp(y, 0, tilesPerAxis - 1)
  };
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = toCamelCase(arg.slice(2));
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function requiredOption(options, key) {
  const camelKey = toCamelCase(key);
  const value = options[camelKey];
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return String(value);
}

function parseBounds(value) {
  const bounds = String(value).split(",").map((item) => Number(item.trim()));
  if (bounds.length !== 4 || bounds.some((item) => !Number.isFinite(item))) {
    throw new Error(`Invalid bounds: ${value}`);
  }
  return normalizeBounds(bounds);
}

function normalizeBounds(bounds) {
  const minLon = Math.max(-180, Math.min(180, Math.min(bounds[0], bounds[2])));
  const maxLon = Math.max(-180, Math.min(180, Math.max(bounds[0], bounds[2])));
  const minLat = Math.max(-85.05112878, Math.min(85.05112878, Math.min(bounds[1], bounds[3])));
  const maxLat = Math.max(-85.05112878, Math.min(85.05112878, Math.max(bounds[1], bounds[3])));
  return [minLon, minLat, maxLon, maxLat];
}

function assertZoomRange(minZoom, maxZoom) {
  if (!Number.isInteger(minZoom) || !Number.isInteger(maxZoom) || minZoom < 0 || maxZoom < minZoom || maxZoom > 22) {
    throw new Error(`Invalid zoom range: ${minZoom}-${maxZoom}`);
  }
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
