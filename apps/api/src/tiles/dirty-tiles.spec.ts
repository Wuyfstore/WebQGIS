import { describe, expect, it } from "vitest";
import { dirtyTilesForBbox, mergeBboxes } from "./dirty-tiles.js";

describe("dirty tile helpers", () => {
  it("merges old and new geometry bboxes", () => {
    expect(mergeBboxes([100, 20, 101, 21], [102, 19, 103, 22])).toEqual([100, 19, 103, 22]);
    expect(mergeBboxes(null, undefined)).toBeNull();
  });

  it("converts a WGS84 bbox into covered WebMercator tiles", () => {
    expect(dirtyTilesForBbox([0.1, 0.1, 0.2, 0.2], { minZoom: 1, maxZoom: 1 })).toEqual([
      { z: 1, x: 1, y: 0 }
    ]);
  });

  it("returns multiple tiles when a bbox spans tile boundaries", () => {
    expect(dirtyTilesForBbox([-1, -1, 1, 1], { minZoom: 2, maxZoom: 2 })).toEqual([
      { z: 2, x: 1, y: 1 },
      { z: 2, x: 1, y: 2 },
      { z: 2, x: 2, y: 1 },
      { z: 2, x: 2, y: 2 }
    ]);
  });

  it("drops invalid or overly broad dirty tile results", () => {
    expect(dirtyTilesForBbox([Number.NaN, 0, 1, 1], { minZoom: 1, maxZoom: 1 })).toEqual([]);
    expect(dirtyTilesForBbox([-180, -85, 180, 85], { minZoom: 12, maxZoom: 12 })).toEqual([]);
  });
});
