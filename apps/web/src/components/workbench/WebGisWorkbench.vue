<script setup lang="ts">
import {
  Aim,
  CircleCheck,
  Crop,
  DocumentAdd,
  DocumentChecked,
  EditPen,
  FolderOpened,
  Link,
  Location,
  Minus,
  Pointer,
  Rank,
  Refresh,
  RefreshLeft,
  Search
} from "@element-plus/icons-vue";
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

const {
  datasources,
  layers,
  activeLayerId,
  activeLayer,
  visibleLayerIds,
  busy,
  status,
  selectedFeatureId,
  selectedProperties,
  datasourceForm,
  editableFields,
  selectedLayerStatus,
  editableLayerCount
} = workspace;
const {
  drawMode,
  isDrawing,
  isDeleteDialogOpen
} = editor;

const hasDraftGeometry = computed(() => Boolean(workspace.draftGeometry.value));
const hasSelectedFeature = computed(() => Boolean(selectedFeatureId.value));
const statusClasses = computed(() => ({
  "workbench__status--success": status.value.tone === "success",
  "workbench__status--warning": status.value.tone === "warning",
  "workbench__status--danger": status.value.tone === "danger"
}));
const activeLayerLabel = computed(() => (
  activeLayer.value ? `${activeLayer.value.schema}.${activeLayer.value.table}` : "未选择"
));
const activeLayerEditStatus = computed(() => (activeLayer.value?.editable ? "开启" : "只读"));
const menuItems = ["项目", "编辑", "视图", "图层", "设置", "插件", "矢量", "数据库", "网络", "帮助"];
const toolbarItems = [
  { label: "新建", icon: DocumentAdd },
  { label: "保存", icon: DocumentChecked },
  { label: "撤销", icon: RefreshLeft },
  { label: "选择", icon: Pointer, active: true },
  { label: "平移", icon: Rank },
  { label: "缩放", icon: Search },
  { label: "识别", icon: Aim },
  { label: "点", icon: Location },
  { label: "线", icon: Minus },
  { label: "面", icon: Crop },
  { label: "节点", icon: EditPen },
  { label: "吸附", icon: Link, active: true },
  { label: "校验", icon: CircleCheck },
  { label: "刷新", icon: Refresh }
];

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
    editor.refreshLayer(activeLayer.value?.id);
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
    editor.refreshLayer(activeLayer.value?.id);
  }
}

function handleClearDraft() {
  workspace.clearDraftState();
  editor.clearDraft();
}
</script>

<template>
  <main class="workbench">
    <header class="workbench__menubar">
      <strong class="workbench__brand">WebQGIS</strong>
      <nav class="workbench__menu" aria-label="应用菜单">
        <button v-for="item in menuItems" :key="item" class="workbench__menu-item focus-ring" type="button">
          {{ item }}
        </button>
      </nav>
      <span class="workbench__connection">PostgreSQL: Local PostGIS / public</span>
    </header>

    <section class="workbench__toolbar" aria-label="QGIS 风格工具栏">
      <button
        v-for="item in toolbarItems"
        :key="item.label"
        class="workbench__tool focus-ring"
        :class="{ 'workbench__tool--active': item.active }"
        type="button"
        :title="item.label"
      >
        <component :is="item.icon" class="workbench__tool-icon" aria-hidden="true" />
        <span class="workbench__tool-label">{{ item.label }}</span>
      </button>
      <span class="workbench__separator"></span>
      <button class="workbench__tool workbench__tool--wide focus-ring" :disabled="busy" type="button" @click="workspace.refreshAll">
        <FolderOpened class="workbench__tool-icon" aria-hidden="true" />
        刷新图层
      </button>
    </section>

    <section class="workbench__contextbar" aria-label="编辑上下文">
      <span class="workbench__context-label">活动图层:</span>
      <span class="workbench__context-field">{{ activeLayerLabel }}</span>
      <span class="workbench__context-label">编辑:</span>
      <span class="workbench__context-badge">{{ activeLayerEditStatus }}</span>
      <span class="workbench__context-label">捕捉:</span>
      <span class="workbench__context-field">顶点 + 线段, 8 px</span>
      <span class="workbench__context-note">显示链路: MVT</span>
      <span class="workbench__context-note">编辑链路: 原始 PostGIS geometry</span>
    </section>

    <section class="workbench__body">
      <aside class="workbench__left-dock" aria-label="浏览器与图层">
        <DatasourcePanel
          :datasources="datasources"
          v-model:form="datasourceForm"
          :busy="busy"
          @save="workspace.saveDatasource"
          @scan="workspace.scanDatasource"
        />

        <LayerPanel
          :layers="layers"
          :active-layer-id="activeLayerId"
          :visible-layer-ids="visibleLayerIds"
          :editable-layer-count="editableLayerCount"
          @select="workspace.setActiveLayer"
          @toggle="workspace.toggleLayer"
          @update-style="workspace.updateLayerStyle"
        />
      </aside>

      <MapCanvas
        v-model:draw-mode="drawMode"
        :active-layer="activeLayer"
        :busy="busy"
        :has-draft-geometry="hasDraftGeometry"
        :has-selected-feature="hasSelectedFeature"
        :is-drawing="isDrawing"
        @ready="handleMapReady"
        @draw="editor.startDrawing"
        @save="handleSaveFeature"
        @delete="handleDeleteFeature"
        @clear="handleClearDraft"
      />

      <EditInspector
        v-model:selected-properties="selectedProperties"
        :active-layer="activeLayer"
        :editable-fields="editableFields"
        :selected-layer-status="selectedLayerStatus"
        :selected-feature-id="selectedFeatureId"
      />
    </section>

    <footer class="workbench__statusbar">
      <span>坐标 104.0648, 30.6572</span>
      <span>比例尺 1:2500</span>
      <span>EPSG:3857 显示 / EPSG:4326 数据源</span>
      <span class="workbench__statusbar-ok">捕捉: 顶点+线段 8 px</span>
      <span :class="statusClasses" class="workbench__status" role="status">{{ status.text }}</span>
    </footer>

    <div v-if="isDeleteDialogOpen" class="workbench__dialog-backdrop">
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
  display: flex;
  min-width: 1180px;
  min-height: 100vh;
  flex-direction: column;
  color: var(--qgis-text);
  background: var(--qgis-app);
  font-size: 12px;
}

.workbench__menubar,
.workbench__toolbar,
.workbench__contextbar,
.workbench__statusbar {
  flex: 0 0 auto;
}

.workbench__menubar {
  display: flex;
  align-items: center;
  height: 28px;
  border-bottom: 1px solid #a9a9a9;
  background: var(--qgis-menubar);
}

.workbench__brand {
  padding: 0 12px;
  font-size: 13px;
}

.workbench__menu {
  display: flex;
  align-items: stretch;
  height: 100%;
}

.workbench__menu-item {
  border: 0;
  background: transparent;
  color: var(--qgis-text);
  padding: 0 12px;
  font-size: 13px;
}

.workbench__menu-item:hover {
  background: #dcdcdc;
}

.workbench__connection {
  margin-left: auto;
  padding-right: 16px;
  color: var(--qgis-green);
}

.workbench__toolbar {
  display: flex;
  align-items: center;
  gap: 3px;
  min-height: 34px;
  border-bottom: 1px solid #a5a5a5;
  padding: 3px 8px;
  background: var(--qgis-toolbar);
}

.workbench__tool {
  position: relative;
  display: grid;
  width: 28px;
  height: 26px;
  place-items: center;
  border: 1px solid #8d8d8d;
  background: #efefef;
  color: var(--qgis-text);
  padding: 0;
}

.workbench__tool--active {
  border-color: #4d86ba;
  background: #b8d6f0;
}

.workbench__tool--wide {
  display: inline-flex;
  width: auto;
  min-width: 72px;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
}

.workbench__tool-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.workbench__tool--wide .workbench__tool-label,
.workbench__tool--wide {
  position: static;
  width: auto;
  height: 26px;
  overflow: visible;
  clip: auto;
}

.workbench__tool-icon {
  display: block;
  width: 16px;
  height: 16px;
}

.workbench__separator {
  width: 1px;
  height: 24px;
  margin: 0 6px;
  background: #9b9b9b;
}

.workbench__contextbar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
  border-bottom: 1px solid #a5a5a5;
  padding: 4px 12px;
  background: var(--qgis-toolbar);
}

.workbench__context-label,
.workbench__context-note {
  color: var(--qgis-muted);
}

.workbench__context-field {
  min-width: 136px;
  border: 1px solid #aeb6bf;
  background: #ffffff;
  padding: 2px 8px;
}

.workbench__context-badge {
  border: 1px solid #6f9fc9;
  background: var(--qgis-blue-soft);
  color: var(--qgis-blue);
  padding: 2px 16px;
}

.workbench__body {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: 330px minmax(520px, 1fr) 360px;
  min-height: 0;
}

.workbench__left-dock {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow-y: auto;
  background: var(--qgis-dock);
  border-right: 1px solid var(--qgis-border);
}

.workbench__statusbar {
  display: flex;
  align-items: center;
  gap: 28px;
  height: 40px;
  border-top: 1px solid #a0a0a0;
  padding: 0 12px;
  background: var(--qgis-menubar);
  color: var(--qgis-text);
  white-space: nowrap;
}

.workbench__statusbar-ok {
  color: var(--qgis-green);
}

.workbench__status {
  margin-left: auto;
  color: var(--qgis-muted);
}

.workbench__status--success {
  color: var(--qgis-green);
}

.workbench__status--warning {
  color: var(--qgis-warn);
}

.workbench__status--danger {
  color: var(--qgis-danger);
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
  border: 1px solid var(--qgis-border);
  padding: 18px;
  background: var(--qgis-pane);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
}

.workbench__dialog-title {
  margin: 0 0 8px;
  color: var(--qgis-text);
  font-size: 15px;
}

.workbench__dialog-copy {
  margin: 0;
  color: var(--qgis-muted);
  font-size: 13px;
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
  border: 1px solid #8f8f8f;
  background: #e8e8e8;
  color: var(--qgis-text);
  padding: 6px 12px;
}

.workbench__dialog-button--danger {
  border-color: #b88b8b;
  background: #f3dddd;
  color: var(--qgis-danger);
}

@media (max-width: 1100px) {
  .workbench__body {
    grid-template-columns: 300px minmax(520px, 1fr);
  }

  .workbench__statusbar {
    gap: 14px;
  }
}

@media (max-width: 760px) {
  .workbench {
    min-width: 0;
    overflow: auto;
  }

  .workbench__body {
    grid-template-columns: 1fr;
  }

  .workbench__contextbar,
  .workbench__statusbar {
    flex-wrap: wrap;
    height: auto;
  }

  .workbench__left-dock {
    border-right: 0;
  }
}
</style>
