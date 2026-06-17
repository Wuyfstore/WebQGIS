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

  it("selects rows by geometry using ctid ids when no primary key exists", async () => {
    const queries: string[] = [];
    const repository = new PostgisRepository();
    (repository as unknown as { getPool: () => unknown }).getPool = () => ({
      query: async (sql: string) => {
        queries.push(sql);
        return { rows: [{ id: "(0,1)" }] };
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
    expect(queries[0]).toContain("t.ctid::text as id");
    expect(queries[0]).toContain("ST_Intersects");
  });
});
