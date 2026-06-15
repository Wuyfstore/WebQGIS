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
  style: LayerStyle;
  extent: [number, number, number, number] | null;
  updatedAt: string;
};

export type FeaturePayload = {
  geometry?: unknown;
  properties?: Record<string, unknown>;
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
  sort?: string;
  order: "asc" | "desc";
};

export type FeaturePage = {
  items: FeatureSummary[];
  total: number;
  limit: number;
  offset: number;
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
