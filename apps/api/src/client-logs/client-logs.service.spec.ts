import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientLogsRepository } from "./client-logs.repository.js";
import { ClientLogsService } from "./client-logs.service.js";

describe("ClientLogsService", () => {
  let service: ClientLogsService;
  let repository: {
    append: ReturnType<typeof vi.fn>;
    findRecent: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repository = {
      append: vi.fn(async (entry) => entry),
      findRecent: vi.fn(async () => [])
    };

    const module = await Test.createTestingModule({
      providers: [
        ClientLogsService,
        { provide: ClientLogsRepository, useValue: repository }
      ]
    }).compile();

    service = module.get(ClientLogsService);
  });

  it("creates a timestamped client log entry", async () => {
    const entry = await service.create({
      source: "vue",
      message: "Cannot read properties of undefined",
      stack: "stack",
      component: "WebGisWorkbench",
      info: "render",
      url: "http://localhost:5173/",
      userAgent: "vitest"
    });

    expect(entry.id).toHaveLength(12);
    expect(entry.receivedAt).toEqual(expect.any(String));
    expect(repository.append).toHaveBeenCalledWith(expect.objectContaining({
      source: "vue",
      message: "Cannot read properties of undefined"
    }), 200);
  });

  it("clamps recent log limits", async () => {
    await service.listRecent(999);

    expect(repository.findRecent).toHaveBeenCalledWith(200);
  });

  it("uses the default recent log limit for non-numeric input", async () => {
    await service.listRecent("invalid");

    expect(repository.findRecent).toHaveBeenCalledWith(50);
  });
});
