export type {
  Datasource,
  DatasourceForm,
  FieldMeta,
  GeoJsonFeature,
  LayerRegistration,
  LayerStyle,
  LayerStylePatch
} from "./types/gis";

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
