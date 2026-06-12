import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shallowRef } from "vue";
import WebGisWorkbench from "./WebGisWorkbench.vue";
import type { Datasource, LayerRegistration } from "../../types/gis";

const sampleDatasources: Datasource[] = [];
const sampleLayers: LayerRegistration[] = [
  {
    id: "province",
    datasourceId: "local",
    schema: "public",
    table: "china_2025_province",
    geometryColumn: "geom",
    geometryType: "MultiPolygon",
    srid: 4326,
    primaryKey: "id",
    fields: [],
    hasSpatialIndex: true,
    canSelect: true,
    canInsert: false,
    canUpdate: true,
    canDelete: false,
    queryable: true,
    editable: true,
    editableReason: [],
    tileUrl: "/api/layers/province/tile/{z}/{x}/{y}.mvt",
    style: {
      fill: "#5ca8ff66",
      stroke: "#2563eb",
      strokeWidth: 1,
      pointRadius: 5,
      opacity: 0.6
    },
    extent: null,
    updatedAt: "2026-06-12T00:00:00.000Z"
  },
  {
    id: "city",
    datasourceId: "local",
    schema: "public",
    table: "china_2025_city",
    geometryColumn: "geom",
    geometryType: "MultiPolygon",
    srid: 4326,
    primaryKey: "id",
    fields: [],
    hasSpatialIndex: true,
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true,
    queryable: true,
    editable: true,
    editableReason: [],
    tileUrl: "/api/layers/city/tile/{z}/{x}/{y}.mvt",
    style: {
      fill: "#94d82d66",
      stroke: "#2f9e44",
      strokeWidth: 1,
      pointRadius: 5,
      opacity: 0.6
    },
    extent: null,
    updatedAt: "2026-06-12T00:00:00.000Z"
  }
];

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

vi.mock("../../api", () => ({
  apiGet: vi.fn(async (path: string) => {
    if (path === "/api/datasources") {
      return sampleDatasources;
    }
    if (path === "/api/layers") {
      return sampleLayers;
    }
    throw new Error(`Unhandled apiGet ${path}`);
  }),
  apiSend: vi.fn()
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

  it("toggles the PostgreSQL browser node when clicking it", async () => {
    const wrapper = mount(WebGisWorkbench, {
      attachTo: document.body
    });

    expect(wrapper.text()).toContain("暂无连接。右键 PostgreSQL 新建 PostGIS 连接。");
    await wrapper.find(".datasource-panel__tree-node--root").trigger("click");

    expect(document.body.textContent).not.toContain("创建新的 PostGIS 连接");
    expect(wrapper.text()).not.toContain("暂无连接。右键 PostgreSQL 新建 PostGIS 连接。");

    await wrapper.find(".datasource-panel__tree-node--root").trigger("click");
    expect(wrapper.text()).toContain("暂无连接。右键 PostgreSQL 新建 PostGIS 连接。");

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("opens the PostGIS connection dialog from the database menu command", async () => {
    const wrapper = mount(WebGisWorkbench, {
      attachTo: document.body
    });
    await flushPromises();

    await wrapper.findAll(".workbench__menu-item")
      .find((item) => item.text() === "数据库")
      ?.trigger("click");

    const command = wrapper.findAll(".workbench__menu-command")
      .find((item) => item.text() === "新建 PostgreSQL 连接...");
    expect(command?.exists()).toBe(true);

    await command?.trigger("click");

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

  it("shows only one layer from the layer panel solo action", async () => {
    const wrapper = mount(WebGisWorkbench);
    await flushPromises();

    const soloButtons = wrapper.findAll(".layer-panel__solo");
    expect(soloButtons).toHaveLength(2);

    await soloButtons[1].trigger("click");

    const visibilityInputs = wrapper.findAll<HTMLInputElement>(".layer-panel__visibility input");
    expect(visibilityInputs[0].element.checked).toBe(false);
    expect(visibilityInputs[1].element.checked).toBe(true);
    expect(wrapper.text()).toContain("已仅显示图层：public.china_2025_city");
  });

  it("can show only the active layer and then show all layers from the layer menu", async () => {
    const wrapper = mount(WebGisWorkbench);
    await flushPromises();

    await wrapper.findAll(".workbench__menu-item")
      .find((item) => item.text() === "图层")
      ?.trigger("click");
    await wrapper.findAll(".workbench__menu-command")
      .find((item) => item.text() === "仅显示当前图层")
      ?.trigger("click");

    let visibilityInputs = wrapper.findAll<HTMLInputElement>(".layer-panel__visibility input");
    expect(visibilityInputs[0].element.checked).toBe(true);
    expect(visibilityInputs[1].element.checked).toBe(false);

    await wrapper.findAll(".workbench__menu-item")
      .find((item) => item.text() === "图层")
      ?.trigger("click");
    await wrapper.findAll(".workbench__menu-command")
      .find((item) => item.text() === "显示全部图层")
      ?.trigger("click");

    visibilityInputs = wrapper.findAll<HTMLInputElement>(".layer-panel__visibility input");
    expect(visibilityInputs[0].element.checked).toBe(true);
    expect(visibilityInputs[1].element.checked).toBe(true);
    expect(wrapper.text()).toContain("已显示全部 2 个图层");
  });
});
