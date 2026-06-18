import { Inject, Injectable } from "@nestjs/common";
import { JsonFileStore } from "../storage/json-file.store.js";
import type { LayerRegistration, LayerStyle } from "../types.js";

@Injectable()
export class LayersRepository {
  private readonly fileName = "layers.json";

  constructor(
    @Inject(JsonFileStore)
    private readonly store: JsonFileStore
  ) {}

  async findAll(): Promise<LayerRegistration[]> {
    const layers = await this.store.read<LayerRegistration[]>(this.fileName, []);
    return layers.map((layer) => this.withDefaults(layer));
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
            style: previous.style,
            tileVersion: previous.tileVersion ?? 1,
            tileSourceType: previous.tileSourceType,
            tilePackages: previous.tilePackages,
            scaleSources: previous.scaleSources
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

  async bumpTileVersion(id: string): Promise<LayerRegistration | undefined> {
    const layers = await this.findAll();
    let updatedLayer: LayerRegistration | undefined;
    const next = layers.map((layer) => {
      if (layer.id !== id) {
        return layer;
      }
      updatedLayer = {
        ...layer,
        tileVersion: (layer.tileVersion ?? 1) + 1,
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

  private withDefaults(layer: LayerRegistration): LayerRegistration {
    return {
      ...layer,
      tileVersion: layer.tileVersion ?? 1,
      tileSourceType: layer.tileSourceType ?? "live"
    };
  }
}
