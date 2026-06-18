import { describe, expect, it, vi } from "vitest";
import { LayersController } from "./layers.controller.js";
import type { TileParamDto } from "./dto/tile-param.dto.js";

describe("LayersController vector tiles", () => {
  it("sets etag on Fastify replies and returns live vector tile bytes", async () => {
    const tile = Buffer.from("mvt");
    const service = {
      getVectorTile: vi.fn(async () => tile)
    };
    const controller = new LayersController(service as never);
    const response = {
      header: vi.fn()
    };
    const params = createTileParams();

    await expect(controller.getVectorTile(params, "7", response)).resolves.toBe(tile);

    expect(response.header).toHaveBeenCalledWith("etag", "\"layer-1-8-210-97-7\"");
    expect(service.getVectorTile).toHaveBeenCalledWith("layer-1", 8, 210, 97);
  });

  it("sets etag on Fastify replies and returns offline vector tile bytes", async () => {
    const tile = Buffer.from("offline-mvt");
    const service = {
      getVectorTile: vi.fn(async () => tile)
    };
    const controller = new LayersController(service as never);
    const response = {
      header: vi.fn()
    };
    const params = createTileParams();

    await expect(controller.getOfflineVectorTile(params, undefined, response)).resolves.toBe(tile);

    expect(response.header).toHaveBeenCalledWith("etag", "\"layer-1-offline-8-210-97-current\"");
    expect(service.getVectorTile).toHaveBeenCalledWith("layer-1", 8, 210, 97);
  });
});

function createTileParams(): TileParamDto {
  return {
    id: "layer-1",
    z: 8,
    x: 210,
    y: 97
  };
}
