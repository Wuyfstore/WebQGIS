<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef } from "vue";
import DatasourcePanel from "./DatasourcePanel.vue";
import LayerPanel from "./LayerPanel.vue";
import MapCanvas from "./MapCanvas.vue";
import EditInspector from "./EditInspector.vue";
import { useOpenLayersEditor } from "../../composables/useOpenLayersEditor";
import { useWebGisWorkspace } from "../../composables/useWebGisWorkspace";

const workspace = useWebGisWorkspace();
const mapElement = shallowRef<HTMLDivElement | null>(null);

const editor = useOpenLayersEditor({
  mapElement,
  layers: workspace.layers,
  activeLayer: workspace.activeLayer,
  visibleLayerIds: workspace.visibleLayerIds,
  selectedFeatureId: workspace.selectedFeatureId,
  draftGeometry: workspace.draftGeometry,
  readFeature: workspace.readFeature,
  setStatus: workspace.setStatus
});

const hasDraftGeometry = computed(() => Boolean(workspace.draftGeometry.value));
const hasSelectedFeature = computed(() => Boolean(workspace.selectedFeatureId.value));
const statusClasses = computed(() => ({
  "workbench__status--success": workspace.status.value.tone === "success",
  "workbench__status--warning": workspace.status.value.tone === "warning",
  "workbench__status--danger": workspace.status.value.tone === "danger"
}));

onMounted(async () => {
  await nextTick();
  await workspace.refreshAll();
});

function handleMapReady(element: HTMLDivElement) {
  mapElement.value = element;
  editor.initializeMap();
}

async function handleSaveFeature() {
  const saved = await workspace.saveFeature();
  if (saved) {
    editor.loadEditableFeature(saved);
    editor.refreshLayer(workspace.activeLayer.value?.id);
  }
}

async function handleDeleteFeature() {
  const confirmed = await editor.requestDeleteConfirmation();
  if (!confirmed) {
    return;
  }
  const deleted = await workspace.deleteSelectedFeature();
  if (deleted) {
    editor.clearDraft();
    editor.refreshLayer(workspace.activeLayer.value?.id);
  }
}

function handleClearDraft() {
  workspace.clearDraftState();
  editor.clearDraft();
}
</script>

<template>
  <main class="workbench">
    <aside class="workbench__sidebar" aria-label="数据源与图层">
      <section class="workbench__masthead workbench-panel">
        <div class="workbench__brand">
          <p class="workbench__eyebrow">PostGIS 编辑与发布</p>
          <h1 class="workbench__title">WebQGIS</h1>
        </div>
        <button class="workbench__refresh focus-ring" :disabled="workspace.busy.value" type="button" @click="workspace.refreshAll">
          刷新
        </button>
        <div class="workbench__metrics" aria-label="图层概览">
          <span>{{ workspace.registeredLayerCount.value }} 图层</span>
          <span>{{ workspace.editableLayerCount.value }} 可编辑</span>
        </div>
        <p class="workbench__status" :class="statusClasses" role="status">
          {{ workspace.status.value.text }}
        </p>
      </section>

      <DatasourcePanel
        :datasources="workspace.datasources.value"
        :form="workspace.datasourceForm"
        :busy="workspace.busy.value"
        @save="workspace.saveDatasource"
        @scan="workspace.scanDatasource"
      />

      <LayerPanel
        :layers="workspace.layers.value"
        :active-layer-id="workspace.activeLayerId.value"
        :visible-layer-ids="workspace.visibleLayerIds.value"
        :editable-layer-count="workspace.editableLayerCount.value"
        @select="workspace.setActiveLayer"
        @toggle="workspace.toggleLayer"
        @update-style="workspace.updateLayerStyle"
      />
    </aside>

    <MapCanvas
      v-model:draw-mode="editor.drawMode.value"
      :active-layer="workspace.activeLayer.value"
      :busy="workspace.busy.value"
      :has-draft-geometry="hasDraftGeometry"
      :has-selected-feature="hasSelectedFeature"
      :is-drawing="editor.isDrawing.value"
      @ready="handleMapReady"
      @draw="editor.startDrawing"
      @save="handleSaveFeature"
      @delete="handleDeleteFeature"
      @clear="handleClearDraft"
    />

    <EditInspector
      v-model:selected-properties="workspace.selectedProperties.value"
      :active-layer="workspace.activeLayer.value"
      :editable-fields="workspace.editableFields.value"
      :selected-layer-status="workspace.selectedLayerStatus.value"
      :selected-feature-id="workspace.selectedFeatureId.value"
    />

    <div v-if="editor.isDeleteDialogOpen.value" class="workbench__dialog-backdrop">
      <section class="workbench__dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <h2 id="delete-title" class="workbench__dialog-title">删除要素</h2>
        <p class="workbench__dialog-copy">
          删除后会直接写回 PostGIS。请确认当前选中的要素不再需要保留。
        </p>
        <div class="workbench__dialog-actions">
          <button class="workbench__dialog-button focus-ring" type="button" @click="editor.cancelDelete">
            取消
          </button>
          <button class="workbench__dialog-button workbench__dialog-button--danger focus-ring" type="button" @click="editor.confirmDelete">
            删除
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.workbench {
  display: grid;
  grid-template-columns: minmax(300px, 360px) minmax(0, 1fr) minmax(300px, 340px);
  min-height: 100vh;
  color: #172033;
  background: #e7edf5;
}

.workbench__sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding: 12px;
  background: #f8fafc;
  border-right: 1px solid #dbe3ef;
}

.workbench__masthead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  padding: 14px;
}

.workbench__brand {
  min-width: 0;
}

.workbench__eyebrow {
  margin: 0 0 2px;
  color: #64748b;
  font-size: 12px;
}

.workbench__title {
  margin: 0;
  color: #172033;
  font-size: 22px;
  letter-spacing: 0;
}

.workbench__refresh {
  align-self: start;
  min-height: 34px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #172033;
  padding: 6px 10px;
}

.workbench__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  grid-column: 1 / -1;
  color: #475569;
  font-size: 12px;
}

.workbench__metrics span {
  border: 1px solid #dbe3ef;
  border-radius: 999px;
  padding: 3px 8px;
  background: #ffffff;
}

.workbench__status {
  grid-column: 1 / -1;
  min-height: 34px;
  margin: 0;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  padding: 8px;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 13px;
  line-height: 1.35;
}

.workbench__status--success {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.workbench__status--warning {
  border-color: #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.workbench__status--danger {
  border-color: #fecaca;
  background: #fef2f2;
  color: #991b1b;
}

.workbench__dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.36);
}

.workbench__dialog {
  width: min(420px, 100%);
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  padding: 18px;
  background: #ffffff;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
}

.workbench__dialog-title {
  margin: 0 0 8px;
  color: #172033;
  font-size: 18px;
}

.workbench__dialog-copy {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.55;
}

.workbench__dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.workbench__dialog-button {
  min-height: 34px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #172033;
  padding: 6px 12px;
}

.workbench__dialog-button--danger {
  border-color: #b91c1c;
  background: #dc2626;
  color: #ffffff;
}

@media (max-width: 1100px) {
  .workbench {
    grid-template-columns: 300px minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .workbench {
    grid-template-columns: 1fr;
  }

  .workbench__sidebar {
    max-height: none;
    border-right: 0;
  }
}
</style>
