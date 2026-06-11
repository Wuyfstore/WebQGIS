import type { FieldMeta, LayerRegistration } from "./types.js";

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function quoteIdent(identifier: string): string {
  if (!identifierPattern.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function qualifiedTable(layer: LayerRegistration): string {
  return `${quoteIdent(layer.schema)}.${quoteIdent(layer.table)}`;
}

export function editableFields(layer: LayerRegistration): FieldMeta[] {
  return layer.fields.filter((field) => field.editable);
}

export function filterProperties(
  layer: LayerRegistration,
  properties: Record<string, unknown> = {}
): Record<string, unknown> {
  const allowed = new Set(editableFields(layer).map((field) => field.name));
  return Object.fromEntries(
    Object.entries(properties).filter(([key]) => allowed.has(key))
  );
}

export function buildSetClause(
  startIndex: number,
  properties: Record<string, unknown>
): { clause: string; values: unknown[] } {
  const entries = Object.entries(properties);
  const clause = entries
    .map(([key], index) => `${quoteIdent(key)} = $${startIndex + index}`)
    .join(", ");
  return {
    clause,
    values: entries.map(([, value]) => value)
  };
}
