import { Body, Controller, Delete, Get, Header, Inject, Param, Post, Put, Query, Res } from "@nestjs/common";
import { FeatureParamDto } from "./dto/feature-param.dto.js";
import { FeatureListQueryDto } from "./dto/feature-list-query.dto.js";
import { FeaturePayloadDto } from "./dto/feature-payload.dto.js";
import { FeatureSelectionDto } from "./dto/feature-selection.dto.js";
import { AttributeCalculationDto } from "./dto/attribute-calculation.dto.js";
import { LayerParamDto } from "./dto/layer-param.dto.js";
import { LayerStyleDto } from "./dto/layer-style.dto.js";
import { SqlQueryDto } from "./dto/sql-query.dto.js";
import { TileParamDto } from "./dto/tile-param.dto.js";
import { LayersService } from "./layers.service.js";

@Controller("layers")
export class LayersController {
  constructor(
    @Inject(LayersService)
    private readonly layersService: LayersService
  ) {}

  @Get()
  list() {
    return this.layersService.list();
  }

  @Get(":id/features")
  listFeatures(@Param() params: LayerParamDto, @Query() query: FeatureListQueryDto) {
    return this.layersService.listFeatures(params.id, query);
  }

  @Get(":id/features/:pk")
  readFeature(@Param() params: FeatureParamDto) {
    return this.layersService.readFeature(params.id, params.pk);
  }

  @Post(":id/query")
  queryLayer(@Param() params: LayerParamDto, @Body() dto: SqlQueryDto) {
    return this.layersService.queryLayer(params.id, dto);
  }

  @Post(":id/calculate")
  calculateAttribute(@Param() params: LayerParamDto, @Body() dto: AttributeCalculationDto) {
    return this.layersService.calculateAttribute(params.id, dto);
  }

  @Post(":id/features/select")
  selectFeatures(@Param() params: LayerParamDto, @Body() dto: FeatureSelectionDto) {
    return this.layersService.selectFeatures(params.id, dto);
  }

  @Post(":id/features")
  createFeature(@Param() params: LayerParamDto, @Body() dto: FeaturePayloadDto) {
    return this.layersService.createFeature(params.id, dto);
  }

  @Put(":id/features/:pk")
  updateFeature(@Param() params: FeatureParamDto, @Body() dto: FeaturePayloadDto) {
    return this.layersService.updateFeature(params.id, params.pk, dto);
  }

  @Delete(":id/features/:pk")
  deleteFeature(@Param() params: FeatureParamDto) {
    return this.layersService.deleteFeature(params.id, params.pk);
  }

  @Put(":id/style")
  updateStyle(@Param() params: LayerParamDto, @Body() dto: LayerStyleDto) {
    return this.layersService.updateStyle(params.id, dto);
  }

  @Get(":id/tile/:z/:x/:y.mvt")
  @Header("content-type", "application/vnd.mapbox-vector-tile")
  @Header("cache-control", "public, max-age=31536000, immutable")
  async getVectorTile(
    @Param() params: TileParamDto,
    @Query("v") version: string | undefined,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }
  ) {
    response.setHeader("etag", `"${params.id}-${params.z}-${params.x}-${params.y}-${version ?? "current"}"`);
    return this.layersService.getVectorTile(params.id, params.z, params.x, params.y);
  }

  @Get(":id/offline-tile/:z/:x/:y.mvt")
  @Header("content-type", "application/vnd.mapbox-vector-tile")
  @Header("cache-control", "public, max-age=31536000, immutable")
  async getOfflineVectorTile(
    @Param() params: TileParamDto,
    @Query("v") version: string | undefined,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }
  ) {
    response.setHeader("etag", `"${params.id}-offline-${params.z}-${params.x}-${params.y}-${version ?? "current"}"`);
    return this.layersService.getVectorTile(params.id, params.z, params.x, params.y);
  }
}
