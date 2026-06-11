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
      <h2 class="datasource-panel__title">数据源</h2>
      <p class="datasource-panel__summary">{{ datasources.length }} 个连接</p>
    </header>

    <form class="datasource-panel__form" aria-label="PostGIS 数据源" @submit.prevent="emit('save')">
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

    <div class="datasource-panel__list" aria-label="已保存数据源">
      <button
        v-for="datasource in datasources"
        :key="datasource.id"
        class="datasource-panel__item focus-ring"
        :disabled="busy"
        type="button"
        @click="emit('scan', datasource.id)"
      >
        <span class="datasource-panel__item-name">{{ datasource.name }}</span>
        <span class="datasource-panel__item-meta">{{ datasource.host }} / {{ datasource.database }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.datasource-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
}

.datasource-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.datasource-panel__title {
  margin: 0;
  color: #172033;
  font-size: 14px;
}

.datasource-panel__summary {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.datasource-panel__form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
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
  color: #52627a;
  font-size: 12px;
}

.datasource-panel__input {
  width: 100%;
  min-height: 34px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 7px 9px;
  background: #ffffff;
  color: #172033;
}

.datasource-panel__check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  color: #52627a;
  font-size: 13px;
}

.datasource-panel__save,
.datasource-panel__item {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #172033;
}

.datasource-panel__save {
  min-height: 36px;
}

.datasource-panel__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.datasource-panel__item {
  display: flex;
  min-height: 46px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 7px 9px;
  text-align: left;
}

.datasource-panel__item-name,
.datasource-panel__item-meta {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.datasource-panel__item-name {
  font-size: 13px;
}

.datasource-panel__item-meta {
  color: #64748b;
  font-size: 12px;
}
</style>
