import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { TileCacheService } from "./tile-cache.service.js";
import { TilePackageRepository } from "./tile-package.repository.js";

@Module({
  imports: [StorageModule],
  providers: [TileCacheService, TilePackageRepository],
  exports: [TileCacheService, TilePackageRepository]
})
export class TileCacheModule {}
