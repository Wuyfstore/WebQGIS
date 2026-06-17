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
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  shallowRef,
  useTemplateRef,
  watch,
  type Component,
  type ComponentPublicInstance
} from "vue";
import DatasourcePanel from "./DatasourcePanel.vue";
import AttributeTablePanel from "./AttributeTablePanel.vue";
import LayerPanel from "./LayerPanel.vue";
import MapCanvas from "./MapCanvas.vue";
import EditInspector from "./EditInspector.vue";
import { useOpenLayersEditor } from "../../composables/useOpenLayersEditor";
import { useWebGisWorkspace } from "../../composables/useWebGisWorkspace";
import type { CrsDefinition, CustomCrsPayload, GeometryMode, LayerStylePatch } from "../../types/gis";
import type { CoordinateAxisOrder, SelectionMode } from "../../composables/useOpenLayersEditor";
import { getGeometryModes } from "../../utils/layer";

const workspace = useWebGisWorkspace();
const mapElement = shallowRef<HTMLDivElement | null>(null);
const menuRef = useTemplateRef<HTMLElement>("menuRef");
const selectionToolRef = shallowRef<HTMLElement | null>(null);
const openMenuLabel = shallowRef<string | null>(null);
const datasourceDialogRequestKey = shallowRef(0);
const styleEditorLayerId = shallowRef<string | null>(null);
const editingLayerId = shallowRef<string | null>(null);
const draggedLayerId = shallowRef<string | null>(null);
const isSelectionMenuOpen = shallowRef(false);
const isCrsDialogOpen = shallowRef(false);
const coordinatePrecision = shallowRef(5);
const coordinateAxisOrder = shallowRef<CoordinateAxisOrder>("xy");
const crsSearchQuery = shallowRef("");
const isCrsSearching = shallowRef(false);
const customCrsEditingId = shallowRef<string | null>(null);
const customCrsForm = reactive<CustomCrsPayload>({
  code: "",
  name: "",
  srid: 900001,
  proj4text: "",
  authName: "LOCAL",
  wkt: "",
  area: "",
  scope: ""
});
let crsSearchRequestId = 0;

const editor = useOpenLayersEditor({
  mapElement,
  layers: workspace.layers,
  activeLayer: workspace.activeLayer,
  visibleLayerIds: workspace.visibleLayerIds,
  selectedFeatureId: workspace.selectedFeatureId,
  draftGeometry: workspace.draftGeometry,
  displayProjection: workspace.displayProjection,
  coordinatePrecision,
  coordinateAxisOrder,
  readFeature: workspace.readFeature,
  selectFeatureIdsByGeometry: workspace.selectFeatureIdsByGeometry,
  clearSelection: workspace.clearSelectedFeatureState,
  markDraftDirty: workspace.markDraftDirty,
  canDiscardDraft: canDiscardCurrentDraft,
  setStatus: workspace.setStatus
});

const {
  datasources,
  availableLayers,
  webServiceConnections,
  loadedLayerIds,
  layers,
  activeLayerId,
  activeLayer,
  attributeTableLayer,
  attributeTableFeatures,
  attributeTableTotal,
  attributeSqlResult,
  attributeTableQuery,
  visibleLayerIds,
  displayProjection,
  crsCatalog,
  customCrsCatalog,
  canRestoreVisibleLayerIds,
  busy,
  status,
  selectedFeatureId,
  selectedProperties,
  hasUnsavedEditDraft,
  datasourceForm,
  editableFields,
  selectedLayerStatus,
  editableLayerCount
} = workspace;
const {
  drawMode,
  activeTool,
  selectionMode,
  isDrawing,
  isSnapEnabled,
  isDeleteDialogOpen,
  coordinateLabel,
  scaleLabel,
  zoomLevel
} = editor;

const hasDraftGeometry = computed(() => Boolean(workspace.draftGeometry.value));
const hasSelectedFeature = computed(() => Boolean(selectedFeatureId.value));
const isActiveLayerEditable = computed(() => Boolean(activeLayer.value?.editable));
const isEditingActiveLayer = computed(() => Boolean(activeLayer.value && editingLayerId.value === activeLayer.value.id));
const statusClasses = computed(() => ({
  "workbench__status--success": status.value.tone === "success",
  "workbench__status--warning": status.value.tone === "warning",
  "workbench__status--danger": status.value.tone === "danger"
}));
const styleEditorLayer = computed(() => (
  layers.value.find((layer) => layer.id === styleEditorLayerId.value) ?? null
));
const availableDrawModes = computed(() => getGeometryModes(activeLayer.value));
const fallbackCrs = computed<CrsDefinition>(() => ({
  id: `current-${displayProjection.value}`,
  code: displayProjection.value,
  authName: displayProjection.value.split(":")[0] ?? "EPSG",
  authSrid: Number(displayProjection.value.split(":")[1] ?? 0),
  srid: Number(displayProjection.value.split(":")[1] ?? 0),
  name: displayProjection.value,
  proj4text: "",
  wkt: "",
  area: "",
  scope: "",
  source: "fallback",
  custom: false
}));
const selectionModeOptions = [
  { mode: "click", label: "点击选择", icon: Pointer },
  { mode: "extent", label: "范围选择", icon: Crop },
  { mode: "customExtent", label: "自定义范围选择", icon: EditPen }
] satisfies { mode: SelectionMode; label: string; icon: Component }[];
const coordinatePrecisionOptions = [0, 1, 2, 3, 4, 5, 6, 7] as const;
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
    { label: "新建编辑草稿", action: handleNewDraft, disabled: busy.value || !isEditingActiveLayer.value },
    { label: "保存当前编辑", action: handleSaveFeature, disabled: busy.value || !isEditingActiveLayer.value || !hasDraftGeometry.value },
    { label: "刷新工作区", action: handleRefreshAll, disabled: busy.value }
  ],
  编辑: [
    { label: "选择要素", action: () => editor.activateTool("select"), disabled: busy.value },
    { label: isEditingActiveLayer.value ? "关闭当前图层编辑" : "切换当前图层编辑", action: toggleEditingActiveLayer, disabled: busy.value || !isActiveLayerEditable.value },
    { label: "撤销当前草稿", action: handleClearDraft, disabled: busy.value || !isEditingActiveLayer.value || (!hasDraftGeometry.value && !hasSelectedFeature.value) },
    { label: "节点编辑", action: () => editor.activateTool("node"), disabled: busy.value || !isEditingActiveLayer.value },
    { label: "删除选中要素", action: handleDeleteFeature, disabled: busy.value || !isEditingActiveLayer.value || !hasSelectedFeature.value }
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
    { label: "坐标与 CRS 设置...", action: openCrsDialog, disabled: busy.value },
    { label: "校验编辑状态", action: validateActiveLayer, disabled: busy.value }
  ],
  插件: [
    { label: "插件系统尚未纳入 V1", action: () => workspace.setStatus("插件系统不在 V1 范围内", "warning"), disabled: false }
  ],
  矢量: [
    { label: "绘制点", action: () => startDrawing("Point"), disabled: busy.value || !isEditingActiveLayer.value || !availableDrawModes.value.includes("Point") },
    { label: "绘制线", action: () => startDrawing("LineString"), disabled: busy.value || !isEditingActiveLayer.value || !availableDrawModes.value.includes("LineString") },
    { label: "绘制面", action: () => startDrawing("Polygon"), disabled: busy.value || !isEditingActiveLayer.value || !availableDrawModes.value.includes("Polygon") }
  ],
  数据库: [
    { label: "新建 PostgreSQL 连接...", action: requestDatasourceConnectionDialog, disabled: busy.value },
    { label: "刷新数据源", action: handleRefreshAll, disabled: busy.value },
    { label: "扫描第一个数据源", action: scanFirstDatasource, disabled: busy.value || datasources.value.length === 0 }
  ],
  网络: [
    { label: "刷新 MVT 图层", action: handleRefreshAll, disabled: busy.value }
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
    disabled: busy.value || !isEditingActiveLayer.value,
    action: handleNewDraft
  },
  {
    label: "保存",
    icon: DocumentChecked,
    title: "保存当前编辑",
    active: false,
    disabled: busy.value || !isEditingActiveLayer.value || !hasDraftGeometry.value,
    action: handleSaveFeature
  },
  {
    label: "撤销",
    icon: RefreshLeft,
    title: "撤销当前草稿",
    active: false,
    disabled: busy.value || !isEditingActiveLayer.value || (!hasDraftGeometry.value && !hasSelectedFeature.value),
    action: handleClearDraft
  },
  {
    label: "编辑",
    icon: EditPen,
    title: isEditingActiveLayer.value ? "关闭当前图层编辑" : "开启当前图层编辑",
    active: isEditingActiveLayer.value,
    disabled: busy.value || !isActiveLayerEditable.value,
    action: toggleEditingActiveLayer
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
    disabled: busy.value || !isEditingActiveLayer.value || !availableDrawModes.value.includes("Point"),
    action: () => startDrawing("Point")
  },
  {
    label: "线",
    icon: Minus,
    title: "绘制线要素",
    active: activeTool.value === "draw" && drawMode.value === "LineString",
    disabled: busy.value || !isEditingActiveLayer.value || !availableDrawModes.value.includes("LineString"),
    action: () => startDrawing("LineString")
  },
  {
    label: "面",
    icon: Crop,
    title: "绘制面要素",
    active: activeTool.value === "draw" && drawMode.value === "Polygon",
    disabled: busy.value || !isEditingActiveLayer.value || !availableDrawModes.value.includes("Polygon"),
    action: () => startDrawing("Polygon")
  },
  {
    label: "节点",
    icon: EditPen,
    title: "节点编辑",
    active: activeTool.value === "node",
    disabled: busy.value || !isEditingActiveLayer.value,
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

const activeSelectionModeLabel = computed(() => (
  selectionModeOptions.find((option) => option.mode === selectionMode.value)?.label ?? "点击选择"
));
const selectedCrs = computed(() => (
  [...crsCatalog.value, ...customCrsCatalog.value].find((item) => item.code === displayProjection.value) ?? fallbackCrs.value
));
const visibleCrsCatalog = computed(() => (
  crsCatalog.value.length > 0 ? crsCatalog.value : [selectedCrs.value]
));
const coordinateSettingsLabel = computed(() => (
  `${coordinateAxisOrder.value === "xy" ? "X,Y" : "Y,X"} · ${coordinatePrecision.value} 位小数`
));
const crsSourceLabels: Record<CrsDefinition["source"], string> = {
  postgis: "数据库",
  custom: "地方",
  fallback: "内置"
};

function layerLabel(layer: { schema: string; table: string; displayName?: string }) {
  return layer.displayName ?? `${layer.schema}.${layer.table}`;
}

function setSelectionToolRef(element: Element | ComponentPublicInstance | null) {
  selectionToolRef.value = element instanceof HTMLElement ? element : null;
}

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

watch(activeLayerId, (nextLayerId, previousLayerId) => {
  if (editingLayerId.value && editingLayerId.value !== nextLayerId) {
    if (hasUnsavedEditDraft.value) {
      const fallbackLayerId = previousLayerId || editingLayerId.value;
      if (fallbackLayerId && loadedLayerIds.value.has(fallbackLayerId)) {
        activeLayerId.value = fallbackLayerId;
      }
      workspace.setStatus("当前编辑草稿未保存，请先保存或清除后再切换图层", "warning");
      return;
    }
    editingLayerId.value = null;
    handleClearDraft();
    workspace.setStatus("已切换图层，编辑模式已关闭", "neutral");
  }
});

function handleMapReady(element: HTMLDivElement) {
  mapElement.value = element;
  editor.initializeMap();
}

function closeMenuOnOutsidePointer(event: Event) {
  if (!openMenuLabel.value) {
    if (!isSelectionMenuOpen.value) {
      return;
    }
  }
  const target = event.target;
  if (target instanceof Node && menuRef.value?.contains(target)) {
    return;
  }
  if (target instanceof Node && selectionToolRef.value?.contains(target)) {
    return;
  }
  openMenuLabel.value = null;
  isSelectionMenuOpen.value = false;
}

function closeMenuOnEscape(event: KeyboardEvent) {
  if (event.key === "Escape") {
    openMenuLabel.value = null;
    isSelectionMenuOpen.value = false;
    isCrsDialogOpen.value = false;
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

function openSelectionMenu() {
  if (busy.value) {
    return;
  }
  openMenuLabel.value = null;
  isSelectionMenuOpen.value = true;
}

function setSelectionMode(mode: SelectionMode) {
  isSelectionMenuOpen.value = false;
  if (mode === "click") {
    editor.clearSelectionFeatures();
    editor.activateSelectionMode(mode);
    return;
  }
  if (!canDiscardCurrentDraft("切换选择方式")) {
    return;
  }
  clearSelectionVisuals();
  editor.activateSelectionMode(mode);
}

function openCrsDialog() {
  openMenuLabel.value = null;
  isCrsDialogOpen.value = true;
  if (!crsSearchQuery.value) {
    crsSearchQuery.value = displayProjection.value;
  }
  void searchCrsCatalog();
}

function closeCrsDialog() {
  isCrsDialogOpen.value = false;
}

function applyCrsDialog() {
  workspace.setStatus(`坐标显示已更新：${displayProjection.value}，${coordinateSettingsLabel.value}`, "success");
  closeCrsDialog();
}

async function searchCrsCatalog() {
  const requestId = ++crsSearchRequestId;
  isCrsSearching.value = true;
  try {
    await workspace.searchCrsCatalog(crsSearchQuery.value);
  } finally {
    if (requestId === crsSearchRequestId) {
      isCrsSearching.value = false;
    }
  }
}

function handleCrsSearchInput(event: Event) {
  crsSearchQuery.value = (event.target as HTMLInputElement).value;
  void searchCrsCatalog();
}

function selectCrs(crs: CrsDefinition) {
  workspace.setDisplayProjection(crs.code);
}

function resetCustomCrsForm() {
  customCrsEditingId.value = null;
  Object.assign(customCrsForm, {
    code: "",
    name: "",
    srid: 900001,
    proj4text: "",
    authName: "LOCAL",
    wkt: "",
    area: "",
    scope: ""
  });
}

function editCustomCrs(crs: CrsDefinition) {
  customCrsEditingId.value = crs.id;
  Object.assign(customCrsForm, {
    code: crs.code,
    name: crs.name,
    srid: crs.srid,
    proj4text: crs.proj4text,
    authName: crs.authName,
    wkt: crs.wkt,
    area: crs.area,
    scope: crs.scope
  });
}

async function submitCustomCrs() {
  if (!customCrsForm.code.trim() || !customCrsForm.name.trim() || !customCrsForm.proj4text.trim()) {
    workspace.setStatus("请填写地方坐标系编码、名称和 Proj4 参数", "warning");
    return;
  }
  await workspace.saveCustomCrs({
    ...customCrsForm,
    srid: Number(customCrsForm.srid)
  }, customCrsEditingId.value ?? undefined);
  resetCustomCrsForm();
}

async function removeCustomCrs(crs: CrsDefinition) {
  await workspace.deleteCustomCrs(crs.id);
  if (customCrsEditingId.value === crs.id) {
    resetCustomCrsForm();
  }
}

function setCoordinatePrecision(event: Event) {
  coordinatePrecision.value = Number((event.target as HTMLSelectElement).value);
}

function setCoordinateAxisOrder(event: Event) {
  coordinateAxisOrder.value = (event.target as HTMLSelectElement).value as CoordinateAxisOrder;
}

function setActiveLayerFromContext(event: Event) {
  const layerId = (event.target as HTMLSelectElement).value;
  if (!layerId) {
    return;
  }
  setActiveLayerSafely(layerId);
}

function handleNewDraft() {
  if (!isEditingActiveLayer.value) {
    workspace.setStatus("请先开启当前图层编辑", "warning");
    return;
  }
  handleClearDraft();
  workspace.setStatus("已新建空白编辑草稿，请选择绘制工具开始采集", "success");
}

async function handleSaveFeature() {
  if (!isEditingActiveLayer.value) {
    workspace.setStatus("请先开启当前图层编辑后再保存", "warning");
    return;
  }
  const saved = await workspace.saveFeature();
  if (saved) {
    editor.loadEditableFeature(saved);
    editor.refreshLayer(activeLayer.value?.id);
  }
}

async function handleDeleteFeature() {
  if (!isEditingActiveLayer.value) {
    workspace.setStatus("请先开启当前图层编辑后再删除", "warning");
    return;
  }
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

function clearSelectionVisuals() {
  editor.clearSelectionFeatures();
  workspace.clearSelectedFeatureState();
  editor.clearEditableFeature();
}

function canDiscardCurrentDraft(actionLabel: string) {
  if (!hasUnsavedEditDraft.value) {
    return true;
  }
  workspace.setStatus(`${actionLabel}前请先保存或清除当前编辑草稿`, "warning");
  return false;
}

function startDrawing(mode?: GeometryMode) {
  if (!isEditingActiveLayer.value) {
    workspace.setStatus("请先开启当前图层编辑后再绘制", "warning");
    return;
  }
  if (!canDiscardCurrentDraft("开始绘制")) {
    return;
  }
  workspace.clearDraftState();
  editor.startDrawing(mode);
}

function toggleEditingActiveLayer() {
  const layer = activeLayer.value;
  toggleEditingLayer(layer?.id);
}

function startEditingLayer(layerId: string) {
  if (!canDiscardCurrentDraft("切换编辑图层")) {
    return;
  }
  const layer = layers.value.find((item) => item.id === layerId);
  if (!layer) {
    workspace.setStatus("请先选择一个图层", "warning");
    return;
  }
  if ((layer.sourceType ?? "postgis") !== "postgis") {
    workspace.setStatus("Web 栅格图层不支持编辑", "warning");
    return;
  }
  if (!layer.editable) {
    workspace.setStatus(`当前图层只读：${layer.editableReason.join("；") || "缺少可编辑条件"}`, "warning");
    return;
  }
  workspace.setActiveLayer(layer.id);
  editingLayerId.value = layer.id;
  workspace.setStatus(`已开启图层编辑：${layerLabel(layer)}`, "success");
}

function stopEditingLayer(layerId: string) {
  if (!canDiscardCurrentDraft("关闭编辑")) {
    return;
  }
  const layer = layers.value.find((item) => item.id === layerId);
  if (!layer || editingLayerId.value !== layer.id) {
    return;
  }
    editingLayerId.value = null;
    handleClearDraft();
    workspace.setStatus(`已关闭图层编辑：${layerLabel(layer)}`, "neutral");
}

function toggleEditingLayer(layerId?: string) {
  if (!layerId) {
    workspace.setStatus("请先选择一个图层", "warning");
    return;
  }
  if (editingLayerId.value === layerId) {
    stopEditingLayer(layerId);
    return;
  }
  startEditingLayer(layerId);
}

async function handleRefreshAll() {
  await workspace.refreshAll();
  editor.refreshLayer(activeLayer.value?.id);
}

function refreshLoadedLayer(layerId: string) {
  if (!setActiveLayerSafely(layerId)) {
    return;
  }
  editor.refreshLayer(layerId);
  const layer = layers.value.find((item) => item.id === layerId);
  workspace.setStatus(
    layer ? `已刷新图层：${layer.schema}.${layer.table}` : "已刷新图层",
    "success"
  );
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

async function loadLayerToMap(layerId: string) {
  if (!canDiscardCurrentDraft("加载图层")) {
    return;
  }
  const layer = workspace.loadLayer(layerId);
  if (!layer) {
    return;
  }
  await nextTick();
  editor.zoomToLayerExtent(layer.id);
}

function rememberDraggedLayer(layerId: string) {
  draggedLayerId.value = layerId;
}

function clearDraggedLayer() {
  draggedLayerId.value = null;
}

function removeLoadedLayer(layerId: string) {
  if (!canDiscardCurrentDraft("移除图层")) {
    return;
  }
  const layer = workspace.removeLayer(layerId);
  if (!layer) {
    return;
  }
  if (editingLayerId.value === layer.id) {
    editingLayerId.value = null;
    handleClearDraft();
  }
  if (styleEditorLayerId.value === layer.id) {
    closeStyleEditor();
  }
  editor.refreshLayer(activeLayer.value?.id);
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
  showOnlyLayerSafely(layer.id);
}

function showAllLayers() {
  workspace.showAllLayers();
}

function restorePreviousVisibleLayers() {
  restorePreviousVisibleLayersSafely();
}

function setActiveLayerSafely(layerId: string) {
  if (!canDiscardCurrentDraft("切换图层")) {
    return false;
  }
  workspace.setActiveLayer(layerId);
  editor.clearDraft();
  return true;
}

function toggleLayerVisibilitySafely(layerId: string) {
  workspace.toggleLayer(layerId);
}

function showOnlyLayerSafely(layerId: string) {
  if (!canDiscardCurrentDraft("独显图层")) {
    return false;
  }
  workspace.showOnlyLayer(layerId);
  editor.clearDraft();
  return true;
}

function restorePreviousVisibleLayersSafely() {
  if (!canDiscardCurrentDraft("恢复图层可见性")) {
    return false;
  }
  workspace.restorePreviousVisibleLayers();
  editor.clearDraft();
  return true;
}

function zoomToLayer(layerId: string) {
  if (!setActiveLayerSafely(layerId)) {
    return;
  }
  editor.zoomToLayerExtent(layerId);
}

function handleMapStatusCopy(kind: "coordinate" | "scale" | "zoom", value: string) {
  const labels = {
    coordinate: "坐标",
    scale: "比例尺",
    zoom: "Zoom"
  } satisfies Record<typeof kind, string>;
  workspace.setStatus(`已复制${labels[kind]}：${value}`, "success");
}

function openAttributeTable(layerId: string) {
  const layer = layers.value.find((item) => item.id === layerId);
  if (layer && (layer.sourceType ?? "postgis") !== "postgis") {
    workspace.setStatus("Web 栅格图层没有属性表", "warning");
    return;
  }
  void workspace.openAttributeTable(layerId);
}

function closeAttributeTable() {
  workspace.closeAttributeTable();
}

function runAttributeSql(payload: { sql: string; limit: number }) {
  const layer = attributeTableLayer.value;
  if (!layer) {
    return;
  }
  void workspace.runLayerSqlQuery(layer.id, payload.sql, payload.limit);
}

async function runAttributeCalculation(payload: { targetField: string; expression: string; where?: string }) {
  const layer = attributeTableLayer.value;
  if (!layer) {
    return;
  }
  const result = await workspace.calculateLayerAttribute(layer.id, payload);
  if (result) {
    editor.refreshLayer(layer.id);
  }
}

function openStyleEditor(layerId: string) {
  const layer = layers.value.find((item) => item.id === layerId);
  if (layer && (layer.sourceType ?? "postgis") !== "postgis") {
    workspace.setStatus("Web 栅格图层暂不支持服务端样式编辑", "warning");
    return;
  }
  if (!setActiveLayerSafely(layerId)) {
    return;
  }
  styleEditorLayerId.value = layerId;
}

function handlePropertyChange() {
  workspace.markDraftDirty();
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
      <div
        v-for="item in toolbarItems"
        :key="item.label"
        class="workbench__tool-wrap"
        :class="{ 'workbench__tool-wrap--select': item.label === '选择' }"
        :ref="item.label === '选择' ? setSelectionToolRef : undefined"
      >
        <button
          class="workbench__tool focus-ring"
          :class="{ 'workbench__tool--active': item.active }"
          :disabled="item.disabled"
          type="button"
          :title="item.label === '选择' ? `${activeSelectionModeLabel}；右键切换选择方式` : item.title"
          @click="item.label === '选择' ? setSelectionMode(selectionMode) : item.action()"
          @contextmenu.prevent="item.label === '选择' ? openSelectionMenu() : undefined"
        >
          <component :is="item.icon" class="workbench__tool-icon" aria-hidden="true" />
          <span class="workbench__tool-label">{{ item.label }}</span>
        </button>
        <div
          v-if="item.label === '选择' && isSelectionMenuOpen"
          class="workbench__selection-menu"
          role="menu"
          aria-label="选择方式"
        >
          <button
            v-for="option in selectionModeOptions"
            :key="option.mode"
            class="workbench__selection-command focus-ring"
            :class="{ 'workbench__selection-command--active': selectionMode === option.mode }"
            type="button"
            role="menuitemradio"
            :aria-checked="selectionMode === option.mode"
            @click="setSelectionMode(option.mode)"
          >
            <component :is="option.icon" class="workbench__selection-icon" aria-hidden="true" />
            <span class="workbench__selection-label">{{ option.label }}</span>
          </button>
        </div>
      </div>
    </section>

    <section class="workbench__contextbar" aria-label="编辑上下文">
      <span class="workbench__context-label">活动图层:</span>
      <select
        class="workbench__context-select focus-ring"
        :value="activeLayerId"
        :disabled="busy || layers.length === 0"
        aria-label="选择活动图层"
        @change="setActiveLayerFromContext"
      >
        <option value="" disabled>未选择</option>
        <option v-for="layer in layers" :key="layer.id" :value="layer.id">
          {{ layerLabel(layer) }}
        </option>
      </select>
      <template v-if="isSnapEnabled">
        <span class="workbench__context-label">捕捉:</span>
        <span class="workbench__context-field">顶点 + 线段, 8 px</span>
      </template>
    </section>

    <section class="workbench__body" :class="{ 'workbench__body--editing': isEditingActiveLayer }">
      <aside class="workbench__left-dock" aria-label="浏览器与图层">
        <DatasourcePanel
          :datasources="datasources"
          :available-layers="availableLayers"
          :web-service-connections="webServiceConnections"
          :loaded-layer-ids="loadedLayerIds"
          v-model:form="datasourceForm"
          :busy="busy"
          :connection-dialog-request-key="datasourceDialogRequestKey"
          @save="workspace.saveDatasource"
          @save-web-service-connection="workspace.saveWebServiceConnection"
          @scan="workspace.scanDatasource"
          @load-layer="loadLayerToMap"
          @layer-drag-start="rememberDraggedLayer"
          @layer-drag-end="clearDraggedLayer"
        />

        <LayerPanel
          :layers="layers"
          :active-layer-id="activeLayerId"
          :editing-layer-id="editingLayerId"
          :drag-layer-fallback-id="draggedLayerId"
          :visible-layer-ids="visibleLayerIds"
          :editable-layer-count="editableLayerCount"
          :can-restore-visible-layer-ids="canRestoreVisibleLayerIds"
          @select="setActiveLayerSafely"
          @toggle="toggleLayerVisibilitySafely"
          @solo="showOnlyLayerSafely"
          @restore-visibility="restorePreviousVisibleLayersSafely"
          @refresh-layer="refreshLoadedLayer"
          @zoom-to-layer="zoomToLayer"
          @open-attribute-table="openAttributeTable"
          @open-style-editor="openStyleEditor"
          @start-editing="startEditingLayer"
          @stop-editing="stopEditingLayer"
          @remove-layer="removeLoadedLayer"
          @layer-drop="loadLayerToMap"
        />
      </aside>

      <MapCanvas
        v-model:draw-mode="drawMode"
        :active-layer="activeLayer"
        :drag-layer-fallback-id="draggedLayerId"
        :busy="busy"
        :has-draft-geometry="hasDraftGeometry"
        :has-selected-feature="hasSelectedFeature"
        :is-editing-layer="isEditingActiveLayer"
        :is-drawing="isDrawing"
        :coordinate-label="coordinateLabel"
        :scale-label="scaleLabel"
        :zoom-level="zoomLevel"
        @ready="handleMapReady"
        @draw="startDrawing"
        @save="handleSaveFeature"
        @delete="handleDeleteFeature"
        @clear="handleClearDraft"
        @toggle-edit="toggleEditingActiveLayer"
        @layer-drop="loadLayerToMap"
        @copy-map-status="handleMapStatusCopy"
      />

      <EditInspector
        v-if="isEditingActiveLayer"
        v-model:selected-properties="selectedProperties"
        :active-layer="activeLayer"
        :editable-fields="editableFields"
        :is-editing-layer="isEditingActiveLayer"
        :selected-layer-status="selectedLayerStatus"
        :selected-feature-id="selectedFeatureId"
        @property-change="handlePropertyChange"
      />
    </section>

    <footer class="workbench__statusbar">
      <span>{{ coordinateLabel }}</span>
      <span>{{ scaleLabel }}</span>
      <span>Zoom {{ zoomLevel.toFixed(2) }}</span>
      <span class="workbench__statusbar-ok">捕捉: 顶点+线段 8 px</span>
      <span :class="statusClasses" class="workbench__status" role="status">{{ status.text }}</span>
      <div class="workbench__status-crs" title="当前项目显示坐标系">
        <span class="workbench__status-crs-label">CRS</span>
        <button
          class="workbench__status-crs-button focus-ring"
          type="button"
          aria-label="当前项目显示坐标系"
          title="打开坐标与 CRS 设置"
          @click="openCrsDialog"
        >
          {{ displayProjection }}
        </button>
      </div>
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
      <div v-if="isCrsDialogOpen" class="workbench__dialog-backdrop" @pointerdown.self="closeCrsDialog">
        <section class="workbench__crs-dialog" role="dialog" aria-modal="true" aria-labelledby="crs-dialog-title">
          <aside class="workbench__crs-nav" aria-label="工程属性分类">
            <button class="workbench__crs-nav-item workbench__crs-nav-item--active focus-ring" type="button">CRS</button>
            <button class="workbench__crs-nav-item focus-ring" type="button">变换</button>
            <button class="workbench__crs-nav-item focus-ring" type="button">坐标显示</button>
          </aside>
          <section class="workbench__crs-content">
            <header class="workbench__crs-header">
              <div>
                <h2 id="crs-dialog-title" class="workbench__dialog-title">工程坐标参照系 (CRS)</h2>
                <p class="workbench__crs-subtitle">参考 QGIS 工程属性，将项目 CRS、最近使用列表、坐标显示和地方坐标系集中设置。</p>
              </div>
              <button class="workbench__style-dialog-close focus-ring" type="button" aria-label="关闭 CRS 设置" @click="closeCrsDialog">
                ×
              </button>
            </header>

            <div class="workbench__crs-search-row">
              <label class="workbench__crs-filter">
                <span>过滤</span>
                <input
                  class="workbench__crs-filter-input focus-ring"
                  type="search"
                  :value="crsSearchQuery"
                  aria-label="过滤 CRS"
                  placeholder="输入 EPSG、名称、SRID 或 Proj4 片段"
                  @input="handleCrsSearchInput"
                />
              </label>
              <label class="workbench__crs-no-projection">
                <input type="checkbox" disabled />
                <span>无 CRS (或未知/非地球投影)</span>
              </label>
            </div>

            <div class="workbench__crs-grid">
              <section class="workbench__crs-section workbench__crs-section--recent" aria-label="最近使用的坐标参照系">
                <h3 class="workbench__crs-section-title">最近使用的坐标参照系</h3>
                <button
                  class="workbench__crs-row workbench__crs-row--active focus-ring"
                  type="button"
                  @click="selectCrs(selectedCrs)"
                >
                  <span>{{ selectedCrs.code }} - {{ selectedCrs.name }}</span>
                  <span>{{ crsSourceLabels[selectedCrs.source] }}</span>
                </button>
              </section>

              <section class="workbench__crs-section workbench__crs-section--catalog" aria-label="预定义坐标参照系">
                <div class="workbench__crs-section-heading">
                  <h3 class="workbench__crs-section-title">坐标参照系</h3>
                  <label class="workbench__crs-hide-deprecated">
                    <input type="checkbox" checked />
                    <span>隐藏弃用 CRS</span>
                  </label>
                </div>
                <p v-if="isCrsSearching" class="workbench__crs-empty">正在查询坐标系表...</p>
                <button
                  v-for="projection in visibleCrsCatalog"
                  :key="projection.id"
                  class="workbench__crs-row focus-ring"
                  :class="{ 'workbench__crs-row--active': displayProjection === projection.code }"
                  type="button"
                  @click="selectCrs(projection)"
                >
                  <span>{{ projection.code }} - {{ projection.name }}</span>
                  <span>{{ crsSourceLabels[projection.source] }}</span>
                </button>
                <p v-if="!isCrsSearching && visibleCrsCatalog.length === 0" class="workbench__crs-empty">未找到匹配坐标系</p>
              </section>

              <aside class="workbench__crs-side">
                <section class="workbench__crs-section workbench__crs-section--details" aria-label="坐标系详情">
                  <h3 class="workbench__crs-section-title">{{ selectedCrs.name }}</h3>
                  <dl class="workbench__crs-details">
                    <div>
                      <dt>授权 ID</dt>
                      <dd>{{ selectedCrs.code }}</dd>
                    </div>
                    <div>
                      <dt>SRID</dt>
                      <dd>{{ selectedCrs.srid }}</dd>
                    </div>
                    <div>
                      <dt>来源</dt>
                      <dd>{{ crsSourceLabels[selectedCrs.source] }}</dd>
                    </div>
                    <div>
                      <dt>用途</dt>
                      <dd>{{ selectedCrs.scope || "-" }}</dd>
                    </div>
                    <div>
                      <dt>范围</dt>
                      <dd>{{ selectedCrs.area || "-" }}</dd>
                    </div>
                    <div>
                      <dt>Proj4</dt>
                      <dd>{{ selectedCrs.proj4text || "-" }}</dd>
                    </div>
                  </dl>
                </section>

                <section class="workbench__crs-section workbench__crs-section--settings" aria-label="坐标显示设置">
                  <h3 class="workbench__crs-section-title">坐标显示</h3>
                  <div class="workbench__crs-setting">
                    <span>显示 CRS</span>
                    <strong>{{ displayProjection }}</strong>
                  </div>
                  <label class="workbench__crs-setting">
                    <span>坐标顺序</span>
                    <select class="workbench__crs-select focus-ring" :value="coordinateAxisOrder" @change="setCoordinateAxisOrder">
                      <option value="xy">X, Y</option>
                      <option value="yx">Y, X</option>
                    </select>
                  </label>
                  <label class="workbench__crs-setting">
                    <span>小数位数</span>
                    <select class="workbench__crs-select focus-ring" :value="coordinatePrecision" @change="setCoordinatePrecision">
                      <option v-for="precision in coordinatePrecisionOptions" :key="precision" :value="precision">
                        {{ precision }}
                      </option>
                    </select>
                  </label>
                </section>
              </aside>

              <section class="workbench__crs-section workbench__crs-section--custom" aria-label="地方坐标系">
                <div class="workbench__crs-section-heading">
                  <h3 class="workbench__crs-section-title">地方坐标系</h3>
                  <button class="workbench__crs-mini-button focus-ring" type="button" @click="resetCustomCrsForm">
                    新增
                  </button>
                </div>
                <div class="workbench__custom-crs-list">
                  <p v-if="customCrsCatalog.length === 0" class="workbench__crs-empty">暂无自定义地方坐标系</p>
                  <div v-for="crs in customCrsCatalog" :key="crs.id" class="workbench__custom-crs-row">
                    <button class="workbench__custom-crs-pick focus-ring" type="button" @click="selectCrs(crs)">
                      <strong>{{ crs.code }}</strong>
                      <span>{{ crs.name }}</span>
                    </button>
                    <button class="workbench__crs-mini-button focus-ring" type="button" @click="editCustomCrs(crs)">编辑</button>
                    <button class="workbench__crs-mini-button focus-ring" type="button" @click="removeCustomCrs(crs)">删除</button>
                  </div>
                </div>
                <form class="workbench__custom-crs-form" @submit.prevent="submitCustomCrs">
                  <label class="workbench__custom-crs-field">
                    <span>编码</span>
                    <input class="focus-ring" v-model="customCrsForm.code" placeholder="LOCAL:900001" />
                  </label>
                  <label class="workbench__custom-crs-field">
                    <span>名称</span>
                    <input class="focus-ring" v-model="customCrsForm.name" placeholder="成都地方坐标系" />
                  </label>
                  <label class="workbench__custom-crs-field">
                    <span>SRID</span>
                    <input class="focus-ring" v-model.number="customCrsForm.srid" type="number" min="1" max="999999" />
                  </label>
                  <label class="workbench__custom-crs-field">
                    <span>Proj4</span>
                    <textarea class="focus-ring" v-model="customCrsForm.proj4text" rows="3" placeholder="+proj=tmerc ..."></textarea>
                  </label>
                  <label class="workbench__custom-crs-field">
                    <span>用途</span>
                    <input class="focus-ring" v-model="customCrsForm.scope" placeholder="地方工程坐标转换" />
                  </label>
                  <div class="workbench__custom-crs-actions">
                    <button class="workbench__dialog-button focus-ring" type="button" @click="resetCustomCrsForm">清空</button>
                    <button class="workbench__dialog-button workbench__dialog-button--primary focus-ring" type="submit">
                      {{ customCrsEditingId ? "保存修改" : "添加地方坐标系" }}
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <footer class="workbench__crs-actions">
              <button class="workbench__dialog-button focus-ring" type="button" @click="closeCrsDialog">取消</button>
              <button class="workbench__dialog-button focus-ring" type="button" @click="workspace.setStatus(`已应用坐标设置：${coordinateSettingsLabel}`, 'success')">应用</button>
              <button class="workbench__dialog-button workbench__dialog-button--primary focus-ring" type="button" @click="applyCrsDialog">确定</button>
            </footer>
          </section>
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
      :sql-result="attributeSqlResult"
      :query="attributeTableQuery"
      :busy="busy"
      @query="workspace.updateAttributeTableQuery"
      @calculate="runAttributeCalculation"
      @sql-query="runAttributeSql"
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

.workbench__tool-wrap {
  position: relative;
  display: inline-flex;
  align-items: stretch;
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

.workbench__selection-menu {
  position: absolute;
  top: calc(100% + 3px);
  left: 0;
  z-index: var(--qgis-z-menu);
  width: 184px;
  border: 1px solid #8d8d8d;
  background: #f7f7f7;
  box-shadow: 2px 4px 12px rgba(15, 23, 42, 0.24);
  padding: 4px;
}

.workbench__selection-command {
  display: flex;
  width: 100%;
  min-height: 30px;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: var(--qgis-text);
  padding: 5px 8px;
  text-align: left;
}

.workbench__selection-command:hover,
.workbench__selection-command--active {
  background: var(--qgis-row-active);
}

.workbench__selection-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.workbench__selection-label {
  font-weight: 600;
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

.workbench__context-label {
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

.workbench__body {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: 330px minmax(520px, 1fr);
  min-height: 0;
}

.workbench__body--editing {
  grid-template-columns: 330px minmax(520px, 1fr) 360px;
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
  overflow: hidden;
  color: var(--qgis-muted);
  text-overflow: ellipsis;
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

.workbench__status-crs {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  border-left: 1px solid #b6b6b6;
  padding-left: 10px;
}

.workbench__status-crs-label {
  color: var(--qgis-muted);
  font-size: 11px;
  font-weight: 600;
}

.workbench__status-crs-button {
  min-height: 22px;
  border: 1px solid #9f9f9f;
  background: #e8e8e8;
  color: var(--qgis-text);
  padding: 1px 10px;
  font-size: 12px;
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

.workbench__crs-dialog {
  display: grid;
  width: min(980px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  grid-template-columns: 150px minmax(0, 1fr);
  border: 1px solid #777777;
  background: var(--qgis-pane);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.workbench__crs-nav {
  display: grid;
  align-content: start;
  gap: 2px;
  background: #5b5b5b;
  padding: 8px 0;
}

.workbench__crs-nav-item {
  min-height: 36px;
  border: 0;
  background: transparent;
  color: #ffffff;
  padding: 8px 12px;
  text-align: left;
}

.workbench__crs-nav-item--active {
  background: #e8e8e8;
  color: var(--qgis-text);
}

.workbench__crs-content {
  display: grid;
  min-width: 0;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 10px;
  padding: 12px;
  overflow: hidden;
}

.workbench__crs-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #c8c8c8;
  padding-bottom: 8px;
}

.workbench__crs-subtitle {
  margin: 0;
  color: var(--qgis-muted);
  font-size: 12px;
}

.workbench__crs-search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.workbench__crs-no-projection,
.workbench__crs-filter,
.workbench__crs-hide-deprecated,
.workbench__crs-setting {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--qgis-text);
}

.workbench__crs-filter span,
.workbench__crs-setting span {
  width: 72px;
  color: var(--qgis-muted);
  font-size: 11px;
}

.workbench__crs-filter-input,
.workbench__crs-select {
  min-height: 24px;
  min-width: 0;
  border: 1px solid #aeb6bf;
  background: var(--qgis-input);
  color: var(--qgis-text);
  padding: 3px 7px;
}

.workbench__crs-filter-input {
  flex: 1 1 auto;
}

.workbench__crs-grid {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(360px, 1fr) 300px;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
}

.workbench__crs-section {
  border: 1px solid #b6b6b6;
  background: #f7f7f7;
}

.workbench__crs-section--recent,
.workbench__crs-section--catalog {
  grid-column: 1;
}

.workbench__crs-section--catalog {
  min-height: 0;
  overflow: auto;
}

.workbench__crs-side {
  display: grid;
  min-height: 0;
  grid-column: 2;
  grid-row: 1 / span 2;
  align-content: start;
  gap: 10px;
}

.workbench__crs-section--custom {
  grid-column: 1 / -1;
  max-height: 210px;
  overflow: auto;
}

.workbench__crs-section-title {
  margin: 0;
  border-bottom: 1px solid #c8c8c8;
  background: #e6e6e6;
  padding: 6px 8px;
  font-size: 12px;
}

.workbench__crs-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #c8c8c8;
  background: #e6e6e6;
}

.workbench__crs-section-heading .workbench__crs-section-title {
  border-bottom: 0;
}

.workbench__crs-hide-deprecated {
  padding-right: 8px;
  color: var(--qgis-muted);
  font-size: 11px;
}

.workbench__crs-row {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) 120px;
  border: 0;
  border-bottom: 1px solid #d7d7d7;
  background: transparent;
  color: var(--qgis-text);
  padding: 6px 8px;
  text-align: left;
}

.workbench__crs-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench__crs-row:hover,
.workbench__crs-row--active {
  background: var(--qgis-row-active);
}

.workbench__crs-empty {
  margin: 0;
  padding: 8px;
  color: var(--qgis-muted);
}

.workbench__crs-details {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 8px;
}

.workbench__crs-details div {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 8px;
}

.workbench__crs-details dt {
  color: var(--qgis-muted);
}

.workbench__crs-details dd {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workbench__crs-section--settings {
  display: grid;
  gap: 8px;
  align-content: start;
  padding-bottom: 8px;
}

.workbench__crs-section--settings .workbench__crs-section-title {
  margin-bottom: 2px;
}

.workbench__crs-setting {
  padding: 0 8px;
}

.workbench__crs-select {
  flex: 1 1 auto;
}

.workbench__crs-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid #c8c8c8;
  padding-top: 10px;
}

.workbench__crs-mini-button {
  min-height: 24px;
  border: 1px solid #9f9f9f;
  background: #e8e8e8;
  color: var(--qgis-text);
  padding: 2px 8px;
  font-size: 11px;
}

.workbench__custom-crs-list {
  display: grid;
}

.workbench__custom-crs-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: stretch;
  border-bottom: 1px solid #d7d7d7;
}

.workbench__custom-crs-pick {
  display: grid;
  border: 0;
  background: transparent;
  color: var(--qgis-text);
  padding: 6px 8px;
  text-align: left;
}

.workbench__custom-crs-pick:hover {
  background: var(--qgis-row-active);
}

.workbench__custom-crs-pick span {
  overflow: hidden;
  color: var(--qgis-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench__custom-crs-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 8px;
}

.workbench__custom-crs-field {
  display: grid;
  gap: 4px;
  color: var(--qgis-muted);
  font-size: 11px;
}

.workbench__custom-crs-field:nth-child(4),
.workbench__custom-crs-field:nth-child(5) {
  grid-column: 1 / -1;
}

.workbench__custom-crs-field input,
.workbench__custom-crs-field textarea {
  min-width: 0;
  border: 1px solid #aeb6bf;
  background: var(--qgis-input);
  color: var(--qgis-text);
  padding: 4px 6px;
  font: inherit;
  resize: vertical;
}

.workbench__custom-crs-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.workbench__dialog-button--primary {
  border-color: #6f6f6f;
  background: #d8d8d8;
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

  .workbench__body--editing {
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
