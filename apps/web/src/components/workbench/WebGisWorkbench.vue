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
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, type Component } from "vue";
import DatasourcePanel from "./DatasourcePanel.vue";
import AttributeTablePanel from "./AttributeTablePanel.vue";
import LayerPanel from "./LayerPanel.vue";
import MapCanvas from "./MapCanvas.vue";
import EditInspector from "./EditInspector.vue";
import { useOpenLayersEditor } from "../../composables/useOpenLayersEditor";
import { useWebGisWorkspace } from "../../composables/useWebGisWorkspace";
import type { GeometryMode, LayerStylePatch } from "../../types/gis";
import { getGeometryModes } from "../../utils/layer";

const workspace = useWebGisWorkspace();
const mapElement = shallowRef<HTMLDivElement | null>(null);
const menuRef = useTemplateRef<HTMLElement>("menuRef");
const openMenuLabel = shallowRef<string | null>(null);
const datasourceDialogRequestKey = shallowRef(0);
const styleEditorLayerId = shallowRef<string | null>(null);

const editor = useOpenLayersEditor({
  mapElement,
  layers: workspace.layers,
  activeLayer: workspace.activeLayer,
  visibleLayerIds: workspace.visibleLayerIds,
  selectedFeatureId: workspace.selectedFeatureId,
  draftGeometry: workspace.draftGeometry,
  displayProjection: workspace.displayProjection,
  readFeature: workspace.readFeature,
  clearSelection: workspace.clearDraftState,
  setStatus: workspace.setStatus
});

const {
  datasources,
  layers,
  activeLayerId,
  activeLayer,
  attributeTableLayer,
  attributeTableFeatures,
  attributeTableTotal,
  attributeTableQuery,
  visibleLayerIds,
  displayProjection,
  canRestoreVisibleLayerIds,
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
  activeTool,
  isDrawing,
  isSnapEnabled,
  isDeleteDialogOpen,
  mapCssVars,
  coordinateLabel,
  scaleLabel,
  projectionLabel,
  zoomLevel
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
const styleEditorLayer = computed(() => (
  layers.value.find((layer) => layer.id === styleEditorLayerId.value) ?? null
));
const activeLayerEditStatus = computed(() => (activeLayer.value?.editable ? "开启" : "只读"));
const availableDrawModes = computed(() => getGeometryModes(activeLayer.value));
const projectionOptions = ["EPSG:3857", "EPSG:4326", "EPSG:4490", "EPSG:4547"] as const;
const menuItems = [
  "项目",
  "编辑",
  "视图",
  "图层",
  "设置",
  "插件",
  "矢量",
  "数据库",
  "网络",
  "帮助"
] as const;

type MenuLabel = typeof menuItems[number];

type MenuCommand = {
  label: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
};

const menuCommands = computed<Record<MenuLabel, MenuCommand[]>>(() => ({
  项目: [
    { label: "新建编辑草稿", action: handleNewDraft, disabled: busy.value },
    { label: "保存当前编辑", action: handleSaveFeature, disabled: busy.value || !hasDraftGeometry.value },
    { label: "刷新工作区", action: handleRefreshAll, disabled: busy.value }
  ],
  编辑: [
    { label: "选择要素", action: () => editor.activateTool("select"), disabled: busy.value },
    { label: "撤销当前草稿", action: handleClearDraft, disabled: busy.value || (!hasDraftGeometry.value && !hasSelectedFeature.value) },
    { label: "节点编辑", action: () => editor.activateTool("node"), disabled: busy.value },
    { label: "删除选中要素", action: handleDeleteFeature, disabled: busy.value || !hasSelectedFeature.value }
  ],
  视图: [
    { label: "平移地图", action: () => editor.activateTool("pan"), disabled: busy.value },
    { label: "放大一级", action: editor.zoomIn, disabled: busy.value },
    { label: "刷新当前图层", action: handleRefreshAll, disabled: busy.value }
  ],
  图层: [
    { label: "刷新图层列表", action: handleRefreshAll, disabled: busy.value },
    { label: "校验当前图层", action: validateActiveLayer, disabled: busy.value },
    { label: "切换当前图层可见性", action: toggleActiveLayerVisibility, disabled: busy.value || !activeLayer.value },
    { label: "仅显示当前图层", action: showOnlyActiveLayer, disabled: busy.value || !activeLayer.value },
    { label: "显示全部图层", action: showAllLayers, disabled: busy.value || layers.value.length === 0 },
    { label: "恢复上次可见性", action: restorePreviousVisibleLayers, disabled: busy.value || !canRestoreVisibleLayerIds.value }
  ],
  设置: [
    { label: "切换吸附", action: editor.toggleSnap, disabled: busy.value },
    { label: "校验编辑状态", action: validateActiveLayer, disabled: busy.value }
  ],
  插件: [
    { label: "插件系统尚未纳入 V1", action: () => workspace.setStatus("插件系统不在 V1 范围内", "warning"), disabled: false }
  ],
  矢量: [
    { label: "绘制点", action: () => startDrawing("Point"), disabled: busy.value || !activeLayer.value?.editable || !availableDrawModes.value.includes("Point") },
    { label: "绘制线", action: () => startDrawing("LineString"), disabled: busy.value || !activeLayer.value?.editable || !availableDrawModes.value.includes("LineString") },
    { label: "绘制面", action: () => startDrawing("Polygon"), disabled: busy.value || !activeLayer.value?.editable || !availableDrawModes.value.includes("Polygon") }
  ],
  数据库: [
    { label: "新建 PostgreSQL 连接...", action: requestDatasourceConnectionDialog, disabled: busy.value },
    { label: "刷新数据源", action: handleRefreshAll, disabled: busy.value },
    { label: "扫描第一个数据源", action: scanFirstDatasource, disabled: busy.value || datasources.value.length === 0 }
  ],
  网络: [
    { label: "刷新 MVT 图层", action: handleRefreshAll, disabled: busy.value },
    { label: "显示链路说明", action: () => workspace.setStatus("显示链路使用 MVT，编辑链路回源读取原始 PostGIS geometry", "neutral") }
  ],
  帮助: [
    { label: "显示 V1 范围", action: () => workspace.setStatus("V1 聚焦连接 PostGIS、扫描图层、浏览地图、编辑要素并写回数据库", "neutral") },
    { label: "显示当前状态", action: () => workspace.setStatus(status.value.text, status.value.tone) }
  ]
}));

type ToolbarItem = {
  label: string;
  icon: Component;
  title: string;
  active: boolean;
  disabled: boolean;
  action: () => void | Promise<void>;
};

const toolbarItems = computed<ToolbarItem[]>(() => [
  {
    label: "新建",
    icon: DocumentAdd,
    title: "新建编辑草稿",
    active: false,
    disabled: busy.value,
    action: handleNewDraft
  },
  {
    label: "保存",
    icon: DocumentChecked,
    title: "保存当前编辑",
    active: false,
    disabled: busy.value || !hasDraftGeometry.value,
    action: handleSaveFeature
  },
  {
    label: "撤销",
    icon: RefreshLeft,
    title: "撤销当前草稿",
    active: false,
    disabled: busy.value || (!hasDraftGeometry.value && !hasSelectedFeature.value),
    action: handleClearDraft
  },
  {
    label: "选择",
    icon: Pointer,
    title: "选择要素",
    active: activeTool.value === "select",
    disabled: busy.value,
    action: () => editor.activateTool("select")
  },
  {
    label: "平移",
    icon: Rank,
    title: "平移地图",
    active: activeTool.value === "pan",
    disabled: busy.value,
    action: () => editor.activateTool("pan")
  },
  {
    label: "放大",
    icon: Search,
    title: "放大一级",
    active: false,
    disabled: busy.value,
    action: editor.zoomIn
  },
  {
    label: "识别",
    icon: Aim,
    title: "识别要素属性",
    active: activeTool.value === "identify",
    disabled: busy.value,
    action: () => editor.activateTool("identify")
  },
  {
    label: "点",
    icon: Location,
    title: "绘制点要素",
    active: activeTool.value === "draw" && drawMode.value === "Point",
    disabled: busy.value || !activeLayer.value?.editable || !availableDrawModes.value.includes("Point"),
    action: () => startDrawing("Point")
  },
  {
    label: "线",
    icon: Minus,
    title: "绘制线要素",
    active: activeTool.value === "draw" && drawMode.value === "LineString",
    disabled: busy.value || !activeLayer.value?.editable || !availableDrawModes.value.includes("LineString"),
    action: () => startDrawing("LineString")
  },
  {
    label: "面",
    icon: Crop,
    title: "绘制面要素",
    active: activeTool.value === "draw" && drawMode.value === "Polygon",
    disabled: busy.value || !activeLayer.value?.editable || !availableDrawModes.value.includes("Polygon"),
    action: () => startDrawing("Polygon")
  },
  {
    label: "节点",
    icon: EditPen,
    title: "节点编辑",
    active: activeTool.value === "node",
    disabled: busy.value,
    action: () => editor.activateTool("node")
  },
  {
    label: "吸附",
    icon: Link,
    title: "切换吸附",
    active: isSnapEnabled.value,
    disabled: busy.value,
    action: editor.toggleSnap
  },
  {
    label: "校验",
    icon: CircleCheck,
    title: "校验当前图层编辑状态",
    active: false,
    disabled: busy.value,
    action: validateActiveLayer
  },
  {
    label: "刷新",
    icon: Refresh,
    title: "刷新数据源和图层",
    active: false,
    disabled: busy.value,
    action: handleRefreshAll
  }
]);

onMounted(async () => {
  window.addEventListener("pointerdown", closeMenuOnOutsidePointer);
  window.addEventListener("keydown", closeMenuOnEscape);
  await nextTick();
  await workspace.refreshAll();
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", closeMenuOnOutsidePointer);
  window.removeEventListener("keydown", closeMenuOnEscape);
});

function handleMapReady(element: HTMLDivElement) {
  mapElement.value = element;
  editor.initializeMap();
}

function closeMenuOnOutsidePointer(event: Event) {
  if (!openMenuLabel.value) {
    return;
  }
  const target = event.target;
  if (target instanceof Node && menuRef.value?.contains(target)) {
    return;
  }
  openMenuLabel.value = null;
}

function closeMenuOnEscape(event: KeyboardEvent) {
  if (event.key === "Escape") {
    openMenuLabel.value = null;
  }
}

function toggleMenu(label: MenuLabel) {
  openMenuLabel.value = openMenuLabel.value === label ? null : label;
}

async function runMenuCommand(command: MenuCommand) {
  if (command.disabled) {
    return;
  }
  openMenuLabel.value = null;
  await command.action();
}

function handleNewDraft() {
  handleClearDraft();
  workspace.setStatus("已新建空白编辑草稿，请选择绘制工具开始采集", "success");
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

function startDrawing(mode?: GeometryMode) {
  workspace.clearDraftState();
  editor.startDrawing(mode);
}

async function handleRefreshAll() {
  await workspace.refreshAll();
  editor.refreshLayer(activeLayer.value?.id);
}

function requestDatasourceConnectionDialog() {
  datasourceDialogRequestKey.value += 1;
  workspace.setStatus("打开 PostGIS 连接窗口", "neutral");
}

async function scanFirstDatasource() {
  const datasource = datasources.value[0];
  if (!datasource) {
    workspace.setStatus("暂无可扫描的数据源", "warning");
    return;
  }
  await workspace.scanDatasource(datasource.id);
}

function toggleActiveLayerVisibility() {
  const layer = activeLayer.value;
  if (!layer) {
    workspace.setStatus("请先选择一个图层", "warning");
    return;
  }
  workspace.toggleLayer(layer.id);
  workspace.setStatus(`已切换图层可见性：${layer.schema}.${layer.table}`, "success");
}

function showOnlyActiveLayer() {
  const layer = activeLayer.value;
  if (!layer) {
    workspace.setStatus("请先选择一个图层", "warning");
    return;
  }
  workspace.showOnlyLayer(layer.id);
}

function showAllLayers() {
  workspace.showAllLayers();
}

function restorePreviousVisibleLayers() {
  workspace.restorePreviousVisibleLayers();
}

function zoomToLayer(layerId: string) {
  workspace.setActiveLayer(layerId);
  editor.zoomToLayerExtent(layerId);
}

function openAttributeTable(layerId: string) {
  void workspace.openAttributeTable(layerId);
}

function closeAttributeTable() {
  workspace.closeAttributeTable();
}

function openStyleEditor(layerId: string) {
  workspace.setActiveLayer(layerId);
  styleEditorLayerId.value = layerId;
}

function closeStyleEditor() {
  styleEditorLayerId.value = null;
}

function readStyleNumber(event: Event): number {
  return Number((event.target as HTMLInputElement).value);
}

function updateStyleEditorLayer(patch: LayerStylePatch) {
  const layer = styleEditorLayer.value;
  if (!layer) {
    return;
  }
  void workspace.updateLayerStyle(layer.id, patch);
}

function validateActiveLayer() {
  const layer = activeLayer.value;
  if (!layer) {
    workspace.setStatus("请先选择一个图层再执行校验", "warning");
    return;
  }
  if (!layer.editable) {
    workspace.setStatus(`当前图层只读：${layer.editableReason.join("；") || "缺少可编辑条件"}`, "warning");
    return;
  }
  workspace.setStatus(`校验通过：${layer.schema}.${layer.table} 可编辑`, "success");
}
</script>

<template>
  <main class="workbench">
    <header class="workbench__menubar">
      <strong class="workbench__brand">WebQGIS</strong>
      <nav ref="menuRef" class="workbench__menu" aria-label="应用菜单">
        <div v-for="item in menuItems" :key="item" class="workbench__menu-group">
          <button
            class="workbench__menu-item focus-ring"
            :class="{ 'workbench__menu-item--open': openMenuLabel === item }"
            type="button"
            :aria-expanded="openMenuLabel === item"
            @click="toggleMenu(item)"
          >
            {{ item }}
          </button>
          <div v-if="openMenuLabel === item" class="workbench__menu-popover" role="menu">
            <button
              v-for="command in menuCommands[item]"
              :key="command.label"
              class="workbench__menu-command focus-ring"
              :disabled="command.disabled"
              type="button"
              role="menuitem"
              @click="runMenuCommand(command)"
            >
              {{ command.label }}
            </button>
          </div>
        </div>
      </nav>
      <span class="workbench__connection">PostgreSQL: Local PostGIS / public</span>
    </header>

    <section class="workbench__toolbar" aria-label="QGIS 风格工具栏">
      <button
        v-for="item in toolbarItems"
        :key="item.label"
        class="workbench__tool focus-ring"
        :class="{ 'workbench__tool--active': item.active }"
        :disabled="item.disabled"
        type="button"
        :title="item.title"
        @click="item.action"
      >
        <component :is="item.icon" class="workbench__tool-icon" aria-hidden="true" />
        <span class="workbench__tool-label">{{ item.label }}</span>
      </button>
      <span class="workbench__separator"></span>
      <button class="workbench__tool workbench__tool--wide focus-ring" :disabled="busy" type="button" @click="handleRefreshAll">
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
      <span class="workbench__context-label">显示坐标系:</span>
      <select
        class="workbench__context-select focus-ring"
        :value="displayProjection"
        aria-label="当前项目显示坐标系"
        @change="workspace.setDisplayProjection(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="projection in projectionOptions" :key="projection" :value="projection">
          {{ projection }}
        </option>
      </select>
      <span class="workbench__context-note">显示链路: MVT</span>
      <span class="workbench__context-note">编辑链路: 原始 PostGIS geometry</span>
    </section>

    <section class="workbench__body">
      <aside class="workbench__left-dock" aria-label="浏览器与图层">
        <DatasourcePanel
          :datasources="datasources"
          v-model:form="datasourceForm"
          :busy="busy"
          :connection-dialog-request-key="datasourceDialogRequestKey"
          @save="workspace.saveDatasource"
          @scan="workspace.scanDatasource"
        />

        <LayerPanel
          :layers="layers"
          :active-layer-id="activeLayerId"
          :visible-layer-ids="visibleLayerIds"
          :editable-layer-count="editableLayerCount"
          :can-restore-visible-layer-ids="canRestoreVisibleLayerIds"
          @select="workspace.setActiveLayer"
          @toggle="workspace.toggleLayer"
          @solo="workspace.showOnlyLayer"
          @restore-visibility="workspace.restorePreviousVisibleLayers"
          @zoom-to-layer="zoomToLayer"
          @open-attribute-table="openAttributeTable"
          @open-style-editor="openStyleEditor"
        />
      </aside>

      <MapCanvas
        v-model:draw-mode="drawMode"
        :active-layer="activeLayer"
        :busy="busy"
        :has-draft-geometry="hasDraftGeometry"
        :has-selected-feature="hasSelectedFeature"
        :is-drawing="isDrawing"
        :map-style="mapCssVars"
        @ready="handleMapReady"
        @draw="startDrawing"
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
      <span>{{ coordinateLabel }}</span>
      <span>{{ scaleLabel }}</span>
      <span>{{ projectionLabel }}</span>
      <span>Zoom {{ zoomLevel.toFixed(2) }}</span>
      <span class="workbench__statusbar-ok">捕捉: 顶点+线段 8 px</span>
      <span :class="statusClasses" class="workbench__status" role="status">{{ status.text }}</span>
    </footer>

    <Teleport to="body">
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
    </Teleport>

    <Teleport to="body">
      <div v-if="styleEditorLayer" class="workbench__dialog-backdrop" @pointerdown.self="closeStyleEditor">
        <section class="workbench__style-dialog" role="dialog" aria-modal="true" aria-labelledby="style-editor-title">
          <header class="workbench__style-dialog-header">
            <div>
              <h2 id="style-editor-title" class="workbench__dialog-title">图层样式</h2>
              <p class="workbench__style-dialog-subtitle">{{ styleEditorLayer.schema }}.{{ styleEditorLayer.table }}</p>
            </div>
            <button class="workbench__style-dialog-close focus-ring" type="button" aria-label="关闭图层样式" @click="closeStyleEditor">
              ×
            </button>
          </header>

          <div class="workbench__style-preview">
            <span class="workbench__style-preview-swatch" :style="{ backgroundColor: styleEditorLayer.style.fill.slice(0, 7), borderColor: styleEditorLayer.style.stroke }"></span>
            <div>
              <strong>单一符号 · 半透明面</strong>
              <span>{{ styleEditorLayer.geometryType }} · {{ Math.round(styleEditorLayer.style.opacity * 100) }}%</span>
            </div>
          </div>

          <label class="workbench__style-field">
            <span class="workbench__style-label">填充</span>
            <input
              class="workbench__style-swatch focus-ring"
              type="color"
              :value="styleEditorLayer.style.fill.slice(0, 7)"
              @change="updateStyleEditorLayer({ fill: ($event.target as HTMLInputElement).value })"
            />
            <span class="workbench__style-value">{{ styleEditorLayer.style.fill.slice(0, 7) }}</span>
          </label>

          <label class="workbench__style-field">
            <span class="workbench__style-label">边线</span>
            <input
              class="workbench__style-swatch focus-ring"
              type="color"
              :value="styleEditorLayer.style.stroke"
              @change="updateStyleEditorLayer({ stroke: ($event.target as HTMLInputElement).value })"
            />
            <span class="workbench__style-value">{{ styleEditorLayer.style.stroke }}</span>
          </label>

          <label class="workbench__style-field workbench__style-field--range">
            <span class="workbench__style-label">透明度</span>
            <input
              class="workbench__style-slider focus-ring"
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              :value="styleEditorLayer.style.opacity"
              @change="updateStyleEditorLayer({ opacity: readStyleNumber($event) })"
            />
            <span class="workbench__style-value">{{ Math.round(styleEditorLayer.style.opacity * 100) }}%</span>
          </label>

          <label class="workbench__style-field workbench__style-field--range">
            <span class="workbench__style-label">线宽</span>
            <input
              class="workbench__style-slider focus-ring"
              type="range"
              min="0.5"
              max="8"
              step="0.5"
              :value="styleEditorLayer.style.strokeWidth"
              @change="updateStyleEditorLayer({ strokeWidth: readStyleNumber($event) })"
            />
            <span class="workbench__style-value">{{ styleEditorLayer.style.strokeWidth }} px</span>
          </label>

          <div class="workbench__dialog-actions">
            <button class="workbench__dialog-button focus-ring" type="button" @click="closeStyleEditor">
              关闭
            </button>
          </div>
        </section>
      </div>
    </Teleport>

    <AttributeTablePanel
      v-if="attributeTableLayer"
      :layer="attributeTableLayer"
      :features="attributeTableFeatures"
      :total="attributeTableTotal"
      :query="attributeTableQuery"
      :busy="busy"
      @query="workspace.updateAttributeTableQuery"
      @close="closeAttributeTable"
    />
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

.workbench__menu-group {
  position: relative;
  display: flex;
  align-items: stretch;
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

.workbench__menu-item--open {
  background: #dcdcdc;
}

.workbench__menu-popover {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: var(--qgis-z-menu);
  min-width: 180px;
  border: 1px solid #8d8d8d;
  background: #f7f7f7;
  box-shadow: 2px 4px 12px rgba(15, 23, 42, 0.24);
  padding: 4px;
}

.workbench__menu-command {
  display: block;
  width: 100%;
  min-height: 26px;
  border: 0;
  background: transparent;
  color: var(--qgis-text);
  padding: 4px 10px;
  text-align: left;
  white-space: nowrap;
}

.workbench__menu-command:hover:not(:disabled) {
  background: var(--qgis-row-active);
}

.workbench__menu-command:disabled {
  color: var(--qgis-muted);
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
  border-color: #777777;
  background: #cfcfcf;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.48),
    inset 0 -1px 0 #9d9d9d;
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

.workbench__context-select {
  min-width: 108px;
  min-height: 22px;
  border: 1px solid #aeb6bf;
  background: #ffffff;
  color: var(--qgis-text);
  padding: 2px 6px;
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
  z-index: var(--qgis-z-modal);
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

.workbench__style-dialog {
  display: grid;
  width: min(440px, 100%);
  gap: 12px;
  border: 1px solid var(--qgis-border);
  padding: 14px;
  background: var(--qgis-pane);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
}

.workbench__style-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--qgis-border-soft);
  padding-bottom: 10px;
}

.workbench__style-dialog-subtitle {
  margin: 4px 0 0;
  color: var(--qgis-muted);
}

.workbench__style-dialog-close {
  width: 24px;
  height: 24px;
  border: 1px solid #8d8d8d;
  background: #e8e8e8;
  color: var(--qgis-text);
  padding: 0;
  line-height: 20px;
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

.workbench__style-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #b7b7b7;
  background: var(--qgis-row);
  padding: 8px;
}

.workbench__style-preview strong,
.workbench__style-preview span {
  display: block;
}

.workbench__style-preview span {
  color: var(--qgis-muted);
  font-size: 11px;
}

.workbench__style-preview-swatch {
  width: 58px;
  height: 28px;
  border: 1px solid;
}

.workbench__style-field {
  display: grid;
  grid-template-columns: 54px 48px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.workbench__style-field--range {
  grid-template-columns: 54px minmax(0, 1fr) 46px;
}

.workbench__style-label,
.workbench__style-value {
  color: var(--qgis-muted);
  font-size: 12px;
}

.workbench__style-swatch {
  width: 46px;
  height: 22px;
  border: 1px solid #8f8f8f;
  padding: 2px;
  background: var(--qgis-input);
}

.workbench__style-slider {
  width: 100%;
  min-width: 0;
  accent-color: #6f8a54;
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

  .workbench__style-field,
  .workbench__style-field--range {
    grid-template-columns: 54px minmax(0, 1fr);
  }

  .workbench__style-value {
    grid-column: 2;
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
