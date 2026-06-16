import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shallowRef } from "vue";
import WebGisWorkbench from "./WebGisWorkbench.vue";
import DatasourcePanel from "./DatasourcePanel.vue";
import { apiGet, apiSend } from "../../api";
import type { CrsDefinition, Datasource, DatasourceForm, LayerRegistration } from "../../types/gis";

const sampleDatasources: Datasource[] = [
  {
    id: "local",
    name: "Docker PostGIS Test",
    host: "127.0.0.1",
    port: 5432,
    database: "test",
    user: "postgres",
    ssl: false,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    hasPassword: true
  }
];
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
const sampleDatasourceForm: DatasourceForm = {
  name: "Docker PostGIS Test",
  host: "127.0.0.1",
  port: 5432,
  database: "test",
  user: "postgres",
  password: "",
  ssl: false
};
const sampleCrsCatalog: CrsDefinition[] = [
  {
    id: "local-EPSG-3857",
    code: "EPSG:3857",
    authName: "EPSG",
    authSrid: 3857,
    srid: 3857,
    name: "WGS 84 / Pseudo-Mercator",
    proj4text: "+proj=merc +a=6378137 +b=6378137 +units=m +no_defs",
    wkt: "",
    area: "World",
    scope: "Web map display",
    source: "postgis",
    datasourceId: "local",
    custom: false
  },
  {
    id: "local-EPSG-4326",
    code: "EPSG:4326",
    authName: "EPSG",
    authSrid: 4326,
    srid: 4326,
    name: "WGS 84",
    proj4text: "+proj=longlat +datum=WGS84 +no_defs",
    wkt: "",
    area: "World",
    scope: "Latitude and longitude",
    source: "postgis",
    datasourceId: "local",
    custom: false
  }
];
const customCrs: CrsDefinition = {
  id: "custom-1",
  code: "LOCAL:900001",
  authName: "LOCAL",
  authSrid: 900001,
  srid: 900001,
  name: "成都地方坐标系",
  proj4text: "+proj=tmerc +lat_0=0 +lon_0=104 +k=1 +x_0=500000 +y_0=0 +units=m +no_defs",
  wkt: "",
  area: "成都",
  scope: "地方工程坐标",
  source: "custom",
  custom: true,
  updatedAt: "2026-06-16T00:00:00.000Z"
};

const editorMock = {
  drawMode: shallowRef("Point"),
  activeTool: shallowRef("select"),
  selectionMode: shallowRef("click"),
  isDrawing: shallowRef(false),
  isSnapEnabled: shallowRef(true),
  isDeleteDialogOpen: shallowRef(false),
  coordinateLabel: shallowRef("坐标 104.06480, 30.65720 / EPSG:4326"),
  scaleLabel: shallowRef("比例尺 1:2,500"),
  projectionLabel: shallowRef("EPSG:4326 显示 / EPSG:4326 数据源 · WGS84 经纬度显示坐标"),
  zoomLevel: shallowRef(7.25),
  initializeMap: vi.fn(),
  loadEditableFeature: vi.fn(),
  clearDraft: vi.fn(),
  startDrawing: vi.fn(),
  stopDrawing: vi.fn(),
  activateTool: vi.fn(),
  activateSelectionMode: vi.fn(),
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
    if (path.startsWith("/api/crs/search")) {
      const url = new URL(path, "http://localhost");
      const search = (url.searchParams.get("q") ?? "").toLowerCase();
      return [...sampleCrsCatalog, customCrs].filter((crs) => (
        !search
        || crs.code.toLowerCase().includes(search)
        || crs.name.toLowerCase().includes(search)
        || String(crs.srid).includes(search)
      ));
    }
    if (path === "/api/crs/custom") {
      return [customCrs];
    }
    if (path.startsWith("/api/layers/city/features")) {
      const url = new URL(path, "http://localhost");
      const search = url.searchParams.get("search") ?? "";
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const items = [
          {
            type: "Feature" as const,
            id: offset + 1024,
            geometry: null,
            properties: { id: offset + 1024, name: offset > 0 ? "德阳市" : "成都市", adcode: offset > 0 ? 510600 : 510100 }
          },
          {
            type: "Feature" as const,
            id: offset + 1025,
            geometry: null,
            properties: { id: offset + 1025, name: "绵阳市", adcode: 510700 }
          }
        ]
        .filter((feature) => !search || feature.properties.name.includes(search));
      return {
        items,
        total: search ? items.length : 128,
        limit: Number(url.searchParams.get("limit") ?? 100),
        offset
      };
    }
    throw new Error(`Unhandled apiGet ${path}`);
  }),
  apiSend: vi.fn(async (path: string, method: string, payload?: unknown) => {
    if (path === "/api/datasources/local/scan" && method === "POST") {
      return { layers: sampleLayers };
    }
    if (path === "/api/layers/city/style" && method === "PUT") {
      return {
        ...sampleLayers[1],
        style: {
          ...sampleLayers[1].style,
          ...(payload as object)
        }
      };
    }
    if (path === "/api/layers/city/query" && method === "POST") {
      return {
        columns: ["id", "name"],
        rows: [{ id: 1024, name: "成都市" }],
        limit: (payload as { limit: number }).limit
      };
    }
    if (path === "/api/layers/city/calculate" && method === "POST") {
      return {
        targetField: (payload as { targetField: string }).targetField,
        affectedRows: 2
      };
    }
    if (path === "/api/crs/custom" && method === "POST") {
      return {
        ...customCrs,
        ...(payload as object)
      };
    }
    if (path === "/api/crs/custom/custom-1" && method === "PUT") {
      return {
        ...customCrs,
        ...(payload as object)
      };
    }
    if (path === "/api/crs/custom/custom-1" && method === "DELETE") {
      return undefined;
    }
    throw new Error(`Unhandled apiSend ${method} ${path}`);
  })
}));

async function expandDatasource(wrapper: ReturnType<typeof mount<typeof WebGisWorkbench>>) {
  if (wrapper.findAll(".datasource-panel__tree-node--layer").length > 0) {
    return;
  }
  const sourceButton = wrapper.findAll(".datasource-panel__tree-node--source")
    .find((button) => button.text().includes("Docker PostGIS Test"));
  expect(sourceButton?.exists()).toBe(true);
  await sourceButton?.trigger("click");
  await flushPromises();
}

async function loadLayerByDoubleClick(
  wrapper: ReturnType<typeof mount<typeof WebGisWorkbench>>,
  layerName = "public.china_2025_city"
) {
  await expandDatasource(wrapper);
  const layerButton = wrapper.findAll(".datasource-panel__tree-node--layer")
    .find((button) => button.text().includes(layerName));
  expect(layerButton?.exists()).toBe(true);
  await layerButton?.trigger("dblclick");
  await flushPromises();
}

function createLayerDragEvent(type: string, layerId = "city") {
  const data = new Map<string, string>([
    ["application/x-webqgis-layer-id", layerId],
    ["text/plain", layerId]
  ]);
  const event = new Event(type, {
    bubbles: true,
    cancelable: true
  }) as DragEvent;
  Object.defineProperty(event, "dataTransfer", {
    value: {
      dropEffect: "",
      effectAllowed: "",
      types: Array.from(data.keys()),
      getData: (format: string) => data.get(format) ?? "",
      setData: (format: string, value: string) => data.set(format, value)
    }
  });
  return event;
}

function createLayerDragOverEventWithProtectedData(layerId = "city") {
  const event = new Event("dragover", {
    bubbles: true,
    cancelable: true
  }) as DragEvent;
  Object.defineProperty(event, "dataTransfer", {
    value: {
      dropEffect: "",
      effectAllowed: "",
      types: ["application/x-webqgis-layer-id", "text/plain"],
      getData: () => "",
      setData: () => undefined
    }
  });
  return event;
}

function createProtectedLayerDragEvent(type: string) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true
  }) as DragEvent;
  Object.defineProperty(event, "dataTransfer", {
    value: {
      dropEffect: "",
      effectAllowed: "",
      types: ["application/x-webqgis-layer-id", "text/plain"],
      getData: () => "",
      setData: () => undefined
    }
  });
  return event;
}

function contextMenuItem(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".layer-panel__context-item"))
    .find((button) => button.textContent?.trim() === label);
}

function setNativeInputValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
}

describe("WebGisWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => undefined)
      }
    });
    editorMock.drawMode.value = "Point";
    editorMock.activeTool.value = "select";
    editorMock.selectionMode.value = "click";
    editorMock.isDrawing.value = false;
    editorMock.isSnapEnabled.value = true;
    editorMock.isDeleteDialogOpen.value = false;
    editorMock.coordinateLabel.value = "坐标 104.06480, 30.65720 / EPSG:4326";
    editorMock.scaleLabel.value = "比例尺 1:2,500";
    editorMock.projectionLabel.value = "EPSG:4326 显示 / EPSG:4326 数据源 · WGS84 经纬度显示坐标";
    editorMock.zoomLevel.value = 7.25;
    editorMock.zoomToLayerExtent.mockReturnValue(true);
  });

  it("renders the QGIS-style shell without crashing on first entry", () => {
    const wrapper = mount(WebGisWorkbench);

    expect(wrapper.text()).toContain("WebQGIS");
    expect(wrapper.text()).toContain("浏览器");
    expect(wrapper.text()).toContain("图层");
    expect(wrapper.find(".edit-inspector").exists()).toBe(false);
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
    await flushPromises();

    expect(wrapper.text()).toContain("Docker PostGIS Test");
    await wrapper.find(".datasource-panel__tree-node--root").trigger("click");

    expect(document.body.textContent).not.toContain("创建新的 PostGIS 连接");
    expect(wrapper.text()).not.toContain("Docker PostGIS Test");

    await wrapper.find(".datasource-panel__tree-node--root").trigger("click");
    expect(wrapper.text()).toContain("Docker PostGIS Test");

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

  it("closes and switches top menu popovers with desktop menu interactions", async () => {
    const wrapper = mount(WebGisWorkbench, {
      attachTo: document.body
    });
    await flushPromises();

    const menuButton = (label: string) => wrapper.findAll(".workbench__menu-item")
      .find((item) => item.text() === label);

    await menuButton("数据库")?.trigger("click");
    expect(wrapper.text()).toContain("新建 PostgreSQL 连接...");

    await menuButton("数据库")?.trigger("click");
    expect(wrapper.text()).not.toContain("新建 PostgreSQL 连接...");

    await menuButton("数据库")?.trigger("click");
    expect(wrapper.text()).toContain("新建 PostgreSQL 连接...");
    await menuButton("图层")?.trigger("click");
    expect(wrapper.text()).not.toContain("新建 PostgreSQL 连接...");
    expect(wrapper.text()).toContain("刷新图层列表");

    window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await flushPromises();
    expect(wrapper.text()).not.toContain("刷新图层列表");

    await menuButton("数据库")?.trigger("click");
    expect(wrapper.text()).toContain("新建 PostgreSQL 连接...");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(wrapper.text()).not.toContain("新建 PostgreSQL 连接...");

    await menuButton("数据库")?.trigger("click");
    const command = wrapper.findAll(".workbench__menu-command")
      .find((item) => item.text() === "新建 PostgreSQL 连接...");
    await command?.trigger("click");
    expect(wrapper.text()).not.toContain("新建 PostgreSQL 连接...");

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("renders toolbar actions with icon components", () => {
    const wrapper = mount(WebGisWorkbench);

    expect(wrapper.findAll(".workbench__tool-icon").length).toBeGreaterThan(10);
    expect(wrapper.find("svg.workbench__tool-icon").exists()).toBe(true);
  });

  it("keeps scanned spatial tables in the browser until the user loads them", async () => {
    const wrapper = mount(WebGisWorkbench);
    await flushPromises();

    expect(wrapper.text()).toContain("Docker PostGIS Test");
    expect(wrapper.text()).toContain("从浏览器拖入空间表以添加图层");
    expect(wrapper.text()).toContain("活动图层:未选择");

    await expandDatasource(wrapper);

    expect(wrapper.text()).toContain("public.china_2025_city");
    expect(wrapper.findAll(".layer-panel__row")).toHaveLength(0);

    await wrapper.findAll(".datasource-panel__tree-node--layer")
      .find((button) => button.text().includes("public.china_2025_city"))
      ?.trigger("dblclick");
    await flushPromises();

    expect(wrapper.findAll(".layer-panel__row")).toHaveLength(1);
    expect(wrapper.text()).toContain("已添加图层：public.china_2025_city");
    expect(wrapper.text()).toContain("活动图层:public.china_2025_city");
    expect(wrapper.text()).toContain("编辑:关闭");
    expect(wrapper.find(".edit-inspector").exists()).toBe(false);
    expect(editorMock.zoomToLayerExtent).toHaveBeenCalledWith("city");

    await wrapper.findAll(".datasource-panel__tree-node--layer")
      .find((button) => button.text().includes("public.china_2025_city"))
      ?.trigger("dblclick");
    await flushPromises();

    expect(wrapper.findAll(".layer-panel__row")).toHaveLength(1);
    expect(wrapper.text()).toContain("已激活图层：public.china_2025_city");
  });

  it("shows a scanning state instead of an empty spatial table message while a datasource scan is running", async () => {
    const wrapper = mount(DatasourcePanel, {
      props: {
        datasources: sampleDatasources,
        availableLayers: [],
        loadedLayerIds: new Set<string>(),
        busy: false,
        connectionDialogRequestKey: 0,
        form: sampleDatasourceForm,
        "onUpdate:form": () => undefined
      }
    });

    await wrapper.find(".datasource-panel__tree-node--source").trigger("click");
    await wrapper.setProps({ busy: true });

    expect(wrapper.text()).toContain("正在扫描空间表...");
    expect(wrapper.text()).not.toContain("暂无空间表");
    expect(wrapper.text()).not.toContain("未扫描到空间表");
    expect(wrapper.emitted("scan")?.[0]).toEqual(["local"]);
  });

  it("loads spatial tables when dropped on the map canvas or layer panel", async () => {
    const wrapper = mount(WebGisWorkbench);
    await flushPromises();
    await expandDatasource(wrapper);

    const mapDragOver = createLayerDragOverEventWithProtectedData("city");
    wrapper.find(".map-canvas__map").element.dispatchEvent(mapDragOver);
    expect(mapDragOver.defaultPrevented).toBe(true);
    wrapper.find(".map-canvas__map").element.dispatchEvent(createLayerDragEvent("drop", "city"));
    await flushPromises();

    expect(wrapper.findAll(".layer-panel__row")).toHaveLength(1);
    expect(wrapper.text()).toContain("public.china_2025_city");
    expect(editorMock.zoomToLayerExtent).toHaveBeenCalledWith("city");

    const layerPanelDragOver = createLayerDragOverEventWithProtectedData("province");
    const provinceSourceLayer = wrapper.findAll(".datasource-panel__tree-node--layer")
      .find((button) => button.text().includes("public.china_2025_province"));
    expect(provinceSourceLayer?.exists()).toBe(true);
    provinceSourceLayer?.element.dispatchEvent(createLayerDragEvent("dragstart", "province"));
    await flushPromises();

    wrapper.find(".layer-panel__dock").element.dispatchEvent(layerPanelDragOver);
    expect(layerPanelDragOver.defaultPrevented).toBe(true);
    wrapper.find(".layer-panel__dock").element.dispatchEvent(createProtectedLayerDragEvent("drop"));
    await flushPromises();

    expect(wrapper.findAll(".layer-panel__row")).toHaveLength(2);
    expect(wrapper.text()).toContain("public.china_2025_province");
    expect(editorMock.zoomToLayerExtent).toHaveBeenCalledWith("province");
  });

  it("wires toolbar tools to existing map and workspace actions", async () => {
    const wrapper = mount(WebGisWorkbench);
    await flushPromises();
    await loadLayerByDoubleClick(wrapper, "public.china_2025_province");
    await loadLayerByDoubleClick(wrapper);

    const tools = wrapper.findAll(".workbench__tool");
    const editTool = tools.find((tool) => tool.attributes("title") === "开启当前图层编辑");
    const selectTool = tools.find((tool) => tool.attributes("title")?.includes("右键切换选择方式"));
    const drawPointTool = tools.find((tool) => tool.attributes("title") === "绘制点要素");
    const drawPolygonTool = tools.find((tool) => tool.attributes("title") === "绘制面要素");
    const zoomTool = tools.find((tool) => tool.attributes("title") === "放大一级");
    const snapTool = tools.find((tool) => tool.attributes("title") === "切换吸附");

    expect(editTool?.exists()).toBe(true);
    expect(selectTool?.exists()).toBe(true);
    expect(wrapper.find(".workbench__tool-split").exists()).toBe(false);
    expect(drawPointTool?.attributes("disabled")).toBeDefined();
    expect(drawPolygonTool?.attributes("disabled")).toBeDefined();
    expect(zoomTool?.exists()).toBe(true);
    expect(snapTool?.exists()).toBe(true);
    expect(wrapper.text()).toContain("编辑:");
    expect(wrapper.text()).toContain("关闭");
    expect(wrapper.find(".edit-inspector").exists()).toBe(false);
    expect(wrapper.find(".map-canvas__toolbar").exists()).toBe(false);

    await editTool?.trigger("click");
    await flushPromises();

    const activeEditTool = wrapper.findAll(".workbench__tool")
      .find((tool) => tool.attributes("title") === "关闭当前图层编辑");
    const enabledDrawPointTool = wrapper.findAll(".workbench__tool")
      .find((tool) => tool.attributes("title") === "绘制点要素");
    const enabledDrawPolygonTool = wrapper.findAll(".workbench__tool")
      .find((tool) => tool.attributes("title") === "绘制面要素");
    expect(activeEditTool?.classes()).toContain("workbench__tool--active");
    expect(enabledDrawPointTool?.attributes("disabled")).toBeDefined();
    expect(enabledDrawPolygonTool?.attributes("disabled")).toBeUndefined();
    expect(wrapper.text()).toContain("编辑中");
    expect(wrapper.find(".edit-inspector").exists()).toBe(true);
    expect(wrapper.find(".map-canvas__toolbar").exists()).toBe(true);
    expect(wrapper.text()).toContain("属性表单");

    await selectTool?.trigger("click");
    await selectTool?.trigger("contextmenu");
    await flushPromises();
    expect(wrapper.text()).toContain("范围选择");
    expect(wrapper.findAll(".workbench__selection-icon")).toHaveLength(3);
    expect(wrapper.find(".workbench__selection-description").exists()).toBe(false);
    await wrapper.findAll(".workbench__selection-command")[1].trigger("click");
    await flushPromises();
    await selectTool?.trigger("contextmenu");
    await flushPromises();
    await wrapper.findAll(".workbench__selection-command")[2].trigger("click");
    await flushPromises();
    await enabledDrawPolygonTool?.trigger("click");
    await zoomTool?.trigger("click");
    await snapTool?.trigger("click");

    expect(editorMock.activateSelectionMode).toHaveBeenCalledWith("click");
    expect(editorMock.activateSelectionMode).toHaveBeenCalledWith("extent");
    expect(editorMock.activateSelectionMode).toHaveBeenCalledWith("customExtent");
    expect(editorMock.startDrawing).toHaveBeenCalledWith("Polygon");
    expect(editorMock.zoomIn).toHaveBeenCalled();
    expect(editorMock.activateTool).not.toHaveBeenCalledWith("zoom");
    expect(editorMock.toggleSnap).toHaveBeenCalled();

    await wrapper.findAll(".layer-panel__select")[0].trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("已切换图层，编辑模式已关闭");
    expect(wrapper.text()).toContain("关闭");
    expect(wrapper.find(".edit-inspector").exists()).toBe(false);
    expect(wrapper.find(".map-canvas__toolbar").exists()).toBe(false);
    expect(wrapper.findAll(".workbench__tool")
      .find((tool) => tool.attributes("title") === "绘制面要素")
      ?.attributes("disabled")).toBeDefined();
  });

  it("supports QGIS-style layer context editing and removal", async () => {
    const wrapper = mount(WebGisWorkbench, {
      attachTo: document.body
    });
    await flushPromises();
    await loadLayerByDoubleClick(wrapper, "public.china_2025_province");
    await loadLayerByDoubleClick(wrapper, "public.china_2025_city");

    expect(wrapper.find(".edit-inspector").exists()).toBe(false);

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });

    expect(document.body.textContent).toContain("开启编辑");
    expect(document.body.textContent).toContain("移除图层");
    contextMenuItem("开启编辑")?.click();
    await flushPromises();

    expect(wrapper.text()).toContain("已开启图层编辑：public.china_2025_city");
    expect(wrapper.find(".edit-inspector").exists()).toBe(true);
    expect(wrapper.text()).toContain("编辑中");

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });

    expect(document.body.textContent).toContain("关闭编辑");
    contextMenuItem("关闭编辑")?.click();
    await flushPromises();

    expect(wrapper.text()).toContain("已关闭图层编辑：public.china_2025_city");
    expect(wrapper.find(".edit-inspector").exists()).toBe(false);

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });
    contextMenuItem("开启编辑")?.click();
    await flushPromises();
    expect(wrapper.find(".edit-inspector").exists()).toBe(true);

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });
    contextMenuItem("移除图层")?.click();
    await flushPromises();

    expect(wrapper.findAll(".layer-panel__row")).toHaveLength(1);
    expect(wrapper.text()).toContain("已移除图层：public.china_2025_city");
    expect(wrapper.text()).not.toContain("活动图层:public.china_2025_city");
    expect(wrapper.find(".edit-inspector").exists()).toBe(false);

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("renders live map status labels from the OpenLayers editor", () => {
    const wrapper = mount(WebGisWorkbench);
    const statusbar = wrapper.find(".workbench__statusbar");
    const crsButton = statusbar.find("button[aria-label='当前项目显示坐标系']");

    expect(wrapper.text()).toContain("坐标 104.06480, 30.65720 / EPSG:4326");
    expect(wrapper.text()).toContain("比例尺 1:2,500");
    expect(wrapper.text()).toContain("Zoom 7.25");
    expect(wrapper.text()).not.toContain("EPSG:4326 显示 / EPSG:4326 数据源");
    expect(wrapper.find(".workbench__contextbar select[aria-label='当前项目显示坐标系']").exists()).toBe(false);
    expect(statusbar.find("select[aria-label='当前项目显示坐标系']").exists()).toBe(false);
    expect(crsButton.exists()).toBe(true);
    expect(crsButton.text()).toBe("EPSG:3857");
  });

  it("opens QGIS-style CRS settings from the bottom status bar", async () => {
    const wrapper = mount(WebGisWorkbench, {
      attachTo: document.body
    });
    await flushPromises();

    await wrapper.find(".workbench__status-crs-button").trigger("click");
    await flushPromises();

    expect(document.body.textContent).toContain("工程坐标参照系 (CRS)");
    expect(document.body.textContent).toContain("最近使用的坐标参照系");
    expect(document.body.textContent).toContain("坐标参照系");
    expect(document.body.textContent).toContain("地方坐标系");
    expect(document.body.textContent).toContain("坐标显示");
    expect(document.body.textContent).toContain("WGS 84 / Pseudo-Mercator");
    expect(apiGet).toHaveBeenCalledWith(expect.stringContaining("/api/crs/search?"));

    const axisSelect = document.querySelectorAll<HTMLSelectElement>(".workbench__crs-select")[0];
    expect(axisSelect).not.toBeNull();
    setNativeInputValue(axisSelect!, "yx");
    axisSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();

    Array.from(document.querySelectorAll<HTMLButtonElement>(".workbench__dialog-button"))
      .find((button) => button.textContent?.trim() === "确定")
      ?.click();
    await flushPromises();

    expect(wrapper.text()).toContain("坐标显示已更新：EPSG:3857，Y,X · 5 位小数");

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("opens a map context menu and copies coordinate, scale, and zoom labels", async () => {
    const wrapper = mount(WebGisWorkbench, {
      attachTo: document.body
    });
    await flushPromises();

    await wrapper.find(".map-canvas__map").trigger("contextmenu", {
      clientX: 260,
      clientY: 220
    });

    expect(document.body.textContent).toContain("复制坐标");
    document.querySelectorAll<HTMLButtonElement>(".map-canvas__context-item")[0].click();
    await flushPromises();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("坐标 104.06480, 30.65720 / EPSG:4326");
    expect(wrapper.text()).toContain("已复制坐标");

    await wrapper.find(".map-canvas__map").trigger("contextmenu", {
      clientX: 260,
      clientY: 220
    });
    document.querySelectorAll<HTMLButtonElement>(".map-canvas__context-item")[1].click();
    await flushPromises();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("比例尺 1:2,500");

    await wrapper.find(".map-canvas__map").trigger("contextmenu", {
      clientX: 260,
      clientY: 220
    });
    document.querySelectorAll<HTMLButtonElement>(".map-canvas__context-item")[2].click();
    await flushPromises();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Zoom 7.25");

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("can show only the active layer and then show all layers from the layer menu", async () => {
    const wrapper = mount(WebGisWorkbench);
    await flushPromises();
    await loadLayerByDoubleClick(wrapper, "public.china_2025_province");
    await loadLayerByDoubleClick(wrapper, "public.china_2025_city");

    await wrapper.findAll(".workbench__menu-item")
      .find((item) => item.text() === "图层")
      ?.trigger("click");
    await wrapper.findAll(".workbench__menu-command")
      .find((item) => item.text() === "仅显示当前图层")
      ?.trigger("click");

    let visibilityInputs = wrapper.findAll<HTMLInputElement>(".layer-panel__visibility input");
    expect(visibilityInputs[0].element.checked).toBe(false);
    expect(visibilityInputs[1].element.checked).toBe(true);

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
    await loadLayerByDoubleClick(wrapper, "public.china_2025_province");
    await loadLayerByDoubleClick(wrapper, "public.china_2025_city");

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
    await loadLayerByDoubleClick(wrapper, "public.china_2025_province");
    await loadLayerByDoubleClick(wrapper, "public.china_2025_city");

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });

    expect(document.body.textContent).toContain("独显图层");
    expect(document.body.textContent).toContain("缩放到图层");
    expect(document.body.textContent).toContain("刷新图层");
    expect(document.body.textContent).toContain("打开属性表");
    expect(document.body.textContent).toContain("图层样式");
    expect(document.body.textContent).toContain("开启编辑");
    expect(document.body.textContent).toContain("移除图层");
    expect(document.querySelector(".workbench__style-dialog")).toBeNull();
    expect(wrapper.find(".layer-panel__style-card").exists()).toBe(false);

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

    expect(editorMock.refreshLayer).toHaveBeenCalledWith("city");
    expect(wrapper.text()).toContain("已刷新图层：public.china_2025_city");

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });
    await document.querySelectorAll<HTMLButtonElement>(".layer-panel__context-item")[4].click();
    await flushPromises();

    expect(wrapper.text()).toContain("已打开属性表：public.china_2025_city");
    expect(document.body.textContent).toContain("属性表 - public.china_2025_city");
    expect(document.body.textContent).toContain("2/128 条记录");
    expect(document.body.textContent).toContain("成都市");
    expect(document.body.textContent).toContain("绵阳市");
    const attributeTable = document.querySelector<HTMLElement>(".attribute-table");
    expect(attributeTable).not.toBeNull();
    expect(attributeTable?.parentElement).toBe(document.body);
    expect(attributeTable?.className).toContain("attribute-table");
    expect(getComputedStyle(attributeTable!).position).toBe("fixed");
    expect(attributeTable!.getAttribute("style")).toContain("left:");
    expect(document.querySelector(".attribute-table__header")).not.toBeNull();
    expect(document.body.textContent).toContain("1-2 / 128 条记录");
    expect(document.body.textContent).toContain("第 1/2 页");
    let tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".attribute-table__tab"));
    expect(tabs[0].classList.contains("attribute-table__tab--active")).toBe(true);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].classList.contains("attribute-table__tab--active")).toBe(false);
    expect(tabs[2].textContent).toContain("属性计算器");
    expect(tabs[3].textContent).toContain("SQL 查询");

    Array.from(document.querySelectorAll<HTMLButtonElement>(".attribute-table__pager-button"))
      .find((button) => button.textContent?.trim() === "下一页")
      ?.click();
    await flushPromises();

    expect(vi.mocked(apiGet)).toHaveBeenCalledWith(expect.stringContaining("offset=100"));
    expect(document.body.textContent).toContain("101-102 / 128 条记录");

    document.querySelector<HTMLButtonElement>(".attribute-table__record-sort")?.click();
    await flushPromises();

    expect(vi.mocked(apiGet)).toHaveBeenCalledWith(expect.stringContaining("sort=id"));
    expect(vi.mocked(apiGet)).toHaveBeenCalledWith(expect.stringContaining("order=desc"));

    const recordFilter = document.querySelector<HTMLInputElement>(".attribute-table__filter-input");
    expect(recordFilter).not.toBeNull();
    recordFilter!.value = "绵阳";
    recordFilter!.dispatchEvent(new Event("input"));
    Array.from(document.querySelectorAll<HTMLButtonElement>(".attribute-table__pager-button"))
      .find((button) => button.textContent?.trim() === "查询")
      ?.click();
    await flushPromises();

    expect(document.body.textContent).toContain("1/1 条记录");
    expect(document.body.textContent).toContain("绵阳市");
    expect(document.body.textContent).not.toContain("成都市");

    await document.querySelectorAll<HTMLButtonElement>(".attribute-table__tab")[1].click();
    await flushPromises();
    tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".attribute-table__tab"));
    expect(tabs[0].classList.contains("attribute-table__tab--active")).toBe(false);
    expect(tabs[0].getAttribute("aria-selected")).toBe("false");
    expect(tabs[1].classList.contains("attribute-table__tab--active")).toBe(true);
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");

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

    await document.querySelectorAll<HTMLButtonElement>(".attribute-table__tab")[2].click();
    await flushPromises();
    expect(document.body.textContent).toContain("字段和值");
    expect(document.body.textContent).toContain("输出字段");
    expect(document.body.textContent).toContain("预览 SQL");
    document.querySelector<HTMLButtonElement>(".attribute-table__calculator-item")?.click();
    await flushPromises();
    const targetSelect = document.querySelector<HTMLSelectElement>(".attribute-table__tool-input");
    expect(targetSelect).not.toBeNull();
    setNativeInputValue(targetSelect!, "name");
    targetSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    const expressionInput = document.querySelector<HTMLTextAreaElement>(".attribute-table__tool-textarea--expression");
    expect(expressionInput).not.toBeNull();
    setNativeInputValue(expressionInput!, "upper(\"name\")");
    expressionInput!.dispatchEvent(new InputEvent("input", { bubbles: true, data: "upper(\"name\")" }));
    await flushPromises();
    expect(document.querySelector<HTMLTextAreaElement>(".attribute-table__tool-textarea--preview")?.value)
      .toContain("UPDATE public.china_2025_city");
    const calculateButton = document.querySelector<HTMLButtonElement>(".attribute-table__calculator-run");
    expect(calculateButton?.disabled).toBe(false);
    calculateButton?.click();
    await flushPromises();

    expect(vi.mocked(apiSend)).toHaveBeenCalledWith("/api/layers/city/calculate", "POST", {
      targetField: "name",
      expression: "upper(\"name\")",
      where: undefined
    });
    expect(wrapper.text()).toContain("属性计算完成：name 更新 2 行");

    await document.querySelectorAll<HTMLButtonElement>(".attribute-table__tab")[3].click();
    await flushPromises();
    expect(document.body.textContent).toContain("仅允许当前图层的单条 SELECT");
    Array.from(document.querySelectorAll<HTMLButtonElement>(".attribute-table__pager-button"))
      .find((button) => button.textContent?.trim() === "执行 SQL")
      ?.click();
    await flushPromises();

    expect(vi.mocked(apiSend)).toHaveBeenCalledWith("/api/layers/city/query", "POST", {
      sql: "select * from {layer}",
      limit: 100
    });
    expect(document.body.textContent).toContain("SQL 查询完成：返回 1 条记录");
    expect(document.body.textContent).toContain("成都市");

    await document.querySelector<HTMLButtonElement>(".attribute-table__close")?.click();
    await flushPromises();

    expect(document.body.textContent).not.toContain("属性表 - public.china_2025_city");

    await wrapper.findAll(".layer-panel__row")[1].trigger("contextmenu", {
      clientX: 160,
      clientY: 260
    });
    await document.querySelectorAll<HTMLButtonElement>(".layer-panel__context-item")[5].click();
    await flushPromises();

    const styleDialog = document.querySelector<HTMLElement>(".workbench__style-dialog");
    expect(styleDialog).not.toBeNull();
    expect(styleDialog?.textContent).toContain("图层样式");
    expect(styleDialog?.textContent).toContain("public.china_2025_city");
    expect(styleDialog?.textContent).toContain("MultiPolygon · 60%");

    const fillInput = document.querySelector<HTMLInputElement>(".workbench__style-swatch");
    expect(fillInput).not.toBeNull();
    fillInput!.value = "#123456";
    fillInput!.dispatchEvent(new Event("change"));
    await flushPromises();

    expect(vi.mocked(apiSend)).toHaveBeenCalledWith("/api/layers/city/style", "PUT", { fill: "#123456" });
    expect(document.body.textContent).toContain("已更新图层样式：public.china_2025_city");

    await document.querySelector<HTMLButtonElement>(".workbench__dialog-button")?.click();
    await flushPromises();
    expect(document.querySelector(".workbench__style-dialog")).toBeNull();

    wrapper.unmount();
    document.body.innerHTML = "";
  });
});
