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

  it("opens the PostGIS connection dialog from the PostgreSQL browser context menu", async () => {
    const wrapper = mount(WebGisWorkbench, {
      attachTo: document.body
    });

    await wrapper.find(".datasource-panel__tree-node--root").trigger("contextmenu", {
      clientX: 80,
      clientY: 120
    });

    expect(document.body.textContent).toContain("新建连接...");
    await document.querySelector<HTMLButtonElement>(".datasource-panel__context-item")?.click();

    expect(document.body.textContent).toContain("创建新的 PostGIS 连接");
    expect(document.body.textContent).toContain("保存并测试");

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("renders toolbar actions with icon components", () => {
    const wrapper = mount(WebGisWorkbench);

    expect(wrapper.findAll(".workbench__tool-icon").length).toBeGreaterThan(10);
    expect(wrapper.find("svg.workbench__tool-icon").exists()).toBe(true);
  });
});
