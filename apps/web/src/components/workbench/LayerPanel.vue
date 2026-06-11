<script setup lang="ts">
import type { LayerRegistration } from "../../types/gis";

defineProps<{
  layers: LayerRegistration[];
  activeLayerId: string;
  visibleLayerIds: Set<string>;
  editableLayerCount: number;
}>();

const emit = defineEmits<{
  select: [layerId: string];
  toggle: [layerId: string];
}>();
</script>

<template>
  <section class="layer-panel workbench-panel">
    <header class="layer-panel__header">
      <h2 class="layer-panel__title">图层</h2>
      <span class="layer-panel__summary">{{ editableLayerCount }} 个可编辑</span>
    </header>

    <div v-if="layers.length === 0" class="layer-panel__empty">
      暂无图层
    </div>

    <div v-else class="layer-panel__list" aria-label="空间图层">
      <article
        v-for="layer in layers"
        :key="layer.id"
        class="layer-panel__row"
        :class="{ 'layer-panel__row--active': activeLayerId === layer.id }"
      >
        <label class="layer-panel__visibility">
          <input
            class="focus-ring"
            type="checkbox"
            :checked="visibleLayerIds.has(layer.id)"
            :aria-label="`显示 ${layer.schema}.${layer.table}`"
            @change="emit('toggle', layer.id)"
          />
        </label>

        <button class="layer-panel__select focus-ring" type="button" @click="emit('select', layer.id)">
          <span class="layer-panel__name">{{ layer.schema }}.{{ layer.table }}</span>
          <span class="layer-panel__meta">{{ layer.geometryType }} · SRID {{ layer.srid ?? "未知" }}</span>
        </button>

        <span class="layer-panel__tag" :class="{ 'layer-panel__tag--readonly': !layer.editable }">
          {{ layer.editable ? "编辑" : "只读" }}
        </span>
      </article>
    </div>
  </section>
</template>

<style scoped>
.layer-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}

.layer-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.layer-panel__title {
  margin: 0;
  color: #172033;
  font-size: 14px;
}

.layer-panel__summary,
.layer-panel__empty {
  color: #64748b;
  font-size: 12px;
}

.layer-panel__empty {
  min-height: 44px;
  display: grid;
  place-items: center;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
}

.layer-panel__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.layer-panel__row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
  padding: 7px;
  background: #ffffff;
}

.layer-panel__row--active {
  border-color: #2563eb;
  box-shadow: inset 3px 0 0 #2563eb;
}

.layer-panel__visibility {
  display: grid;
  place-items: center;
}

.layer-panel__select {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  border: 0;
  background: transparent;
  color: #172033;
  text-align: left;
}

.layer-panel__name,
.layer-panel__meta {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-panel__name {
  font-size: 13px;
}

.layer-panel__meta {
  color: #64748b;
  font-size: 12px;
}

.layer-panel__tag {
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-size: 12px;
  padding: 3px 8px;
}

.layer-panel__tag--readonly {
  background: #fee2e2;
  color: #991b1b;
}
</style>
