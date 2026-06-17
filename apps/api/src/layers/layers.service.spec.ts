import { describe, expect, it, vi } from "vitest";
import type { DatasourceConfig, GeoJsonFeature, LayerRegistration } from "../types.js";
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

function createService(options: {
  layer?: LayerRegistration;
  tile?: Buffer;
  feature?: GeoJsonFeature;
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
    createFeature: vi.fn(async () => options.feature ?? {
      type: "Feature" as const,
      id: 7,
      geometry: { type: "Point", coordinates: [104, 30] },
      properties: { name: "road-7" }
    }),
    updateFeature: vi.fn(),
    deleteFeature: vi.fn()
  };
  const service = new LayersService(
    layersRepository as never,
    datasourcesRepository as never,
    postgisRepository as never
  );
  return { service, layersRepository, postgisRepository };
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
    postgisRepository.updateFeature.mockResolvedValueOnce(feature);

    const result = await service.updateFeature("layer-1", "7", {
      geometry: feature.geometry,
      properties: feature.properties
    });

    expect(result).toEqual({ feature, tileVersion: 5 });
    expect(layersRepository.bumpTileVersion).toHaveBeenCalledWith("layer-1");
  });

  it("bumps tileVersion after deleting a feature", async () => {
    const { service, layersRepository, postgisRepository } = createService({ bumpedVersion: 6 });

    const result = await service.deleteFeature("layer-1", "7");

    expect(result).toEqual({ tileVersion: 6 });
    expect(postgisRepository.deleteFeature).toHaveBeenCalled();
    expect(layersRepository.bumpTileVersion).toHaveBeenCalledWith("layer-1");
  });
});
