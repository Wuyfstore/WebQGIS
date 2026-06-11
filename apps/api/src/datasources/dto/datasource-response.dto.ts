import { Expose } from "class-transformer";
import type { DatasourceConfig } from "../../types.js";

export class DatasourceResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  host: string;

  @Expose()
  port: number;

  @Expose()
  database: string;

  @Expose()
  user: string;

  @Expose()
  ssl: boolean;

  @Expose()
  hasPassword: boolean;

  @Expose()
  createdAt: string;

  @Expose()
  updatedAt: string;

  constructor(config: DatasourceConfig) {
    Object.assign(this, {
      id: config.id,
      name: config.name,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      ssl: config.ssl,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      hasPassword: config.password.length > 0
    });
  }
}
