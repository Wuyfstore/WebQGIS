<script setup lang="ts">
import type { Datasource, DatasourceForm } from "../../types/gis";

defineProps<{
  datasources: Datasource[];
  form: DatasourceForm;
  busy: boolean;
}>();

const emit = defineEmits<{
  save: [];
  scan: [datasourceId: string];
}>();
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
      <div class="datasource-panel__tree-node datasource-panel__tree-node--root">▾ PostgreSQL</div>
      <button
        v-for="datasource in datasources"
        :key="datasource.id"
        class="datasource-panel__tree-node datasource-panel__tree-node--source focus-ring"
        :disabled="busy"
        type="button"
        @click="emit('scan', datasource.id)"
      >
        ▾ {{ datasource.name }}
        <span>{{ datasource.host }} / {{ datasource.database }}</span>
      </button>
      <div v-if="datasources.length === 0" class="datasource-panel__tree-empty">
        暂无连接，保存后可扫描空间表
      </div>
    </div>

    <form class="datasource-panel__form" aria-label="PostGIS 数据源" @submit.prevent="emit('save')">
      <h3 class="datasource-panel__section-title">PostGIS 连接</h3>
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
        <span class="datasource-panel__label">用户</span>
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
        <span>SSL</span>
      </label>

      <button class="datasource-panel__save focus-ring" :disabled="busy" type="submit">
        保存并测试
      </button>
    </form>
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
  min-height: 118px;
  padding: 4px 10px 12px;
  color: var(--qgis-text);
}

.datasource-panel__tree-node {
  display: block;
  width: 100%;
  min-height: 24px;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0 0 0 6px;
  text-align: left;
}

.datasource-panel__tree-node--root {
  font-weight: 600;
}

.datasource-panel__tree-node--source {
  padding-left: 24px;
  font-weight: 600;
}

.datasource-panel__tree-node--source:hover {
  background: var(--qgis-row-active);
}

.datasource-panel__tree-node span {
  display: block;
  padding-left: 18px;
  color: var(--qgis-muted);
  font-size: 11px;
  font-weight: 400;
}

.datasource-panel__tree-empty {
  padding: 8px 24px;
  color: var(--qgis-muted);
  font-size: 12px;
}

.datasource-panel__form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 8px;
  border-top: 1px solid var(--qgis-border);
  padding: 10px;
  background: var(--qgis-pane);
}

.datasource-panel__section-title {
  grid-column: 1 / -1;
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 600;
}

.datasource-panel__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.datasource-panel__field--wide,
.datasource-panel__save {
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

.datasource-panel__save {
  min-height: 26px;
  border: 1px solid #8f8f8f;
  background: #e8e8e8;
  color: var(--qgis-text);
  font-size: 12px;
}
</style>
