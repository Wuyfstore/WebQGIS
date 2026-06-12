<script setup lang="ts">
import { Close } from "@element-plus/icons-vue";
import { computed } from "vue";
import type { FieldMeta, LayerRegistration } from "../../types/gis";

const props = defineProps<{
  layer: LayerRegistration;
}>();

const emit = defineEmits<{
  close: [];
}>();

const layerLabel = computed(() => `${props.layer.schema}.${props.layer.table}`);
const fieldCountLabel = computed(() => `${props.layer.fields.length} 个字段`);
const extentLabel = computed(() => (
  props.layer.extent
    ? props.layer.extent.map((value) => value.toFixed(4)).join(", ")
    : "未扫描"
));
const capabilityItems = computed(() => [
  { label: "查询", enabled: props.layer.canSelect },
  { label: "新增", enabled: props.layer.canInsert },
  { label: "更新", enabled: props.layer.canUpdate },
  { label: "删除", enabled: props.layer.canDelete },
  { label: "空间索引", enabled: props.layer.hasSpatialIndex }
]);

function typeLabel(field: FieldMeta) {
  return field.udtName && field.udtName !== field.dataType
    ? `${field.dataType} (${field.udtName})`
    : field.dataType;
}

function valueLabel(value: string | null) {
  return value ?? "-";
}

function boolLabel(value: boolean) {
  return value ? "是" : "否";
}
</script>

<template>
  <div class="attribute-table__backdrop">
    <section class="attribute-table" role="dialog" aria-modal="true" aria-labelledby="attribute-table-title">
      <header class="attribute-table__header">
        <div class="attribute-table__title-group">
          <h2 id="attribute-table-title" class="attribute-table__title">
            属性表 - {{ layerLabel }}
          </h2>
          <span class="attribute-table__subtitle">{{ fieldCountLabel }}</span>
        </div>
        <button class="attribute-table__close focus-ring" type="button" aria-label="关闭属性表" @click="emit('close')">
          <Close class="attribute-table__close-icon" aria-hidden="true" />
        </button>
      </header>

      <section class="attribute-table__meta" aria-label="图层元信息">
        <div class="attribute-table__meta-item">
          <span class="attribute-table__meta-label">几何</span>
          <strong class="attribute-table__meta-value">{{ layer.geometryType }}</strong>
        </div>
        <div class="attribute-table__meta-item">
          <span class="attribute-table__meta-label">几何字段</span>
          <strong class="attribute-table__meta-value">{{ layer.geometryColumn }}</strong>
        </div>
        <div class="attribute-table__meta-item">
          <span class="attribute-table__meta-label">SRID</span>
          <strong class="attribute-table__meta-value">{{ layer.srid ?? "-" }}</strong>
        </div>
        <div class="attribute-table__meta-item">
          <span class="attribute-table__meta-label">主键</span>
          <strong class="attribute-table__meta-value">{{ layer.primaryKey ?? "-" }}</strong>
        </div>
        <div class="attribute-table__meta-item attribute-table__meta-item--wide">
          <span class="attribute-table__meta-label">范围</span>
          <strong class="attribute-table__meta-value">{{ extentLabel }}</strong>
        </div>
      </section>

      <section class="attribute-table__capabilities" aria-label="图层能力">
        <span
          v-for="item in capabilityItems"
          :key="item.label"
          class="attribute-table__capability"
          :class="{ 'attribute-table__capability--enabled': item.enabled }"
        >
          {{ item.label }}: {{ boolLabel(item.enabled) }}
        </span>
      </section>

      <div class="attribute-table__table-wrap">
        <table class="attribute-table__table">
          <thead>
            <tr>
              <th scope="col">字段</th>
              <th scope="col">类型</th>
              <th scope="col">可空</th>
              <th scope="col">默认值</th>
              <th scope="col">可编辑</th>
            </tr>
          </thead>
          <tbody v-if="layer.fields.length > 0">
            <tr v-for="field in layer.fields" :key="field.name">
              <th scope="row">{{ field.name }}</th>
              <td>{{ typeLabel(field) }}</td>
              <td>{{ boolLabel(field.nullable) }}</td>
              <td>{{ valueLabel(field.defaultValue) }}</td>
              <td>{{ boolLabel(field.editable) }}</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr>
              <td class="attribute-table__empty" colspan="5">暂无字段</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.attribute-table__backdrop {
  position: fixed;
  inset: 0;
  z-index: 28;
  display: grid;
  align-items: end;
  padding: 32px;
  background: rgba(15, 23, 42, 0.24);
}

.attribute-table {
  width: min(960px, 100%);
  max-height: min(560px, calc(100vh - 64px));
  border: 1px solid #8d8d8d;
  background: var(--qgis-pane);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}

.attribute-table__header {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #a5a5a5;
  background: var(--qgis-dock-title);
  padding: 0 8px 0 12px;
}

.attribute-table__title-group {
  min-width: 0;
}

.attribute-table__title {
  margin: 0;
  overflow: hidden;
  color: var(--qgis-text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attribute-table__subtitle {
  color: var(--qgis-muted);
  font-size: 11px;
}

.attribute-table__close {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #9a9a9a;
  background: #e8e8e8;
  color: var(--qgis-text);
  padding: 0;
}

.attribute-table__close-icon {
  width: 14px;
  height: 14px;
}

.attribute-table__meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  border-bottom: 1px solid #b9b9b9;
  background: #b9b9b9;
}

.attribute-table__meta-item {
  min-width: 0;
  background: #f4f4f4;
  padding: 7px 10px;
}

.attribute-table__meta-item--wide {
  grid-column: span 4;
}

.attribute-table__meta-label,
.attribute-table__meta-value {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attribute-table__meta-label {
  color: var(--qgis-muted);
  font-size: 11px;
}

.attribute-table__meta-value {
  color: var(--qgis-text);
  font-size: 12px;
  font-weight: 600;
}

.attribute-table__capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border-bottom: 1px solid #c8c8c8;
  padding: 8px 10px;
  background: #eeeeee;
}

.attribute-table__capability {
  border: 1px solid #b8b8b8;
  background: #f8f8f8;
  color: var(--qgis-muted);
  padding: 2px 7px;
  font-size: 11px;
}

.attribute-table__capability--enabled {
  border-color: #9bb88c;
  background: #eef6e8;
  color: var(--qgis-green);
}

.attribute-table__table-wrap {
  max-height: 310px;
  overflow: auto;
  background: #ffffff;
}

.attribute-table__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--qgis-text);
  font-size: 12px;
}

.attribute-table__table th,
.attribute-table__table td {
  border: 1px solid #d2d2d2;
  padding: 5px 8px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attribute-table__table thead th {
  position: sticky;
  top: 0;
  background: #e6e6e6;
  font-weight: 600;
}

.attribute-table__table tbody th {
  background: #fafafa;
  font-weight: 600;
}

.attribute-table__empty {
  color: var(--qgis-muted);
  text-align: center;
}

@media (max-width: 760px) {
  .attribute-table__backdrop {
    align-items: stretch;
    padding: 12px;
  }

  .attribute-table {
    max-height: calc(100vh - 24px);
  }

  .attribute-table__meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .attribute-table__meta-item--wide {
    grid-column: span 2;
  }
}
</style>
