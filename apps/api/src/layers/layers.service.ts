import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DatasourcesRepository } from "../datasources/datasources.repository.js";
import { PostgisRepository } from "../postgis/postgis.repository.js";
import type { FeaturePageQuery, FeaturePayload, FeatureSelectionPayload, FeatureWriteResult, LayerRegistration, LayerStyle } from "../types.js";
import { AttributeCalculationDto } from "./dto/attribute-calculation.dto.js";
import { LayerStyleDto } from "./dto/layer-style.dto.js";
import { SqlQueryDto } from "./dto/sql-query.dto.js";
import { LayersRepository } from "./layers.repository.js";

@Injectable()
export class LayersService {
  private readonly tileCache = new Map<string, Buffer>();

  constructor(
    @Inject(LayersRepository)
    private readonly layersRepository: LayersRepository,
    @Inject(DatasourcesRepository)
    private readonly datasourcesRepository: DatasourcesRepository,
    @Inject(PostgisRepository)
    private readonly postgisRepository: PostgisRepository
  ) {}

  list(): Promise<LayerRegistration[]> {
    return this.layersRepository.findAll();
  }

  async readFeature(layerId: string, pk: string) {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    const feature = await this.postgisRepository.readFeature(datasource, layer, pk);
    if (!feature) {
      throw new NotFoundException("Feature not found");
    }
    return feature;
  }

  async listFeatures(layerId: string, query: FeaturePageQuery) {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    return this.postgisRepository.listFeatures(datasource, layer, query);
  }

  async queryLayer(layerId: string, dto: SqlQueryDto) {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    return this.postgisRepository.queryLayer(datasource, layer, dto.sql, dto.limit);
  }

  async calculateAttribute(layerId: string, dto: AttributeCalculationDto) {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    return this.postgisRepository.calculateAttribute(datasource, layer, dto);
  }

  async selectFeatures(layerId: string, payload: FeatureSelectionPayload) {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    return this.postgisRepository.selectFeatures(datasource, layer, payload);
  }

  async createFeature(layerId: string, payload: FeaturePayload): Promise<FeatureWriteResult> {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    const feature = await this.postgisRepository.createFeature(datasource, layer, payload);
    const tileVersion = await this.bumpLayerTileVersion(layerId);
    return { feature, tileVersion };
  }

  async updateFeature(layerId: string, pk: string, payload: FeaturePayload): Promise<FeatureWriteResult> {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    const feature = await this.postgisRepository.updateFeature(datasource, layer, pk, payload);
    const tileVersion = await this.bumpLayerTileVersion(layerId);
    return { feature, tileVersion };
  }

  async deleteFeature(layerId: string, pk: string): Promise<{ tileVersion: number }> {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    await this.postgisRepository.deleteFeature(datasource, layer, pk);
    const tileVersion = await this.bumpLayerTileVersion(layerId);
    return { tileVersion };
  }

  async updateStyle(layerId: string, dto: LayerStyleDto): Promise<LayerRegistration> {
    const layer = await this.getRequiredLayer(layerId);
    const nextStyle: LayerStyle = {
      ...layer.style,
      ...dto
    };
    const updated = await this.layersRepository.updateStyle(layerId, nextStyle);
    if (!updated) {
      throw new NotFoundException("Layer not found");
    }
    return updated;
  }

  async getVectorTile(layerId: string, z: number, x: number, y: number): Promise<Buffer> {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    const tileVersion = layer.tileVersion ?? 1;
    const cacheKey = this.tileCacheKey(layerId, z, x, y, tileVersion);
    const cached = this.tileCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const tile = await this.postgisRepository.getVectorTile(datasource, layer, z, x, y);
    this.tileCache.set(cacheKey, tile);
    return tile;
  }

  async getRequiredLayer(id: string): Promise<LayerRegistration> {
    const layer = await this.layersRepository.findById(id);
    if (!layer) {
      throw new NotFoundException("Layer not found");
    }
    return layer;
  }

  private async getRequiredDatasource(id: string) {
    const datasource = await this.datasourcesRepository.findById(id);
    if (!datasource) {
      throw new NotFoundException("Datasource not found");
    }
    return datasource;
  }

  private async bumpLayerTileVersion(layerId: string): Promise<number> {
    const updated = await this.layersRepository.bumpTileVersion(layerId);
    if (!updated) {
      throw new NotFoundException("Layer not found");
    }
    this.clearTileCacheForLayer(layerId);
    return updated.tileVersion;
  }

  private clearTileCacheForLayer(layerId: string) {
    const prefix = `${layerId}:`;
    for (const key of this.tileCache.keys()) {
      if (key.startsWith(prefix)) {
        this.tileCache.delete(key);
      }
    }
  }

  private tileCacheKey(layerId: string, z: number, x: number, y: number, tileVersion: number) {
    return `${layerId}:${z}:${x}:${y}:${tileVersion}`;
  }
}
