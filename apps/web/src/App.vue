<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
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
import { apiGet, apiSend, type Datasource, type DatasourceForm, type LayerRegistration } from "./api";

type GeometryMode = "Point" | "LineString" | "Polygon";
type GeoJsonFeature = {
  type: "Feature";
  id?: string | number | null;
  geometry: unknown;
  properties?: Record<string, unknown> | null;
};

const mapElement = ref<HTMLDivElement | null>(null);
const datasources = ref<Datasource[]>([]);
const layers = ref<LayerRegistration[]>([]);
const activeLayerId = ref("");
const visibleLayerIds = ref(new Set<string>());
const enabledLayerMap = new globalThis.Map<string, TileLayer<VectorTileSource>>();
const message = ref("就绪");
const busy = ref(false);
const selectedFeatureId = ref<string | null>(null);
const selectedProperties = ref<Record<string, unknown>>({});
const draftGeometry = ref<unknown>(null);
const drawMode = ref<GeometryMode>("Point");
const isEditing = ref(false);

const datasourceForm = reactive<DatasourceForm>({
  name: "Local PostGIS",
  host: "localhost",
  port: 5432,
  database: "postgis",
  user: "postgres",
  password: "",
  ssl: false
});

let map: OlMap;
let selectInteraction: Select;
let modifyInteraction: Modify;
let snapInteraction: Snap;
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

const activeLayer = computed(() => layers.value.find((layer) => layer.id === activeLayerId.value));
const editableFields = computed(() => activeLayer.value?.fields.filter((field) => field.editable) ?? []);
const selectedLayerStatus = computed(() => {
  const layer = activeLayer.value;
  if (!layer) {
    return "请选择图层";
  }
  if (layer.editable) {
    return "可编辑";
  }
  return layer.editableReason.join("、") || "只读";
});

onMounted(async () => {
  await nextTick();
  map = new OlMap({
    target: mapElement.value ?? undefined,
    layers: [editLayer],
    view: new View({
      center: fromLonLat([104.06, 30.67]),
      zoom: 5
    })
  });
  selectInteraction = new Select({ condition: click, layers: () => true });
  modifyInteraction = new Modify({ source: editSource });
  snapInteraction = new Snap({ source: editSource });
  map.addInteraction(selectInteraction);
  map.addInteraction(modifyInteraction);
  map.addInteraction(snapInteraction);
  selectInteraction.on("select", handleMapSelect);
  modifyInteraction.on("modifyend", updateDraftGeometry);
  await refreshAll();
});

watch(activeLayerId, () => {
  clearDraft();
});

async function refreshAll() {
  busy.value = true;
  try {
    datasources.value = await apiGet<Datasource[]>("/api/datasources");
    layers.value = await apiGet<LayerRegistration[]>("/api/layers");
    for (const layer of layers.value) {
      if (!visibleLayerIds.value.has(layer.id)) {
        visibleLayerIds.value.add(layer.id);
      }
      mountLayer(layer);
    }
    if (!activeLayerId.value && layers.value.length > 0) {
      activeLayerId.value = layers.value[0].id;
    }
    message.value = "已刷新数据源和图层";
  } catch (error) {
    message.value = (error as Error).message;
  } finally {
    busy.value = false;
  }
}

async function saveDatasource() {
  busy.value = true;
  try {
    const datasource = await apiSend<Datasource>("/api/datasources", "POST", datasourceForm);
    datasources.value = [...datasources.value, datasource];
    message.value = `已保存数据源：${datasource.name}`;
  } catch (error) {
    message.value = (error as Error).message;
  } finally {
    busy.value = false;
  }
}

async function scanDatasource(datasourceId: string) {
  busy.value = true;
  try {
    const result = await apiSend<{ layers: LayerRegistration[] }>(
      `/api/datasources/${datasourceId}/scan`,
      "POST"
    );
    layers.value = await apiGet<LayerRegistration[]>("/api/layers");
    for (const layer of result.layers) {
      visibleLayerIds.value.add(layer.id);
      mountLayer(layer);
    }
    activeLayerId.value = result.layers[0]?.id ?? activeLayerId.value;
    message.value = `扫描完成：${result.layers.length} 个空间图层`;
  } catch (error) {
    message.value = (error as Error).message;
  } finally {
    busy.value = false;
  }
}

function mountLayer(layer: LayerRegistration) {
  if (enabledLayerMap.has(layer.id) || !map) {
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
  enabledLayerMap.set(layer.id, vectorLayer);
  map.getLayers().insertAt(Math.max(0, map.getLayers().getLength() - 1), vectorLayer);
}

function layerStyle(layer: LayerRegistration, feature: FeatureLike) {
  const active = activeLayerId.value === layer.id;
  const selected = String(feature.get("id")) === selectedFeatureId.value;
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

function toggleLayer(layer: LayerRegistration) {
  const visible = visibleLayerIds.value.has(layer.id);
  if (visible) {
    visibleLayerIds.value.delete(layer.id);
  } else {
    visibleLayerIds.value.add(layer.id);
  }
  enabledLayerMap.get(layer.id)?.setVisible(!visible);
  visibleLayerIds.value = new Set(visibleLayerIds.value);
}

async function handleMapSelect(event: SelectEvent) {
  const feature = event.selected[0];
  const layer = activeLayer.value;
  if (!feature || !layer?.queryable) {
    return;
  }
  const pk = String(feature.get("id"));
  if (!pk || pk === "undefined") {
    return;
  }
  busy.value = true;
  try {
    const sourceFeature = await apiGet<GeoJsonFeature>(`/api/layers/${layer.id}/features/${pk}`);
    loadEditableFeature(sourceFeature);
    selectedFeatureId.value = pk;
    selectedProperties.value = { ...(sourceFeature.properties ?? {}) };
    message.value = `已读取原始要素 ${pk}`;
  } catch (error) {
    message.value = (error as Error).message;
  } finally {
    busy.value = false;
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
    draftGeometry.value = null;
    return;
  }
  const geojson = new GeoJSON().writeFeatureObject(feature, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857"
  }) as GeoJsonFeature;
  draftGeometry.value = geojson.geometry;
}

function clearDraft() {
  selectedFeatureId.value = null;
  selectedProperties.value = {};
  draftGeometry.value = null;
  editSource.clear();
  stopDrawing();
}

function startDrawing() {
  const layer = activeLayer.value;
  if (!layer?.editable) {
    message.value = "当前图层不可编辑";
    return;
  }
  stopDrawing();
  clearDraft();
  isEditing.value = true;
  drawInteraction = new Draw({
    source: editSource,
    type: drawMode.value
  });
  drawInteraction.on("drawend", (event: DrawEvent) => {
    editSource.clear();
    editSource.addFeature(event.feature);
    selectedFeatureId.value = null;
    selectedProperties.value = {};
    window.setTimeout(updateDraftGeometry, 0);
    stopDrawing();
  });
  map.addInteraction(drawInteraction);
  message.value = `开始绘制 ${drawMode.value}`;
}

function stopDrawing() {
  isEditing.value = false;
  if (drawInteraction) {
    map.removeInteraction(drawInteraction);
    drawInteraction = null;
  }
}

async function saveFeature() {
  const layer = activeLayer.value;
  if (!layer?.editable || !draftGeometry.value) {
    message.value = "没有可保存的编辑内容";
    return;
  }
  busy.value = true;
  try {
    const payload = {
      geometry: draftGeometry.value,
      properties: selectedProperties.value
    };
    const saved = selectedFeatureId.value
      ? await apiSend<GeoJsonFeature>(`/api/layers/${layer.id}/features/${selectedFeatureId.value}`, "PUT", payload)
      : await apiSend<GeoJsonFeature>(`/api/layers/${layer.id}/features`, "POST", payload);
    selectedFeatureId.value = String(saved.id);
    selectedProperties.value = { ...(saved.properties ?? {}) };
    loadEditableFeature(saved);
    enabledLayerMap.get(layer.id)?.getSource()?.refresh();
    message.value = "保存成功，图层已刷新";
  } catch (error) {
    message.value = (error as Error).message;
  } finally {
    busy.value = false;
  }
}

async function deleteSelectedFeature() {
  const layer = activeLayer.value;
  if (!layer?.editable || !selectedFeatureId.value) {
    message.value = "没有可删除的已选要素";
    return;
  }
  busy.value = true;
  try {
    await apiSend<void>(`/api/layers/${layer.id}/features/${selectedFeatureId.value}`, "DELETE");
    enabledLayerMap.get(layer.id)?.getSource()?.refresh();
    clearDraft();
    message.value = "删除成功";
  } catch (error) {
    message.value = (error as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="shell">
    <aside class="sidebar">
      <section class="panel">
        <div class="section-title">
          <h1>WebQGIS</h1>
          <button :disabled="busy" @click="refreshAll">刷新</button>
        </div>
        <div class="status" :class="{ busy }">{{ message }}</div>
      </section>

      <section class="panel">
        <h2>数据源</h2>
        <form class="form-grid" @submit.prevent="saveDatasource">
          <input v-model="datasourceForm.name" placeholder="名称" />
          <input v-model="datasourceForm.host" placeholder="Host" />
          <input v-model.number="datasourceForm.port" type="number" placeholder="Port" />
          <input v-model="datasourceForm.database" placeholder="Database" />
          <input v-model="datasourceForm.user" placeholder="User" />
          <input v-model="datasourceForm.password" type="password" placeholder="Password" />
          <label class="inline">
            <input v-model="datasourceForm.ssl" type="checkbox" />
            SSL
          </label>
          <button :disabled="busy" type="submit">保存并测试</button>
        </form>
        <div class="list">
          <button
            v-for="datasource in datasources"
            :key="datasource.id"
            class="list-row"
            :disabled="busy"
            @click="scanDatasource(datasource.id)"
          >
            <span>{{ datasource.name }}</span>
            <small>{{ datasource.host }} / {{ datasource.database }}</small>
          </button>
        </div>
      </section>

      <section class="panel">
        <h2>图层</h2>
        <div class="list">
          <div
            v-for="layer in layers"
            :key="layer.id"
            class="layer-row"
            :class="{ active: activeLayerId === layer.id }"
          >
            <input
              type="checkbox"
              :checked="visibleLayerIds.has(layer.id)"
              @change="toggleLayer(layer)"
            />
            <button @click="activeLayerId = layer.id">
              <span>{{ layer.schema }}.{{ layer.table }}</span>
              <small>{{ layer.geometryType }} · SRID {{ layer.srid ?? "未知" }}</small>
            </button>
            <span class="tag" :class="{ warn: !layer.editable }">
              {{ layer.editable ? "编辑" : "只读" }}
            </span>
          </div>
        </div>
      </section>
    </aside>

    <section class="map-stage">
      <div ref="mapElement" class="map"></div>
      <div class="toolbar">
        <select v-model="drawMode">
          <option value="Point">点</option>
          <option value="LineString">线</option>
          <option value="Polygon">面</option>
        </select>
        <button :disabled="busy || !activeLayer?.editable" @click="startDrawing">
          {{ isEditing ? "绘制中" : "绘制" }}
        </button>
        <button :disabled="busy || !draftGeometry" @click="saveFeature">保存</button>
        <button :disabled="busy || !selectedFeatureId" @click="deleteSelectedFeature">删除</button>
        <button @click="clearDraft">清空草稿</button>
      </div>
    </section>

    <aside class="inspector">
      <section class="panel">
        <h2>编辑面板</h2>
        <dl class="meta-list">
          <dt>当前图层</dt>
          <dd>{{ activeLayer ? `${activeLayer.schema}.${activeLayer.table}` : "无" }}</dd>
          <dt>状态</dt>
          <dd>{{ selectedLayerStatus }}</dd>
          <dt>主键</dt>
          <dd>{{ activeLayer?.primaryKey ?? "无" }}</dd>
          <dt>空间索引</dt>
          <dd>{{ activeLayer?.hasSpatialIndex ? "已存在" : "未检测到" }}</dd>
        </dl>
      </section>

      <section class="panel">
        <h2>属性</h2>
        <div v-if="editableFields.length === 0" class="empty">没有可编辑字段</div>
        <label v-for="field in editableFields" :key="field.name" class="field">
          <span>{{ field.name }}</span>
          <input
            v-model="selectedProperties[field.name]"
            :placeholder="field.dataType"
            :type="field.dataType.includes('int') || field.dataType.includes('numeric') ? 'number' : 'text'"
          />
        </label>
      </section>
    </aside>
  </main>
</template>
