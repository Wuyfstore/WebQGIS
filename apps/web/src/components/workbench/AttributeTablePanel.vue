<script setup lang="ts">
import { Close } from "@element-plus/icons-vue";
import { useDraggable, useSorted } from "@vueuse/core";
import { computed, shallowRef, useTemplateRef } from "vue";
import type { AttributeCalculationPayload, AttributeTableQuery, FeatureSummary, FieldMeta, LayerRegistration, SqlQueryResult } from "../../types/gis";

const props = defineProps<{
  layer: LayerRegistration;
  features: FeatureSummary[];
  total: number;
  sqlResult: SqlQueryResult | null;
  query: AttributeTableQuery;
  busy: boolean;
}>();

const emit = defineEmits<{
  close: [];
  query: [patch: Partial<AttributeTableQuery>];
  calculate: [payload: AttributeCalculationPayload];
  sqlQuery: [payload: { sql: string; limit: number }];
}>();

type FieldSortKey = "name" | "type" | "nullable" | "defaultValue" | "editable";
type SortDirection = "asc" | "desc";
type ActiveTab = "records" | "fields" | "calculator" | "sql";

const panelRef = useTemplateRef<HTMLElement>("panelRef");
const handleRef = useTemplateRef<HTMLElement>("handleRef");
const activeTab = shallowRef<ActiveTab>("records");
const fieldSearch = shallowRef("");
const recordSearchDraft = shallowRef("");
const sortKey = shallowRef<FieldSortKey>("name");
const sortDirection = shallowRef<SortDirection>("asc");
const columnWidths = shallowRef<Record<string, number>>({});
const calculatorTargetField = shallowRef("");
const calculatorExpression = shallowRef("");
const calculatorWhere = shallowRef("");
const sqlDraft = shallowRef("select * from {layer}");
const sqlLimit = shallowRef(100);
const calculatorFunctionGroups = [
  {
    label: "字符串",
    items: [
      { label: "upper", insert: "upper()" },
      { label: "lower", insert: "lower()" },
      { label: "concat", insert: "concat(, )" }
    ]
  },
  {
    label: "数学",
    items: [
      { label: "round", insert: "round(, 2)" },
      { label: "abs", insert: "abs()" },
      { label: "coalesce", insert: "coalesce(, '')" }
    ]
  },
  {
    label: "条件",
    items: [
      { label: "case when", insert: "case when  then  else  end" },
      { label: "nullif", insert: "nullif(, )" },
      { label: "now", insert: "now()" }
    ]
  }
] as const;

const { style: draggableStyle } = useDraggable(panelRef, {
  handle: handleRef,
  initialValue: { x: 420, y: 420 },
  preventDefault: true
});

const layerLabel = computed(() => `${props.layer.schema}.${props.layer.table}`);
const normalizedFieldSearch = computed(() => fieldSearch.value.trim().toLowerCase());
const propertyFields = computed(() => props.layer.fields.filter((field) => field.name !== props.layer.geometryColumn));
const editablePropertyFields = computed(() => propertyFields.value.filter((field) => field.editable));
const displayColumns = computed(() => propertyFields.value.slice(0, 12));
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.query.limit)));
const currentPage = computed(() => Math.floor(props.query.offset / props.query.limit) + 1);
const featureLimitLabel = computed(() => (
  props.total === 0
    ? "0 条记录"
    : `${props.query.offset + 1}-${props.query.offset + props.features.length} / ${props.total} 条记录`
));
const canGoPrevious = computed(() => props.query.offset > 0 && !props.busy);
const canGoNext = computed(() => props.query.offset + props.query.limit < props.total && !props.busy);
const serverSortLabel = computed(() => {
  const sort = props.query.sort ?? props.layer.primaryKey ?? "id";
  return `${sort} ${props.query.order === "asc" ? "升序" : "降序"}`;
});
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
  const query = normalizedFieldSearch.value;
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
  normalizedFieldSearch.value
    ? `${sortedFields.value.length}/${props.layer.fields.length} 个字段`
    : `${props.layer.fields.length} 个字段`
));
const recordCountLabel = computed(() => `${props.features.length}/${props.total} 条记录`);
const emptyFieldLabel = computed(() => (props.layer.fields.length === 0 ? "暂无字段" : "无匹配字段"));
const emptyRecordLabel = computed(() => (props.features.length === 0 ? "暂无属性记录" : "无匹配记录"));
const calculatorPreview = computed(() => {
  const targetField = calculatorTargetField.value || editablePropertyFields.value[0]?.name || "未选择字段";
  const expression = calculatorExpression.value.trim() || "未填写表达式";
  const where = calculatorWhere.value.trim();
  return [
    `UPDATE ${props.layer.schema}.${props.layer.table}`,
    `SET ${targetField} = ${expression}`,
    where ? `WHERE ${where};` : "WHERE <当前过滤器或全部记录>;"
  ].join("\n");
});
const sortControls = [
  { key: "name", label: "字段" },
  { key: "type", label: "类型" },
  { key: "nullable", label: "可空" },
  { key: "defaultValue", label: "默认值" },
  { key: "editable", label: "可编辑" }
] satisfies { key: FieldSortKey; label: string }[];

function submitCalculation() {
  const targetField = calculatorTargetField.value || editablePropertyFields.value[0]?.name;
  if (!targetField || !calculatorExpression.value.trim()) {
    return;
  }
  emit("calculate", {
    targetField,
    expression: calculatorExpression.value.trim(),
    where: calculatorWhere.value.trim() || undefined
  });
}

function submitSqlQuery() {
  if (!sqlDraft.value.trim()) {
    return;
  }
  emit("sqlQuery", {
    sql: sqlDraft.value.trim(),
    limit: sqlLimit.value
  });
}

function insertExpressionToken(token: string) {
  const prefix = calculatorExpression.value.trim();
  const spacer = prefix && !prefix.endsWith(" ") ? " " : "";
  calculatorExpression.value = `${prefix}${spacer}${token}`.trim();
}

function insertFieldExpression(field: FieldMeta) {
  insertExpressionToken(`"${field.name}"`);
}

function columnStyle(column: string) {
  const width = columnWidths.value[column] ?? (column === "__id" ? 96 : 136);
  return {
    width: `${width}px`,
    minWidth: `${width}px`
  };
}

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

function setRecordSearch() {
  emit("query", {
    search: recordSearchDraft.value.trim(),
    offset: 0
  });
}

function setPageSize(event: Event) {
  emit("query", {
    limit: Number((event.target as HTMLSelectElement).value),
    offset: 0
  });
}

function goPage(direction: -1 | 1) {
  emit("query", {
    offset: Math.max(0, props.query.offset + props.query.limit * direction)
  });
}

function setServerSort(fieldName: string) {
  const nextOrder = props.query.sort === fieldName && props.query.order === "asc" ? "desc" : "asc";
  emit("query", {
    sort: fieldName,
    order: nextOrder,
    offset: 0
  });
}

function startColumnResize(event: PointerEvent, column: string) {
  const startX = event.clientX;
  const startWidth = columnWidths.value[column] ?? (column === "__id" ? 96 : 136);
  const onMove = (moveEvent: PointerEvent) => {
    columnWidths.value = {
      ...columnWidths.value,
      [column]: Math.max(72, startWidth + moveEvent.clientX - startX)
    };
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
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

function valueLabel(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function boolLabel(value: boolean) {
  return value ? "是" : "否";
}
</script>

<template>
  <Teleport to="body">
    <section
      ref="panelRef"
      class="attribute-table"
      :style="draggableStyle"
      role="dialog"
      aria-modal="false"
      aria-labelledby="attribute-table-title"
    >
    <header ref="handleRef" class="attribute-table__header">
      <div class="attribute-table__title-group">
        <h2 id="attribute-table-title" class="attribute-table__title">
          属性表 - {{ layerLabel }}
        </h2>
        <span class="attribute-table__subtitle">{{ recordCountLabel }} · {{ fieldCountLabel }} · {{ serverSortLabel }}</span>
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

    <div class="attribute-table__tabs" role="tablist" aria-label="属性表视图">
      <button
        class="attribute-table__tab focus-ring"
        :class="{ 'attribute-table__tab--active': activeTab === 'records' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'records'"
        @click="activeTab = 'records'"
      >
        属性数据
      </button>
      <button
        class="attribute-table__tab focus-ring"
        :class="{ 'attribute-table__tab--active': activeTab === 'fields' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'fields'"
        @click="activeTab = 'fields'"
      >
        字段结构
      </button>
      <button
        class="attribute-table__tab focus-ring"
        :class="{ 'attribute-table__tab--active': activeTab === 'calculator' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'calculator'"
        @click="activeTab = 'calculator'"
      >
        属性计算器
      </button>
      <button
        class="attribute-table__tab focus-ring"
        :class="{ 'attribute-table__tab--active': activeTab === 'sql' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'sql'"
        @click="activeTab = 'sql'"
      >
        SQL 查询
      </button>
    </div>

    <template v-if="activeTab === 'records'">
      <section class="attribute-table__controls" aria-label="属性记录浏览">
        <label class="attribute-table__filter">
          <span class="attribute-table__filter-label">服务端过滤</span>
          <input
            v-model="recordSearchDraft"
            class="attribute-table__filter-input focus-ring"
            type="search"
            aria-label="过滤属性记录"
            placeholder="主键 / 属性值"
            @keydown.enter="setRecordSearch"
          />
        </label>
        <button class="attribute-table__pager-button focus-ring" :disabled="busy" type="button" @click="setRecordSearch">
          查询
        </button>
        <label class="attribute-table__page-size">
          <span>每页</span>
          <select class="attribute-table__page-select focus-ring" :value="query.limit" :disabled="busy" @change="setPageSize">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select>
        </label>
        <div class="attribute-table__pager" aria-label="属性表分页">
          <button class="attribute-table__pager-button focus-ring" :disabled="!canGoPrevious" type="button" @click="goPage(-1)">
            上一页
          </button>
          <span class="attribute-table__limit-note">{{ featureLimitLabel }} · 第 {{ currentPage }}/{{ totalPages }} 页</span>
          <button class="attribute-table__pager-button focus-ring" :disabled="!canGoNext" type="button" @click="goPage(1)">
            下一页
          </button>
        </div>
      </section>

      <div class="attribute-table__table-wrap">
        <table class="attribute-table__table">
          <thead>
            <tr>
              <th class="attribute-table__id-col" scope="col" :style="columnStyle('__id')">
                <button class="attribute-table__record-sort focus-ring" type="button" @click="setServerSort(layer.primaryKey ?? 'id')">
                  {{ layer.primaryKey ?? "id" }}
                </button>
                <span class="attribute-table__resize-handle" @pointerdown.prevent="startColumnResize($event, '__id')"></span>
              </th>
              <th v-for="field in displayColumns" :key="field.name" scope="col" :style="columnStyle(field.name)">
                <button class="attribute-table__record-sort focus-ring" type="button" @click="setServerSort(field.name)">
                  {{ field.name }}
                </button>
                <span class="attribute-table__resize-handle" @pointerdown.prevent="startColumnResize($event, field.name)"></span>
              </th>
            </tr>
          </thead>
          <tbody v-if="features.length > 0">
            <tr v-for="feature in features" :key="String(feature.id ?? JSON.stringify(feature.properties))">
              <th scope="row">{{ valueLabel(feature.id) }}</th>
              <td v-for="field in displayColumns" :key="field.name">
                {{ valueLabel(feature.properties[field.name]) }}
              </td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr>
              <td class="attribute-table__empty" :colspan="displayColumns.length + 1">{{ emptyRecordLabel }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else-if="activeTab === 'fields'">
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
    </template>

    <template v-else-if="activeTab === 'calculator'">
      <section class="attribute-table__calculator" aria-label="属性计算器">
        <aside class="attribute-table__calculator-browser" aria-label="字段和函数">
          <section class="attribute-table__calculator-group">
            <h3 class="attribute-table__calculator-heading">字段和值</h3>
            <button
              v-for="field in propertyFields"
              :key="field.name"
              class="attribute-table__calculator-item focus-ring"
              type="button"
              @click="insertFieldExpression(field)"
            >
              <span class="attribute-table__calculator-item-name">"{{ field.name }}"</span>
              <span class="attribute-table__calculator-item-meta">{{ typeLabel(field) }}</span>
            </button>
          </section>
          <section v-for="group in calculatorFunctionGroups" :key="group.label" class="attribute-table__calculator-group">
            <h3 class="attribute-table__calculator-heading">{{ group.label }}</h3>
            <button
              v-for="item in group.items"
              :key="item.label"
              class="attribute-table__calculator-item focus-ring"
              type="button"
              @click="insertExpressionToken(item.insert)"
            >
              <span class="attribute-table__calculator-item-name">{{ item.label }}</span>
              <span class="attribute-table__calculator-item-meta">{{ item.insert }}</span>
            </button>
          </section>
        </aside>

        <section class="attribute-table__calculator-editor" aria-label="表达式编辑">
          <label class="attribute-table__tool-field">
            <span>表达式</span>
            <textarea
              v-model="calculatorExpression"
              class="attribute-table__tool-textarea attribute-table__tool-textarea--expression focus-ring"
              :disabled="busy"
              spellcheck="false"
              placeholder="例如 upper(&quot;name&quot;) 或 &quot;adcode&quot; + 1"
            ></textarea>
          </label>
          <div class="attribute-table__calculator-operators" aria-label="常用操作符">
            <button v-for="operator in ['+', '-', '*', '/', '(', ')', '=', 'and', 'or']" :key="operator" class="attribute-table__operator focus-ring" type="button" @click="insertExpressionToken(operator)">
              {{ operator }}
            </button>
          </div>
          <label class="attribute-table__tool-field">
            <span>预览 SQL</span>
            <textarea class="attribute-table__tool-textarea attribute-table__tool-textarea--preview focus-ring" :value="calculatorPreview" readonly></textarea>
          </label>
        </section>

        <aside class="attribute-table__calculator-options" aria-label="输出字段和过滤">
          <label class="attribute-table__tool-field">
            <span>输出字段</span>
            <select v-model="calculatorTargetField" class="attribute-table__tool-input focus-ring" :disabled="busy || editablePropertyFields.length === 0">
              <option value="">选择可编辑字段</option>
              <option v-for="field in editablePropertyFields" :key="field.name" :value="field.name">
                {{ field.name }} · {{ typeLabel(field) }}
              </option>
            </select>
          </label>
          <label class="attribute-table__tool-field">
            <span>仅更新匹配要素</span>
            <input
              v-model="calculatorWhere"
              class="attribute-table__tool-input focus-ring"
              :disabled="busy"
              placeholder='可选，例如 "adcode" is not null'
            />
          </label>
          <div class="attribute-table__calculator-summary">
            <span>目标图层</span>
            <strong>{{ layerLabel }}</strong>
            <span>可编辑字段</span>
            <strong>{{ editablePropertyFields.length }} 个</strong>
          </div>
          <button class="attribute-table__calculator-run focus-ring" :disabled="busy || editablePropertyFields.length === 0 || !calculatorExpression.trim()" type="button" @click="submitCalculation">
            执行计算
          </button>
          <p class="attribute-table__tool-note">
            字段请使用双引号；服务端仅允许当前图层字段、只读表达式和少量安全函数。
          </p>
        </aside>
      </section>
    </template>

    <template v-else>
      <section class="attribute-table__tool-panel" aria-label="SQL 查询">
        <label class="attribute-table__tool-field attribute-table__tool-field--wide">
          <span>SQL</span>
          <textarea
            v-model="sqlDraft"
            class="attribute-table__tool-textarea attribute-table__tool-textarea--sql focus-ring"
            :disabled="busy"
            spellcheck="false"
          ></textarea>
        </label>
        <label class="attribute-table__tool-field">
          <span>返回上限</span>
          <select v-model.number="sqlLimit" class="attribute-table__tool-input focus-ring" :disabled="busy">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select>
        </label>
        <button class="attribute-table__pager-button focus-ring" :disabled="busy || !sqlDraft.trim()" type="button" @click="submitSqlQuery">
          执行 SQL
        </button>
        <p class="attribute-table__tool-note">
          仅允许当前图层的单条 SELECT；推荐使用 {layer} 代表当前表，也支持当前表名占位符 {schema.table}；服务端强制只读事务和 LIMIT。
        </p>
      </section>
      <div v-if="sqlResult" class="attribute-table__table-wrap">
        <table class="attribute-table__table">
          <thead>
            <tr>
              <th v-for="column in sqlResult.columns" :key="column" scope="col">
                {{ column }}
              </th>
            </tr>
          </thead>
          <tbody v-if="sqlResult.rows.length > 0">
            <tr v-for="(row, rowIndex) in sqlResult.rows" :key="rowIndex">
              <td v-for="column in sqlResult.columns" :key="column">
                {{ valueLabel(row[column]) }}
              </td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr>
              <td class="attribute-table__empty" :colspan="Math.max(1, sqlResult.columns.length)">SQL 查询无结果</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    </section>
  </Teleport>
</template>

<style scoped>
.attribute-table {
  position: fixed;
  z-index: var(--qgis-z-floating-panel);
  width: min(1080px, calc(100vw - 32px));
  max-height: min(580px, calc(100vh - 32px));
  border: 1px solid #8d8d8d;
  background: var(--qgis-pane);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}

.attribute-table__header {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #a5a5a5;
  background: var(--qgis-dock-title);
  cursor: move;
  padding: 0 8px 0 12px;
  user-select: none;
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
  cursor: pointer;
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
  padding: 7px 10px;
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

.attribute-table__tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #b6b6b6;
  background: #e2e2e2;
  padding: 5px 8px;
}

.attribute-table__tab {
  min-height: 25px;
  border: 1px solid #b6b6b6;
  background: #d7d7d7;
  color: var(--qgis-muted);
  padding: 3px 14px;
  font-size: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
}

.attribute-table__tab--active {
  border-color: #8f8f8f;
  background: #c9c9c9;
  color: var(--qgis-text);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    inset 0 -1px 0 #9c9c9c;
}

.attribute-table__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #c8c8c8;
  padding: 8px 10px;
  background: #f5f5f5;
}

.attribute-table__filter {
  display: grid;
  width: min(320px, 100%);
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

.attribute-table__page-size,
.attribute-table__pager {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--qgis-muted);
  font-size: 11px;
}

.attribute-table__page-select,
.attribute-table__pager-button {
  min-height: 24px;
  border: 1px solid #9a9a9a;
  background: #e8e8e8;
  color: var(--qgis-text);
  padding: 2px 8px;
  font-size: 11px;
}

.attribute-table__page-select {
  background: #ffffff;
}

.attribute-table__pager-button:disabled,
.attribute-table__page-select:disabled {
  color: var(--qgis-muted);
  opacity: 0.7;
}

.attribute-table__limit-note {
  color: var(--qgis-muted);
  font-size: 11px;
  white-space: nowrap;
}

.attribute-table__table-wrap {
  max-height: 300px;
  overflow: auto;
  background: #ffffff;
}

.attribute-table__table {
  min-width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--qgis-text);
  font-size: 12px;
}

.attribute-table__table th,
.attribute-table__table td {
  min-width: 120px;
  border: 1px solid #d2d2d2;
  padding: 5px 8px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attribute-table__table .attribute-table__id-col,
.attribute-table__table tbody th {
  min-width: 90px;
}

.attribute-table__table thead th {
  position: sticky;
  top: 0;
  background: #e6e6e6;
  font-weight: 600;
  padding: 0;
  z-index: 1;
}

.attribute-table__record-sort {
  display: block;
  width: 100%;
  min-height: 28px;
  border: 0;
  background: transparent;
  color: var(--qgis-text);
  padding: 5px 18px 5px 8px;
  text-align: left;
  font: inherit;
  font-weight: 600;
}

.attribute-table__record-sort:hover {
  background: var(--qgis-row-active);
}

.attribute-table__resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
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
  color: var(--qgis-muted);
  text-align: right;
}

.attribute-table__empty {
  color: var(--qgis-muted);
  text-align: center;
}

.attribute-table__tool-panel {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto;
  gap: 10px;
  padding: 12px;
  background: #f5f5f5;
}

.attribute-table__tool-field {
  display: grid;
  gap: 5px;
  color: var(--qgis-muted);
  font-size: 11px;
}

.attribute-table__tool-field--wide,
.attribute-table__tool-note {
  grid-column: 1 / -1;
}

.attribute-table__tool-input,
.attribute-table__tool-textarea {
  min-height: 26px;
  border: 1px solid #aeb6bf;
  background: var(--qgis-input);
  color: var(--qgis-text);
  padding: 4px 7px;
  font: inherit;
}

.attribute-table__tool-textarea {
  min-height: 78px;
  resize: vertical;
}

.attribute-table__tool-textarea--sql {
  font-family: Consolas, "Cascadia Mono", monospace;
}

.attribute-table__tool-note {
  margin: 0;
  color: var(--qgis-muted);
  font-size: 11px;
}

.attribute-table__calculator {
  display: grid;
  grid-template-columns: 220px minmax(260px, 1fr) 230px;
  min-height: 360px;
  background: #f5f5f5;
}

.attribute-table__calculator-browser,
.attribute-table__calculator-editor,
.attribute-table__calculator-options {
  min-width: 0;
  border-right: 1px solid #c8c8c8;
  padding: 10px;
}

.attribute-table__calculator-browser {
  max-height: 390px;
  overflow: auto;
  background: #eeeeee;
}

.attribute-table__calculator-editor {
  display: grid;
  gap: 10px;
  align-content: start;
  background: #f8f8f8;
}

.attribute-table__calculator-options {
  display: grid;
  gap: 10px;
  align-content: start;
  border-right: 0;
  background: #f1f1f1;
}

.attribute-table__calculator-group {
  display: grid;
  gap: 3px;
  margin-bottom: 10px;
}

.attribute-table__calculator-heading {
  margin: 0;
  border: 1px solid #b6b6b6;
  background: #dedede;
  color: var(--qgis-text);
  padding: 5px 7px;
  font-size: 12px;
}

.attribute-table__calculator-item {
  display: grid;
  min-height: 30px;
  gap: 2px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--qgis-text);
  padding: 4px 7px;
  text-align: left;
}

.attribute-table__calculator-item:hover {
  border-color: #c8c8c8;
  background: var(--qgis-row-active);
}

.attribute-table__calculator-item-name {
  font-weight: 600;
}

.attribute-table__calculator-item-meta {
  color: var(--qgis-muted);
  font-size: 11px;
}

.attribute-table__tool-textarea--expression {
  min-height: 136px;
  font-family: Consolas, "Cascadia Mono", monospace;
}

.attribute-table__tool-textarea--preview {
  min-height: 98px;
  background: #eeeeee;
  color: var(--qgis-muted);
  font-family: Consolas, "Cascadia Mono", monospace;
}

.attribute-table__calculator-operators {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.attribute-table__operator {
  min-width: 34px;
  min-height: 26px;
  border: 1px solid #9a9a9a;
  background: #e8e8e8;
  color: var(--qgis-text);
  padding: 2px 8px;
  font-size: 11px;
}

.attribute-table__calculator-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 5px 8px;
  border: 1px solid #c8c8c8;
  background: #ffffff;
  padding: 8px;
}

.attribute-table__calculator-summary span {
  color: var(--qgis-muted);
}

.attribute-table__calculator-summary strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attribute-table__calculator-run {
  min-height: 30px;
  border: 1px solid #8f8f8f;
  background: #d8d8d8;
  color: var(--qgis-text);
  padding: 5px 10px;
  font-weight: 600;
}

.attribute-table__calculator-run:disabled {
  color: var(--qgis-muted);
  opacity: 0.7;
}

@media (max-width: 760px) {
  .attribute-table {
    width: calc(100vw - 24px);
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

  .attribute-table__controls {
    align-items: stretch;
    flex-direction: column;
  }

  .attribute-table__limit-note {
    white-space: normal;
  }

  .attribute-table__calculator {
    grid-template-columns: 1fr;
  }

  .attribute-table__calculator-browser,
  .attribute-table__calculator-editor,
  .attribute-table__calculator-options {
    border-right: 0;
    border-bottom: 1px solid #c8c8c8;
  }
}
</style>
