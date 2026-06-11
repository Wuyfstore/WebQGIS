import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { nanoid } from "nanoid";
import { PostgisRepository } from "../postgis/postgis.repository.js";
import { LayersRepository } from "../layers/layers.repository.js";
import type { DatasourceConfig } from "../types.js";
import { DatasourcesRepository } from "./datasources.repository.js";
import { CreateDatasourceDto } from "./dto/create-datasource.dto.js";
import { DatasourceResponseDto } from "./dto/datasource-response.dto.js";

@Injectable()
export class DatasourcesService {
  constructor(
    @Inject(DatasourcesRepository)
    private readonly datasourcesRepository: DatasourcesRepository,
    @Inject(LayersRepository)
    private readonly layersRepository: LayersRepository,
    @Inject(PostgisRepository)
    private readonly postgisRepository: PostgisRepository
  ) {}

  async list(): Promise<DatasourceResponseDto[]> {
    const datasources = await this.datasourcesRepository.findAll();
    return datasources.map((config) => new DatasourceResponseDto(config));
  }

  async test(dto: CreateDatasourceDto): Promise<{ ok: true }> {
    const config = this.buildDatasource(dto);
    await this.postgisRepository.testConnection(config);
    return { ok: true };
  }

  async create(dto: CreateDatasourceDto): Promise<DatasourceResponseDto> {
    const config = this.buildDatasource(dto);
    await this.postgisRepository.testConnection(config);
    const saved = await this.datasourcesRepository.save(config);
    return new DatasourceResponseDto(saved);
  }

  async scan(id: string) {
    const datasource = await this.getRequiredDatasource(id);
    const layers = await this.postgisRepository.scanDatasource(datasource);
    await this.layersRepository.replaceForDatasource(id, layers);
    return { layers };
  }

  async getRequiredDatasource(id: string): Promise<DatasourceConfig> {
    const datasource = await this.datasourcesRepository.findById(id);
    if (!datasource) {
      throw new NotFoundException("Datasource not found");
    }
    return datasource;
  }

  private buildDatasource(input: CreateDatasourceDto): DatasourceConfig {
    const now = new Date().toISOString();
    return {
      id: nanoid(12),
      name: input.name,
      host: input.host,
      port: input.port,
      database: input.database,
      user: input.user,
      password: input.password ?? "",
      ssl: Boolean(input.ssl),
      createdAt: now,
      updatedAt: now
    };
  }
}
