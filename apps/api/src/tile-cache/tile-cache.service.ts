import { Inject, Injectable } from "@nestjs/common";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import type { LayerRegistration, TilePackage } from "../types.js";
import { TilePackageRepository } from "./tile-package.repository.js";

@Injectable()
export class TileCacheService {
  private readonly tileRoot = resolve(process.cwd(), "data", "tile-packages");

  constructor(
    @Inject(TilePackageRepository)
    private readonly tilePackageRepository: TilePackageRepository
  ) {}

  async readPublishedTile(tilePackage: TilePackage, z: number, x: number, y: number): Promise<Buffer | null> {
    if (tilePackage.sourceType !== "directory") {
      return null;
    }
    const path = this.tilePath(tilePackage, z, x, y);
    try {
      return await readFile(path);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        return null;
      }
      throw error;
    }
  }

  async findTilePackage(layer: LayerRegistration, z: number): Promise<TilePackage | undefined> {
    const packages = layer.tilePackages?.length
      ? layer.tilePackages
      : await this.tilePackageRepository.findForLayer(layer.id);
    return packages
      .filter((tilePackage) => tilePackage.format === "mvt")
      .filter((tilePackage) => z >= tilePackage.minZoom && z <= tilePackage.maxZoom)
      .sort((a, b) => b.version - a.version)[0];
  }

  async directoryPackageHasTile(tilePackage: TilePackage, z: number, x: number, y: number): Promise<boolean> {
    if (tilePackage.sourceType !== "directory") {
      return false;
    }
    try {
      await access(this.tilePath(tilePackage, z, x, y), constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  private tilePath(tilePackage: TilePackage, z: number, x: number, y: number): string {
    const root = this.resolveStoragePath(tilePackage.storagePath);
    return join(root, String(z), String(x), `${y}.mvt`);
  }

  private resolveStoragePath(storagePath: string): string {
    if (isAbsolute(storagePath)) {
      return normalize(storagePath);
    }
    const resolved = resolve(this.tileRoot, storagePath);
    const relativePath = relative(this.tileRoot, resolved);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error(`Tile package storagePath escapes tile root: ${storagePath}`);
    }
    return resolved;
  }
}
