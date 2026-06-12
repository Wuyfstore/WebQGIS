<script setup lang="ts">
import { Close } from "@element-plus/icons-vue";
import { useSorted } from "@vueuse/core";
import { computed, shallowRef } from "vue";
import type { FieldMeta, LayerRegistration } from "../../types/gis";

const props = defineProps<{
  layer: LayerRegistration;
}>();

const emit = defineEmits<{
  close: [];
}>();

type FieldSortKey = "name" | "type" | "nullable" | "defaultValue" | "editable";
type SortDirection = "asc" | "desc";

const fieldSearch = shallowRef("");
const sortKey = shallowRef<FieldSortKey>("name");
const sortDirection = shallowRef<SortDirection>("asc");
const layerLabel = computed(() => `${props.layer.schema}.${props.layer.table}`);
const normalizedSearch = computed(() => fieldSearch.value.trim().toLowerCase());
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
const filteredFields = computed(() => {
  const query = normalizedSearch.value;
  if (!query) {
    return props.layer.fields;
  }
  return props.layer.fields.filter((field) => (
    field.name.toLowerCase().includes(query)
    || typeLabel(field).toLowerCase().includes(query)
    || valueLabel(field.defaultValue).toLowerCase().includes(query)
    || boolLabel(field.nullable).includes(query)
    || boolLabel(field.editable).includes(query)
  ));
});
const sortedFields = useSorted(filteredFields, compareFields);
const fieldCountLabel = computed(() => (
  normalizedSearch.value
    ? `${sortedFields.value.length}/${props.layer.fields.length} 个字段`
    : `${props.layer.fields.length} 个字段`
));
const emptyFieldLabel = computed(() => (props.layer.fields.length === 0 ? "暂无字段" : "无匹配字段"));
const sortControls = [
  { key: "name", label: "字段" },
  { key: "type", label: "类型" },
  { key: "nullable", label: "可空" },
  { key: "defaultValue", label: "默认值" },
  { key: "editable", label: "可编辑" }
] satisfies { key: FieldSortKey; label: string }[];

function sortAriaLabel(key: FieldSortKey, label: string) {
  if (sortKey.value !== key) {
    return `按${label}升序排序`;
  }
  return sortDirection.value === "asc" ? `按${label}降序排序` : `按${label}升序排序`;
}

function sortMark(key: FieldSortKey) {
  if (sortKey.value !== key) {
    return "";
  }
  return sortDirection.value === "asc" ? "▲" : "▼";
}

function setSort(key: FieldSortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortKey.value = key;
  sortDirection.value = "asc";
}

function compareFields(left: FieldMeta, right: FieldMeta) {
  const direction = sortDirection.value === "asc" ? 1 : -1;
  return compareValue(readSortValue(left), readSortValue(right)) * direction;
}

function readSortValue(field: FieldMeta) {
  if (sortKey.value === "type") {
    return typeLabel(field);
  }
  if (sortKey.value === "nullable") {
    return Number(field.nullable);
  }
  if (sortKey.value === "defaultValue") {
    return field.defaultValue ?? "";
  }
  if (sortKey.value === "editable") {
    return Number(field.editable);
  }
  return field.name;
}

function compareValue(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right), "zh-Hans-CN", {
    numeric: true,
    sensitivity: "base"
  });
}

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

      <section class="attribute-table__controls" aria-label="字段浏览">
        <label class="attribute-table__filter">
          <span class="attribute-table__filter-label">字段过滤</span>
          <input
            v-model="fieldSearch"
            class="attribute-table__filter-input focus-ring"
            type="search"
            aria-label="过滤字段"
            placeholder="字段 / 类型 / 默认值"
          />
        </label>
      </section>

      <div class="attribute-table__table-wrap">
        <table class="attribute-table__table">
          <thead>
            <tr>
              <th v-for="control in sortControls" :key="control.key" scope="col">
                <button
                  class="attribute-table__sort focus-ring"
                  type="button"
                  :aria-label="sortAriaLabel(control.key, control.label)"
                  @click="setSort(control.key)"
                >
                  <span>{{ control.label }}</span>
                  <span class="attribute-table__sort-mark" aria-hidden="true">{{ sortMark(control.key) }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody v-if="sortedFields.length > 0">
            <tr v-for="field in sortedFields" :key="field.name">
              <th scope="row">{{ field.name }}</th>
              <td>{{ typeLabel(field) }}</td>
              <td>{{ boolLabel(field.nullable) }}</td>
              <td>{{ valueLabel(field.defaultValue) }}</td>
              <td>{{ boolLabel(field.editable) }}</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr>
              <td class="attribute-table__empty" colspan="5">{{ emptyFieldLabel }}</td>
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

.attribute-table__controls {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #c8c8c8;
  padding: 8px 10px;
  background: #f5f5f5;
}

.attribute-table__filter {
  display: grid;
  width: min(360px, 100%);
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.attribute-table__filter-label {
  color: var(--qgis-muted);
  font-size: 11px;
}

.attribute-table__filter-input {
  min-height: 24px;
  min-width: 0;
  border: 1px solid #aeb6bf;
  background: var(--qgis-input);
  color: var(--qgis-text);
  padding: 3px 7px;
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
  padding: 0;
}

.attribute-table__table tbody th {
  background: #fafafa;
  font-weight: 600;
}

.attribute-table__sort {
  display: flex;
  width: 100%;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  border: 0;
  background: transparent;
  color: var(--qgis-text);
  padding: 5px 8px;
  text-align: left;
  font: inherit;
  font-weight: 600;
}

.attribute-table__sort:hover {
  background: var(--qgis-row-active);
}

.attribute-table__sort-mark {
  width: 12px;
  color: var(--qgis-blue);
  text-align: right;
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

  .attribute-table__filter {
    grid-template-columns: 1fr;
  }
}
</style>
