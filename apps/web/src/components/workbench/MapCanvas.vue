<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from "vue";
import { getGeometryModes } from "../../utils/layer";
import type { GeometryMode, LayerRegistration } from "../../types/gis";

const props = defineProps<{
  activeLayer?: LayerRegistration;
  busy: boolean;
  hasDraftGeometry: boolean;
  hasSelectedFeature: boolean;
  isDrawing: boolean;
}>();

const drawMode = defineModel<GeometryMode>("drawMode", { required: true });

const emit = defineEmits<{
  ready: [element: HTMLDivElement];
  draw: [];
  save: [];
  delete: [];
  clear: [];
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
    <div ref="mapRoot" class="map-canvas__map" aria-label="地图画布"></div>

    <div class="map-canvas__toolbar" aria-label="编辑工具栏">
      <label class="map-canvas__mode">
        <span class="map-canvas__label">绘制类型</span>
        <select v-model="drawMode" class="map-canvas__select focus-ring">
          <option v-for="mode in geometryModes" :key="mode" :value="mode">
            {{ mode }}
          </option>
        </select>
      </label>

      <button
        class="map-canvas__button focus-ring"
        :disabled="busy || !activeLayer?.editable"
        type="button"
        @click="emit('draw')"
      >
        {{ isDrawing ? "绘制中" : "绘制" }}
      </button>

      <button
        class="map-canvas__button map-canvas__button--primary focus-ring"
        :disabled="busy || !hasDraftGeometry"
        type="button"
        @click="emit('save')"
      >
        保存
      </button>

      <button
        class="map-canvas__button map-canvas__button--danger focus-ring"
        :disabled="busy || !hasSelectedFeature"
        type="button"
        @click="emit('delete')"
      >
        删除
      </button>

      <button class="map-canvas__button focus-ring" type="button" @click="emit('clear')">
        清空
      </button>
    </div>
  </section>
</template>

<style scoped>
.map-canvas {
  position: relative;
  min-width: 0;
  background: #dbeafe;
}

.map-canvas__map {
  width: 100%;
  height: 100vh;
}

.map-canvas__toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  max-width: calc(100% - 24px);
  flex-wrap: wrap;
  align-items: end;
  gap: 8px;
  border: 1px solid #c7d2e2;
  border-radius: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
}

.map-canvas__mode {
  display: flex;
  width: 132px;
  flex-direction: column;
  gap: 3px;
}

.map-canvas__label {
  color: #52627a;
  font-size: 11px;
}

.map-canvas__select,
.map-canvas__button {
  min-height: 34px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #172033;
}

.map-canvas__select {
  width: 100%;
  padding: 6px 8px;
}

.map-canvas__button {
  min-width: 70px;
  padding: 6px 10px;
}

.map-canvas__button--primary {
  border-color: #1d4ed8;
  background: #2563eb;
  color: #ffffff;
}

.map-canvas__button--danger {
  border-color: #fecaca;
  color: #b91c1c;
}

@media (max-width: 760px) {
  .map-canvas__map {
    height: 58vh;
  }

  .map-canvas__toolbar {
    right: 12px;
  }
}
</style>
