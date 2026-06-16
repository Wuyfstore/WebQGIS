<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from "vue";
import type { LayerRegistration } from "../../types/gis";
import { hasLayerDragPayload, readLayerDragPayload } from "../../utils/layerDrag";

const props = defineProps<{
  layers: LayerRegistration[];
  activeLayerId: string;
  editingLayerId: string | null;
  dragLayerFallbackId?: string | null;
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
  openStyleEditor: [layerId: string];
  startEditing: [layerId: string];
  stopEditing: [layerId: string];
  removeLayer: [layerId: string];
  layerDrop: [layerId: string];
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
const isContextLayerEditing = computed(() => Boolean(contextLayer.value && props.editingLayerId === contextLayer.value.id));
const isLayerDragOver = shallowRef(false);

function handleLayerDragOver(event: DragEvent) {
  if (!hasLayerDragPayload(event, props.dragLayerFallbackId)) {
    return;
  }
  event.preventDefault();
  isLayerDragOver.value = true;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
}

function handleLayerDrop(event: DragEvent) {
  const layerId = readLayerDragPayload(event, props.dragLayerFallbackId);
  if (!layerId) {
    isLayerDragOver.value = false;
    return;
  }
  event.preventDefault();
  isLayerDragOver.value = false;
  emit("layerDrop", layerId);
}

function openLayerContextMenu(event: MouseEvent, layerId: string) {
  event.preventDefault();
  emit("select", layerId);
  contextMenu.value = {
    visible: true,
    layerId,
    x: Math.min(event.clientX, window.innerWidth - 206),
    y: Math.min(event.clientY, window.innerHeight - 164)
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
    <section
      class="layer-panel__dock workbench-panel"
      :class="{ 'layer-panel__dock--drop-target': isLayerDragOver }"
      @dragenter="handleLayerDragOver"
      @dragover="handleLayerDragOver"
      @dragleave="isLayerDragOver = false"
      @drop="handleLayerDrop"
    >
      <header class="layer-panel__header">
        <h2 class="layer-panel__title">图层</h2>
        <span class="layer-panel__summary">{{ editableLayerCount }} 可编辑</span>
      </header>

      <div v-if="layers.length === 0" class="layer-panel__empty">
        从浏览器拖入空间表以添加图层
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
            {{ editingLayerId === layer.id ? "编辑中" : layer.editable ? "可编辑" : "只读" }}
          </span>
        </article>
      </div>
    </section>

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
        <button class="layer-panel__context-item" type="button" role="menuitem" @click="runContextLayerCommand((layerId) => emit('openStyleEditor', layerId))">
          图层样式
        </button>
        <button
          v-if="isContextLayerEditing"
          class="layer-panel__context-item"
          type="button"
          role="menuitem"
          @click="runContextLayerCommand((layerId) => emit('stopEditing', layerId))"
        >
          关闭编辑
        </button>
        <button
          v-else
          class="layer-panel__context-item"
          :disabled="!contextLayer.editable"
          type="button"
          role="menuitem"
          @click="runContextLayerCommand((layerId) => emit('startEditing', layerId))"
        >
          开启编辑
        </button>
        <button
          class="layer-panel__context-item layer-panel__context-item--danger"
          type="button"
          role="menuitem"
          @click="runContextLayerCommand((layerId) => emit('removeLayer', layerId))"
        >
          移除图层
        </button>
      </div>
    </Teleport>
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

.layer-panel__dock--drop-target {
  outline: 2px solid #777777;
  outline-offset: -4px;
  background: #eeeeee;
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
  border-color: #777777;
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
  z-index: var(--qgis-z-menu);
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

.layer-panel__context-item--danger {
  color: var(--qgis-danger);
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

</style>
