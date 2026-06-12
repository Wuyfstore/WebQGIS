import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shallowRef } from "vue";
import WebGisWorkbench from "./WebGisWorkbench.vue";

const editorMock = {
  drawMode: shallowRef("Point"),
  activeTool: shallowRef("select"),
  isDrawing: shallowRef(false),
  isSnapEnabled: shallowRef(true),
  isDeleteDialogOpen: shallowRef(false),
  initializeMap: vi.fn(),
  loadEditableFeature: vi.fn(),
  clearDraft: vi.fn(),
  startDrawing: vi.fn(),
  stopDrawing: vi.fn(),
  activateTool: vi.fn(),
  toggleSnap: vi.fn(),
  zoomIn: vi.fn(),
  refreshLayer: vi.fn(),
  requestDeleteConfirmation: vi.fn(async () => false),
  confirmDelete: vi.fn(),
  cancelDelete: vi.fn()
};

vi.mock("../../composables/useOpenLayersEditor", () => ({
  useOpenLayersEditor: () => editorMock
}));

describe("WebGisWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorMock.drawMode.value = "Point";
    editorMock.activeTool.value = "select";
    editorMock.isDrawing.value = false;
    editorMock.isSnapEnabled.value = true;
    editorMock.isDeleteDialogOpen.value = false;
  });

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

  it("opens the PostGIS connection dialog when clicking the PostgreSQL browser node", async () => {
    const wrapper = mount(WebGisWorkbench, {
      attachTo: document.body
    });

    await wrapper.find(".datasource-panel__tree-node--root").trigger("click");

    expect(document.body.textContent).toContain("创建新的 PostGIS 连接");
    expect(document.body.textContent).toContain("名称");

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("renders toolbar actions with icon components", () => {
    const wrapper = mount(WebGisWorkbench);

    expect(wrapper.findAll(".workbench__tool-icon").length).toBeGreaterThan(10);
    expect(wrapper.find("svg.workbench__tool-icon").exists()).toBe(true);
  });

  it("wires toolbar tools to existing map and workspace actions", async () => {
    const wrapper = mount(WebGisWorkbench);
    await flushPromises();

    const tools = wrapper.findAll(".workbench__tool");
    const selectTool = tools.find((tool) => tool.attributes("title") === "选择要素");
    const snapTool = tools.find((tool) => tool.attributes("title") === "切换吸附");

    expect(selectTool?.exists()).toBe(true);
    expect(snapTool?.exists()).toBe(true);

    await selectTool?.trigger("click");
    await snapTool?.trigger("click");

    expect(editorMock.activateTool).toHaveBeenCalledWith("select");
    expect(editorMock.toggleSnap).toHaveBeenCalled();
  });
});
