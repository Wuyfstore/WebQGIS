export type GeometryMode = "Point" | "LineString" | "Polygon";

export type GeoJsonFeature = {
  type: "Feature";
  id?: string | number | null;
  geometry: unknown;
  properties?: Record<string, unknown> | null;
};

export type FeatureSummary = {
  type: "Feature";
  id: string | number | null;
  geometry: null;
  properties: Record<string, unknown>;
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

export type AttributeCalculationPayload = {
  targetField: string;
  expression: string;
  where?: string;
};

export type AttributeCalculationResult = {
  targetField: string;
  affectedRows: number;
};

export type AttributeTableQuery = {
  limit: number;
  offset: number;
  search: string;
  sort?: string;
  order: "asc" | "desc";
};

export type FieldMeta = {
  name: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  defaultValue: string | null;
  editable: boolean;
};

export type DatasourceForm = {
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

export type Datasource = Omit<DatasourceForm, "password"> & {
  id: string;
  createdAt: string;
  updatedAt: string;
  hasPassword: boolean;
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
  style: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    pointRadius: number;
    opacity: number;
  };
  extent: [number, number, number, number] | null;
  updatedAt: string;
};

export type LayerStyle = LayerRegistration["style"];

export type LayerStylePatch = Partial<LayerStyle>;

export type ToastTone = "neutral" | "success" | "warning" | "danger";

export type StatusMessage = {
  text: string;
  tone: ToastTone;
};
