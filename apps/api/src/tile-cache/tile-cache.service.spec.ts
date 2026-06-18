import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayerRegistration, TilePackage } from "../types.js";
import { TileCacheService } from "./tile-cache.service.js";

let tempDir: string;

function createLayer(overrides: Partial<LayerRegistration> = {}): LayerRegistration {
  return {
    id: "layer-1",
    datasourceId: "source-1",
    schema: "public",
    table: "roads",
    geometryColumn: "geom",
    geometryType: "LINESTRING",
    srid: 3857,
    primaryKey: "id",
    fields: [],
    hasSpatialIndex: true,
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true,
    queryable: true,
    editable: true,
    editableReason: [],
    tileUrl: "/api/layers/layer-1/tile/{z}/{x}/{y}.mvt",
    tileVersion: 1,
    tileSourceType: "directory",
    style: {
      fill: "#ffffff",
      stroke: "#2563eb",
      strokeWidth: 2,
      pointRadius: 6,
      opacity: 0.82
    },
    extent: null,
    updatedAt: "2026-06-17T00:00:00.000Z",
    ...overrides
  };
}

function createPackage(overrides: Partial<TilePackage> = {}): TilePackage {
  return {
    id: "pkg-1",
    layerId: "layer-1",
    version: 1,
    minZoom: 0,
    maxZoom: 10,
    bounds: null,
    format: "mvt",
    sourceType: "directory",
    storagePath: tempDir,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
    ...overrides
  };
}

function createService(packages: TilePackage[] = []) {
  return new TileCacheService({
    findForLayer: vi.fn(async () => packages)
  } as never);
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "webqgis-tiles-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("TileCacheService", () => {
  it("reads MVT files from a directory tile package", async () => {
    await mkdir(join(tempDir, "8", "210"), { recursive: true });
    await writeFile(join(tempDir, "8", "210", "97.mvt"), Buffer.from("offline-tile"));
    const tilePackage = createPackage();
    const service = createService();

    const tile = await service.readPublishedTile(tilePackage, 8, 210, 97);

    expect(tile?.toString()).toBe("offline-tile");
  });

  it("returns null when a directory tile is missing", async () => {
    const tilePackage = createPackage();
    const service = createService();

    await expect(service.readPublishedTile(tilePackage, 8, 210, 97)).resolves.toBeNull();
  });

  it("prefers the newest matching package version", async () => {
    const older = createPackage({ id: "old", version: 1, storagePath: join(tempDir, "old") });
    const newer = createPackage({ id: "new", version: 3, storagePath: join(tempDir, "new") });
    const service = createService([older, newer]);

    const matched = await service.findTilePackage(createLayer({ tilePackages: [] }), 6);

    expect(matched?.id).toBe("new");
  });

  it("ignores packages outside the requested zoom range", async () => {
    const service = createService([createPackage({ minZoom: 0, maxZoom: 5 })]);

    await expect(service.findTilePackage(createLayer({ tilePackages: [] }), 8)).resolves.toBeUndefined();
  });

  it("rejects relative storage paths that escape the tile package root", async () => {
    const tilePackage = createPackage({ storagePath: "../outside" });
    const service = createService();

    await expect(service.readPublishedTile(tilePackage, 8, 210, 97)).rejects.toThrow("escapes tile root");
  });
});
