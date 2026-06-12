import { Inject, Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";
import { CreateClientLogDto } from "./dto/create-client-log.dto.js";
import { ClientLogsRepository } from "./client-logs.repository.js";
import type { ClientLogEntry } from "./client-logs.types.js";

const maxEntries = 200;

@Injectable()
export class ClientLogsService {
  constructor(
    @Inject(ClientLogsRepository)
    private readonly clientLogsRepository: ClientLogsRepository
  ) {}

  listRecent(limit: number | string | undefined = 50): Promise<ClientLogEntry[]> {
    const numericLimit = typeof limit === "number" ? limit : Number(limit);
    const safeLimit = Number.isFinite(numericLimit) ? numericLimit : 50;
    return this.clientLogsRepository.findRecent(Math.min(Math.max(safeLimit, 1), maxEntries));
  }

  create(dto: CreateClientLogDto): Promise<ClientLogEntry> {
    const entry: ClientLogEntry = {
      id: nanoid(12),
      receivedAt: new Date().toISOString(),
      ...dto
    };
    return this.clientLogsRepository.append(entry, maxEntries);
  }
}
