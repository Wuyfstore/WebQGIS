import { Inject, Injectable } from "@nestjs/common";
import { JsonFileStore } from "../storage/json-file.store.js";
import type { DatasourceConfig } from "../types.js";

@Injectable()
export class DatasourcesRepository {
  private readonly fileName = "datasources.json";

  constructor(
    @Inject(JsonFileStore)
    private readonly store: JsonFileStore
  ) {}

  async findAll(): Promise<DatasourceConfig[]> {
    return this.store.read<DatasourceConfig[]>(this.fileName, []);
  }

  async findById(id: string): Promise<DatasourceConfig | undefined> {
    const datasources = await this.findAll();
    return datasources.find((item) => item.id === id);
  }

  async save(config: DatasourceConfig): Promise<DatasourceConfig> {
    const datasources = await this.findAll();
    const index = datasources.findIndex((item) => item.id === config.id);
    if (index >= 0) {
      datasources[index] = config;
    } else {
      datasources.push(config);
    }
    await this.store.write(this.fileName, datasources);
    return config;
  }
}
