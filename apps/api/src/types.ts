import type { PoolConfig } from "pg";

export type GeometryKind =
  | "GEOMETRY"
  | "POINT"
  | "MULTIPOINT"
  | "LINESTRING"
  | "MULTILINESTRING"
  | "POLYGON"
  | "MULTIPOLYGON";

export type FieldMeta = {
  name: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  defaultValue: string | null;
  editable: boolean;
};

export type DatasourceConfig = {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicDatasourceConfig = Omit<DatasourceConfig, "password"> & {
  hasPassword: boolean;
};

export type LayerStyle = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  pointRadius: number;
  opacity: number;
};

export type LayerRegistration = {
  id: string;
  datasourceId: string;
  schema: string;
  table: string;
  geometryColumn: string;
  geometryType: string;
  srid: number | null;
  primaryKey: string | null;
  fields: FieldMeta[];
  hasSpatialIndex: boolean;
  canSelect: boolean;
  canInsert: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  queryable: boolean;
  editable: boolean;
  editableReason: string[];
  tileUrl: string;
  tileVersion: number;
  style: LayerStyle;
  extent: [number, number, number, number] | null;
  updatedAt: string;
};

export type GeoJsonFeature = {
  type: "Feature";
  id?: string | number | null;
  geometry: unknown;
  properties?: Record<string, unknown> | null;
};

export type GeometryBbox = [number, number, number, number];

export type DirtyTile = {
  z: number;
  x: number;
  y: number;
};

export type FeaturePayload = {
  geometry?: unknown;
  properties?: Record<string, unknown>;
};

export type FeatureWriteResult = {
  feature: GeoJsonFeature;
  tileVersion: number;
  dirtyTiles: DirtyTile[];
};

export type FeatureDeleteResult = {
  tileVersion: number;
  dirtyTiles: DirtyTile[];
};

export type FeatureMutationResult = {
  feature: GeoJsonFeature;
  oldBbox: GeometryBbox | null;
  newBbox: GeometryBbox | null;
};

export type FeatureDeleteMutationResult = {
  oldBbox: GeometryBbox | null;
};

export type FeatureSelectionPayload = {
  geometry: unknown;
  limit: number;
};

export type FeatureSelectionResult = {
  ids: string[];
  features: GeoJsonFeature[];
  total: number;
  limit: number;
};

export type FeatureSummary = {
  type: "Feature";
  id: string | number | null;
  geometry: null;
  properties: Record<string, unknown>;
};

export type FeaturePageQuery = {
  limit: number;
  offset: number;
  search: string;
  ids?: string[];
  sort?: string;
  order: "asc" | "desc";
};

export type FeaturePage = {
  items: FeatureSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type SqlQueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  limit: number;
};

export type AttributeCalculationResult = {
  targetField: string;
  affectedRows: number;
};

export function toPoolConfig(config: DatasourceConfig): PoolConfig {
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30_000
  };
}
