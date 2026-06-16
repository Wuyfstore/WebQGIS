import { describe, expect, it } from "vitest";
import {
  hasLayerDragPayload,
  layerDragMime,
  readLayerDragPayload,
  writeLayerDragPayload
} from "./layerDrag";

function createDragEvent(type: string, options: {
  types?: string[];
  values?: Map<string, string>;
} = {}) {
  const values = options.values ?? new Map<string, string>();
  const event = new Event(type, {
    bubbles: true,
    cancelable: true
  }) as DragEvent;
  Object.defineProperty(event, "dataTransfer", {
    value: {
      dropEffect: "",
      effectAllowed: "",
      types: options.types ?? Array.from(values.keys()),
      getData: (format: string) => values.get(format) ?? "",
      setData: (format: string, value: string) => values.set(format, value)
    }
  });
  return event;
}

describe("layer drag utilities", () => {
  it("writes a custom layer payload and plain text fallback", () => {
    const values = new Map<string, string>();
    const event = createDragEvent("dragstart", { values });

    writeLayerDragPayload(event, "city");

    expect(values.get(layerDragMime)).toBe("city");
    expect(values.get("text/plain")).toBe("city");
    expect(event.dataTransfer?.effectAllowed).toBe("copy");
  });

  it("detects protected drag events from dataTransfer types", () => {
    const event = createDragEvent("dragover", {
      types: [layerDragMime, "text/plain"]
    });

    expect(hasLayerDragPayload(event)).toBe(true);
  });

  it("reads the fallback layer id when drop data is protected or empty", () => {
    const event = createDragEvent("drop", {
      types: [layerDragMime, "text/plain"]
    });

    expect(readLayerDragPayload(event, "province")).toBe("province");
    expect(hasLayerDragPayload(event, "province")).toBe(true);
  });
});
