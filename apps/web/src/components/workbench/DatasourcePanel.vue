<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue";
import { Connection, FolderOpened, Plus, Refresh, Setting } from "@element-plus/icons-vue";
import type { Datasource, DatasourceForm } from "../../types/gis";

const props = defineProps<{
  datasources: Datasource[];
  busy: boolean;
  connectionDialogRequestKey: number;
}>();

const form = defineModel<DatasourceForm>("form", { required: true });

const emit = defineEmits<{
  save: [];
  scan: [datasourceId: string];
}>();

const isPostgresExpanded = shallowRef(true);
const isConnectionDialogOpen = shallowRef(false);
const contextMenu = shallowRef({
  visible: false,
  x: 0,
  y: 0
});
const contextMenuStyle = computed(() => ({
  left: `${contextMenu.value.x}px`,
  top: `${contextMenu.value.y}px`
}));
const datasourceCountLabel = computed(() => `${props.datasources.length} 个连接`);
const postgresDisclosure = computed(() => (isPostgresExpanded.value ? "▾" : "▸"));

function openContextMenu(event: MouseEvent) {
  event.preventDefault();
  contextMenu.value = {
    visible: true,
    x: Math.min(event.clientX, window.innerWidth - 186),
    y: Math.min(event.clientY, window.innerHeight - 96)
  };
  window.addEventListener("click", closeContextMenu, { once: true });
}

function closeContextMenu() {
  contextMenu.value = {
    ...contextMenu.value,
    visible: false
  };
}

function openConnectionDialog() {
  closeContextMenu();
  isConnectionDialogOpen.value = true;
}

function togglePostgresNode() {
  isPostgresExpanded.value = !isPostgresExpanded.value;
}

function closeConnectionDialog() {
  isConnectionDialogOpen.value = false;
}

function saveConnection() {
  emit("save");
}

function refreshFirstDatasource() {
  const datasource = props.datasources[0];
  if (datasource) {
    emit("scan", datasource.id);
  }
}

onBeforeUnmount(() => {
  window.removeEventListener("click", closeContextMenu);
});

watch(
  () => props.connectionDialogRequestKey,
  () => openConnectionDialog()
);
</script>

<template>
  <section class="datasource-panel workbench-panel">
    <header class="datasource-panel__header">
      <h2 class="datasource-panel__title">浏览器</h2>
      <span class="datasource-panel__dock-button" aria-hidden="true"></span>
    </header>

    <label class="datasource-panel__filter">
      <span class="datasource-panel__filter-text">过滤 schema / table / 图层</span>
      <input class="datasource-panel__filter-input focus-ring" aria-label="过滤数据源" />
    </label>

    <div class="datasource-panel__tree" aria-label="PostGIS 浏览器树">
      <button
        class="datasource-panel__tree-node datasource-panel__tree-node--root focus-ring"
        type="button"
        :title="isPostgresExpanded ? '折叠 PostgreSQL 连接' : '展开 PostgreSQL 连接'"
        @contextmenu="openContextMenu"
        @click="togglePostgresNode"
      >
        <FolderOpened class="datasource-panel__node-icon" />
        <span>{{ postgresDisclosure }} PostgreSQL</span>
        <span class="datasource-panel__root-meta">{{ datasourceCountLabel }}</span>
      </button>
      <template v-if="isPostgresExpanded">
        <button
          v-for="datasource in datasources"
          :key="datasource.id"
          class="datasource-panel__tree-node datasource-panel__tree-node--source focus-ring"
          :disabled="busy"
          type="button"
          @click="emit('scan', datasource.id)"
        >
          <Connection class="datasource-panel__node-icon" />
          <span class="datasource-panel__source-name">▾ {{ datasource.name }}</span>
          <span class="datasource-panel__source-meta">{{ datasource.host }} / {{ datasource.database }}</span>
        </button>
        <div v-if="datasources.length === 0" class="datasource-panel__tree-empty">
          暂无连接。右键 PostgreSQL 新建 PostGIS 连接。
        </div>
      </template>
    </div>

    <Teleport to="body">
      <div v-if="contextMenu.visible" class="datasource-panel__context-menu" :style="contextMenuStyle" role="menu">
        <button class="datasource-panel__context-item" type="button" role="menuitem" @click="openConnectionDialog">
          <Plus class="datasource-panel__context-icon" />
          新建连接...
        </button>
        <button class="datasource-panel__context-item" :disabled="busy || datasources.length === 0" type="button" role="menuitem" @click="refreshFirstDatasource">
          <Refresh class="datasource-panel__context-icon" />
          刷新
        </button>
        <button class="datasource-panel__context-item" type="button" role="menuitem" @click="openConnectionDialog">
          <Setting class="datasource-panel__context-icon" />
          连接管理
        </button>
      </div>

      <div v-if="isConnectionDialogOpen" class="datasource-panel__dialog-backdrop">
        <form class="datasource-panel__dialog" aria-label="PostGIS 连接" @submit.prevent="saveConnection">
          <header class="datasource-panel__dialog-header">
            <h3 class="datasource-panel__dialog-title">创建新的 PostGIS 连接</h3>
            <button class="datasource-panel__dialog-close focus-ring" type="button" aria-label="关闭连接弹窗" @click="closeConnectionDialog">
              ×
            </button>
          </header>

          <section class="datasource-panel__dialog-body">
            <label class="datasource-panel__field datasource-panel__field--wide">
              <span class="datasource-panel__label">名称</span>
              <input
                v-model="form.name"
                class="datasource-panel__input focus-ring"
                name="datasource-name"
                autocomplete="organization"
                placeholder="Local PostGIS"
              />
            </label>

            <label class="datasource-panel__field">
              <span class="datasource-panel__label">主机</span>
              <input
                v-model="form.host"
                class="datasource-panel__input focus-ring"
                name="host"
                autocomplete="url"
                placeholder="localhost"
              />
            </label>

            <label class="datasource-panel__field">
              <span class="datasource-panel__label">端口</span>
              <input
                v-model.number="form.port"
                class="datasource-panel__input focus-ring"
                name="port"
                type="number"
                inputmode="numeric"
                min="1"
                max="65535"
              />
            </label>

            <label class="datasource-panel__field">
              <span class="datasource-panel__label">数据库</span>
              <input
                v-model="form.database"
                class="datasource-panel__input focus-ring"
                name="database"
                autocomplete="off"
                placeholder="postgis"
              />
            </label>

            <label class="datasource-panel__field">
              <span class="datasource-panel__label">用户名</span>
              <input
                v-model="form.user"
                class="datasource-panel__input focus-ring"
                name="username"
                autocomplete="username"
                placeholder="postgres"
              />
            </label>

            <label class="datasource-panel__field datasource-panel__field--wide">
              <span class="datasource-panel__label">密码</span>
              <input
                v-model="form.password"
                class="datasource-panel__input focus-ring"
                name="password"
                type="password"
                autocomplete="current-password"
              />
            </label>

            <label class="datasource-panel__check">
              <input v-model="form.ssl" class="focus-ring" name="ssl" type="checkbox" />
              <span>使用 SSL 连接</span>
            </label>
          </section>

          <footer class="datasource-panel__dialog-actions">
            <button class="datasource-panel__dialog-button focus-ring" type="button" @click="closeConnectionDialog">
              取消
            </button>
            <button class="datasource-panel__dialog-button datasource-panel__dialog-button--primary focus-ring" :disabled="busy" type="submit">
              保存并测试
            </button>
          </footer>
        </form>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.datasource-panel {
  display: flex;
  flex-direction: column;
  border-width: 0 0 1px;
}

.datasource-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 25px;
  border-bottom: 1px solid #9e9e9e;
  padding: 0 10px;
  background: var(--qgis-dock-title);
}

.datasource-panel__title {
  margin: 0;
  color: var(--qgis-text);
  font-size: 13px;
  font-weight: 600;
}

.datasource-panel__dock-button {
  width: 12px;
  height: 12px;
  border: 1px solid #858585;
  background: #cfcfcf;
}

.datasource-panel__filter {
  position: relative;
  display: block;
  padding: 9px 10px 6px;
}

.datasource-panel__filter-text {
  position: absolute;
  top: 14px;
  left: 22px;
  color: var(--qgis-muted);
  pointer-events: none;
}

.datasource-panel__filter-input {
  width: 100%;
  height: 24px;
  border: 1px solid #aeb6bf;
  background: #ffffff;
  padding: 3px 8px;
}

.datasource-panel__tree {
  min-height: 206px;
  padding: 4px 10px 12px;
  color: var(--qgis-text);
}

.datasource-panel__tree-node {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  column-gap: 4px;
  align-items: center;
  width: 100%;
  min-height: 24px;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0 0 0 6px;
  text-align: left;
}

.datasource-panel__tree-node--root {
  grid-template-columns: 18px minmax(0, 1fr) auto;
  font-weight: 600;
  cursor: pointer;
}

.datasource-panel__tree-node--source {
  grid-template-columns: 18px minmax(0, 1fr);
  padding-left: 24px;
  font-weight: 600;
}

.datasource-panel__node-icon {
  width: 14px;
  height: 14px;
  color: #6f8a54;
}

.datasource-panel__tree-node--source:hover {
  background: var(--qgis-row-active);
}

.datasource-panel__source-name,
.datasource-panel__source-meta,
.datasource-panel__root-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.datasource-panel__root-meta {
  color: var(--qgis-muted);
  font-size: 11px;
  font-weight: 400;
}

.datasource-panel__source-meta {
  grid-column: 2;
  display: block;
  color: var(--qgis-muted);
  font-size: 11px;
  font-weight: 400;
}

.datasource-panel__tree-empty {
  padding: 8px 24px;
  color: var(--qgis-muted);
  font-size: 12px;
}

.datasource-panel__context-menu {
  position: fixed;
  z-index: 40;
  width: 180px;
  border: 1px solid #8d8d8d;
  background: #f7f7f7;
  box-shadow: 2px 4px 12px rgba(15, 23, 42, 0.24);
  padding: 4px;
}

.datasource-panel__context-item {
  display: flex;
  width: 100%;
  min-height: 26px;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: var(--qgis-text);
  padding: 4px 8px;
  text-align: left;
}

.datasource-panel__context-item:hover:not(:disabled) {
  background: var(--qgis-row-active);
}

.datasource-panel__context-item:disabled {
  color: var(--qgis-muted);
}

.datasource-panel__context-icon {
  width: 14px;
  height: 14px;
}

.datasource-panel__dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 35;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.36);
}

.datasource-panel__dialog {
  width: min(520px, 100%);
  border: 1px solid #8d8d8d;
  background: var(--qgis-pane);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
}

.datasource-panel__dialog-header {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #a5a5a5;
  background: var(--qgis-dock-title);
  padding: 0 10px 0 12px;
}

.datasource-panel__dialog-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.datasource-panel__dialog-close {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid #9a9a9a;
  background: #e8e8e8;
  color: var(--qgis-text);
  padding: 0;
  font-size: 18px;
  line-height: 1;
}

.datasource-panel__dialog-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
  padding: 14px;
  background: var(--qgis-pane);
}

.datasource-panel__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.datasource-panel__field--wide,
.datasource-panel__dialog-actions {
  grid-column: 1 / -1;
}

.datasource-panel__label {
  color: var(--qgis-muted);
  font-size: 11px;
}

.datasource-panel__input {
  width: 100%;
  min-height: 24px;
  border: 1px solid #aeb6bf;
  padding: 3px 6px;
  background: var(--qgis-input);
  color: var(--qgis-text);
}

.datasource-panel__check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  color: var(--qgis-muted);
  font-size: 12px;
}

.datasource-panel__dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid #c8c8c8;
  padding: 10px 14px;
  background: #eeeeee;
}

.datasource-panel__dialog-button {
  min-height: 28px;
  border: 1px solid #8f8f8f;
  background: #e8e8e8;
  color: var(--qgis-text);
  padding: 4px 14px;
  font-size: 12px;
}

.datasource-panel__dialog-button--primary {
  border-color: #6f9fc9;
  background: var(--qgis-blue-soft);
  color: var(--qgis-blue);
}

@media (max-width: 760px) {
  .datasource-panel__dialog-body {
    grid-template-columns: 1fr;
  }
}
</style>
