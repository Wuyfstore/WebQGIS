<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from "vue";
import type { LayerRegistration, LayerStylePatch } from "../../types/gis";

const props = defineProps<{
  layers: LayerRegistration[];
  activeLayerId: string;
  visibleLayerIds: Set<string>;
  editableLayerCount: number;
  canRestoreVisibleLayerIds: boolean;
}>();

const emit = defineEmits<{
  select: [layerId: string];
  toggle: [layerId: string];
  solo: [layerId: string];
  restoreVisibility: [];
  zoomToLayer: [layerId: string];
  openAttributeTable: [layerId: string];
  updateStyle: [layerId: string, patch: LayerStylePatch];
}>();

const contextMenu = shallowRef({
  visible: false,
  layerId: "",
  x: 0,
  y: 0
});
const contextMenuStyle = computed(() => ({
  left: `${contextMenu.value.x}px`,
  top: `${contextMenu.value.y}px`
}));
const contextLayer = computed(() => props.layers.find((layer) => layer.id === contextMenu.value.layerId));

function readNumber(event: Event): number {
  return Number((event.target as HTMLInputElement).value);
}

function openLayerContextMenu(event: MouseEvent, layerId: string) {
  event.preventDefault();
  emit("select", layerId);
  contextMenu.value = {
    visible: true,
    layerId,
    x: Math.min(event.clientX, window.innerWidth - 206),
    y: Math.min(event.clientY, window.innerHeight - 138)
  };
  window.addEventListener("click", closeLayerContextMenu, { once: true });
}

function closeLayerContextMenu() {
  contextMenu.value = {
    ...contextMenu.value,
    visible: false
  };
}

function runLayerCommand(action: () => void) {
  closeLayerContextMenu();
  action();
}

function runContextLayerCommand(action: (layerId: string) => void) {
  const layer = contextLayer.value;
  if (!layer) {
    closeLayerContextMenu();
    return;
  }
  runLayerCommand(() => action(layer.id));
}

onBeforeUnmount(() => {
  window.removeEventListener("click", closeLayerContextMenu);
});
</script>

<template>
  <section class="layer-panel">
    <section class="layer-panel__dock workbench-panel">
      <header class="layer-panel__header">
        <h2 class="layer-panel__title">图层</h2>
        <span class="layer-panel__summary">{{ editableLayerCount }} 可编辑</span>
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
          @contextmenu="openLayerContextMenu($event, layer.id)"
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

          <span class="layer-panel__symbol" :style="{ backgroundColor: layer.style.fill.slice(0, 7), borderColor: layer.style.stroke }"></span>

          <button class="layer-panel__select focus-ring" type="button" @click="emit('select', layer.id)">
            <span class="layer-panel__name">{{ layer.schema }}.{{ layer.table }}</span>
          </button>

          <span class="layer-panel__tag" :class="{ 'layer-panel__tag--readonly': !layer.editable }">
            {{ layer.editable ? "可编辑" : "只读" }}
          </span>
        </article>
      </div>
    </section>

    <section class="layer-panel__dock workbench-panel">
      <header class="layer-panel__header">
        <h2 class="layer-panel__title">图层样式</h2>
      </header>

      <div v-if="layers.length === 0" class="layer-panel__style-empty">选择图层后编辑符号样式</div>

      <div v-else class="layer-panel__style-list" aria-label="图层样式">
        <article
          v-for="layer in layers"
          :key="`${layer.id}-style`"
          v-show="activeLayerId === layer.id"
          class="layer-panel__style-card"
        >
          <div class="layer-panel__style-preview">
            <span class="layer-panel__preview-swatch" :style="{ backgroundColor: layer.style.fill.slice(0, 7), borderColor: layer.style.stroke }"></span>
            <div>
              <strong>单一符号 · 半透明面</strong>
              <span>{{ layer.geometryType }} · {{ Math.round(layer.style.opacity * 100) }}%</span>
            </div>
          </div>

          <label class="layer-panel__style-field">
            <span class="layer-panel__style-label">填充</span>
            <input
              class="layer-panel__swatch focus-ring"
              type="color"
              :value="layer.style.fill.slice(0, 7)"
              @change="emit('updateStyle', layer.id, { fill: ($event.target as HTMLInputElement).value })"
            />
            <span class="layer-panel__style-value">{{ layer.style.fill.slice(0, 7) }}</span>
          </label>

          <label class="layer-panel__style-field">
            <span class="layer-panel__style-label">边线</span>
            <input
              class="layer-panel__swatch focus-ring"
              type="color"
              :value="layer.style.stroke"
              @change="emit('updateStyle', layer.id, { stroke: ($event.target as HTMLInputElement).value })"
            />
            <span class="layer-panel__style-value">{{ layer.style.stroke }}</span>
          </label>

          <label class="layer-panel__style-field layer-panel__style-field--range">
            <span class="layer-panel__style-label">透明度</span>
            <input
              class="layer-panel__slider focus-ring"
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              :value="layer.style.opacity"
              @change="emit('updateStyle', layer.id, { opacity: readNumber($event) })"
            />
            <span class="layer-panel__style-value">{{ Math.round(layer.style.opacity * 100) }}%</span>
          </label>

          <label class="layer-panel__style-field layer-panel__style-field--range">
            <span class="layer-panel__style-label">线宽</span>
            <input
              class="layer-panel__slider focus-ring"
              type="range"
              min="0.5"
              max="8"
              step="0.5"
              :value="layer.style.strokeWidth"
              @change="emit('updateStyle', layer.id, { strokeWidth: readNumber($event) })"
            />
            <span class="layer-panel__style-value">{{ layer.style.strokeWidth }} px</span>
          </label>
        </article>
      </div>

      <Teleport to="body">
        <div v-if="contextMenu.visible && contextLayer" class="layer-panel__context-menu" :style="contextMenuStyle" role="menu">
          <button class="layer-panel__context-item" type="button" role="menuitem" @click="runContextLayerCommand((layerId) => emit('solo', layerId))">
            独显图层
          </button>
          <button
            class="layer-panel__context-item"
            :disabled="!canRestoreVisibleLayerIds"
            type="button"
            role="menuitem"
            @click="runLayerCommand(() => emit('restoreVisibility'))"
          >
            恢复上次可见性
          </button>
          <button class="layer-panel__context-item" type="button" role="menuitem" @click="runContextLayerCommand((layerId) => emit('zoomToLayer', layerId))">
            缩放到图层
          </button>
          <button class="layer-panel__context-item" type="button" role="menuitem" @click="runContextLayerCommand((layerId) => emit('openAttributeTable', layerId))">
            打开属性表
          </button>
        </div>
      </Teleport>
    </section>
  </section>
</template>

<style scoped>
.layer-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.layer-panel__dock {
  border-width: 1px 0 0;
}

.layer-panel__dock + .layer-panel__dock {
  margin-top: 0;
}

.layer-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 25px;
  border-bottom: 1px solid #9e9e9e;
  padding: 0 10px;
  background: var(--qgis-dock-title);
}

.layer-panel__title {
  margin: 0;
  color: var(--qgis-text);
  font-size: 13px;
  font-weight: 600;
}

.layer-panel__summary,
.layer-panel__empty {
  color: var(--qgis-muted);
  font-size: 12px;
}

.layer-panel__empty {
  min-height: 56px;
  display: grid;
  place-items: center;
}

.layer-panel__list {
  display: flex;
  flex-direction: column;
  padding: 8px;
}

.layer-panel__row {
  display: grid;
  grid-template-columns: 22px 24px minmax(0, 1fr) 76px;
  align-items: center;
  min-height: 28px;
  border: 1px solid #d0d0d0;
  border-bottom: 0;
  background: var(--qgis-row);
  padding: 0 8px;
}

.layer-panel__row:last-child {
  border-bottom: 1px solid #d0d0d0;
}

.layer-panel__row--active {
  border-color: #4b8edb;
  background: var(--qgis-row-active);
}

.layer-panel__visibility {
  display: grid;
  place-items: center;
}

.layer-panel__symbol {
  width: 18px;
  height: 10px;
  border: 1px solid;
}

.layer-panel__select {
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--qgis-text);
  text-align: left;
  padding: 0;
}

.layer-panel__context-menu {
  position: fixed;
  z-index: 40;
  width: 172px;
  border: 1px solid #8d8d8d;
  background: #f7f7f7;
  box-shadow: 2px 4px 12px rgba(15, 23, 42, 0.24);
  padding: 3px;
  font-size: 11px;
}

.layer-panel__context-item {
  display: block;
  width: 100%;
  min-height: 22px;
  border: 0;
  background: transparent;
  color: var(--qgis-text);
  padding: 3px 8px;
  text-align: left;
}

.layer-panel__context-item:hover:not(:disabled) {
  background: var(--qgis-row-active);
}

.layer-panel__context-item:disabled {
  color: var(--qgis-muted);
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

.layer-panel__tag {
  color: var(--qgis-muted);
  font-size: 12px;
  text-align: right;
}

.layer-panel__tag--readonly {
  color: var(--qgis-warn);
}

.layer-panel__style-list,
.layer-panel__style-empty {
  padding: 10px 12px 12px;
  background: var(--qgis-pane);
}

.layer-panel__style-empty {
  color: var(--qgis-muted);
}

.layer-panel__style-card {
  display: grid;
  gap: 10px;
}

.layer-panel__style-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #b7b7b7;
  background: var(--qgis-row);
  padding: 8px;
}

.layer-panel__style-preview strong,
.layer-panel__style-preview span {
  display: block;
}

.layer-panel__style-preview span {
  color: var(--qgis-muted);
  font-size: 11px;
}

.layer-panel__preview-swatch {
  width: 58px;
  height: 28px;
  border: 1px solid;
}

.layer-panel__style-field {
  display: grid;
  grid-template-columns: 54px 48px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.layer-panel__style-field--range {
  grid-template-columns: 54px minmax(0, 1fr) 46px;
}

.layer-panel__style-label,
.layer-panel__style-value {
  color: var(--qgis-muted);
  font-size: 12px;
}

.layer-panel__swatch {
  width: 46px;
  height: 22px;
  border: 1px solid #8f8f8f;
  padding: 2px;
  background: var(--qgis-input);
}

.layer-panel__slider {
  width: 100%;
  min-width: 0;
  accent-color: #6f8a54;
}

@media (max-width: 760px) {
  .layer-panel__style-field,
  .layer-panel__style-field--range {
    grid-template-columns: 54px minmax(0, 1fr);
  }

  .layer-panel__style-value {
    grid-column: 2;
  }
}
</style>
