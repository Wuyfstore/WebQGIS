import { onBeforeUnmount, shallowRef, watch, type Ref } from "vue";
import { useConfirmDialog } from "@vueuse/core";
import OlMap from "ol/Map";
import View from "ol/View";
import Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import MVT from "ol/format/MVT";
import TileLayer from "ol/layer/VectorTile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import VectorTileSource from "ol/source/VectorTile";
import { Modify, Select, Snap, Draw } from "ol/interaction";
import { click } from "ol/events/condition";
import { Fill, Stroke, Style, Circle as CircleStyle } from "ol/style";
import { fromLonLat } from "ol/proj";
import type { Geometry } from "ol/geom";
import type { FeatureLike } from "ol/Feature";
import type { DrawEvent } from "ol/interaction/Draw";
import type { SelectEvent } from "ol/interaction/Select";
import type { GeoJsonFeature, GeometryMode, LayerRegistration } from "../types/gis";

export type MapTool = "select" | "pan" | "zoom" | "identify" | "node" | "draw";

type UseOpenLayersEditorOptions = {
  mapElement: Ref<HTMLDivElement | null>;
  layers: Ref<LayerRegistration[]>;
  activeLayer: Ref<LayerRegistration | undefined>;
  visibleLayerIds: Ref<Set<string>>;
  selectedFeatureId: Ref<string | null>;
  draftGeometry: Ref<unknown>;
  readFeature: (pk: string) => Promise<GeoJsonFeature | undefined>;
  setStatus: (text: string, tone?: "neutral" | "success" | "warning" | "danger") => void;
};

export function useOpenLayersEditor(options: UseOpenLayersEditorOptions) {
  const map = shallowRef<OlMap | null>(null);
  const drawMode = shallowRef<GeometryMode>("Point");
  const activeTool = shallowRef<MapTool>("select");
  const isDrawing = shallowRef(false);
  const isSnapEnabled = shallowRef(true);
  const layerMap = new globalThis.Map<string, TileLayer<VectorTileSource>>();
  const { isRevealed: isDeleteDialogOpen, reveal, confirm, cancel } = useConfirmDialog();

  let selectInteraction: Select | null = null;
  let modifyInteraction: Modify | null = null;
  let snapInteraction: Snap | null = null;
  let drawInteraction: Draw | null = null;

  const editSource = new VectorSource();
  const editLayer = new VectorLayer({
    source: editSource,
    style: new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: "#f97316" }),
        stroke: new Stroke({ color: "#fff7ed", width: 2 })
      }),
      fill: new Fill({ color: "rgba(249, 115, 22, 0.2)" }),
      stroke: new Stroke({ color: "#f97316", width: 3 })
    })
  });

  function initializeMap() {
    if (map.value || !options.mapElement.value) {
      return;
    }
    map.value = new OlMap({
      target: options.mapElement.value,
      layers: [editLayer],
      view: new View({
        center: fromLonLat([104.06, 30.67]),
        zoom: 5
      })
    });

    selectInteraction = new Select({ condition: click, layers: () => true });
    modifyInteraction = new Modify({ source: editSource });
    snapInteraction = new Snap({ source: editSource });
    map.value.addInteraction(selectInteraction);
    map.value.addInteraction(modifyInteraction);
    map.value.addInteraction(snapInteraction);
    modifyInteraction.setActive(false);
    selectInteraction.on("select", handleMapSelect);
    modifyInteraction.on("modifyend", updateDraftGeometry);
  }

  function disposeMap() {
    stopDrawing();
    if (selectInteraction) {
      selectInteraction.un("select", handleMapSelect);
    }
    map.value?.setTarget(undefined);
    map.value = null;
    layerMap.clear();
  }

  function syncLayers() {
    if (!map.value) {
      return;
    }
    for (const layer of options.layers.value) {
      mountLayer(layer);
      const mountedLayer = layerMap.get(layer.id);
      mountedLayer?.setVisible(options.visibleLayerIds.value.has(layer.id));
      mountedLayer?.setOpacity(layer.style.opacity);
      mountedLayer?.setStyle((feature) => layerStyle(layer, feature));
    }
    for (const [id, tileLayer] of layerMap) {
      if (!options.layers.value.some((layer) => layer.id === id)) {
        map.value.removeLayer(tileLayer);
        layerMap.delete(id);
      }
    }
  }

  function mountLayer(layer: LayerRegistration) {
    if (!map.value || layerMap.has(layer.id)) {
      return;
    }
    const vectorLayer = new TileLayer({
      source: new VectorTileSource({
        format: new MVT(),
        url: layer.tileUrl
      }),
      opacity: layer.style.opacity,
      style: (feature) => layerStyle(layer, feature)
    });
    layerMap.set(layer.id, vectorLayer);
    map.value.getLayers().insertAt(Math.max(0, map.value.getLayers().getLength() - 1), vectorLayer);
  }

  function layerStyle(layer: LayerRegistration, feature: FeatureLike) {
    const active = options.activeLayer.value?.id === layer.id;
    const selected = String(feature.get("id")) === options.selectedFeatureId.value;
    return new Style({
      image: new CircleStyle({
        radius: active || selected ? layer.style.pointRadius + 2 : layer.style.pointRadius,
        fill: new Fill({ color: selected ? "#f97316" : layer.style.stroke }),
        stroke: new Stroke({ color: "#ffffff", width: 1.5 })
      }),
      fill: new Fill({ color: selected ? "rgba(249, 115, 22, 0.32)" : layer.style.fill }),
      stroke: new Stroke({
        color: selected ? "#f97316" : layer.style.stroke,
        width: active || selected ? layer.style.strokeWidth + 1 : layer.style.strokeWidth
      })
    });
  }

  async function handleMapSelect(event: SelectEvent) {
    const feature = event.selected[0];
    const layer = options.activeLayer.value;
    if (!feature || !layer?.queryable) {
      return;
    }
    const pk = String(feature.get("id"));
    if (!pk || pk === "undefined") {
      return;
    }
    const sourceFeature = await options.readFeature(pk);
    if (sourceFeature) {
      loadEditableFeature(sourceFeature);
      if (activeTool.value === "identify") {
        options.setStatus(`已识别要素 ${pk}`, "success");
      }
    }
  }

  function loadEditableFeature(feature: GeoJsonFeature) {
    editSource.clear();
    const parsed = new GeoJSON().readFeature(feature, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857"
    }) as Feature<Geometry>;
    editSource.addFeature(parsed);
    updateDraftGeometry();
  }

  function updateDraftGeometry() {
    const feature = editSource.getFeatures()[0];
    if (!feature) {
      options.draftGeometry.value = null;
      return;
    }
    const geojson = new GeoJSON().writeFeatureObject(feature, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857"
    }) as GeoJsonFeature;
    options.draftGeometry.value = geojson.geometry;
  }

  function clearDraft() {
    editSource.clear();
    options.draftGeometry.value = null;
    stopDrawing();
  }

  function startDrawing(mode?: GeometryMode) {
    if (mode) {
      drawMode.value = mode;
    }
    const layer = options.activeLayer.value;
    if (!map.value || !layer?.editable) {
      options.setStatus("当前图层不可编辑", "warning");
      return;
    }
    stopDrawing();
    clearDraft();
    activeTool.value = "draw";
    selectInteraction?.setActive(false);
    modifyInteraction?.setActive(false);
    isDrawing.value = true;
    drawInteraction = new Draw({
      source: editSource,
      type: drawMode.value
    });
    drawInteraction.on("drawend", (event: DrawEvent) => {
      editSource.clear();
      editSource.addFeature(event.feature);
      window.setTimeout(updateDraftGeometry, 0);
      stopDrawing();
      activateTool("node");
    });
    map.value.addInteraction(drawInteraction);
    options.setStatus(`开始绘制 ${drawMode.value}`, "neutral");
  }

  function stopDrawing() {
    isDrawing.value = false;
    if (drawInteraction && map.value) {
      map.value.removeInteraction(drawInteraction);
    }
    drawInteraction = null;
  }

  function activateTool(tool: MapTool) {
    stopDrawing();
    activeTool.value = tool;
    selectInteraction?.setActive(tool === "select" || tool === "identify");
    modifyInteraction?.setActive(tool === "node");

    if (tool === "select") {
      options.setStatus("选择工具已启用：点击地图要素读取原始 geometry", "neutral");
    } else if (tool === "pan") {
      options.setStatus("平移工具已启用：拖拽地图移动视图", "neutral");
    } else if (tool === "zoom") {
      zoomIn();
    } else if (tool === "identify") {
      options.setStatus("识别工具已启用：点击要素查看属性", "neutral");
    } else if (tool === "node") {
      options.setStatus(
        editSource.getFeatures().length > 0 ? "节点编辑已启用：拖动节点修改草稿" : "请先选择或绘制要素，再进行节点编辑",
        editSource.getFeatures().length > 0 ? "neutral" : "warning"
      );
    }
  }

  function zoomIn() {
    const view = map.value?.getView();
    if (!view) {
      options.setStatus("地图尚未初始化", "warning");
      return;
    }
    activeTool.value = "zoom";
    view.animate({
      zoom: (view.getZoom() ?? 5) + 1,
      duration: 180
    });
    options.setStatus("已放大地图视图", "success");
  }

  function toggleSnap() {
    isSnapEnabled.value = !isSnapEnabled.value;
    snapInteraction?.setActive(isSnapEnabled.value);
    options.setStatus(isSnapEnabled.value ? "吸附已开启：顶点 + 线段" : "吸附已关闭", "success");
  }

  function refreshLayer(layerId?: string) {
    if (!layerId) {
      return;
    }
    layerMap.get(layerId)?.getSource()?.refresh();
  }

  function refreshLayerStyles() {
    for (const tileLayer of layerMap.values()) {
      tileLayer.changed();
    }
  }

  async function requestDeleteConfirmation() {
    const result = await reveal();
    return Boolean(result.data);
  }

  watch([options.layers, options.visibleLayerIds], syncLayers, { deep: false });
  watch([options.activeLayer, options.selectedFeatureId], refreshLayerStyles, { deep: false });

  onBeforeUnmount(disposeMap);

  return {
    map,
    drawMode,
    activeTool,
    isDrawing,
    isSnapEnabled,
    isDeleteDialogOpen,
    initializeMap,
    loadEditableFeature,
    clearDraft,
    startDrawing,
    stopDrawing,
    activateTool,
    toggleSnap,
    zoomIn,
    refreshLayer,
    requestDeleteConfirmation,
    confirmDelete: () => confirm(true),
    cancelDelete: () => cancel(false)
  };
}
