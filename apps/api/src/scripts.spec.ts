import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("layer simplification scripts", () => {
  it("prints a dry-run SQL plan for polygon simplification", () => {
    const output = execFileSync("node", [
      path.join(rootDir, "scripts/build-simplified-layers.mjs"),
      "--source-table",
      "china_2025_province",
      "--target-table",
      "china_2025_province_simplified_z0_6",
      "--geometry-column",
      "geom",
      "--id-column",
      "id",
      "--tolerance",
      "0.02",
      "--min-area",
      "1000"
    ], { cwd: rootDir, encoding: "utf8" });

    expect(output).toContain('create table "public"."china_2025_province_simplified_z0_6" as');
    expect(output).toContain("ST_SimplifyPreserveTopology");
    expect(output).toContain("::geometry(MultiPolygon) as");
    expect(output).not.toContain("::geometry(MultiPolygon, 4326) as");
    expect(output).toContain("ST_Area(ST_Transform");
    expect(output).toContain("using gist");
  });

  it("prints a dry-run SQL plan with an explicit target SRID when requested", () => {
    const output = execFileSync("node", [
      path.join(rootDir, "scripts/build-simplified-layers.mjs"),
      "--source-table",
      "china_2025_province",
      "--target-table",
      "china_2025_province_simplified_z0_6",
      "--target-srid",
      "3857"
    ], { cwd: rootDir, encoding: "utf8" });

    expect(output).toContain("::geometry(MultiPolygon, 3857) as");
  });

  it("prints scaleSources JSON for zoom ranges", () => {
    const output = execFileSync("node", [
      path.join(rootDir, "scripts/generate-layer-scale-config.mjs"),
      "--source-table",
      "china_2025_province",
      "--ranges",
      "0-6,7-10"
    ], { cwd: rootDir, encoding: "utf8" });

    const parsed = JSON.parse(output) as {
      scaleSources: Array<{ minZoom: number; maxZoom: number; table: string }>;
    };
    expect(parsed.scaleSources).toEqual([
      expect.objectContaining({ minZoom: 0, maxZoom: 6, table: "china_2025_province_simplified_z0_6" }),
      expect.objectContaining({ minZoom: 7, maxZoom: 10, table: "china_2025_province_simplified_z7_10" })
    ]);
  });

  it("prints a dry-run tile publication plan", () => {
    const output = execFileSync("node", [
      path.join(rootDir, "scripts/generate-tiles.mjs"),
      "--layer-id",
      "province",
      "--bounds",
      "100,20,110,30",
      "--min-zoom",
      "3",
      "--max-zoom",
      "3",
      "--output-dir",
      "apps/api/data/tile-packages/province/z3_3"
    ], { cwd: rootDir, encoding: "utf8" });

    const parsed = JSON.parse(output) as {
      mode: string;
      layerId: string;
      tileCount: number;
      sample: Array<{ url: string; outputPath: string }>;
    };
    expect(parsed.mode).toBe("dry-run");
    expect(parsed.layerId).toBe("province");
    expect(parsed.tileCount).toBeGreaterThan(0);
    expect(parsed.sample[0].url).toContain("/api/layers/province/tile/");
    expect(parsed.sample[0].outputPath).toContain("apps");
  });
});
