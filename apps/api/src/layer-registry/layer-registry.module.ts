import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { LayersRepository } from "../layers/layers.repository.js";

@Module({
  imports: [StorageModule],
  providers: [LayersRepository],
  exports: [LayersRepository]
})
export class LayerRegistryModule {}
