import { describe, expect, it } from "vitest";
import type { DatasourceConfig, LayerRegistration } from "../types.js";
import { PostgisRepository } from "./postgis.repository.js";

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
    primaryKey: null,
    fields: [
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

describe("PostgisRepository ctid-backed layers", () => {
  it("lists rows without requiring a primary key or an exact full-table count", async () => {
    const queries: string[] = [];
    const repository = new PostgisRepository();
    (repository as unknown as { getPool: () => unknown }).getPool = () => ({
      query: async (sql: string) => {
        queries.push(sql);
        if (sql.includes("pg_class")) {
          return { rows: [{ total: "900000" }] };
        }
        return {
          rows: [
            {
              feature: {
                type: "Feature",
                id: "(0,1)",
                geometry: null,
                properties: { name: "road-1" }
              }
            }
          ]
        };
      }
    });

    const page = await repository.listFeatures(createDatasource(), createLayer(), {
      limit: 100,
      offset: 0,
      search: "",
      order: "asc"
    });

    expect(page.items[0]?.id).toBe("(0,1)");
    expect(page.total).toBe(900000);
    expect(queries[0]).toContain("t.ctid::text");
    expect(queries[0]).toContain("order by t.ctid asc");
    expect(queries.some((query) => query.includes("count(*)"))).toBe(false);
  });

  it("normalizes comma separated id query strings before filtering", async () => {
    const queries: string[] = [];
    const queryValues: unknown[][] = [];
    const repository = new PostgisRepository();
    (repository as unknown as { getPool: () => unknown }).getPool = () => ({
      query: async (sql: string, values: unknown[] = []) => {
        queries.push(sql);
        queryValues.push(values);
        if (sql.includes("count(*)")) {
          return { rows: [{ total: "2" }] };
        }
        return {
          rows: [
            {
              feature: {
                type: "Feature",
                id: "199",
                geometry: null,
                properties: { name: "city-199" }
              }
            }
          ]
        };
      }
    });

    await repository.listFeatures(createDatasource(), createLayer({ primaryKey: "id" }), {
      limit: 100,
      offset: 0,
      search: "",
      order: "asc",
      sort: "id",
      ids: "199,228" as unknown as string[]
    });

    expect(queries[0]).toContain('t."id"::text = any($2::text[])');
    expect(queryValues[0][1]).toEqual(["199", "228"]);
    expect(queries.some((query) => query.includes("count(*)"))).toBe(false);
  });

  it("selects rows by geometry and returns highlight features using ctid ids when no primary key exists", async () => {
    const queries: string[] = [];
    const repository = new PostgisRepository();
    (repository as unknown as { getPool: () => unknown }).getPool = () => ({
      query: async (sql: string) => {
        queries.push(sql);
        return {
          rows: [{
            id: "(0,1)",
            feature: {
              type: "Feature",
              id: "(0,1)",
              geometry: { type: "LineString", coordinates: [[120, 31], [121, 32]] },
              properties: {}
            }
          }]
        };
      }
    });

    const result = await repository.selectFeatures(createDatasource(), createLayer(), {
      geometry: {
        type: "Polygon",
        coordinates: [[[120, 31], [121, 31], [121, 32], [120, 32], [120, 31]]]
      },
      limit: 500
    });

    expect(result.ids).toEqual(["(0,1)"]);
    expect(result.features).toHaveLength(1);
    expect(result.features[0]?.id).toBe("(0,1)");
    expect(queries[0]).toContain("t.ctid::text as id");
    expect(queries[0]).toContain("ST_AsGeoJSON(ST_Transform");
    expect(queries[0]).toContain("ST_Intersects");
  });

  it("caps vector tile candidates and keeps tile payload attributes lean", async () => {
    const queries: string[] = [];
    const repository = new PostgisRepository();
    (repository as unknown as { getPool: () => unknown }).getPool = () => ({
      query: async (sql: string) => {
        queries.push(sql);
        return { rows: [{ mvt: Buffer.from("tile") }] };
      }
    });

    const layer = createLayer({
      primaryKey: "id",
      fields: [
        { name: "id", dataType: "integer", udtName: "int4", nullable: false, defaultValue: null, editable: false },
        { name: "name", dataType: "text", udtName: "text", nullable: true, defaultValue: null, editable: true },
        { name: "code", dataType: "text", udtName: "text", nullable: true, defaultValue: null, editable: true },
        { name: "kind", dataType: "text", udtName: "text", nullable: true, defaultValue: null, editable: true },
        { name: "status", dataType: "text", udtName: "text", nullable: true, defaultValue: null, editable: true },
        { name: "extra", dataType: "text", udtName: "text", nullable: true, defaultValue: null, editable: true }
      ]
    });

    await repository.getVectorTile(createDatasource(), layer, 8, 210, 97);

    expect(queries[0]).toContain("limit 5000");
    expect(queries[0]).toContain('"name"');
    expect(queries[0]).toContain('"status"');
    expect(queries[0]).not.toContain('"extra"');
  });
});
