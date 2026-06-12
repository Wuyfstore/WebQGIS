import { Injectable } from "@nestjs/common";
import { JsonFileStore } from "../storage/json-file.store.js";
import type { LayerRegistration, LayerStyle } from "../types.js";

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
    const existingById = new Map(existing.map((layer) => [layer.id, layer]));
    const mergedLayers = scannedLayers.map((layer) => {
      const previous = existingById.get(layer.id);
      return previous
        ? {
            ...layer,
            style: previous.style
          }
        : layer;
    });
    const next = [
      ...existing.filter((layer) => layer.datasourceId !== datasourceId),
      ...mergedLayers
    ];
    await this.store.write(this.fileName, next);
    return next;
  }

  async updateStyle(id: string, style: LayerStyle): Promise<LayerRegistration | undefined> {
    const layers = await this.findAll();
    let updatedLayer: LayerRegistration | undefined;
    const next = layers.map((layer) => {
      if (layer.id !== id) {
        return layer;
      }
      updatedLayer = {
        ...layer,
        style,
        updatedAt: new Date().toISOString()
      };
      return updatedLayer;
    });
    if (!updatedLayer) {
      return undefined;
    }
    await this.store.write(this.fileName, next);
    return updatedLayer;
  }
}
