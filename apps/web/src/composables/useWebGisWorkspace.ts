import { computed, reactive, shallowRef } from "vue";
import { useTitle } from "@vueuse/core";
import { apiGet, apiSend } from "../api";
import { getEditableFields, getLayerStatus, isPostgisLayer } from "../utils/layer";
import type {
  Datasource,
  DatasourceForm,
  DirtyTile,
  AttributeTableQuery,
  AttributeCalculationPayload,
  AttributeCalculationResult,
  CrsDefinition,
  CustomCrsPayload,
  FeatureDeleteResult,
  FeaturePage,
  FeatureSelectionResult,
  FeatureSummary,
  FeatureWriteResult,
  GeoJsonFeature,
  LayerRegistration,
  LayerStylePatch,
  SqlQueryResult,
  StatusMessage,
  WebServiceConnection,
  WebServiceConnectionPayload
} from "../types/gis";

const defaultDatasourceForm = (): DatasourceForm => ({
  name: "Local PostGIS",
  host: "localhost",
  port: 5432,
  database: "postgis",
  user: "postgres",
  password: "",
  ssl: false
});

export function useWebGisWorkspace() {
  useTitle("WebQGIS 工作台");

  const datasources = shallowRef<Datasource[]>([]);
  const postgisLayers = shallowRef<LayerRegistration[]>([]);
  const webLayers = shallowRef<LayerRegistration[]>([
    createWebLayer({
      id: "web-xyz-openstreetmap",
      type: "xyz",
      name: "OpenStreetMap",
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    })
  ]);
  const webServiceConnections = shallowRef<WebServiceConnection[]>([
    {
      id: "xyz-openstreetmap",
      type: "xyz",
      name: "OpenStreetMap",
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    }
  ]);
  const loadedLayerIds = shallowRef(new Set<string>());
  const activeLayerId = shallowRef("");
  const visibleLayerIds = shallowRef(new Set<string>());
  const previousVisibleLayerIds = shallowRef<Set<string> | null>(null);
  const busy = shallowRef(false);
  const status = shallowRef<StatusMessage>({ text: "就绪", tone: "neutral" });
  const selectedFeatureId = shallowRef<string | null>(null);
  const selectedProperties = shallowRef<Record<string, unknown>>({});
  const draftGeometry = shallowRef<unknown>(null);
  const isDraftDirty = shallowRef(false);
  const lastDirtyTiles = shallowRef<DirtyTile[]>([]);
  const displayProjection = shallowRef("EPSG:3857");
  const crsCatalog = shallowRef<CrsDefinition[]>([]);
  const customCrsCatalog = shallowRef<CrsDefinition[]>([]);
  const attributeTableFeatures = shallowRef<FeatureSummary[]>([]);
  const attributeTableTotal = shallowRef(0);
  const attributeSqlResult = shallowRef<SqlQueryResult | null>(null);
  const attributeTableQuery = shallowRef<AttributeTableQuery>({
    limit: 100,
    offset: 0,
    search: "",
    sort: undefined,
    order: "asc"
  });
  const attributeTableLayerId = shallowRef<string | null>(null);
  const datasourceForm = reactive(defaultDatasourceForm());

  const availableLayers = computed(() => [...postgisLayers.value, ...webLayers.value]);
  const layers = computed(() => availableLayers.value.filter((layer) => loadedLayerIds.value.has(layer.id)));
  const activeLayer = computed(() => layers.value.find((layer) => layer.id === activeLayerId.value));
  const editableFields = computed(() => getEditableFields(activeLayer.value));
  const selectedLayerStatus = computed(() => getLayerStatus(activeLayer.value));
  const hasUnsavedEditDraft = computed(() => Boolean(draftGeometry.value) && isDraftDirty.value);
  const visibleLayers = computed(() => layers.value.filter((layer) => visibleLayerIds.value.has(layer.id)));
  const attributeTableLayer = computed(() => (
    layers.value.find((layer) => layer.id === attributeTableLayerId.value) ?? null
  ));
  const canRestoreVisibleLayerIds = computed(() => Boolean(previousVisibleLayerIds.value?.size));
  const registeredLayerCount = computed(() => availableLayers.value.length);
  const editableLayerCount = computed(() => layers.value.filter((layer) => layer.editable).length);

  function setStatus(text: string, tone: StatusMessage["tone"] = "neutral") {
    status.value = { text, tone };
  }

  function replaceVisibleLayerIds(next: Set<string>) {
    visibleLayerIds.value = new Set(next);
  }

  function replaceLoadedLayerIds(next: Set<string>) {
    loadedLayerIds.value = new Set(next);
  }

  function reconcileLoadedLayers(nextAvailableLayers: LayerRegistration[]) {
    const availableIds = new Set(nextAvailableLayers.map((layer) => layer.id));
    const nextLoaded = new Set([...loadedLayerIds.value].filter((layerId) => availableIds.has(layerId)));
    const nextVisible = new Set([...visibleLayerIds.value].filter((layerId) => nextLoaded.has(layerId)));
    replaceLoadedLayerIds(nextLoaded);
    replaceVisibleLayerIds(nextVisible);
    if (activeLayerId.value && !nextLoaded.has(activeLayerId.value)) {
      activeLayerId.value = nextLoaded.values().next().value ?? "";
      clearDraftState();
    }
  }

  function rememberVisibleLayerIds() {
    previousVisibleLayerIds.value = new Set(visibleLayerIds.value);
  }

  function setSelectedFeature(feature: GeoJsonFeature, fallbackId?: string) {
    selectedFeatureId.value = String(feature.id ?? fallbackId ?? "");
    selectedProperties.value = { ...(feature.properties ?? {}) };
    isDraftDirty.value = false;
  }

  function clearDraftState() {
    selectedFeatureId.value = null;
    selectedProperties.value = {};
    draftGeometry.value = null;
    isDraftDirty.value = false;
  }

  function clearSelectedFeatureState() {
    selectedFeatureId.value = null;
    selectedProperties.value = {};
  }

  function markDraftDirty() {
    isDraftDirty.value = true;
  }

  function markDraftClean() {
    isDraftDirty.value = false;
  }

  function consumeLastDirtyTiles() {
    const current = lastDirtyTiles.value;
    lastDirtyTiles.value = [];
    return current;
  }

  function applyLayerTileVersion(layerId: string, tileVersion: number) {
    postgisLayers.value = postgisLayers.value.map((layer) => (
      layer.id === layerId
        ? {
            ...layer,
            tileVersion,
            sourceType: layer.sourceType ?? "postgis"
          }
        : layer
    ));
  }

  function setDisplayProjection(nextProjection: string) {
    displayProjection.value = nextProjection;
    setStatus(`当前显示坐标系已切换为 ${nextProjection}`, "success");
  }

  async function searchCrsCatalog(search = "") {
    const params = new URLSearchParams({
      q: search,
      limit: "40"
    });
    const items = await apiGet<CrsDefinition[]>(`/api/crs/search?${params.toString()}`);
    crsCatalog.value = items;
    return items;
  }

  async function refreshCustomCrsCatalog() {
    const items = await apiGet<CrsDefinition[]>("/api/crs/custom");
    customCrsCatalog.value = items;
    return items;
  }

  async function saveCustomCrs(payload: CustomCrsPayload, id?: string) {
    const item = id
      ? await apiSend<CrsDefinition>(`/api/crs/custom/${id}`, "PUT", payload)
      : await apiSend<CrsDefinition>("/api/crs/custom", "POST", payload);
    await Promise.all([
      refreshCustomCrsCatalog(),
      searchCrsCatalog("")
    ]);
    setStatus(`已保存自定义坐标系：${item.code}`, "success");
    return item;
  }

  async function deleteCustomCrs(id: string) {
    await apiSend<void>(`/api/crs/custom/${id}`, "DELETE");
    await Promise.all([
      refreshCustomCrsCatalog(),
      searchCrsCatalog("")
    ]);
    setStatus("已删除自定义坐标系", "success");
  }

  async function withBusy<T>(task: () => Promise<T>): Promise<T | undefined> {
    busy.value = true;
    try {
      return await task();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "操作失败", "danger");
      return undefined;
    } finally {
      busy.value = false;
    }
  }

  async function refreshAll() {
    await withBusy(async () => {
      const [nextDatasources, nextAvailableLayers] = await Promise.all([
        apiGet<Datasource[]>("/api/datasources"),
        apiGet<LayerRegistration[]>("/api/layers"),
        searchCrsCatalog(""),
        refreshCustomCrsCatalog()
      ]);
      datasources.value = nextDatasources;
      postgisLayers.value = nextAvailableLayers.map((layer) => ({
        ...layer,
        sourceType: layer.sourceType ?? "postgis"
      }));
      reconcileLoadedLayers([...postgisLayers.value, ...webLayers.value]);
      setStatus("已刷新数据源和空间表目录", "success");
    });
  }

  async function saveDatasource() {
    await withBusy(async () => {
      const datasource = await apiSend<Datasource>("/api/datasources", "POST", datasourceForm);
      datasources.value = [...datasources.value, datasource];
      setStatus(`已保存数据源：${datasource.name}`, "success");
    });
  }

  async function scanDatasource(datasourceId: string) {
    await withBusy(async () => {
      const result = await apiSend<{ layers: LayerRegistration[] }>(
        `/api/datasources/${datasourceId}/scan`,
        "POST"
      );
      const nextAvailableLayers = await apiGet<LayerRegistration[]>("/api/layers");
      postgisLayers.value = nextAvailableLayers.map((layer) => ({
        ...layer,
        sourceType: layer.sourceType ?? "postgis"
      }));
      reconcileLoadedLayers([...postgisLayers.value, ...webLayers.value]);
      setStatus(`扫描完成：${result.layers.length} 个空间表，可拖入地图添加图层`, "success");
    });
  }

  function loadLayer(layerId: string) {
    const layer = availableLayers.value.find((item) => item.id === layerId);
    if (!layer) {
      setStatus("未找到要加载的空间表", "warning");
      return undefined;
    }
    const wasLoaded = loadedLayerIds.value.has(layer.id);
    replaceLoadedLayerIds(new Set([...loadedLayerIds.value, layer.id]));
    replaceVisibleLayerIds(new Set([...visibleLayerIds.value, layer.id]));
    activeLayerId.value = layer.id;
    clearDraftState();
    setStatus(
      wasLoaded
        ? `已激活图层：${layer.schema}.${layer.table}`
        : `已添加图层：${layer.schema}.${layer.table}`,
      "success"
    );
    return layer;
  }

  function removeLayer(layerId: string) {
    const layer = layers.value.find((item) => item.id === layerId);
    if (!layer) {
      setStatus("未找到要移除的图层", "warning");
      return undefined;
    }
    const nextLoaded = new Set(loadedLayerIds.value);
    nextLoaded.delete(layer.id);
    replaceLoadedLayerIds(nextLoaded);
    replaceVisibleLayerIds(new Set([...visibleLayerIds.value].filter((visibleLayerId) => visibleLayerId !== layer.id)));
    previousVisibleLayerIds.value = previousVisibleLayerIds.value
      ? new Set([...previousVisibleLayerIds.value].filter((visibleLayerId) => visibleLayerId !== layer.id))
      : null;
    if (attributeTableLayerId.value === layer.id) {
      closeAttributeTable();
    }
    if (activeLayerId.value === layer.id) {
      activeLayerId.value = nextLoaded.values().next().value ?? "";
      clearDraftState();
    }
    setStatus(`已移除图层：${layer.schema}.${layer.table}`, "success");
    return layer;
  }

  function setActiveLayer(layerId: string) {
    activeLayerId.value = layerId;
    clearDraftState();
  }

  function toggleLayer(layerId: string) {
    const nextVisible = new Set(visibleLayerIds.value);
    if (nextVisible.has(layerId)) {
      nextVisible.delete(layerId);
    } else {
      nextVisible.add(layerId);
    }
    replaceVisibleLayerIds(nextVisible);
  }

  function showOnlyLayer(layerId: string) {
    const layer = layers.value.find((item) => item.id === layerId);
    if (!layer) {
      setStatus("请先选择一个可显示的图层", "warning");
      return false;
    }
    rememberVisibleLayerIds();
    activeLayerId.value = layer.id;
    clearDraftState();
    replaceVisibleLayerIds(new Set([layer.id]));
    setStatus(`已仅显示图层：${layer.schema}.${layer.table}`, "success");
    return true;
  }

  function showAllLayers() {
    if (layers.value.length === 0) {
      setStatus("暂无可显示的图层", "warning");
      return false;
    }
    rememberVisibleLayerIds();
    replaceVisibleLayerIds(new Set(layers.value.map((layer) => layer.id)));
    setStatus(`已显示全部 ${layers.value.length} 个图层`, "success");
    return true;
  }

  function restorePreviousVisibleLayers() {
    if (!previousVisibleLayerIds.value?.size) {
      setStatus("暂无可恢复的图层可见性", "warning");
      return false;
    }
    const availableIds = new Set(layers.value.map((layer) => layer.id));
    const restored = new Set([...previousVisibleLayerIds.value].filter((layerId) => availableIds.has(layerId)));
    if (restored.size === 0) {
      previousVisibleLayerIds.value = null;
      setStatus("上一组可见图层已不存在", "warning");
      return false;
    }
    replaceVisibleLayerIds(restored);
    previousVisibleLayerIds.value = null;
    setStatus(`已恢复 ${restored.size} 个图层的可见性`, "success");
    return true;
  }

  async function readFeature(layerId: string, pk: string) {
    const layer = layers.value.find((item) => item.id === layerId);
    if (!layer?.queryable || !isPostgisLayer(layer)) {
      setStatus("当前图层不可查询", "warning");
      return undefined;
    }
    activeLayerId.value = layer.id;
    return withBusy(async () => {
      const feature = await apiGet<GeoJsonFeature>(`/api/layers/${layer.id}/features/${pk}`);
      setSelectedFeature(feature, pk);
      setStatus(`已读取原始要素 ${pk}`, "success");
      return feature;
    });
  }

  function buildFeaturePageUrl(layerId: string, query: AttributeTableQuery) {
    const params = new URLSearchParams({
      limit: String(query.limit),
      offset: String(query.offset),
      search: query.search,
      order: query.order
    });
    if (query.sort) {
      params.set("sort", query.sort);
    }
    if (query.ids?.length) {
      params.set("ids", query.ids.join(","));
    }
    return `/api/layers/${layerId}/features?${params.toString()}`;
  }

  async function loadAttributeTablePage(layerId: string, query: AttributeTableQuery) {
    const page = await apiGet<FeaturePage>(buildFeaturePageUrl(layerId, query));
    attributeTableFeatures.value = page.items;
    attributeTableTotal.value = page.total;
    attributeSqlResult.value = null;
    attributeTableQuery.value = {
      ...query,
      limit: page.limit,
      offset: page.offset
    };
    return page;
  }

  async function openAttributeTable(layerId: string, queryPatch: Partial<AttributeTableQuery> = {}) {
    const layer = layers.value.find((item) => item.id === layerId);
    if (!layer?.queryable || !isPostgisLayer(layer)) {
      setStatus("当前图层不可打开属性表", "warning");
      return;
    }
    activeLayerId.value = layer.id;
    const nextQuery: AttributeTableQuery = {
      limit: 100,
      offset: 0,
      search: "",
      sort: layer.primaryKey ?? undefined,
      order: "asc",
      ...queryPatch
    };
    await withBusy(async () => {
      const page = await loadAttributeTablePage(layer.id, nextQuery);
      attributeTableLayerId.value = layer.id;
      setStatus(`已打开属性表：${layer.schema}.${layer.table}，读取 ${page.items.length}/${page.total} 条属性`, "success");
    });
  }

  async function openAttributeTableForFeatureIds(layerId: string, featureIds: string[]) {
    const ids = [...new Set(featureIds.map((id) => String(id).trim()).filter(Boolean))];
    if (ids.length === 0) {
      setStatus("选择范围内没有可查询要素", "warning");
      return;
    }
    await openAttributeTable(layerId, {
      ids,
      limit: Math.min(500, Math.max(100, ids.length)),
      offset: 0,
      search: ""
    });
    setStatus(`范围选择完成：匹配 ${ids.length} 个要素，已在属性表中显示`, "success");
  }

  async function selectFeatureIdsByGeometry(layerId: string, geometry: unknown) {
    const layer = layers.value.find((item) => item.id === layerId);
    if (!layer?.queryable || !isPostgisLayer(layer)) {
      setStatus("当前图层不可执行范围选择", "warning");
      return { ids: [], features: [], total: 0, limit: 0 } satisfies FeatureSelectionResult;
    }
    activeLayerId.value = layer.id;
    busy.value = true;
    try {
      return await apiSend<FeatureSelectionResult>(
        `/api/layers/${layer.id}/features/select`,
        "POST",
        { geometry, limit: 500 }
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "范围选择失败", "danger");
      throw error;
    } finally {
      busy.value = false;
    }
  }

  async function updateAttributeTableQuery(queryPatch: Partial<AttributeTableQuery>) {
    const layer = attributeTableLayer.value;
    if (!layer) {
      return;
    }
    const nextQuery: AttributeTableQuery = {
      ...attributeTableQuery.value,
      ...queryPatch
    };
    await withBusy(async () => {
      const page = await loadAttributeTablePage(layer.id, nextQuery);
      setStatus(`已刷新属性表：${layer.schema}.${layer.table}，读取 ${page.items.length}/${page.total} 条属性`, "success");
    });
  }

  async function runLayerSqlQuery(layerId: string, sql: string, limit: number) {
    const layer = layers.value.find((item) => item.id === layerId);
    if (!layer?.queryable || !isPostgisLayer(layer)) {
      setStatus("当前图层不可执行 SQL 查询", "warning");
      return undefined;
    }
    return withBusy(async () => {
      const result = await apiSend<SqlQueryResult>(`/api/layers/${layer.id}/query`, "POST", { sql, limit });
      attributeSqlResult.value = result;
      setStatus(`SQL 查询完成：返回 ${result.rows.length} 条记录`, "success");
      return result;
    });
  }

  async function calculateLayerAttribute(layerId: string, payload: AttributeCalculationPayload) {
    const layer = layers.value.find((item) => item.id === layerId);
    if (!layer?.editable || !isPostgisLayer(layer)) {
      setStatus("当前图层不可执行属性计算", "warning");
      return undefined;
    }
    return withBusy(async () => {
      const result = await apiSend<AttributeCalculationResult>(`/api/layers/${layer.id}/calculate`, "POST", payload);
      await updateAttributeTableQuery({ offset: 0 });
      setStatus(`属性计算完成：${result.targetField} 更新 ${result.affectedRows} 行`, "success");
      return result;
    });
  }

  function closeAttributeTable() {
    attributeTableLayerId.value = null;
    attributeTableFeatures.value = [];
    attributeTableTotal.value = 0;
    attributeSqlResult.value = null;
  }

  async function saveFeature() {
    const layer = activeLayer.value;
    if (!layer?.editable || !isPostgisLayer(layer) || !draftGeometry.value) {
      setStatus("没有可保存的编辑内容", "warning");
      return undefined;
    }
    return withBusy(async () => {
      const payload = {
        geometry: draftGeometry.value,
        properties: selectedProperties.value
      };
      const result = selectedFeatureId.value
        ? await apiSend<GeoJsonFeature | FeatureWriteResult>(`/api/layers/${layer.id}/features/${selectedFeatureId.value}`, "PUT", payload)
        : await apiSend<GeoJsonFeature | FeatureWriteResult>(`/api/layers/${layer.id}/features`, "POST", payload);
      const saved = normalizeFeatureWriteResult(result);
      if ("tileVersion" in result) {
        applyLayerTileVersion(layer.id, result.tileVersion);
      }
      lastDirtyTiles.value = readDirtyTiles(result);
      setSelectedFeature(saved);
      draftGeometry.value = saved.geometry;
      markDraftClean();
      setStatus(`保存成功：要素 ${saved.id ?? selectedFeatureId.value ?? "已写入"} 已写入 PostGIS，图层已自动刷新`, "success");
      return saved;
    });
  }

  async function deleteSelectedFeature() {
    const layer = activeLayer.value;
    if (!layer?.editable || !isPostgisLayer(layer) || !selectedFeatureId.value) {
      setStatus("没有可删除的已选要素", "warning");
      return false;
    }
    const deleted = await withBusy(async () => {
      const result = await apiSend<void | FeatureDeleteResult>(`/api/layers/${layer.id}/features/${selectedFeatureId.value}`, "DELETE");
      if (result && typeof result === "object" && "tileVersion" in result) {
        applyLayerTileVersion(layer.id, result.tileVersion);
      }
      lastDirtyTiles.value = result && typeof result === "object" ? readDirtyTiles(result) : [];
      clearDraftState();
      setStatus("删除成功", "success");
      return true;
    });
    return Boolean(deleted);
  }

  async function updateLayerStyle(layerId: string, patch: LayerStylePatch) {
    await withBusy(async () => {
      const updated = await apiSend<LayerRegistration>(`/api/layers/${layerId}/style`, "PUT", patch);
      postgisLayers.value = postgisLayers.value.map((layer) => layer.id === updated.id ? { ...updated, sourceType: "postgis" } : layer);
      setStatus(`已更新图层样式：${updated.schema}.${updated.table}`, "success");
    });
  }

  function saveWebServiceConnection(payload: WebServiceConnectionPayload) {
    const id = `web-${payload.type}-${Date.now().toString(36)}`;
    const connection: WebServiceConnection = {
      id,
      ...payload
    };
    webServiceConnections.value = [...webServiceConnections.value, connection];
    webLayers.value = [...webLayers.value, createWebLayer(connection)];
    setStatus(`已添加${payload.type.toUpperCase()}连接：${payload.name}`, "success");
    return connection;
  }

  return {
    datasources,
    availableLayers,
    webServiceConnections,
    loadedLayerIds,
    layers,
    activeLayerId,
    activeLayer,
    attributeTableLayer,
    attributeTableFeatures,
    attributeTableTotal,
    attributeSqlResult,
    attributeTableQuery,
    visibleLayerIds,
    visibleLayers,
    displayProjection,
    crsCatalog,
    customCrsCatalog,
    canRestoreVisibleLayerIds,
    busy,
    status,
    selectedFeatureId,
    selectedProperties,
    draftGeometry,
    isDraftDirty,
    lastDirtyTiles,
    hasUnsavedEditDraft,
    datasourceForm,
    editableFields,
    selectedLayerStatus,
    registeredLayerCount,
    editableLayerCount,
    refreshAll,
    saveDatasource,
    scanDatasource,
    loadLayer,
    removeLayer,
    setDisplayProjection,
    searchCrsCatalog,
    refreshCustomCrsCatalog,
    saveCustomCrs,
    deleteCustomCrs,
    setActiveLayer,
    toggleLayer,
    showOnlyLayer,
    showAllLayers,
    restorePreviousVisibleLayers,
    readFeature,
    openAttributeTable,
    openAttributeTableForFeatureIds,
    selectFeatureIdsByGeometry,
    updateAttributeTableQuery,
    runLayerSqlQuery,
    calculateLayerAttribute,
    closeAttributeTable,
    saveFeature,
    deleteSelectedFeature,
    updateLayerStyle,
    saveWebServiceConnection,
    clearSelectedFeatureState,
    clearDraftState,
    markDraftDirty,
    markDraftClean,
    applyLayerTileVersion,
    consumeLastDirtyTiles,
    setStatus
  };
}

function normalizeFeatureWriteResult(result: GeoJsonFeature | FeatureWriteResult): GeoJsonFeature {
  return "feature" in result ? result.feature : result;
}

function readDirtyTiles(result: unknown) {
  if (!result || typeof result !== "object" || !("dirtyTiles" in result)) {
    return [];
  }
  const dirtyTiles = (result as { dirtyTiles?: unknown }).dirtyTiles;
  return Array.isArray(dirtyTiles) ? dirtyTiles as DirtyTile[] : [];
}

function createWebLayer(connection: WebServiceConnection): LayerRegistration {
  const sourceType = connection.type;
  const name = connection.name.trim() || connection.url;
  const id = connection.id.startsWith("web-") ? connection.id : `web-${connection.id}`;
  const webSource = sourceType === "xyz"
    ? {
        type: "xyz" as const,
        urlTemplate: connection.url,
        attributions: connection.name
      }
    : sourceType === "wmts"
      ? {
          type: "wmts" as const,
          url: connection.url,
          layer: connection.layerName ?? name,
          matrixSet: connection.matrixSet ?? "EPSG:3857",
          style: connection.style,
          format: connection.format ?? "image/png"
        }
      : {
          type: "wms" as const,
          url: connection.url,
          layers: connection.layerName ?? name,
          styles: connection.style ?? "",
          format: connection.format ?? "image/png",
          transparent: true,
          version: "1.3.0"
        };
  return {
    id,
    datasourceId: "web-services",
    sourceType,
    displayName: name,
    serviceConnectionId: connection.id,
    webSource,
    schema: sourceType === "xyz" ? "XYZ Tiles" : "WMS/WMTS",
    table: name,
    geometryColumn: "",
    geometryType: "Raster",
    srid: 3857,
    primaryKey: null,
    fields: [],
    hasSpatialIndex: false,
    canSelect: false,
    canInsert: false,
    canUpdate: false,
    canDelete: false,
    queryable: false,
    editable: false,
    editableReason: ["Web 栅格图层只读"],
    tileUrl: "",
    tileVersion: 1,
    style: {
      fill: "#00000000",
      stroke: "#666666",
      strokeWidth: 1,
      pointRadius: 4,
      opacity: 1
    },
    extent: null,
    updatedAt: new Date().toISOString()
  };
}
