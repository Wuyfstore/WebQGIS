import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { DatasourcesRepository } from "../datasources/datasources.repository.js";
import { PostgisRepository } from "../postgis/postgis.repository.js";
import type { DatasourceConfig } from "../types.js";
import { CrsRepository } from "./crs.repository.js";
import type { CrsDefinition, CustomCrsRecord } from "./crs.types.js";
import type { CrsSearchQueryDto } from "./dto/crs-search-query.dto.js";
import type { UpsertCustomCrsDto } from "./dto/upsert-custom-crs.dto.js";

const fallbackCrs: CrsDefinition[] = [
  {
    id: "fallback-EPSG-3857",
    code: "EPSG:3857",
    authName: "EPSG",
    authSrid: 3857,
    srid: 3857,
    name: "WGS 84 / Pseudo-Mercator",
    proj4text: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs",
    wkt: "",
    area: "World between 85.06S and 85.06N",
    scope: "Web map display coordinate system",
    source: "fallback",
    custom: false
  },
  {
    id: "fallback-EPSG-4326",
    code: "EPSG:4326",
    authName: "EPSG",
    authSrid: 4326,
    srid: 4326,
    name: "WGS 84",
    proj4text: "+proj=longlat +datum=WGS84 +no_defs",
    wkt: "",
    area: "World",
    scope: "Latitude and longitude coordinate exchange",
    source: "fallback",
    custom: false
  }
];

@Injectable()
export class CrsService {
  constructor(
    @Inject(CrsRepository)
    private readonly crsRepository: CrsRepository,
    @Inject(DatasourcesRepository)
    private readonly datasourcesRepository: DatasourcesRepository,
    @Inject(PostgisRepository)
    private readonly postgisRepository: PostgisRepository
  ) {}

  async search(query: CrsSearchQueryDto): Promise<CrsDefinition[]> {
    const limit = Math.max(1, Math.min(query.limit, 100));
    const keyword = query.q.trim();
    const [customItems, datasources] = await Promise.all([
      this.searchCustom(keyword, limit),
      this.getSearchDatasources(query.datasourceId)
    ]);
    const databaseItems: CrsDefinition[] = [];
    for (const datasource of datasources) {
      try {
        const rows = await this.postgisRepository.searchCoordinateSystems(datasource, keyword, limit);
        databaseItems.push(...rows);
      } catch {
        continue;
      }
      if (databaseItems.length >= limit) {
        break;
      }
    }
    const fallbackItems = fallbackCrs.filter((item) => this.matches(item, keyword));
    return this.uniqueByCode([...customItems, ...databaseItems, ...fallbackItems]).slice(0, limit);
  }

  async listCustom(): Promise<CrsDefinition[]> {
    const items = await this.crsRepository.findAll();
    return items.map((item) => this.toCustomDefinition(item));
  }

  async createCustom(dto: UpsertCustomCrsDto): Promise<CrsDefinition> {
    const item = await this.crsRepository.create(this.toCustomRecordInput(dto));
    return this.toCustomDefinition(item);
  }

  async updateCustom(id: string, dto: UpsertCustomCrsDto): Promise<CrsDefinition> {
    const item = await this.crsRepository.update(id, this.toCustomRecordInput(dto));
    return this.toCustomDefinition(item);
  }

  async deleteCustom(id: string): Promise<void> {
    await this.crsRepository.delete(id);
  }

  private async getSearchDatasources(datasourceId?: string): Promise<DatasourceConfig[]> {
    const datasources = await this.datasourcesRepository.findAll();
    if (!datasourceId) {
      return datasources.slice(0, 3);
    }
    const datasource = datasources.find((item) => item.id === datasourceId);
    if (!datasource) {
      throw new BadRequestException("Datasource not found");
    }
    return [datasource];
  }

  private async searchCustom(keyword: string, limit: number): Promise<CrsDefinition[]> {
    const customItems = await this.listCustom();
    return customItems.filter((item) => this.matches(item, keyword)).slice(0, limit);
  }

  private matches(item: CrsDefinition, keyword: string): boolean {
    if (!keyword) {
      return true;
    }
    const normalized = keyword.toLowerCase();
    return [
      item.code,
      item.name,
      item.authName,
      String(item.authSrid),
      String(item.srid),
      item.proj4text,
      item.area,
      item.scope
    ].some((value) => value.toLowerCase().includes(normalized));
  }

  private uniqueByCode(items: CrsDefinition[]): CrsDefinition[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.code.toUpperCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private toCustomRecordInput(dto: UpsertCustomCrsDto): Omit<CustomCrsRecord, "id" | "createdAt" | "updatedAt"> {
    const authName = (dto.authName || "LOCAL").toUpperCase();
    return {
      code: dto.code,
      authName,
      authSrid: dto.srid,
      srid: dto.srid,
      name: dto.name,
      proj4text: dto.proj4text,
      wkt: dto.wkt,
      area: dto.area,
      scope: dto.scope
    };
  }

  private toCustomDefinition(item: CustomCrsRecord): CrsDefinition {
    return {
      ...item,
      source: "custom",
      custom: true
    };
  }
}
