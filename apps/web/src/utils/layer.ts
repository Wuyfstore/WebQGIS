import type { FieldMeta, LayerRegistration } from "../types/gis";

export function getEditableFields(layer?: LayerRegistration): FieldMeta[] {
  return layer?.fields.filter((field) => field.editable) ?? [];
}

export function getLayerStatus(layer?: LayerRegistration): string {
  if (!layer) {
    return "请选择图层";
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
  const type = layer?.geometryType.toUpperCase() ?? "";
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
