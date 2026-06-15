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
    fields: [
      {
        name: "id",
        dataType: "integer",
        udtName: "int4",
        nullable: false,
        defaultValue: null,
        editable: false
      },
      {
        name: "name",
        dataType: "text",
        udtName: "text",
        nullable: false,
        defaultValue: null,
        editable: true
      }
    ],
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
    extent: [73.5, 18, 135.1, 53.6],
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
    fields: [
      {
        name: "id",
        dataType: "integer",
        udtName: "int4",
        nullable: false,
        defaultValue: null,
        editable: false
      },
      {
        name: "name",
        dataType: "text",
        udtName: "text",
        nullable: false,
        defaultValue: null,
        editable: true
      },
      {
        name: "adcode",
        dataType: "integer",
        udtName: "int4",
        nullable: true,
        defaultValue: null,
        editable: true
      }
    ],
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
    extent: [100, 20, 110, 30],
    updatedAt: "2026-06-12T00:00:00.000Z"
  }
];

const editorMock = {
  drawMode: shallowRef("Point"),
  activeTool: shallowRef("select"),
  isDrawing: shallowRef(false),
  isSnapEnabled: shallowRef(true),
  isDeleteDialogOpen: shallowRef(false),
  mapCssVars: shallowRef({
    "--map-grid-size": "64px",
    "--map-grid-opacity": "0.42"
  }),
  initializeMap: vi.fn(),
  loadEditableFeature: vi.fn(),
  clearDraft: vi.fn(),
  startDrawing: vi.fn(),
  stopDrawing: vi.fn(),
  activateTool: vi.fn(),
  toggleSnap: vi.fn(),
  zoomIn: vi.fn(),
  zoomToLayerExtent: vi.fn(() => true),
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
    if (path === "/api/layers/city/features") {
      return [
        {
          type: "Feature",
          id: 1024,
          geometry: null,
          properties: {
            id: 1024,
            name: "成都市",
            adcode: 510100
          }
        },
        {
          type: "Feature",
          id: 1025,
          geometry: null,
          properties: {
            id: 1025,
            name: "绵阳市",
            adcode: 510700
          }
        }
      ];
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
    editorMock.zoomToLayerExtent.mockReturnValue(true);
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

  it("restores previous layer visibility after using solo mode", async () => {
    const wrapper = mount(WebGisWorkbench, {
      attachTo: document.body
    });
    await flushPromises();

    const visibilityInputs = () => wrapper.findAll<HTMLInputElement>(".layer-panel__visibility input");
    await visibilityInputs()[1].setValue(false);
    expect(visibilityInputs()[0].element.checked).toBe(true);
    expect(visibilityInputs()[1].element.checked).toBe(false);

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });
    await document.querySelectorAll<HTMLButtonElement>(".layer-panel__context-item")[0].click();
    await flushPromises();

    expect(visibilityInputs()[0].element.checked).toBe(false);
    expect(visibilityInputs()[1].element.checked).toBe(true);

    await wrapper.findAll(".workbench__menu-item")
      .find((item) => item.text() === "图层")
      ?.trigger("click");
    const restoreCommand = wrapper.findAll(".workbench__menu-command")
      .find((item) => item.text() === "恢复上次可见性");
    expect(restoreCommand?.attributes("disabled")).toBeUndefined();

    await restoreCommand?.trigger("click");

    expect(visibilityInputs()[0].element.checked).toBe(true);
    expect(visibilityInputs()[1].element.checked).toBe(false);
    expect(wrapper.text()).toContain("已恢复 1 个图层的可见性");

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("opens layer context menu and runs layer commands", async () => {
    const wrapper = mount(WebGisWorkbench, {
      attachTo: document.body
    });
    await flushPromises();

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });

    expect(document.body.textContent).toContain("独显图层");
    expect(document.body.textContent).toContain("缩放到图层");
    expect(document.body.textContent).toContain("打开属性表");

    await document.querySelectorAll<HTMLButtonElement>(".layer-panel__context-item")[0].click();
    await flushPromises();

    let visibilityInputs = wrapper.findAll<HTMLInputElement>(".layer-panel__visibility input");
    expect(visibilityInputs[0].element.checked).toBe(false);
    expect(visibilityInputs[1].element.checked).toBe(true);

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });
    await document.querySelectorAll<HTMLButtonElement>(".layer-panel__context-item")[1].click();
    await flushPromises();

    visibilityInputs = wrapper.findAll<HTMLInputElement>(".layer-panel__visibility input");
    expect(visibilityInputs[0].element.checked).toBe(true);
    expect(visibilityInputs[1].element.checked).toBe(true);

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });
    await document.querySelectorAll<HTMLButtonElement>(".layer-panel__context-item")[2].click();
    await flushPromises();

    expect(editorMock.zoomToLayerExtent).toHaveBeenCalledWith("city");

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });
    await document.querySelectorAll<HTMLButtonElement>(".layer-panel__context-item")[3].click();
    await flushPromises();

    expect(wrapper.text()).toContain("已打开属性表：public.china_2025_city");
    expect(document.body.textContent).toContain("属性表 - public.china_2025_city");
    expect(document.body.textContent).toContain("2 条记录");
    expect(document.body.textContent).toContain("成都市");
    expect(document.body.textContent).toContain("绵阳市");
    expect(document.querySelector(".attribute-table__header")).not.toBeNull();

    const recordFilter = document.querySelector<HTMLInputElement>(".attribute-table__filter-input");
    expect(recordFilter).not.toBeNull();
    recordFilter!.value = "绵阳";
    recordFilter!.dispatchEvent(new Event("input"));
    await flushPromises();

    expect(document.body.textContent).toContain("1/2 条记录");
    expect(document.body.textContent).toContain("绵阳市");

    await document.querySelectorAll<HTMLButtonElement>(".attribute-table__tab")[1].click();
    await flushPromises();

    expect(document.body.textContent).toContain("3 个字段");
    expect(document.body.textContent).toContain("adcode");

    const fieldFilter = document.querySelector<HTMLInputElement>(".attribute-table__filter-input");
    expect(fieldFilter).not.toBeNull();
    fieldFilter!.value = "ad";
    fieldFilter!.dispatchEvent(new Event("input"));
    await flushPromises();

    expect(document.body.textContent).toContain("1/3 个字段");
    let visibleFieldNames = Array.from(document.querySelectorAll<HTMLTableCellElement>(".attribute-table__table tbody th"))
      .map((cell) => cell.textContent?.trim());
    expect(visibleFieldNames).toEqual(["adcode"]);

    fieldFilter!.value = "missing";
    fieldFilter!.dispatchEvent(new Event("input"));
    await flushPromises();

    expect(document.body.textContent).toContain("0/3 个字段");
    expect(document.body.textContent).toContain("无匹配字段");

    fieldFilter!.value = "";
    fieldFilter!.dispatchEvent(new Event("input"));
    await flushPromises();

    const sortButtons = document.querySelectorAll<HTMLButtonElement>(".attribute-table__sort");
    expect(sortButtons).toHaveLength(5);
    sortButtons[1].click();
    await flushPromises();

    visibleFieldNames = Array.from(document.querySelectorAll<HTMLTableCellElement>(".attribute-table__table tbody th"))
      .map((cell) => cell.textContent?.trim());
    expect(visibleFieldNames).toEqual(["id", "adcode", "name"]);

    await document.querySelector<HTMLButtonElement>(".attribute-table__close")?.click();
    await flushPromises();

    expect(document.body.textContent).not.toContain("属性表 - public.china_2025_city");

    wrapper.unmount();
    document.body.innerHTML = "";
  });
});
