import type { FieldMeta, LayerRegistration } from "../types/gis";

export function isPostgisLayer(layer?: LayerRegistration): boolean {
  return Boolean(layer && (layer.sourceType ?? "postgis") === "postgis");
}

export function getEditableFields(layer?: LayerRegistration): FieldMeta[] {
  if (!isPostgisLayer(layer)) {
    return [];
  }
  return layer?.fields.filter((field) => field.editable) ?? [];
}

export function getLayerStatus(layer?: LayerRegistration): string {
  if (!layer) {
    return "请选择图层";
  }
  if (!isPostgisLayer(layer)) {
    return "Web 栅格图层只读";
  }
  if (layer.editable) {
    return "可编辑";
  }
  return layer.editableReason.join("、") || "只读";
}

export function isNumericField(dataType: string): boolean {
  const normalized = dataType.toLowerCase();
  return normalized.includes("int")
    || normalized.includes("numeric")
    || normalized.includes("double")
    || normalized.includes("real")
    || normalized.includes("decimal");
}

export function getGeometryModes(layer?: LayerRegistration): Array<"Point" | "LineString" | "Polygon"> {
  if (!isPostgisLayer(layer)) {
    return [];
  }
  const type = layer?.geometryType.toUpperCase() ?? "";
  if (type === "GEOMETRY") {
    return ["Point", "LineString", "Polygon"];
  }
  if (type.includes("POINT")) {
    return ["Point"];
  }
  if (type.includes("LINESTRING")) {
    return ["LineString"];
  }
  if (type.includes("POLYGON")) {
    return ["Polygon"];
  }
  return ["Point", "LineString", "Polygon"];
}
