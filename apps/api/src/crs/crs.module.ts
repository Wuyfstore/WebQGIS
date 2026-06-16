import { Module } from "@nestjs/common";
import { DatasourcesModule } from "../datasources/datasources.module.js";
import { PostgisModule } from "../postgis/postgis.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { CrsController } from "./crs.controller.js";
import { CrsRepository } from "./crs.repository.js";
import { CrsService } from "./crs.service.js";

@Module({
  imports: [StorageModule, DatasourcesModule, PostgisModule],
  controllers: [CrsController],
  providers: [CrsService, CrsRepository],
  exports: [CrsService]
})
export class CrsModule {}
