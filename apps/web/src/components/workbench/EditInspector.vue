<script setup lang="ts">
import { computed } from "vue";
import { isNumericField } from "../../utils/layer";
import type { FieldMeta, LayerRegistration } from "../../types/gis";

const props = defineProps<{
  activeLayer?: LayerRegistration;
  editableFields: FieldMeta[];
  selectedLayerStatus: string;
  selectedFeatureId: string | null;
}>();

const selectedProperties = defineModel<Record<string, unknown>>("selectedProperties", { required: true });

const layerName = computed(() => (
  props.activeLayer ? `${props.activeLayer.schema}.${props.activeLayer.table}` : "无"
));
</script>

<template>
  <aside class="edit-inspector">
    <section class="edit-inspector__panel workbench-panel">
      <h2 class="edit-inspector__title">编辑面板</h2>
      <dl class="edit-inspector__meta">
        <dt class="edit-inspector__term">当前图层</dt>
        <dd class="edit-inspector__desc">{{ layerName }}</dd>
        <dt class="edit-inspector__term">状态</dt>
        <dd class="edit-inspector__desc">{{ selectedLayerStatus }}</dd>
        <dt class="edit-inspector__term">主键</dt>
        <dd class="edit-inspector__desc">{{ activeLayer?.primaryKey ?? "无" }}</dd>
        <dt class="edit-inspector__term">空间索引</dt>
        <dd class="edit-inspector__desc">{{ activeLayer?.hasSpatialIndex ? "已存在" : "未检测到" }}</dd>
        <dt class="edit-inspector__term">要素</dt>
        <dd class="edit-inspector__desc">{{ selectedFeatureId ?? "未选择" }}</dd>
      </dl>
    </section>

    <section class="edit-inspector__panel workbench-panel">
      <h2 class="edit-inspector__title">属性</h2>
      <div v-if="editableFields.length === 0" class="edit-inspector__empty">没有可编辑字段</div>
      <label v-for="field in editableFields" :key="field.name" class="edit-inspector__field">
        <span class="edit-inspector__field-name">{{ field.name }}</span>
        <input
          v-model="selectedProperties[field.name]"
          class="edit-inspector__input focus-ring"
          :name="`field-${field.name}`"
          :placeholder="field.dataType"
          :type="isNumericField(field.dataType) ? 'number' : 'text'"
          autocomplete="off"
        />
      </label>
    </section>
  </aside>
</template>

<style scoped>
.edit-inspector {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding: 12px;
  background: #f8fafc;
  border-left: 1px solid #dbe3ef;
}

.edit-inspector__panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}

.edit-inspector__title {
  margin: 0;
  color: #172033;
  font-size: 14px;
}

.edit-inspector__meta {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 8px;
  margin: 0;
  font-size: 13px;
}

.edit-inspector__term {
  color: #64748b;
}

.edit-inspector__desc {
  margin: 0;
  word-break: break-word;
}

.edit-inspector__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #52627a;
  font-size: 13px;
}

.edit-inspector__input {
  min-height: 34px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 7px 9px;
  background: #ffffff;
  color: #172033;
}

.edit-inspector__empty {
  min-height: 40px;
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 1100px) {
  .edit-inspector {
    grid-column: 1 / -1;
    min-height: 260px;
    border-left: 0;
    border-top: 1px solid #dbe3ef;
  }
}
</style>
