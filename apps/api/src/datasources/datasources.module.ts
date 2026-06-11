import { Module } from "@nestjs/common";
import { PostgisModule } from "../postgis/postgis.module.js";
import { LayerRegistryModule } from "../layer-registry/layer-registry.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { DatasourcesController } from "./datasources.controller.js";
import { DatasourcesRepository } from "./datasources.repository.js";
import { DatasourcesService } from "./datasources.service.js";

@Module({
  imports: [StorageModule, PostgisModule, LayerRegistryModule],
  controllers: [DatasourcesController],
  providers: [DatasourcesService, DatasourcesRepository],
  exports: [DatasourcesService, DatasourcesRepository]
})
export class DatasourcesModule {}
