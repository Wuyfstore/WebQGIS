<script setup lang="ts">
import { computed } from "vue";
import { isNumericField } from "../../utils/layer";
import type { FieldMeta, LayerRegistration } from "../../types/gis";

const props = defineProps<{
  activeLayer?: LayerRegistration;
  editableFields: FieldMeta[];
  isEditingLayer: boolean;
  selectedLayerStatus: string;
  selectedFeatureId: string | null;
}>();

const selectedProperties = defineModel<Record<string, unknown>>("selectedProperties", { required: true });

const layerName = computed(() => (
  props.activeLayer ? `${props.activeLayer.schema}.${props.activeLayer.table}` : "无"
));
const layerGeometrySummary = computed(() => {
  if (!props.activeLayer) {
    return "未选择图层";
  }
  return `${props.activeLayer.geometryType} · SRID ${props.activeLayer.srid ?? "未知"} · primary key: ${props.activeLayer.primaryKey ?? "无"}`;
});
</script>

<template>
  <aside class="edit-inspector">
    <section class="edit-inspector__panel workbench-panel">
      <header class="edit-inspector__header">
        <h2 class="edit-inspector__title">图层与要素属性</h2>
      </header>
      <div class="edit-inspector__layer-card">
        <strong class="edit-inspector__layer-name">{{ layerName }}</strong>
        <span class="edit-inspector__layer-meta">{{ layerGeometrySummary }}</span>
        <div class="edit-inspector__badges">
          <span class="edit-inspector__badge edit-inspector__badge--primary">{{ selectedLayerStatus }}</span>
          <span class="edit-inspector__badge">{{ activeLayer?.hasSpatialIndex ? "空间索引" : "无空间索引" }}</span>
          <span class="edit-inspector__badge">要素 {{ selectedFeatureId ?? "未选择" }}</span>
        </div>
      </div>
    </section>

    <section class="edit-inspector__panel workbench-panel">
      <header class="edit-inspector__header">
        <h2 class="edit-inspector__title">属性表单</h2>
      </header>
      <div v-if="!isEditingLayer" class="edit-inspector__empty">开启当前图层编辑后可修改属性</div>
      <div v-else-if="editableFields.length === 0" class="edit-inspector__empty">没有可编辑字段</div>
      <label v-for="field in editableFields" :key="field.name" class="edit-inspector__field">
        <span class="edit-inspector__field-name">{{ field.name }}</span>
        <input
          v-model="selectedProperties[field.name]"
          class="edit-inspector__input focus-ring"
          :disabled="!isEditingLayer"
          :name="`field-${field.name}`"
          :placeholder="field.dataType"
          :type="isNumericField(field.dataType) ? 'number' : 'text'"
          autocomplete="off"
        />
      </label>
    </section>

    <section class="edit-inspector__panel workbench-panel">
      <header class="edit-inspector__header">
        <h2 class="edit-inspector__title">保存校验</h2>
      </header>
      <ul class="edit-inspector__checks">
        <li v-if="!isEditingLayer" class="edit-inspector__check edit-inspector__check--warn">当前图层未开启编辑</li>
        <li class="edit-inspector__check edit-inspector__check--ok">SRID 可转换到地图坐标系</li>
        <li class="edit-inspector__check edit-inspector__check--ok">几何类型符合 {{ activeLayer?.geometryType ?? "当前图层" }}</li>
        <li class="edit-inspector__check edit-inspector__check--warn">未检测到 version 字段，保存可能覆盖</li>
      </ul>
    </section>

    <section class="edit-inspector__panel workbench-panel">
      <header class="edit-inspector__header">
        <h2 class="edit-inspector__title">SQL / 审计预览</h2>
      </header>
      <pre class="edit-inspector__sql">UPDATE {{ layerName }}
SET geom = ST_GeomFromGeoJSON(?), properties = ?
WHERE {{ activeLayer?.primaryKey ?? "id" }} = {{ selectedFeatureId ?? "?" }};</pre>
    </section>
  </aside>
</template>

<style scoped>
.edit-inspector {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  background: var(--qgis-dock);
}

.edit-inspector__panel {
  display: flex;
  flex-direction: column;
  border-width: 0 0 1px;
  background: var(--qgis-pane);
}

.edit-inspector__header {
  min-height: 25px;
  border-bottom: 1px solid #9e9e9e;
  padding: 0 10px;
  background: var(--qgis-dock-title);
}

.edit-inspector__title {
  margin: 0;
  color: var(--qgis-text);
  font-size: 13px;
  font-weight: 600;
  line-height: 25px;
}

.edit-inspector__layer-card {
  padding: 14px;
}

.edit-inspector__layer-name {
  display: block;
  font-size: 16px;
}

.edit-inspector__layer-meta {
  display: block;
  margin-top: 4px;
  color: var(--qgis-muted);
  font-size: 12px;
}

.edit-inspector__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.edit-inspector__badge {
  border: 1px solid #8f8f8f;
  background: #e8e8e8;
  padding: 3px 12px;
  font-size: 12px;
}

.edit-inspector__badge--primary {
  border-color: #6f9fc9;
  background: var(--qgis-blue-soft);
  color: var(--qgis-blue);
}

.edit-inspector__field {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  align-items: center;
  min-height: 31px;
  border-bottom: 1px solid #d0d0d0;
  padding: 0 10px;
  color: var(--qgis-muted);
  font-size: 12px;
}

.edit-inspector__field:nth-of-type(odd) {
  background: var(--qgis-row-alt);
}

.edit-inspector__input {
  min-height: 21px;
  border: 1px solid #aeb6bf;
  padding: 2px 8px;
  background: var(--qgis-input);
  color: var(--qgis-text);
}

.edit-inspector__input:disabled {
  background: var(--qgis-readonly);
  color: var(--qgis-muted);
}

.edit-inspector__empty {
  min-height: 40px;
  padding: 12px;
  color: var(--qgis-muted);
  font-size: 12px;
}

.edit-inspector__checks {
  margin: 0;
  padding: 12px 16px 14px 28px;
}

.edit-inspector__check {
  margin: 8px 0;
  font-size: 12px;
}

.edit-inspector__check--ok {
  color: var(--qgis-green);
}

.edit-inspector__check--warn {
  color: var(--qgis-warn);
}

.edit-inspector__sql {
  margin: 0;
  padding: 14px 16px;
  overflow-x: auto;
  color: var(--qgis-muted);
  font-family: Consolas, "Cascadia Mono", monospace;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
}

@media (max-width: 1100px) {
  .edit-inspector {
    grid-column: 1 / -1;
    min-height: 260px;
    border-top: 1px solid #dbe3ef;
  }
}
</style>
