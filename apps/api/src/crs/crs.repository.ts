import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { nanoid } from "nanoid";
import { JsonFileStore } from "../storage/json-file.store.js";
import type { CustomCrsRecord } from "./crs.types.js";

@Injectable()
export class CrsRepository {
  private readonly fileName = "custom-crs.json";

  constructor(
    @Inject(JsonFileStore)
    private readonly store: JsonFileStore
  ) {}

  async findAll(): Promise<CustomCrsRecord[]> {
    return this.store.read<CustomCrsRecord[]>(this.fileName, []);
  }

  async findById(id: string): Promise<CustomCrsRecord | undefined> {
    const items = await this.findAll();
    return items.find((item) => item.id === id);
  }

  async create(input: Omit<CustomCrsRecord, "id" | "createdAt" | "updatedAt">): Promise<CustomCrsRecord> {
    const now = new Date().toISOString();
    const item: CustomCrsRecord = {
      ...input,
      id: nanoid(12),
      createdAt: now,
      updatedAt: now
    };
    const items = await this.findAll();
    await this.store.write(this.fileName, [...items, item]);
    return item;
  }

  async update(id: string, input: Omit<CustomCrsRecord, "id" | "createdAt" | "updatedAt">): Promise<CustomCrsRecord> {
    const items = await this.findAll();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new NotFoundException("Custom CRS not found");
    }
    const updated: CustomCrsRecord = {
      ...items[index],
      ...input,
      id,
      updatedAt: new Date().toISOString()
    };
    items[index] = updated;
    await this.store.write(this.fileName, items);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const items = await this.findAll();
    const nextItems = items.filter((item) => item.id !== id);
    if (nextItems.length === items.length) {
      throw new NotFoundException("Custom CRS not found");
    }
    await this.store.write(this.fileName, nextItems);
  }
}
