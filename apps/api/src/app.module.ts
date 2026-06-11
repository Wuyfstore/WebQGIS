import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { appConfig } from "./config/app.config.js";
import { validateEnvironment } from "./config/validation.js";
import { HealthModule } from "./health/health.module.js";
import { DatasourcesModule } from "./datasources/datasources.module.js";
import { LayersModule } from "./layers/layers.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { PostgisModule } from "./postgis/postgis.module.js";

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
    DatasourcesModule,
    LayersModule
  ]
})
export class AppModule {}
