import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import {
  buildDatasource,
  createFeature,
  deleteFeature,
  getVectorTile,
  readFeature,
  scanDatasource,
  testConnection,
  updateFeature
} from "./postgis.js";
import {
  getDatasource,
  getLayer,
  listDatasources,
  listLayers,
  replaceLayersForDatasource,
  saveDatasource,
  toPublicDatasource
} from "./store.js";
import type { FeaturePayload } from "./types.js";

const datasourceSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.coerce.number().int().positive().default(5432),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().default(""),
  ssl: z.boolean().optional()
});

const featureSchema = z.object({
  geometry: z.unknown().optional(),
  properties: z.record(z.unknown()).optional()
});

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true
});

app.get("/api/health", async () => ({
  ok: true,
  service: "webqgis-api",
  time: new Date().toISOString()
}));

app.post("/api/datasources/test", async (request, reply) => {
  const input = datasourceSchema.parse(request.body);
  const config = buildDatasource(input);
  await testConnection(config);
  return reply.send({ ok: true });
});

app.post("/api/datasources", async (request, reply) => {
  const input = datasourceSchema.parse(request.body);
  const config = buildDatasource(input);
  await testConnection(config);
  const saved = await saveDatasource(config);
  return reply.code(201).send(toPublicDatasource(saved));
});

app.get("/api/datasources", async () => {
  const datasources = await listDatasources();
  return datasources.map(toPublicDatasource);
});

app.post("/api/datasources/:id/scan", async (request, reply) => {
  const { id } = request.params as { id: string };
  const datasource = await getDatasource(id);
  if (!datasource) {
    return reply.code(404).send({ message: "Datasource not found" });
  }
  const layers = await scanDatasource(datasource);
  await replaceLayersForDatasource(id, layers);
  return { layers };
});

app.get("/api/layers", async () => {
  return listLayers();
});

app.get("/api/layers/:id/features/:pk", async (request, reply) => {
  const { id, pk } = request.params as { id: string; pk: string };
  const layer = await getLayer(id);
  if (!layer) {
    return reply.code(404).send({ message: "Layer not found" });
  }
  const datasource = await getDatasource(layer.datasourceId);
  if (!datasource) {
    return reply.code(404).send({ message: "Datasource not found" });
  }
  const feature = await readFeature(datasource, layer, pk);
  if (!feature) {
    return reply.code(404).send({ message: "Feature not found" });
  }
  return feature;
});

app.post("/api/layers/:id/features", async (request, reply) => {
  const { id } = request.params as { id: string };
  const layer = await getLayer(id);
  if (!layer) {
    return reply.code(404).send({ message: "Layer not found" });
  }
  const datasource = await getDatasource(layer.datasourceId);
  if (!datasource) {
    return reply.code(404).send({ message: "Datasource not found" });
  }
  const payload = featureSchema.parse(request.body) as FeaturePayload;
  const feature = await createFeature(datasource, layer, payload);
  return reply.code(201).send(feature);
});

app.put("/api/layers/:id/features/:pk", async (request, reply) => {
  const { id, pk } = request.params as { id: string; pk: string };
  const layer = await getLayer(id);
  if (!layer) {
    return reply.code(404).send({ message: "Layer not found" });
  }
  const datasource = await getDatasource(layer.datasourceId);
  if (!datasource) {
    return reply.code(404).send({ message: "Datasource not found" });
  }
  const payload = featureSchema.parse(request.body) as FeaturePayload;
  const feature = await updateFeature(datasource, layer, pk, payload);
  return feature;
});

app.delete("/api/layers/:id/features/:pk", async (request, reply) => {
  const { id, pk } = request.params as { id: string; pk: string };
  const layer = await getLayer(id);
  if (!layer) {
    return reply.code(404).send({ message: "Layer not found" });
  }
  const datasource = await getDatasource(layer.datasourceId);
  if (!datasource) {
    return reply.code(404).send({ message: "Datasource not found" });
  }
  await deleteFeature(datasource, layer, pk);
  return reply.code(204).send();
});

app.get("/api/layers/:id/tile/:z/:x/:y.mvt", async (request, reply) => {
  const { id, z, x, y } = request.params as {
    id: string;
    z: string;
    x: string;
    y: string;
  };
  const layer = await getLayer(id);
  if (!layer) {
    return reply.code(404).send({ message: "Layer not found" });
  }
  const datasource = await getDatasource(layer.datasourceId);
  if (!datasource) {
    return reply.code(404).send({ message: "Datasource not found" });
  }
  const tile = await getVectorTile(datasource, layer, Number(z), Number(x), Number(y));
  return reply.header("content-type", "application/x-protobuf").send(tile);
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  const statusCode = error instanceof z.ZodError ? 400 : 500;
  const message = error instanceof Error ? error.message : "Unknown server error";
  return reply.code(statusCode).send({
    message,
    issues: error instanceof z.ZodError ? error.issues : undefined
  });
});

const port = Number(process.env.API_PORT ?? 4100);
const host = process.env.API_HOST ?? "0.0.0.0";
await app.listen({ port, host });
