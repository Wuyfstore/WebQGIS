import { Module } from "@nestjs/common";
import { PostgisRepository } from "./postgis.repository.js";

@Module({
  providers: [PostgisRepository],
  exports: [PostgisRepository]
})
export class PostgisModule {}
