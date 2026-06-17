import { describe, expect, it } from "vitest";
import {
  getEditableFields,
  getGeometryModes,
  getLayerStatus,
  isPostgisLayer,
  isNumericField
} from "./layer";
import type { LayerRegistration } from "../types/gis";

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
    fields: [
      {
        name: "id",
        dataType: "integer",
        udtName: "int4",
        nullable: false,
        defaultValue: null,
        editable: false
      },
      {
        name: "name",
        dataType: "text",
        udtName: "text",
        nullable: true,
        defaultValue: null,
        editable: true
      }
    ],
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
    updatedAt: "2026-06-12T00:00:00.000Z",
    ...overrides
  };
}

describe("layer utilities", () => {
  it("returns only editable fields", () => {
    expect(getEditableFields(createLayer()).map((field) => field.name)).toEqual(["name"]);
  });

  it("formats editable and readonly layer status", () => {
    expect(getLayerStatus(createLayer())).toBe("可编辑");
    expect(getLayerStatus(createLayer({
      editable: false,
      editableReason: ["缺少单字段主键", "geometry 字段缺少有效 SRID"]
    }))).toBe("缺少单字段主键、geometry 字段缺少有效 SRID");
  });

  it("treats backend layers without sourceType as PostGIS layers", () => {
    const layer = createLayer({ sourceType: undefined });

    expect(isPostgisLayer(layer)).toBe(true);
    expect(getEditableFields(layer).map((field) => field.name)).toEqual(["name"]);
  });

  it("detects numeric database field types", () => {
    expect(isNumericField("integer")).toBe(true);
    expect(isNumericField("numeric")).toBe(true);
    expect(isNumericField("text")).toBe(false);
  });

  it("limits draw modes to the active geometry family", () => {
    expect(getGeometryModes(createLayer({ geometryType: "GEOMETRY" }))).toEqual(["Point", "LineString", "Polygon"]);
    expect(getGeometryModes(createLayer({ geometryType: "MULTIPOINT" }))).toEqual(["Point"]);
    expect(getGeometryModes(createLayer({ geometryType: "LINESTRING" }))).toEqual(["LineString"]);
    expect(getGeometryModes(createLayer({ geometryType: "MULTIPOLYGON" }))).toEqual(["Polygon"]);
  });
});
