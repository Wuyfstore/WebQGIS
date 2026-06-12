import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { ClientLogsController } from "./client-logs.controller.js";
import { ClientLogsRepository } from "./client-logs.repository.js";
import { ClientLogsService } from "./client-logs.service.js";

@Module({
  imports: [StorageModule],
  controllers: [ClientLogsController],
  providers: [ClientLogsRepository, ClientLogsService]
})
export class ClientLogsModule {}
