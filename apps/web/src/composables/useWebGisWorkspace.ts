import { computed, reactive, shallowRef } from "vue";
import { useTitle } from "@vueuse/core";
import { apiGet, apiSend } from "../api";
import { getEditableFields, getLayerStatus } from "../utils/layer";
import type {
  Datasource,
  DatasourceForm,
  GeoJsonFeature,
  LayerRegistration,
  LayerStylePatch,
  StatusMessage
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
  const layers = shallowRef<LayerRegistration[]>([]);
  const activeLayerId = shallowRef("");
  const visibleLayerIds = shallowRef(new Set<string>());
  const previousVisibleLayerIds = shallowRef<Set<string> | null>(null);
  const busy = shallowRef(false);
  const status = shallowRef<StatusMessage>({ text: "就绪", tone: "neutral" });
  const selectedFeatureId = shallowRef<string | null>(null);
  const selectedProperties = shallowRef<Record<string, unknown>>({});
  const draftGeometry = shallowRef<unknown>(null);
  const datasourceForm = reactive(defaultDatasourceForm());

  const activeLayer = computed(() => layers.value.find((layer) => layer.id === activeLayerId.value));
  const editableFields = computed(() => getEditableFields(activeLayer.value));
  const selectedLayerStatus = computed(() => getLayerStatus(activeLayer.value));
  const visibleLayers = computed(() => layers.value.filter((layer) => visibleLayerIds.value.has(layer.id)));
  const canRestoreVisibleLayerIds = computed(() => Boolean(previousVisibleLayerIds.value?.size));
  const registeredLayerCount = computed(() => layers.value.length);
  const editableLayerCount = computed(() => layers.value.filter((layer) => layer.editable).length);

  function setStatus(text: string, tone: StatusMessage["tone"] = "neutral") {
    status.value = { text, tone };
  }

  function replaceVisibleLayerIds(next: Set<string>) {
    visibleLayerIds.value = new Set(next);
  }

  function rememberVisibleLayerIds() {
    previousVisibleLayerIds.value = new Set(visibleLayerIds.value);
  }

  function setSelectedFeature(feature: GeoJsonFeature, fallbackId?: string) {
    selectedFeatureId.value = String(feature.id ?? fallbackId ?? "");
    selectedProperties.value = { ...(feature.properties ?? {}) };
  }

  function clearDraftState() {
    selectedFeatureId.value = null;
    selectedProperties.value = {};
    draftGeometry.value = null;
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
      const [nextDatasources, nextLayers] = await Promise.all([
        apiGet<Datasource[]>("/api/datasources"),
        apiGet<LayerRegistration[]>("/api/layers")
      ]);
      datasources.value = nextDatasources;
      layers.value = nextLayers;
      const nextVisible = new Set(visibleLayerIds.value);
      for (const layer of nextLayers) {
        nextVisible.add(layer.id);
      }
      replaceVisibleLayerIds(nextVisible);
      if (!activeLayerId.value && nextLayers.length > 0) {
        activeLayerId.value = nextLayers[0].id;
      }
      setStatus("已刷新数据源和图层", "success");
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
      layers.value = await apiGet<LayerRegistration[]>("/api/layers");
      const nextVisible = new Set(visibleLayerIds.value);
      for (const layer of result.layers) {
        nextVisible.add(layer.id);
      }
      replaceVisibleLayerIds(nextVisible);
      activeLayerId.value = result.layers[0]?.id ?? activeLayerId.value;
      setStatus(`扫描完成：${result.layers.length} 个空间图层`, "success");
    });
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
    if (!layer?.queryable) {
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

  async function saveFeature() {
    const layer = activeLayer.value;
    if (!layer?.editable || !draftGeometry.value) {
      setStatus("没有可保存的编辑内容", "warning");
      return undefined;
    }
    return withBusy(async () => {
      const payload = {
        geometry: draftGeometry.value,
        properties: selectedProperties.value
      };
      const saved = selectedFeatureId.value
        ? await apiSend<GeoJsonFeature>(`/api/layers/${layer.id}/features/${selectedFeatureId.value}`, "PUT", payload)
        : await apiSend<GeoJsonFeature>(`/api/layers/${layer.id}/features`, "POST", payload);
      setSelectedFeature(saved);
      setStatus(`保存成功：要素 ${saved.id ?? selectedFeatureId.value ?? "已写入"} 已写入 PostGIS，图层已自动刷新`, "success");
      return saved;
    });
  }

  async function deleteSelectedFeature() {
    const layer = activeLayer.value;
    if (!layer?.editable || !selectedFeatureId.value) {
      setStatus("没有可删除的已选要素", "warning");
      return false;
    }
    const deleted = await withBusy(async () => {
      await apiSend<void>(`/api/layers/${layer.id}/features/${selectedFeatureId.value}`, "DELETE");
      clearDraftState();
      setStatus("删除成功", "success");
      return true;
    });
    return Boolean(deleted);
  }

  async function updateLayerStyle(layerId: string, patch: LayerStylePatch) {
    await withBusy(async () => {
      const updated = await apiSend<LayerRegistration>(`/api/layers/${layerId}/style`, "PUT", patch);
      layers.value = layers.value.map((layer) => layer.id === updated.id ? updated : layer);
      setStatus(`已更新图层样式：${updated.schema}.${updated.table}`, "success");
    });
  }

  return {
    datasources,
    layers,
    activeLayerId,
    activeLayer,
    visibleLayerIds,
    visibleLayers,
    canRestoreVisibleLayerIds,
    busy,
    status,
    selectedFeatureId,
    selectedProperties,
    draftGeometry,
    datasourceForm,
    editableFields,
    selectedLayerStatus,
    registeredLayerCount,
    editableLayerCount,
    refreshAll,
    saveDatasource,
    scanDatasource,
    setActiveLayer,
    toggleLayer,
    showOnlyLayer,
    showAllLayers,
    restorePreviousVisibleLayers,
    readFeature,
    saveFeature,
    deleteSelectedFeature,
    updateLayerStyle,
    clearDraftState,
    setStatus
  };
}
