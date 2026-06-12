import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { appConfig } from "./config/app.config.js";
import { validateEnvironment } from "./config/validation.js";
import { HealthModule } from "./health/health.module.js";
import { DatasourcesModule } from "./datasources/datasources.module.js";
import { LayersModule } from "./layers/layers.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { PostgisModule } from "./postgis/postgis.module.js";
import { ClientLogsModule } from "./client-logs/client-logs.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateEnvironment
    }),
    StorageModule,
    PostgisModule,
    HealthModule,
    ClientLogsModule,
    DatasourcesModule,
    LayersModule
  ]
})
export class AppModule {}
