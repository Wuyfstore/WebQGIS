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

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<T>;
}

export async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
