export const layerDragMime = "application/x-webqgis-layer-id";

export function writeLayerDragPayload(event: DragEvent, layerId: string) {
  event.dataTransfer?.setData(layerDragMime, layerId);
  event.dataTransfer?.setData("text/plain", layerId);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "copy";
  }
}

export function hasLayerDragPayload(event: DragEvent, fallbackLayerId?: string | null) {
  if (fallbackLayerId) {
    return true;
  }
  const types = event.dataTransfer?.types;
  return Boolean(types && Array.from(types).some((type) => (
    type === layerDragMime || type === "text/plain"
  )));
}

export function readLayerDragPayload(event: DragEvent, fallbackLayerId?: string | null) {
  return event.dataTransfer?.getData(layerDragMime)
    || event.dataTransfer?.getData("text/plain")
    || fallbackLayerId
    || "";
}
