<script setup lang="ts">
import type { LayerRegistration, LayerStylePatch } from "../../types/gis";

defineProps<{
  layers: LayerRegistration[];
  activeLayerId: string;
  visibleLayerIds: Set<string>;
  editableLayerCount: number;
}>();

const emit = defineEmits<{
  select: [layerId: string];
  toggle: [layerId: string];
  updateStyle: [layerId: string, patch: LayerStylePatch];
}>();

function readNumber(event: Event): number {
  return Number((event.target as HTMLInputElement).value);
}
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

        <div class="layer-panel__style" aria-label="图层样式">
          <label class="layer-panel__color">
            <span class="layer-panel__style-label">填充</span>
            <input
              class="layer-panel__swatch focus-ring"
              type="color"
              :value="layer.style.fill.slice(0, 7)"
              @change="emit('updateStyle', layer.id, { fill: ($event.target as HTMLInputElement).value })"
            />
          </label>

          <label class="layer-panel__color">
            <span class="layer-panel__style-label">描边</span>
            <input
              class="layer-panel__swatch focus-ring"
              type="color"
              :value="layer.style.stroke"
              @change="emit('updateStyle', layer.id, { stroke: ($event.target as HTMLInputElement).value })"
            />
          </label>

          <label class="layer-panel__range">
            <span class="layer-panel__style-label">透明度 {{ Math.round(layer.style.opacity * 100) }}%</span>
            <input
              class="layer-panel__slider focus-ring"
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              :value="layer.style.opacity"
              @change="emit('updateStyle', layer.id, { opacity: readNumber($event) })"
            />
          </label>

          <label class="layer-panel__range">
            <span class="layer-panel__style-label">线宽 {{ layer.style.strokeWidth }}</span>
            <input
              class="layer-panel__slider focus-ring"
              type="range"
              min="0.5"
              max="8"
              step="0.5"
              :value="layer.style.strokeWidth"
              @change="emit('updateStyle', layer.id, { strokeWidth: readNumber($event) })"
            />
          </label>
        </div>
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

.layer-panel__style {
  display: grid;
  grid-column: 2 / -1;
  grid-template-columns: repeat(2, minmax(0, 72px)) minmax(0, 1fr);
  align-items: center;
  gap: 8px 10px;
  padding-top: 4px;
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

.layer-panel__color,
.layer-panel__range {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.layer-panel__range {
  grid-column: span 1;
}

.layer-panel__style-label {
  overflow: hidden;
  color: #64748b;
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-panel__swatch {
  width: 42px;
  height: 28px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 2px;
  background: #ffffff;
}

.layer-panel__slider {
  width: 100%;
  min-width: 0;
  accent-color: #2563eb;
}

@media (max-width: 760px) {
  .layer-panel__style {
    grid-template-columns: repeat(2, minmax(0, 72px)) minmax(120px, 1fr);
  }
}
</style>
