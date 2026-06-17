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
  ids?: string[];
  sort?: string;
  order: "asc" | "desc";
};

export type LayerSourceType = "postgis" | "xyz" | "wms" | "wmts";

export type WebLayerSource =
  | {
      type: "xyz";
      urlTemplate: string;
      attributions?: string;
      minZoom?: number;
      maxZoom?: number;
    }
  | {
      type: "wms";
      url: string;
      layers: string;
      styles?: string;
      format?: string;
      version?: string;
      transparent?: boolean;
      params?: Record<string, string>;
    }
  | {
      type: "wmts";
      url: string;
      layer: string;
      matrixSet: string;
      style?: string;
      format?: string;
    };

export type WebServiceConnection = {
  id: string;
  type: Exclude<LayerSourceType, "postgis">;
  name: string;
  url: string;
  layerName?: string;
  style?: string;
  format?: string;
  matrixSet?: string;
};

export type WebServiceConnectionPayload = Omit<WebServiceConnection, "id">;

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
  sourceType?: LayerSourceType;
  displayName?: string;
  serviceConnectionId?: string;
  webSource?: WebLayerSource;
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

export type CrsDefinition = {
  id: string;
  code: string;
  authName: string;
  authSrid: number;
  srid: number;
  name: string;
  proj4text: string;
  wkt: string;
  area: string;
  scope: string;
  source: "postgis" | "custom" | "fallback";
  datasourceId?: string;
  custom: boolean;
  updatedAt?: string;
};

export type CustomCrsPayload = {
  code: string;
  name: string;
  srid: number;
  proj4text: string;
  authName: string;
  wkt: string;
  area: string;
  scope: string;
};

export type ToastTone = "neutral" | "success" | "warning" | "danger";

export type StatusMessage = {
  text: string;
  tone: ToastTone;
};
