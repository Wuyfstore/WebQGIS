import { describe, expect, it } from "vitest";
import RenderFeature from "ol/render/Feature";
import { fromExtent } from "ol/geom/Polygon";
import { transformExtent } from "ol/proj";
import type { FeatureLike } from "ol/Feature";
import {
  createHighlightFeatureFromRenderedGeometry,
  estimateScaleDenominator,
  featureIntersectsSelectionGeometry,
  formatCoordinateLabel,
  formatScaleLabel,
  isHighlightableGeoJsonFeature,
  isFeatureCovered,
  overlayLayerZIndexes,
  projectLayerExtent,
  projectionStatusLabel,
  readVectorTileFeaturePk,
  selectionModeStatus,
  uniqueFeatureIds,
  writeSelectionGeometryObject,
  buildSelectionSamplePixels
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

  it("detects MVT features hidden by an edit overlay cover", () => {
    const covered = new Map<string, Set<string>>([
      ["city", new Set(["1024"])]
    ]);

    expect(isFeatureCovered(covered, "city", createFeatureStub("1024"))).toBe(true);
    expect(isFeatureCovered(covered, "city", createFeatureStub("1025"))).toBe(false);
    expect(isFeatureCovered(covered, "province", createFeatureStub("1024"))).toBe(false);
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

  it("describes each selection mode with the intended map gesture", () => {
    expect(selectionModeStatus("click")).toContain("点击地图要素");
    expect(selectionModeStatus("extent")).toContain("拖拽矩形范围");
    expect(selectionModeStatus("customExtent")).toContain("自由绘制多边形范围");
  });

  it("checks whether a candidate feature intersects the selection geometry", () => {
    const selection = fromExtent([0, 0, 10, 10]);
    const inside = fromExtent([2, 2, 4, 4]);
    const outside = fromExtent([12, 12, 14, 14]);

    expect(featureIntersectsSelectionGeometry(inside, selection)).toBe(true);
    expect(featureIntersectsSelectionGeometry(outside, selection)).toBe(false);
    expect(featureIntersectsSelectionGeometry(undefined, selection)).toBe(false);
  });

  it("deduplicates range selection feature ids before opening the attribute table", () => {
    expect(uniqueFeatureIds(["1024", "1024", " 1025 ", "", null, undefined, 1026])).toEqual(["1024", "1025", "1026"]);
  });

  it("writes selection geometry as EPSG:4326 GeoJSON for server-side spatial selection", () => {
    const sourceExtent: [number, number, number, number] = [100, 20, 110, 30];
    const selection = fromExtent(transformExtent(sourceExtent, "EPSG:4326", "EPSG:3857"));

    const geometry = writeSelectionGeometryObject(selection) as { type: string; coordinates: number[][][] };
    const firstCoordinate = geometry.coordinates[0][0];

    expect(geometry.type).toBe("Polygon");
    expect(firstCoordinate[0]).toBeCloseTo(sourceExtent[0], 5);
    expect(firstCoordinate[1]).toBeCloseTo(sourceExtent[1], 5);
  });

  it("accepts only GeoJSON features with non-empty geometry for selection highlights", () => {
    expect(isHighlightableGeoJsonFeature({
      type: "Feature",
      id: "1",
      geometry: { type: "Polygon", coordinates: [] },
      properties: {}
    })).toBe(true);
    expect(isHighlightableGeoJsonFeature({
      type: "Feature",
      id: "2",
      geometry: null,
      properties: {}
    })).toBe(false);
    expect(isHighlightableGeoJsonFeature(undefined)).toBe(false);
    expect(isHighlightableGeoJsonFeature({
      type: "Feature",
      id: "3",
      geometry: {},
      properties: {}
    })).toBe(false);
  });

  it("samples pixels across a selection box for rendered feature fallback", () => {
    const pixels = buildSelectionSamplePixels([0, 0], [36, 36], { step: 18, maxSamples: 10 });

    expect(pixels.length).toBeLessThanOrEqual(10);
    expect(pixels).toContainEqual([18, 18]);
    expect(pixels).toContainEqual([0, 0]);
  });

  it("converts OpenLayers RenderFeature geometry into ordinary highlight features", () => {
    const renderFeature = new RenderFeature(
      "Point",
      [100, 200],
      [],
      2,
      { id: "rendered-1" },
      "rendered-1"
    );

    const highlightFeature = createHighlightFeatureFromRenderedGeometry(renderFeature.getGeometry());

    expect(highlightFeature?.getGeometry()?.getType()).toBe("Point");
    expect(highlightFeature?.getId()).toBe("rendered-1");
  });

  it("keeps selection overlays above map data layers", () => {
    expect(overlayLayerZIndexes().selectedFeature).toBeGreaterThan(overlayLayerZIndexes().selectionSketch);
    expect(overlayLayerZIndexes().editFeature).toBeGreaterThan(overlayLayerZIndexes().selectedFeature);
  });

  it("estimates a positive scale denominator from map resolution", () => {
    expect(estimateScaleDenominator(10, [0, 0])).toBeGreaterThan(1);
    expect(estimateScaleDenominator(null)).toBeNull();
    expect(estimateScaleDenominator(0)).toBeNull();
  });
});
