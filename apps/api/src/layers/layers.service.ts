import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DatasourcesRepository } from "../datasources/datasources.repository.js";
import { PostgisRepository } from "../postgis/postgis.repository.js";
import type { FeaturePageQuery, FeaturePayload, LayerRegistration, LayerStyle } from "../types.js";
import { AttributeCalculationDto } from "./dto/attribute-calculation.dto.js";
import { LayerStyleDto } from "./dto/layer-style.dto.js";
import { SqlQueryDto } from "./dto/sql-query.dto.js";
import { LayersRepository } from "./layers.repository.js";

@Injectable()
export class LayersService {
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

  async createFeature(layerId: string, payload: FeaturePayload) {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    return this.postgisRepository.createFeature(datasource, layer, payload);
  }

  async updateFeature(layerId: string, pk: string, payload: FeaturePayload) {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    return this.postgisRepository.updateFeature(datasource, layer, pk, payload);
  }

  async deleteFeature(layerId: string, pk: string): Promise<void> {
    const layer = await this.getRequiredLayer(layerId);
    const datasource = await this.getRequiredDatasource(layer.datasourceId);
    await this.postgisRepository.deleteFeature(datasource, layer, pk);
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
    return this.postgisRepository.getVectorTile(datasource, layer, z, x, y);
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
}
