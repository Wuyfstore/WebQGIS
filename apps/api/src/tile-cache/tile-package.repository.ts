import { Inject, Injectable } from "@nestjs/common";
import { JsonFileStore } from "../storage/json-file.store.js";
import type { TilePackage } from "../types.js";

@Injectable()
export class TilePackageRepository {
  private readonly fileName = "tile-packages.json";

  constructor(
    @Inject(JsonFileStore)
    private readonly store: JsonFileStore
  ) {}

  async findAll(): Promise<TilePackage[]> {
    return this.store.read<TilePackage[]>(this.fileName, []);
  }

  async findForLayer(layerId: string): Promise<TilePackage[]> {
    const packages = await this.findAll();
    return packages.filter((tilePackage) => tilePackage.layerId === layerId);
  }
}
