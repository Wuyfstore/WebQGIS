import { describe, expect, it } from "vitest";
import { transformExtent } from "ol/proj";
import type { FeatureLike } from "ol/Feature";
import {
  estimateScaleDenominator,
  formatCoordinateLabel,
  formatScaleLabel,
  projectLayerExtent,
  projectionStatusLabel,
  readVectorTileFeaturePk
} from "./useOpenLayersEditor";

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

  it("formats live map status labels", () => {
    expect(formatCoordinateLabel([104.0648123, 30.6572456], "EPSG:4326")).toBe("坐标 104.06481, 30.65725 / EPSG:4326");
    expect(formatCoordinateLabel([11584622.44, 3589044.22], "EPSG:3857")).toBe("坐标 11584622.4, 3589044.2 / EPSG:3857");
    expect(formatCoordinateLabel(null, "EPSG:4547")).toBe("坐标 - / EPSG:4547");
    expect(formatScaleLabel(2500)).toBe("比例尺 1:2,500");
    expect(formatScaleLabel(null)).toBe("比例尺 -");
  });

  it("describes display and source projection relationship", () => {
    expect(projectionStatusLabel("EPSG:4326")).toContain("WGS84 经纬度显示坐标");
    expect(projectionStatusLabel("EPSG:4547")).toContain("需注册投影参数后可精确转换");
  });

  it("estimates a positive scale denominator from map resolution", () => {
    expect(estimateScaleDenominator(10, [0, 0])).toBeGreaterThan(1);
    expect(estimateScaleDenominator(null)).toBeNull();
    expect(estimateScaleDenominator(0)).toBeNull();
  });
});
