import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from "vue";
import { useConfirmDialog } from "@vueuse/core";
import OlMap from "ol/Map";
import MapBrowserEvent from "ol/MapBrowserEvent";
import View from "ol/View";
import Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import MVT from "ol/format/MVT";
import Graticule from "ol/layer/Graticule";
import TileLayer from "ol/layer/VectorTile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import VectorTileSource from "ol/source/VectorTile";
import { Modify, Snap, Draw } from "ol/interaction";
import DragBox from "ol/interaction/DragBox";
import { unByKey } from "ol/Observable";
import { intersects } from "ol/extent";
import { Fill, Stroke, Style, Circle as CircleStyle } from "ol/style";
import { fromLonLat, getPointResolution, transform, transformExtent } from "ol/proj";
import type { Geometry } from "ol/geom";
import type { FeatureLike } from "ol/Feature";
import type { DrawEvent } from "ol/interaction/Draw";
import type { EventsKey } from "ol/events";
import type { Extent } from "ol/extent";
import type { Pixel } from "ol/pixel";
import type { GeoJsonFeature, GeometryMode, LayerRegistration } from "../types/gis";

export type MapTool = "select" | "pan" | "identify" | "node" | "draw";
export type SelectionMode = "click" | "extent" | "customExtent";
export type CoordinateAxisOrder = "xy" | "yx";

const singleClickEvent = "singleclick" as const;
const pointerMoveEvent = "pointermove" as const;
const screenDpi = 25.4 / 0.28;
const projectionHints: Record<string, string> = {
  "EPSG:3857": "Web Mercator 显示坐标",
  "EPSG:4326": "WGS84 经纬度显示坐标",
  "EPSG:4490": "CGCS2000 经纬度；需注册投影参数后可精确转换",
  "EPSG:4547": "CGCS2000 / 3-degree GK CM 105E；需注册投影参数后可精确转换"
};

export function readVectorTileFeaturePk(feature: Pick<FeatureLike, "get" | "getId">): string | null {
  const rawId = typeof feature.getId === "function" ? feature.getId() : undefined;
  const propertyId = feature.get("id");
  const pk = rawId ?? propertyId;
  if (pk === undefined || pk === null || pk === "") {
    return null;
  }
  return String(pk);
}

export function projectLayerExtent(extent: LayerRegistration["extent"]) {
  if (!extent) {
    return null;
  }
  return transformExtent(extent, "EPSG:4326", "EPSG:3857");
}

export function estimateScaleDenominator(resolution?: number | null, center: [number, number] = [0, 0]) {
  if (!resolution || !Number.isFinite(resolution) || resolution <= 0) {
    return null;
  }
  const pointResolution = getPointResolution("EPSG:3857", resolution, center, "m");
  return Math.max(1, Math.round((pointResolution * screenDpi) / 0.0254));
}

export function formatScaleLabel(scale: number | null) {
  if (!scale) {
    return "比例尺 -";
  }
  return `比例尺 1:${scale.toLocaleString("zh-Hans-CN")}`;
}

export function formatCoordinateLabel(
  coordinate: [number, number] | null,
  projection: string,
  options: { precision?: number; axisOrder?: CoordinateAxisOrder } = {}
) {
  if (!coordinate) {
    return `坐标 - / ${projection}`;
  }
  const precision = options.precision ?? (projection === "EPSG:3857" ? 1 : 5);
  const values = options.axisOrder === "yx"
    ? [coordinate[1], coordinate[0]]
    : coordinate;
  return `坐标 ${values[0].toFixed(precision)}, ${values[1].toFixed(precision)} / ${projection}`;
}

export function projectionStatusLabel(displayProjection: string, dataProjection = "EPSG:4326") {
  const hint = projectionHints[displayProjection] ?? "自定义显示坐标";
  return `${displayProjection} 显示 / ${dataProjection} 数据源 · ${hint}`;
}

export function selectionModeStatus(mode: SelectionMode) {
  if (mode === "click") {
    return "点击选择已启用：点击地图要素读取原始 geometry";
  }
  if (mode === "extent") {
    return "范围选择已启用：在地图上拖拽矩形范围选择要素";
  }
  return "自定义范围选择已启用：在地图上自由绘制多边形范围选择要素，双击结束";
}

type ExtentGeometry = {
  getExtent: () => Extent;
};

export function featureIntersectsSelectionGeometry(featureGeometry: ExtentGeometry | undefined, selectionGeometry: Geometry) {
  if (!featureGeometry) {
    return false;
  }
  return intersects(featureGeometry.getExtent(), selectionGeometry.getExtent());
}

function toCoordinatePair(coordinate: number[]): [number, number] {
  return [coordinate[0] ?? 0, coordinate[1] ?? 0];
}

type UseOpenLayersEditorOptions = {
  mapElement: Ref<HTMLDivElement | null>;
  layers: Ref<LayerRegistration[]>;
  activeLayer: Ref<LayerRegistration | undefined>;
  visibleLayerIds: Ref<Set<string>>;
  selectedFeatureId: Ref<string | null>;
  draftGeometry: Ref<unknown>;
  displayProjection: Ref<string>;
  coordinatePrecision?: Ref<number>;
  coordinateAxisOrder?: Ref<CoordinateAxisOrder>;
  readFeature: (layerId: string, pk: string) => Promise<GeoJsonFeature | undefined>;
  clearSelection?: () => void;
  setStatus: (text: string, tone?: "neutral" | "success" | "warning" | "danger") => void;
};

export function useOpenLayersEditor(options: UseOpenLayersEditorOptions) {
  const map = shallowRef<OlMap | null>(null);
  const drawMode = shallowRef<GeometryMode>("Point");
  const activeTool = shallowRef<MapTool>("select");
  const selectionMode = shallowRef<SelectionMode>("click");
  const isDrawing = shallowRef(false);
  const isSnapEnabled = shallowRef(true);
  const zoomLevel = shallowRef(4);
  const pointerCoordinate = shallowRef<[number, number] | null>(null);
  const scaleDenominator = shallowRef<number | null>(null);
  const coordinateLabel = computed(() => formatCoordinateLabel(
    pointerCoordinate.value,
    options.displayProjection.value,
    {
      precision: options.coordinatePrecision?.value,
      axisOrder: options.coordinateAxisOrder?.value
    }
  ));
  const scaleLabel = computed(() => formatScaleLabel(scaleDenominator.value));
  const projectionLabel = computed(() => projectionStatusLabel(options.displayProjection.value));
  const layerMap = new globalThis.Map<string, TileLayer<VectorTileSource>>();
  const { isRevealed: isDeleteDialogOpen, reveal, confirm, cancel } = useConfirmDialog();

  let modifyInteraction: Modify | null = null;
  let snapInteraction: Snap | null = null;
  let drawInteraction: Draw | null = null;
  let selectionBoxInteraction: DragBox | null = null;
  let selectionDrawInteraction: Draw | null = null;
  let mapClickKey: EventsKey | null = null;
  let pointerMoveKey: EventsKey | null = null;
  let viewChangeKey: EventsKey | null = null;

  const editSource = new VectorSource();
  const selectionSketchSource = new VectorSource();
  const graticuleLayer = new Graticule({
    showLabels: true,
    wrapX: true,
    strokeStyle: new Stroke({
      color: "rgba(126, 126, 126, 0.42)",
      width: 1,
      lineDash: [4, 4]
    })
  });
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
  const selectionSketchLayer = new VectorLayer({
    source: selectionSketchSource,
    style: new Style({
      fill: new Fill({ color: "rgba(96, 96, 96, 0.16)" }),
      stroke: new Stroke({
        color: "#5f5f5f",
        width: 2,
        lineDash: [6, 4]
      })
    })
  });

  function initializeMap() {
    if (map.value || !options.mapElement.value) {
      return;
    }
    map.value = new OlMap({
      target: options.mapElement.value,
      layers: [graticuleLayer, selectionSketchLayer, editLayer],
      view: new View({
        center: fromLonLat([104.29, 35.5]),
        zoom: 4
      }),
      controls: []
    });
    updateViewState();
    viewChangeKey = map.value.getView().on("change:resolution", updateViewState);

    modifyInteraction = new Modify({ source: editSource });
    snapInteraction = new Snap({ source: editSource });
    map.value.addInteraction(modifyInteraction);
    map.value.addInteraction(snapInteraction);
    modifyInteraction.setActive(false);
    modifyInteraction.on("modifyend", updateDraftGeometry);
    mapClickKey = map.value.on(singleClickEvent, handleMapClick);
    pointerMoveKey = map.value.on(pointerMoveEvent, handlePointerMove);
    syncLayers();
  }

  function disposeMap() {
    stopDrawing();
    stopSelectionInteractions();
    if (mapClickKey) {
      unByKey(mapClickKey);
      mapClickKey = null;
    }
    if (pointerMoveKey) {
      unByKey(pointerMoveKey);
      pointerMoveKey = null;
    }
    if (viewChangeKey) {
      unByKey(viewChangeKey);
      viewChangeKey = null;
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
        format: new MVT({ idProperty: layer.primaryKey ?? undefined }),
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
    const selected = readVectorTileFeaturePk(feature) === options.selectedFeatureId.value;
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

  function handleMapClick(event: MapBrowserEvent) {
    if (activeTool.value !== "select" && activeTool.value !== "identify") {
      return;
    }
    if (activeTool.value === "select" && selectionMode.value !== "click") {
      options.setStatus(selectionModeStatus(selectionMode.value), "neutral");
      return;
    }
    const activeTileLayer = options.activeLayer.value ? layerMap.get(options.activeLayer.value.id) : undefined;
    const feature = pickFeatureAtPixel(event.pixel, activeTileLayer)
      ?? pickFeatureAtPixel(event.pixel);
    void handleFeaturePick(feature);
  }

  function handlePointerMove(event: MapBrowserEvent) {
    pointerCoordinate.value = projectMapCoordinate(toCoordinatePair(event.coordinate));
  }

  function projectMapCoordinate(coordinate: [number, number]) {
    const projection = options.displayProjection.value;
    if (projection === "EPSG:4490") {
      return transform(coordinate, "EPSG:3857", "EPSG:4326") as [number, number];
    }
    if (projection === "EPSG:4547") {
      return null;
    }
    return transform(coordinate, "EPSG:3857", projection) as [number, number];
  }

  function updateViewState() {
    const view = map.value?.getView();
    if (!view) {
      return;
    }
    const zoom = view.getZoom() ?? zoomLevel.value;
    const center = view.getCenter() as [number, number] | undefined;
    zoomLevel.value = zoom;
    scaleDenominator.value = estimateScaleDenominator(view.getResolution(), center);
  }

  function pickFeatureAtPixel(pixel: Pixel, preferredLayer?: TileLayer<VectorTileSource>) {
    return map.value?.forEachFeatureAtPixel(
      pixel,
      (candidate) => candidate,
      {
        hitTolerance: 6,
        layerFilter: preferredLayer ? (layer) => layer === preferredLayer : undefined
      }
    );
  }

  async function handleFeaturePick(feature?: FeatureLike) {
    const layer = findFeatureLayer(feature);
    if (!feature || !layer?.queryable) {
      options.setStatus("请选择可查询图层上的要素", "warning");
      return;
    }
    const pk = readVectorTileFeaturePk(feature);
    if (!pk) {
      options.setStatus("瓦片要素缺少主键，无法回源编辑", "warning");
      return;
    }
    const sourceFeature = await options.readFeature(layer.id, pk);
    if (sourceFeature) {
      loadEditableFeature(sourceFeature);
      options.setStatus(`已回源读取要素 ${pk}，可进行节点编辑或属性编辑`, "success");
      if (activeTool.value === "identify") {
        options.setStatus(`已识别要素 ${pk}`, "success");
      }
    }
  }

  async function selectFeatureInGeometry(selectionGeometry: Geometry) {
    const feature = findFeatureInSelectionGeometry(selectionGeometry);
    if (!feature) {
      options.setStatus("选择范围内没有可查询要素", "warning");
      return;
    }
    await handleFeaturePick(feature);
  }

  function findFeatureInSelectionGeometry(selectionGeometry: Geometry) {
    const activeTileLayer = options.activeLayer.value ? layerMap.get(options.activeLayer.value.id) : undefined;
    return findFeatureInSelectionGeometryFromLayers(selectionGeometry, activeTileLayer ? [activeTileLayer] : [])
      ?? findFeatureInSelectionGeometryFromLayers(
        selectionGeometry,
        [...layerMap.entries()]
          .filter(([layerId]) => options.visibleLayerIds.value.has(layerId))
          .map(([, layer]) => layer)
      );
  }

  function findFeatureInSelectionGeometryFromLayers(
    selectionGeometry: Geometry,
    tileLayers: TileLayer<VectorTileSource>[]
  ) {
    const selectionExtent = selectionGeometry.getExtent();
    for (const tileLayer of tileLayers) {
      const candidates = tileLayer.getFeaturesInExtent(selectionExtent);
      const matched = candidates.find((feature) => {
        return featureIntersectsSelectionGeometry(feature.getGeometry(), selectionGeometry);
      });
      if (matched) {
        return matched;
      }
    }
    return undefined;
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

  function findFeatureLayer(feature?: FeatureLike): LayerRegistration | undefined {
    if (!feature) {
      return undefined;
    }
    const layerId = feature.get("layer");
    if (typeof layerId === "string") {
      const matchedLayer = options.layers.value.find((layer) => layer.id === layerId);
      if (matchedLayer) {
        return matchedLayer;
      }
    }
    return options.activeLayer.value;
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
    options.clearSelection?.();
    activeTool.value = "draw";
    modifyInteraction?.setActive(false);
    isDrawing.value = true;
    drawInteraction = new Draw({
      source: editSource,
      type: drawMode.value
    });
    drawInteraction.on("drawend", (event: DrawEvent) => {
      editSource.clear();
      window.setTimeout(() => {
        updateDraftGeometry();
        stopDrawing();
        activateTool("node");
      }, 0);
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

  function stopSelectionInteractions() {
    if (selectionBoxInteraction && map.value) {
      map.value.removeInteraction(selectionBoxInteraction);
    }
    if (selectionDrawInteraction && map.value) {
      map.value.removeInteraction(selectionDrawInteraction);
    }
    selectionBoxInteraction = null;
    selectionDrawInteraction = null;
    selectionSketchSource.clear();
  }

  function activateTool(tool: MapTool) {
    stopDrawing();
    if (tool !== "select") {
      stopSelectionInteractions();
    }
    activeTool.value = tool;
    modifyInteraction?.setActive(tool === "node");

    if (tool === "select") {
      selectionMode.value = "click";
      stopSelectionInteractions();
      options.setStatus(selectionModeStatus("click"), "neutral");
    } else if (tool === "pan") {
      options.setStatus("平移工具已启用：拖拽地图移动视图", "neutral");
    } else if (tool === "identify") {
      options.setStatus("识别工具已启用：点击要素查看属性", "neutral");
    } else if (tool === "node") {
      options.setStatus(
        editSource.getFeatures().length > 0 ? "节点编辑已启用：拖动节点修改草稿" : "请先选择或绘制要素，再进行节点编辑",
        editSource.getFeatures().length > 0 ? "neutral" : "warning"
      );
    }
  }

  function activateSelectionMode(mode: SelectionMode) {
    stopDrawing();
    stopSelectionInteractions();
    selectionMode.value = mode;
    activeTool.value = "select";
    modifyInteraction?.setActive(false);

    if (mode === "click") {
      options.setStatus(selectionModeStatus(mode), "neutral");
    } else if (mode === "extent") {
      startExtentSelection();
      options.setStatus(selectionModeStatus(mode), "neutral");
    } else {
      startCustomPolygonSelection();
      options.setStatus(selectionModeStatus(mode), "neutral");
    }
  }

  function startExtentSelection() {
    if (!map.value) {
      options.setStatus("地图尚未初始化", "warning");
      return;
    }
    selectionBoxInteraction = new DragBox({
      className: "workbench-selection-box"
    });
    selectionBoxInteraction.on("boxend", () => {
      const geometry = selectionBoxInteraction?.getGeometry();
      if (geometry) {
        void selectFeatureInGeometry(geometry);
      }
    });
    map.value.addInteraction(selectionBoxInteraction);
  }

  function startCustomPolygonSelection() {
    if (!map.value) {
      options.setStatus("地图尚未初始化", "warning");
      return;
    }
    selectionDrawInteraction = new Draw({
      source: selectionSketchSource,
      type: "Polygon",
      stopClick: true
    });
    selectionDrawInteraction.on("drawend", (event: DrawEvent) => {
      const geometry = event.feature.getGeometry();
      window.setTimeout(() => {
        selectionSketchSource.clear();
      }, 0);
      if (geometry) {
        void selectFeatureInGeometry(geometry);
      }
    });
    map.value.addInteraction(selectionDrawInteraction);
  }

  function zoomIn() {
    const view = map.value?.getView();
    if (!view) {
      options.setStatus("地图尚未初始化", "warning");
      return;
    }
    stopDrawing();
    view.animate({
      zoom: (view.getZoom() ?? 5) + 1,
      duration: 180
    });
    options.setStatus("已放大地图视图", "success");
  }

  function zoomToLayerExtent(layerId: string) {
    const view = map.value?.getView();
    if (!view) {
      options.setStatus("地图尚未初始化", "warning");
      return false;
    }
    const layer = options.layers.value.find((item) => item.id === layerId);
    if (!layer) {
      options.setStatus("未找到要缩放的图层", "warning");
      return false;
    }
    const extent = projectLayerExtent(layer.extent);
    if (!extent) {
      options.setStatus(`图层缺少范围信息：${layer.schema}.${layer.table}`, "warning");
      return false;
    }
    view.fit(extent, {
      duration: 220,
      padding: [48, 48, 48, 48],
      maxZoom: 13
    });
    activeTool.value = "pan";
    options.setStatus(`已缩放到图层：${layer.schema}.${layer.table}`, "success");
    return true;
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
  watch(options.displayProjection, () => {
    if (!map.value) {
      return;
    }
    const center = map.value.getView().getCenter() as [number, number] | undefined;
    pointerCoordinate.value = center ? projectMapCoordinate(center) : null;
  });

  onBeforeUnmount(disposeMap);

  return {
    map,
    coordinateLabel,
    scaleLabel,
    projectionLabel,
    zoomLevel,
    drawMode,
    activeTool,
    selectionMode,
    isDrawing,
    isSnapEnabled,
    isDeleteDialogOpen,
    initializeMap,
    loadEditableFeature,
    clearDraft,
    startDrawing,
    stopDrawing,
    activateTool,
    activateSelectionMode,
    toggleSnap,
    zoomIn,
    zoomToLayerExtent,
    refreshLayer,
    requestDeleteConfirmation,
    confirmDelete: () => confirm(true),
    cancelDelete: () => cancel(false)
  };
}
