import type { FieldMeta, LayerRegistration } from "./types.js";

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const forbiddenSqlPattern = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|execute|call|do|merge|vacuum|analyze|refresh|reindex|attach|detach|pg_sleep|dblink|lo_import|lo_export)\b/i;
const allowedExpressionTokens = new Set([
  "null",
  "true",
  "false",
  "case",
  "when",
  "then",
  "else",
  "end",
  "coalesce",
  "concat",
  "lower",
  "upper",
  "round",
  "abs",
  "length",
  "replace",
  "substring",
  "cast",
  "as",
  "is",
  "not",
  "and",
  "or",
  "like",
  "ilike",
  "in",
  "between"
]);

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

export function assertSingleReadonlySelect(sql: string): string {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (!trimmed) {
    throw new Error("SQL query is required");
  }
  if (!/^select\b/i.test(trimmed)) {
    throw new Error("Only SELECT queries are allowed");
  }
  if (trimmed.includes(";") || forbiddenSqlPattern.test(trimmed) || /--|\/\*/.test(trimmed)) {
    throw new Error("Only a single read-only SELECT query is allowed");
  }
  return trimmed;
}

export function buildSafeLayerSelectSql(layer: LayerRegistration, sql: string, limit: number): string {
  const selectSql = assertSingleReadonlySelect(sql);
  const layerTokenSql = selectSql.replaceAll("{layer}", qualifiedTable(layer));
  const tablePattern = new RegExp(
    `\\bfrom\\s+${escapeRegExp(qualifiedTable(layer)).replace("\\.", "\\s*\\.\\s*")}(?:\\s|$)`,
    "i"
  );
  const aliasedTablePattern = new RegExp(
    `\\bfrom\\s+${escapeRegExp(layer.schema)}\\s*\\.\\s*${escapeRegExp(layer.table)}(?:\\s|$)`,
    "i"
  );
  if (!tablePattern.test(layerTokenSql) && !aliasedTablePattern.test(layerTokenSql)) {
    throw new Error("SQL must query the current layer table or use {layer}");
  }
  return `select * from (${layerTokenSql}) webqgis_safe_query limit ${Math.max(1, Math.min(200, limit))}`;
}

export function buildSafeAttributeExpression(layer: LayerRegistration, expression: string): string {
  const trimmed = expression.trim();
  if (!trimmed || trimmed.length > 500) {
    throw new Error("Expression is required");
  }
  if (trimmed.includes(";") || forbiddenSqlPattern.test(trimmed) || /--|\/\*/.test(trimmed)) {
    throw new Error("Unsafe expression");
  }
  if (!/^[\w\s."'+\-*/%(),|&<>=!?:]+$/.test(trimmed)) {
    throw new Error("Expression contains unsupported characters");
  }
  assertAllowedExpressionTokens(trimmed);
  return replaceFieldTokens(layer, trimmed);
}

export function buildSafeWhereExpression(layer: LayerRegistration, where = ""): string {
  const trimmed = where.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes(";") || forbiddenSqlPattern.test(trimmed) || /--|\/\*/.test(trimmed)) {
    throw new Error("Unsafe WHERE expression");
  }
  if (!/^[\w\s."'+\-*/%(),|&<>=!?:]+$/.test(trimmed)) {
    throw new Error("WHERE expression contains unsupported characters");
  }
  assertAllowedExpressionTokens(trimmed);
  return replaceFieldTokens(layer, trimmed);
}

function assertAllowedExpressionTokens(input: string): void {
  const withoutQuotedFields = input
    .replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, "")
    .replace(/'[^']*'/g, "");
  const tokens = withoutQuotedFields.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];
  const invalid = tokens.find((token) => !allowedExpressionTokens.has(token.toLowerCase()));
  if (invalid) {
    throw new Error(`Unsupported expression token: ${invalid}`);
  }
}

function replaceFieldTokens(layer: LayerRegistration, input: string): string {
  const allowed = new Set([
    layer.primaryKey,
    layer.geometryColumn,
    ...layer.fields.map((field) => field.name)
  ].filter(Boolean));
  return input.replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, (_, fieldName: string) => {
    if (!allowed.has(fieldName)) {
      throw new Error(`Unknown field: ${fieldName}`);
    }
    return quoteIdent(fieldName);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
