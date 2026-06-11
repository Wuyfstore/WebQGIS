import { Module } from "@nestjs/common";
import { JsonFileStore } from "./json-file.store.js";

@Module({
  providers: [JsonFileStore],
  exports: [JsonFileStore]
})
export class StorageModule {}
