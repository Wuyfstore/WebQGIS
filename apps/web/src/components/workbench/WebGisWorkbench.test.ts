import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { shallowRef } from "vue";
import WebGisWorkbench from "./WebGisWorkbench.vue";

vi.mock("../../composables/useOpenLayersEditor", () => ({
  useOpenLayersEditor: () => ({
    drawMode: shallowRef("Point"),
    isDrawing: shallowRef(false),
    isDeleteDialogOpen: shallowRef(false),
    initializeMap: vi.fn(),
    loadEditableFeature: vi.fn(),
    clearDraft: vi.fn(),
    startDrawing: vi.fn(),
    refreshLayer: vi.fn(),
    requestDeleteConfirmation: vi.fn(async () => false),
    confirmDelete: vi.fn(),
    cancelDelete: vi.fn()
  })
}));

describe("WebGisWorkbench", () => {
  it("renders the QGIS-style shell without crashing on first entry", () => {
    const wrapper = mount(WebGisWorkbench);

    expect(wrapper.text()).toContain("WebQGIS");
    expect(wrapper.text()).toContain("浏览器");
    expect(wrapper.text()).toContain("图层与要素属性");
  });
});
