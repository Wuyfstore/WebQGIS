import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { DatasourceConfig, LayerRegistration, TilePackage } from "../types.js";
import { LayersService } from "./layers.service.js";

function createDatasource(): DatasourceConfig {
  return {
    id: "source-1",
    name: "Local PostGIS",
    host: "127.0.0.1",
    port: 5432,
    database: "test",
    user: "postgres",
    password: "",
    ssl: false,
    createdAt: "2026-06-17T00:00:00.000Z",
    updatedAt: "2026-06-17T00:00:00.000Z"
  };
}

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
    tileSourceType: "live",
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

function createTilePackage(overrides: Partial<TilePackage> = {}): TilePackage {
  return {
    id: "pkg-1",
    layerId: "layer-1",
    version: 1,
    minZoom: 0,
    maxZoom: 12,
    bounds: null,
    format: "mvt",
    sourceType: "directory",
    storagePath: "layer-1/v1",
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
    ...overrides
  };
}

function createService(options: {
  layer?: LayerRegistration;
  tile?: Buffer;
  bumpedVersion?: number;
}) {
  const layer = options.layer ?? createLayer();
  const datasource = createDatasource();
  const layersRepository = {
    findAll: vi.fn(async () => [layer]),
    findById: vi.fn(async () => layer),
    updateStyle: vi.fn(),
    bumpTileVersion: vi.fn(async () => createLayer({ ...layer, tileVersion: options.bumpedVersion ?? layer.tileVersion + 1 }))
  };
  const datasourcesRepository = {
    findById: vi.fn(async () => datasource)
  };
  const postgisRepository = {
    getVectorTile: vi.fn(async () => options.tile ?? Buffer.from("tile")),
    createFeature: vi.fn(async () => ({
      feature: {
        type: "Feature" as const,
        id: 7,
        geometry: { type: "Point", coordinates: [104, 30] },
        properties: { name: "road-7" }
      },
      oldBbox: null,
      newBbox: [104, 30, 104, 30] as [number, number, number, number]
    })),
    updateFeature: vi.fn(),
    deleteFeature: vi.fn()
  };
  const tileCacheService = {
    findTilePackage: vi.fn(async () => layer.tilePackages?.[0]),
    readPublishedTile: vi.fn(async (): Promise<Buffer | null> => null)
  };
  const service = new LayersService(
    layersRepository as never,
    datasourcesRepository as never,
    postgisRepository as never,
    tileCacheService as never
  );
  return { service, layersRepository, postgisRepository, tileCacheService };
}

describe("LayersService tile version cache", () => {
  it("caches vector tiles by layer, coordinate and tileVersion", async () => {
    const { service, postgisRepository } = createService({ tile: Buffer.from("cached-tile") });

    const first = await service.getVectorTile("layer-1", 8, 210, 97);
    const second = await service.getVectorTile("layer-1", 8, 210, 97);

    expect(first.toString()).toBe("cached-tile");
    expect(second.toString()).toBe("cached-tile");
    expect(postgisRepository.getVectorTile).toHaveBeenCalledTimes(1);
  });

  it("reads published directory tiles before falling back to live PostGIS MVT", async () => {
    const tilePackage = createTilePackage();
    const layer = createLayer({ tileSourceType: "directory", tilePackages: [tilePackage] });
    const { service, postgisRepository, tileCacheService } = createService({ layer });
    tileCacheService.readPublishedTile.mockResolvedValueOnce(Buffer.from("published-tile"));

    const tile = await service.getVectorTile("layer-1", 8, 210, 97);

    expect(tile.toString()).toBe("published-tile");
    expect(tileCacheService.findTilePackage).toHaveBeenCalledWith(layer, 8);
    expect(tileCacheService.readPublishedTile).toHaveBeenCalledWith(tilePackage, 8, 210, 97);
    expect(postgisRepository.getVectorTile).not.toHaveBeenCalled();
  });

  it("falls back to live PostGIS MVT when a published tile is missing", async () => {
    const { service, postgisRepository, tileCacheService } = createService({
      layer: createLayer({ tileSourceType: "directory" }),
      tile: Buffer.from("live-tile")
    });
    tileCacheService.readPublishedTile.mockResolvedValueOnce(null);

    const tile = await service.getVectorTile("layer-1", 8, 210, 97);

    expect(tile.toString()).toBe("live-tile");
    expect(postgisRepository.getVectorTile).toHaveBeenCalledTimes(1);
  });

  it("does not reuse cached directory tiles across package versions", async () => {
    const firstPackage = createTilePackage({ id: "pkg-1", version: 1 });
    const secondPackage = createTilePackage({ id: "pkg-2", version: 2 });
    const { service, tileCacheService } = createService({
      layer: createLayer({ tileSourceType: "directory", tilePackages: [firstPackage] })
    });
    tileCacheService.findTilePackage
      .mockResolvedValueOnce(firstPackage)
      .mockResolvedValueOnce(secondPackage);
    tileCacheService.readPublishedTile
      .mockResolvedValueOnce(Buffer.from("offline-v1"))
      .mockResolvedValueOnce(Buffer.from("offline-v2"));

    const first = await service.getVectorTile("layer-1", 8, 210, 97);
    const second = await service.getVectorTile("layer-1", 8, 210, 97);

    expect(first.toString()).toBe("offline-v1");
    expect(second.toString()).toBe("offline-v2");
    expect(tileCacheService.readPublishedTile).toHaveBeenCalledTimes(2);
  });

  it("returns saved feature with bumped tileVersion and invalidates old tile cache", async () => {
    const { service, layersRepository, postgisRepository } = createService({ bumpedVersion: 2 });
    await service.getVectorTile("layer-1", 8, 210, 97);

    const result = await service.createFeature("layer-1", {
      geometry: { type: "Point", coordinates: [104, 30] },
      properties: { name: "road-7" }
    });
    await service.getVectorTile("layer-1", 8, 210, 97);

    expect(result.tileVersion).toBe(2);
    expect(result.feature.id).toBe(7);
    expect(result.dirtyTiles.length).toBeGreaterThan(0);
    expect(layersRepository.bumpTileVersion).toHaveBeenCalledWith("layer-1");
    expect(postgisRepository.getVectorTile).toHaveBeenCalledTimes(2);
  });

  it("returns updated feature with bumped tileVersion", async () => {
    const { service, layersRepository, postgisRepository } = createService({ bumpedVersion: 5 });
    const feature = {
      type: "Feature" as const,
      id: 7,
      geometry: { type: "Point", coordinates: [105, 31] },
      properties: { name: "updated-road" }
    };
    postgisRepository.updateFeature.mockResolvedValueOnce({
      feature,
      oldBbox: [104, 30, 104, 30],
      newBbox: [105, 31, 105, 31]
    });

    const result = await service.updateFeature("layer-1", "7", {
      geometry: feature.geometry,
      properties: feature.properties
    });

    expect(result.feature).toEqual(feature);
    expect(result.tileVersion).toBe(5);
    expect(result.dirtyTiles.length).toBeGreaterThan(0);
    expect(layersRepository.bumpTileVersion).toHaveBeenCalledWith("layer-1");
  });

  it("does not bump tileVersion when an update hits an edit conflict", async () => {
    const { service, layersRepository, postgisRepository } = createService({ bumpedVersion: 5 });
    postgisRepository.updateFeature.mockRejectedValueOnce(new ConflictException("Feature has changed on the server"));

    await expect(service.updateFeature("layer-1", "7", {
      geometry: { type: "Point", coordinates: [105, 31] },
      revision: "stale"
    })).rejects.toBeInstanceOf(ConflictException);

    expect(layersRepository.bumpTileVersion).not.toHaveBeenCalled();
  });

  it("bumps tileVersion after deleting a feature", async () => {
    const { service, layersRepository, postgisRepository } = createService({ bumpedVersion: 6 });
    postgisRepository.deleteFeature.mockResolvedValueOnce({
      oldBbox: [104, 30, 104, 30]
    });

    const result = await service.deleteFeature("layer-1", "7");

    expect(result.tileVersion).toBe(6);
    expect(result.dirtyTiles.length).toBeGreaterThan(0);
    expect(postgisRepository.deleteFeature).toHaveBeenCalled();
    expect(layersRepository.bumpTileVersion).toHaveBeenCalledWith("layer-1");
  });
});
