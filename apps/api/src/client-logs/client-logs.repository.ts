import { Injectable } from "@nestjs/common";
import { JsonFileStore } from "../storage/json-file.store.js";
import type { ClientLogEntry } from "./client-logs.types.js";

@Injectable()
export class ClientLogsRepository {
  private readonly fileName = "client-logs.json";

  constructor(private readonly store: JsonFileStore) {}

  async findRecent(limit: number): Promise<ClientLogEntry[]> {
    const logs = await this.findAll();
    return logs.slice(-limit).reverse();
  }

  async append(entry: ClientLogEntry, maxEntries: number): Promise<ClientLogEntry> {
    const logs = await this.findAll();
    const next = [...logs, entry].slice(-maxEntries);
    await this.store.write(this.fileName, next);
    return entry;
  }

  private findAll(): Promise<ClientLogEntry[]> {
    return this.store.read<ClientLogEntry[]>(this.fileName, []);
  }
}
