import { Module } from "@nestjs/common";
import { DatasourcesModule } from "../datasources/datasources.module.js";
import { LayerRegistryModule } from "../layer-registry/layer-registry.module.js";
import { PostgisModule } from "../postgis/postgis.module.js";
import { LayersController } from "./layers.controller.js";
import { LayersService } from "./layers.service.js";

@Module({
  imports: [LayerRegistryModule, PostgisModule, DatasourcesModule],
  controllers: [LayersController],
  providers: [LayersService],
  exports: [LayersService]
})
export class LayersModule {}
