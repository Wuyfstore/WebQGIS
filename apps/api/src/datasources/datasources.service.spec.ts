import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatasourcesService } from "./datasources.service.js";
import { DatasourcesRepository } from "./datasources.repository.js";
import { LayersRepository } from "../layers/layers.repository.js";
import { PostgisRepository } from "../postgis/postgis.repository.js";
import type { DatasourceConfig, LayerRegistration } from "../types.js";

const datasource: DatasourceConfig = {
  id: "source-1",
  name: "Local",
  host: "localhost",
  port: 5432,
  database: "postgis",
  user: "postgres",
  password: "secret",
  ssl: false,
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z"
};

const layer = {
  id: "layer-1",
  datasourceId: "source-1"
} as LayerRegistration;

describe("DatasourcesService", () => {
  let service: DatasourcesService;
  let datasourcesRepository: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let layersRepository: {
    replaceForDatasource: ReturnType<typeof vi.fn>;
  };
  let postgisRepository: {
    testConnection: ReturnType<typeof vi.fn>;
    scanDatasource: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    datasourcesRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      save: vi.fn()
    };
    layersRepository = {
      replaceForDatasource: vi.fn()
    };
    postgisRepository = {
      testConnection: vi.fn(),
      scanDatasource: vi.fn()
    };

    const module = await Test.createTestingModule({
      providers: [
        DatasourcesService,
        { provide: DatasourcesRepository, useValue: datasourcesRepository },
        { provide: LayersRepository, useValue: layersRepository },
        { provide: PostgisRepository, useValue: postgisRepository }
      ]
    }).compile();

    service = module.get(DatasourcesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns public datasource data without password", async () => {
    datasourcesRepository.findAll.mockResolvedValue([datasource]);

    await expect(service.list()).resolves.toMatchObject([
      {
        id: "source-1",
        name: "Local",
        hasPassword: true
      }
    ]);
    const result = await service.list();
    expect("password" in result[0]).toBe(false);
  });

  it("tests a datasource before saving it", async () => {
    postgisRepository.testConnection.mockResolvedValue(undefined);
    datasourcesRepository.save.mockImplementation(async (value: DatasourceConfig) => value);

    const result = await service.create({
      name: "Local",
      host: "localhost",
      port: 5432,
      database: "postgis",
      user: "postgres",
      password: "secret",
      ssl: false
    });

    expect(postgisRepository.testConnection).toHaveBeenCalledOnce();
    expect(datasourcesRepository.save).toHaveBeenCalledOnce();
    expect(result.hasPassword).toBe(true);
  });

  it("scans and replaces layers for a datasource", async () => {
    datasourcesRepository.findById.mockResolvedValue(datasource);
    postgisRepository.scanDatasource.mockResolvedValue([layer]);
    layersRepository.replaceForDatasource.mockResolvedValue([layer]);

    await expect(service.scan("source-1")).resolves.toEqual({ layers: [layer] });
    expect(layersRepository.replaceForDatasource).toHaveBeenCalledWith("source-1", [layer]);
  });
});
