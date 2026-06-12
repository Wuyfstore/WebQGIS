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
    expect(next.find((layer) => layer.id === "other-layer")).toBeDefined();
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
});
