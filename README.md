# WebQGIS

WebQGIS 是一个面向 PostGIS 矢量数据的类 QGIS WebGIS MVP。项目目标是把“连接 PostGIS 数据源、扫描空间表、注册图层、发布矢量瓦片、浏览地图、编辑要素并写回数据库”这条主流程先做通、做稳。

当前版本强调展示链路和编辑链路分离：地图展示使用 MVT 矢量瓦片，编辑时按图层和主键回源读取原始 PostGIS 几何，保存时写回原始表。

## 当前能力

- PostgreSQL/PostGIS 数据源连接测试与本地注册。
- 扫描 schema、table、geometry column、SRID、几何类型、单字段主键、字段、权限和空间索引状态。
- 自动生成图层注册信息，包含可查询、可编辑状态、不可编辑原因、默认样式和瓦片地址。
- 为每个空间图层提供 MVT 矢量瓦片接口。
- 按主键读取原始 GeoJSON 要素。
- 提供要素新增、更新、删除接口，直接写回 PostGIS。
- 前端提供 Vue 3 + OpenLayers 工作台：
  - 数据源管理。
  - 图层树和图层显隐。
  - MVT 地图展示。
  - 要素选择和回源读取。
  - 点、线、面绘制。
  - Modify 节点编辑。
  - Snap 基础吸附。
  - 属性编辑面板。
  - 保存、删除和删除确认。

## 技术架构

项目采用 npm workspaces：

```text
apps/
  api/  NestJS + Fastify Adapter + pg
  web/  Vue 3 + Vite + OpenLayers + UnoCSS + VueUse
```

后端按 NestJS feature module 拆分：

- `HealthModule`：健康检查。
- `DatasourcesModule`：数据源测试、保存、列表、扫描。
- `LayersModule`：图层列表、要素 CRUD、MVT 瓦片。
- `PostgisModule`：PostGIS 连接池和 SQL repository。
- `StorageModule`：本地 JSON 文件存储。
- `LayerRegistryModule`：图层注册表仓库。

前端按工作台职责拆分：

- `WebGisWorkbench.vue`：页面组合容器。
- `DatasourcePanel.vue`：数据源面板。
- `LayerPanel.vue`：图层面板。
- `MapCanvas.vue`：地图画布与编辑工具栏。
- `EditInspector.vue`：图层信息和属性编辑面板。
- `useWebGisWorkspace.ts`：业务状态和 API 编排。
- `useOpenLayersEditor.ts`：OpenLayers 地图和编辑交互。

## 快速开始

安装依赖：

```bash
npm install
```

启动前后端开发服务：

```bash
npm run dev
```

默认情况下：

- API 服务地址：`http://localhost:4100`
- Web 前端地址：以 Vite 终端输出为准，通常是 `http://localhost:5173`

运行时数据源配置和图层注册表会写入 `data/` 目录。该目录用于本地 MVP 运行数据，默认不提交到 Git。

## 常用命令

```bash
npm run typecheck
npm run build
npm --workspace apps/api run test
npm --workspace apps/web run test
```

## API 概览

- `GET /api/health`：健康检查。
- `POST /api/datasources/test`：测试 PostGIS 连接。
- `POST /api/datasources`：测试成功后保存数据源配置。
- `GET /api/datasources`：列出已保存数据源，响应不包含密码。
- `POST /api/datasources/:id/scan`：扫描 PostGIS 元数据并注册图层。
- `GET /api/layers`：列出已注册图层。
- `GET /api/layers/:id/tile/:z/:x/:y.mvt`：返回 MVT 矢量瓦片。
- `GET /api/layers/:id/features/:pk`：按主键读取原始 GeoJSON 要素。
- `POST /api/layers/:id/features`：新增要素。
- `PUT /api/layers/:id/features/:pk`：更新要素几何和属性。
- `DELETE /api/layers/:id/features/:pk`：删除要素。

## V1 边界

V1 只把 PostGIS `geometry` 列作为可编辑对象。图层如果缺少稳定单字段主键、有效 SRID、受支持几何类型或写权限，会被注册为只读。

暂不包含以下能力：

- 完整 QGIS 插件体系。
- Shapefile、GeoPackage、DXF、GeoTIFF 等文件格式导入导出。
- 完整 QGIS 样式系统和复杂标注。
- 拓扑规则引擎。
- 服务端全库高性能吸附。
- 多用户协同编辑、版本管理和冲突合并。
- 生产级数据源密码加密、认证授权和审计。

## 开发提示

- 当前后端仍使用本地 JSON 文件保存数据源和图层注册信息，适合 MVP 和本地验证，不适合生产。
- PostGIS SQL 路径需要配合真实示例库做集成测试。
- 推荐准备点、线、面三张示例表，每张表包含主键、`geometry` 字段、SRID、空间索引和若干属性字段，用于验证完整编辑闭环。
