import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DatasourceConfig, LayerRegistration, PublicDatasourceConfig } from "./types.js";

const dataDir = join(process.cwd(), "data");
const datasourcePath = join(dataDir, "datasources.json");
const layerPath = join(dataDir, "layers.json");

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile<T>(path: string, value: T): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function listDatasources(): Promise<DatasourceConfig[]> {
  return readJsonFile<DatasourceConfig[]>(datasourcePath, []);
}

export async function saveDatasource(config: DatasourceConfig): Promise<DatasourceConfig> {
  const datasources = await listDatasources();
  const index = datasources.findIndex((item) => item.id === config.id);
  if (index >= 0) {
    datasources[index] = config;
  } else {
    datasources.push(config);
  }
  await writeJsonFile(datasourcePath, datasources);
  return config;
}

export function toPublicDatasource(config: DatasourceConfig): PublicDatasourceConfig {
  const { password, ...rest } = config;
  return {
    ...rest,
    hasPassword: password.length > 0
  };
}

export async function getDatasource(id: string): Promise<DatasourceConfig | undefined> {
  const datasources = await listDatasources();
  return datasources.find((item) => item.id === id);
}

export async function listLayers(): Promise<LayerRegistration[]> {
  return readJsonFile<LayerRegistration[]>(layerPath, []);
}

export async function replaceLayersForDatasource(
  datasourceId: string,
  scannedLayers: LayerRegistration[]
): Promise<LayerRegistration[]> {
  const existing = await listLayers();
  const next = [
    ...existing.filter((layer) => layer.datasourceId !== datasourceId),
    ...scannedLayers
  ];
  await writeJsonFile(layerPath, next);
  return next;
}

export async function getLayer(id: string): Promise<LayerRegistration | undefined> {
  const layers = await listLayers();
  return layers.find((layer) => layer.id === id);
}
