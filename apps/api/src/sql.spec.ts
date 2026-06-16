import { describe, expect, it } from "vitest";
import {
  buildSafeAttributeExpression,
  buildSafeLayerSelectSql,
  buildSafeWhereExpression
} from "./sql.js";
import type { LayerRegistration } from "./types.js";

const layer: LayerRegistration = {
  id: "layer-1",
  datasourceId: "source-1",
  schema: "public",
  table: "cities",
  geometryColumn: "geom",
  geometryType: "MULTIPOLYGON",
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
      nullable: false,
      defaultValue: null,
      editable: true
    },
    {
      name: "adcode",
      dataType: "integer",
      udtName: "int4",
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
  style: {
    fill: "#ffffff",
    stroke: "#111827",
    strokeWidth: 1,
    pointRadius: 5,
    opacity: 0.8
  },
  extent: null,
  updatedAt: "2026-06-16T00:00:00.000Z"
};

describe("safe SQL helpers", () => {
  it("wraps current layer SELECT queries with a hard limit", () => {
    expect(buildSafeLayerSelectSql(layer, "select id, name from {layer}", 50))
      .toBe('select * from (select id, name from "public"."cities") webqgis_safe_query limit 50');
  });

  it("allows the current layer schema.table placeholder", () => {
    expect(buildSafeLayerSelectSql(layer, "select id, name from {public.cities}", 25))
      .toBe('select * from (select id, name from "public"."cities") webqgis_safe_query limit 25');
  });

  it("rejects non-readonly or multi-statement SQL", () => {
    expect(() => buildSafeLayerSelectSql(layer, "delete from {layer}", 50)).toThrow("Only SELECT");
    expect(() => buildSafeLayerSelectSql(layer, "select * from {layer}; drop table users", 50)).toThrow("single read-only");
    expect(() => buildSafeLayerSelectSql(layer, "select * from other.table", 50)).toThrow("current layer");
    expect(() => buildSafeLayerSelectSql(layer, "select * from {public.roads}", 50)).toThrow("must be {layer}");
  });

  it("allows field based calculation expressions", () => {
    expect(buildSafeAttributeExpression(layer, 'concat("name", \'_checked\')')).toBe('concat("name", \'_checked\')');
    expect(buildSafeWhereExpression(layer, '"adcode" is not null')).toBe('"adcode" is not null');
  });

  it("rejects unsafe calculation expressions", () => {
    expect(() => buildSafeAttributeExpression(layer, 'pg_sleep(10)')).toThrow("Unsafe expression");
    expect(() => buildSafeAttributeExpression(layer, '"missing" + 1')).toThrow("Unknown field");
    expect(() => buildSafeWhereExpression(layer, '"id" = 1; update public.cities set name = \'x\'')).toThrow("Unsafe WHERE");
  });
});
