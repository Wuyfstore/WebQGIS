import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

@Injectable()
export class JsonFileStore {
  private readonly dataDir = join(process.cwd(), "data");

  async read<T>(fileName: string, fallback: T): Promise<T> {
    try {
      const raw = await readFile(this.resolvePath(fileName), "utf8");
      return JSON.parse(raw) as T;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return fallback;
      }
      throw error;
    }
  }

  async write<T>(fileName: string, value: T): Promise<void> {
    const path = this.resolvePath(fileName);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  private resolvePath(fileName: string): string {
    return join(this.dataDir, fileName);
  }
}
