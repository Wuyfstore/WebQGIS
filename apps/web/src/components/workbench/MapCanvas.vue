<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from "vue";
import { getGeometryModes } from "../../utils/layer";
import type { GeometryMode, LayerRegistration } from "../../types/gis";

const props = defineProps<{
  activeLayer?: LayerRegistration;
  busy: boolean;
  hasDraftGeometry: boolean;
  hasSelectedFeature: boolean;
  isEditingLayer: boolean;
  isDrawing: boolean;
  mapStyle?: Record<string, string>;
}>();

const drawMode = defineModel<GeometryMode>("drawMode", { required: true });

const emit = defineEmits<{
  ready: [element: HTMLDivElement];
  draw: [];
  save: [];
  delete: [];
  clear: [];
  toggleEdit: [];
}>();

const mapRoot = useTemplateRef<HTMLDivElement>("mapRoot");
const geometryModes = computed(() => getGeometryModes(props.activeLayer));

onMounted(() => {
  if (mapRoot.value) {
    emit("ready", mapRoot.value);
  }
});
</script>

<template>
  <section class="map-canvas">
    <div ref="mapRoot" class="map-canvas__map" :style="mapStyle" aria-label="地图画布"></div>

    <div class="map-canvas__toolbar" aria-label="编辑工具栏">
      <div class="map-canvas__toolbar-title">
        活动图层: {{ activeLayer ? `${activeLayer.schema}.${activeLayer.table}` : "未选择" }}
      </div>
      <label class="map-canvas__mode">
        <span class="map-canvas__label">绘制类型</span>
        <select v-model="drawMode" class="map-canvas__select focus-ring" :disabled="busy || !isEditingLayer">
          <option v-for="mode in geometryModes" :key="mode" :value="mode">
            {{ mode }}
          </option>
        </select>
      </label>

      <button
        class="map-canvas__button focus-ring"
        :class="{ 'map-canvas__button--active': isEditingLayer }"
        :disabled="busy || !activeLayer?.editable"
        type="button"
        @click="emit('toggleEdit')"
      >
        {{ isEditingLayer ? "关闭编辑" : "开启编辑" }}
      </button>

      <button
        class="map-canvas__button focus-ring"
        :disabled="busy || !isEditingLayer"
        type="button"
        @click="emit('draw')"
      >
        {{ isDrawing ? "绘制中" : "绘制" }}
      </button>

      <button
        class="map-canvas__button map-canvas__button--primary focus-ring"
        :disabled="busy || !isEditingLayer || !hasDraftGeometry"
        type="button"
        @click="emit('save')"
      >
        保存
      </button>

      <button
        class="map-canvas__button map-canvas__button--danger focus-ring"
        :disabled="busy || !isEditingLayer || !hasSelectedFeature"
        type="button"
        @click="emit('delete')"
      >
        删除
      </button>

      <button class="map-canvas__button focus-ring" :disabled="busy || !isEditingLayer" type="button" @click="emit('clear')">
        清空
      </button>

      <p class="map-canvas__hint">
        {{ isEditingLayer ? "编辑已开启：草稿来自原始 PostGIS geometry" : "先开启编辑，再绘制、修改或保存要素" }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.map-canvas {
  position: relative;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--qgis-border);
  background: var(--qgis-map-bg);
}

.map-canvas__map {
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 134px);
  background:
    linear-gradient(rgba(215, 208, 185, var(--map-grid-opacity, 0.42)) 1px, transparent 1px),
    linear-gradient(90deg, rgba(215, 208, 185, var(--map-grid-opacity, 0.42)) 1px, transparent 1px);
  background-size: var(--map-grid-size, 64px) var(--map-grid-size, 64px);
}

.map-canvas__map :deep(.ol-zoom),
.map-canvas__map :deep(.ol-control) {
  display: none;
}

.map-canvas__toolbar {
  position: absolute;
  top: 18px;
  left: 18px;
  display: grid;
  grid-template-columns: 132px repeat(5, auto);
  max-width: calc(100% - 36px);
  align-items: end;
  gap: 8px;
  border: 1px solid #b7b7b7;
  background: rgba(250, 250, 250, 0.96);
  box-shadow: 1px 1px 0 rgba(0, 0, 0, 0.08);
}

.map-canvas__toolbar-title {
  grid-column: 1 / -1;
  min-height: 24px;
  border-bottom: 1px solid #9e9e9e;
  padding: 5px 10px 0;
  background: var(--qgis-dock-title);
  color: var(--qgis-text);
  font-weight: 600;
}

.map-canvas__mode {
  display: flex;
  width: 132px;
  flex-direction: column;
  gap: 3px;
  padding-left: 10px;
}

.map-canvas__label {
  color: var(--qgis-muted);
  font-size: 11px;
}

.map-canvas__select,
.map-canvas__button {
  min-height: 26px;
  border: 1px solid #8f8f8f;
  background: #e8e8e8;
  color: var(--qgis-text);
}

.map-canvas__select {
  width: 100%;
  padding: 2px 6px;
  background: #ffffff;
}

.map-canvas__button {
  min-width: 62px;
  padding: 3px 10px;
}

.map-canvas__button--primary {
  border-color: #6f9fc9;
  background: var(--qgis-blue-soft);
  color: var(--qgis-blue);
}

.map-canvas__button--active {
  border-color: #777777;
  background: #cfcfcf;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.48),
    inset 0 -1px 0 #9d9d9d;
}

.map-canvas__button--danger {
  border-color: #b88b8b;
  background: #f3dddd;
  color: var(--qgis-danger);
}

.map-canvas__hint {
  grid-column: 1 / -1;
  margin: 0;
  border-top: 1px solid #d0d0d0;
  padding: 6px 10px;
  color: var(--qgis-muted);
  font-size: 12px;
}

@media (max-width: 760px) {
  .map-canvas__map {
    height: 58vh;
    min-height: 58vh;
  }

  .map-canvas__toolbar {
    right: 12px;
    grid-template-columns: 1fr 1fr;
  }
}
</style>
