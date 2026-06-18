import { beforeEach, describe, expect, it } from "vitest";
import { JsonFileStore } from "../storage/json-file.store.js";
import type { LayerRegistration } from "../types.js";
import { LayersRepository } from "./layers.repository.js";

class MemoryJsonFileStore {
  private readonly files = new Map<string, unknown>();

  async read<T>(fileName: string, fallback: T): Promise<T> {
    return (this.files.get(fileName) as T | undefined) ?? fallback;
  }

  async write<T>(fileName: string, value: T): Promise<void> {
    this.files.set(fileName, value);
  }
}

function createLayer(overrides: Partial<LayerRegistration> = {}): LayerRegistration {
  return {
    id: "layer-1",
    datasourceId: "source-1",
    schema: "public",
    table: "roads",
    geometryColumn: "geom",
    geometryType: "LINESTRING",
    srid: 4326,
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
      fill: "#6EA8FE55",
      stroke: "#1D4ED8",
      strokeWidth: 2,
      pointRadius: 6,
      opacity: 0.82
    },
    extent: null,
    updatedAt: "2026-06-12T00:00:00.000Z",
    ...overrides
  };
}

describe("LayersRepository", () => {
  let store: MemoryJsonFileStore;
  let repository: LayersRepository;

  beforeEach(() => {
    store = new MemoryJsonFileStore();
    repository = new LayersRepository(store as unknown as JsonFileStore);
  });

  it("preserves existing styles when replacing scanned layers for a datasource", async () => {
    const customStyle = {
      fill: "#ff0000",
      stroke: "#00ff00",
      strokeWidth: 4,
      pointRadius: 10,
      opacity: 0.4
    };
    await store.write("layers.json", [
      createLayer({ style: customStyle }),
      createLayer({ id: "other-layer", datasourceId: "source-2" })
    ]);

    const next = await repository.replaceForDatasource("source-1", [
      createLayer({
        style: {
          fill: "#111111",
          stroke: "#222222",
          strokeWidth: 1,
          pointRadius: 3,
          opacity: 1
        }
      })
    ]);

    expect(next.find((layer) => layer.id === "layer-1")?.style).toEqual(customStyle);
    expect(next.find((layer) => layer.id === "layer-1")?.tileVersion).toBe(1);
    expect(next.find((layer) => layer.id === "other-layer")).toBeDefined();
  });

  it("preserves tileVersion when replacing scanned layers for a datasource", async () => {
    await store.write("layers.json", [createLayer({ tileVersion: 9 })]);

    const next = await repository.replaceForDatasource("source-1", [createLayer({ tileVersion: 1 })]);

    expect(next.find((layer) => layer.id === "layer-1")?.tileVersion).toBe(9);
  });

  it("preserves configured scale sources when replacing scanned layers for a datasource", async () => {
    const scaleSources = [{
      minZoom: 0,
      maxZoom: 6,
      schema: "public",
      table: "roads_simplified_z0_6",
      geometryColumn: "geom"
    }];
    await store.write("layers.json", [createLayer({ scaleSources })]);

    const next = await repository.replaceForDatasource("source-1", [createLayer()]);

    expect(next.find((layer) => layer.id === "layer-1")?.scaleSources).toEqual(scaleSources);
  });

  it("preserves offline tile settings when replacing scanned layers for a datasource", async () => {
    const tilePackages = [{
      id: "pkg-1",
      layerId: "layer-1",
      version: 3,
      minZoom: 0,
      maxZoom: 8,
      bounds: null,
      format: "mvt" as const,
      sourceType: "directory" as const,
      storagePath: "layer-1/v3",
      createdAt: "2026-06-18T00:00:00.000Z",
      updatedAt: "2026-06-18T00:00:00.000Z"
    }];
    await store.write("layers.json", [createLayer({ tileSourceType: "directory", tilePackages })]);

    const next = await repository.replaceForDatasource("source-1", [createLayer()]);
    const layer = next.find((item) => item.id === "layer-1");

    expect(layer?.tileSourceType).toBe("directory");
    expect(layer?.tilePackages).toEqual(tilePackages);
  });

  it("updates layer style and timestamp", async () => {
    await store.write("layers.json", [createLayer()]);

    const updated = await repository.updateStyle("layer-1", {
      fill: "#ffffff",
      stroke: "#111827",
      strokeWidth: 3,
      pointRadius: 8,
      opacity: 0.65
    });

    expect(updated?.style).toMatchObject({
      fill: "#ffffff",
      stroke: "#111827",
      strokeWidth: 3,
      pointRadius: 8,
      opacity: 0.65
    });
    expect(updated?.updatedAt).not.toBe("2026-06-12T00:00:00.000Z");
  });

  it("bumps layer tileVersion and timestamp", async () => {
    await store.write("layers.json", [createLayer({ tileVersion: 3 })]);

    const updated = await repository.bumpTileVersion("layer-1");

    expect(updated?.tileVersion).toBe(4);
    expect(updated?.updatedAt).not.toBe("2026-06-12T00:00:00.000Z");
    expect((await repository.findById("layer-1"))?.tileVersion).toBe(4);
  });

  it("defaults missing tileVersion to one for existing registries", async () => {
    const legacyLayer: Omit<LayerRegistration, "tileVersion"> & { tileVersion?: number } = createLayer();
    delete legacyLayer.tileVersion;
    await store.write("layers.json", [legacyLayer]);

    expect((await repository.findById("layer-1"))?.tileVersion).toBe(1);
    expect((await repository.findById("layer-1"))?.tileSourceType).toBe("live");
  });
});
