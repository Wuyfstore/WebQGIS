import { describe, expect, it } from "vitest";
import type { FeatureLike } from "ol/Feature";
import { readVectorTileFeaturePk } from "./useOpenLayersEditor";

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
});
