import { describe, expect, it } from "vitest";
import { transformExtent } from "ol/proj";
import type { FeatureLike } from "ol/Feature";
import { projectLayerExtent, readVectorTileFeaturePk } from "./useOpenLayersEditor";

function createFeatureStub(id: string | number | undefined, propertyId: unknown = undefined): Pick<FeatureLike, "get" | "getId"> {
  return {
    get: (key: string) => key === "id" ? propertyId : undefined,
    getId: () => id
  };
}

describe("readVectorTileFeaturePk", () => {
  it("reads the MVT feature id when OpenLayers exposes one", () => {
    expect(readVectorTileFeaturePk(createFeatureStub(42, undefined))).toBe("42");
  });

  it("falls back to the id property for ordinary MVT attributes", () => {
    expect(readVectorTileFeaturePk(createFeatureStub(undefined, "abc-1"))).toBe("abc-1");
  });

  it("returns null when neither MVT feature id nor id property exists", () => {
    expect(readVectorTileFeaturePk(createFeatureStub(undefined, undefined))).toBeNull();
  });

  it("projects a layer extent from EPSG:4326 to EPSG:3857", () => {
    const extent: [number, number, number, number] = [100, 20, 110, 30];

    expect(projectLayerExtent(extent)).toEqual(transformExtent(extent, "EPSG:4326", "EPSG:3857"));
  });

  it("returns null for an empty layer extent", () => {
    expect(projectLayerExtent(null)).toBeNull();
  });
});
