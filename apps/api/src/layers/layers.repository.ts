import { Injectable } from "@nestjs/common";
import { JsonFileStore } from "../storage/json-file.store.js";
import type { LayerRegistration } from "../types.js";

@Injectable()
export class LayersRepository {
  private readonly fileName = "layers.json";

  constructor(private readonly store: JsonFileStore) {}

  async findAll(): Promise<LayerRegistration[]> {
    return this.store.read<LayerRegistration[]>(this.fileName, []);
  }

  async findById(id: string): Promise<LayerRegistration | undefined> {
    const layers = await this.findAll();
    return layers.find((layer) => layer.id === id);
  }

  async replaceForDatasource(
    datasourceId: string,
    scannedLayers: LayerRegistration[]
  ): Promise<LayerRegistration[]> {
    const existing = await this.findAll();
    const next = [
      ...existing.filter((layer) => layer.datasourceId !== datasourceId),
      ...scannedLayers
    ];
    await this.store.write(this.fileName, next);
    return next;
  }
}
