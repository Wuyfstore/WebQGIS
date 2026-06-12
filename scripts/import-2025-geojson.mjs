import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const sourceDir = "D:/User_Data/Downloads/2025.9版/geojson格式";

const datasets = [
  { file: "中国_省.geojson", table: "china_2025_province", adminLevel: "province" },
  { file: "中国_市.geojson", table: "china_2025_city", adminLevel: "city" },
  { file: "中国_县.geojson", table: "china_2025_county", adminLevel: "county" }
];

const pool = new Pool({
  host: "127.0.0.1",
  port: 15432,
  database: "test",
  user: "qcwebserver",
  password: "qcwebserver123",
  max: 3
});

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

async function importDataset(client, dataset) {
  const fullPath = path.join(sourceDir, dataset.file);
  const raw = fs.readFileSync(fullPath, "utf8");
  const geojson = JSON.parse(raw);
  const features = Array.isArray(geojson.features) ? geojson.features : [];

  await client.query("begin");
  try {
    await client.query(`drop table if exists public.${quoteIdent(dataset.table)} cascade`);
    await client.query(`
      create table public.${quoteIdent(dataset.table)} (
        id bigserial primary key,
        source_file text not null default ${quoteLiteral(dataset.file)},
        admin_level text not null default ${quoteLiteral(dataset.adminLevel)},
        name text,
        gb text,
        properties jsonb not null default '{}'::jsonb,
        geom geometry(Geometry, 4326) not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);

    const insertSql = `
      insert into public.${quoteIdent(dataset.table)}
        (source_file, admin_level, name, gb, properties, geom)
      values
        ($1, $2, $3, $4, $5::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326))
    `;

    let inserted = 0;
    for (const feature of features) {
      if (!feature?.geometry) {
        continue;
      }
      const properties = feature.properties ?? {};
      await client.query(insertSql, [
        dataset.file,
        dataset.adminLevel,
        normalizeText(properties.name),
        normalizeText(properties.gb),
        JSON.stringify(properties),
        JSON.stringify(feature.geometry)
      ]);
      inserted += 1;
    }

    await client.query(`create index ${quoteIdent(`${dataset.table}_geom_gix`)} on public.${quoteIdent(dataset.table)} using gist (geom)`);
    await client.query(`create index ${quoteIdent(`${dataset.table}_name_idx`)} on public.${quoteIdent(dataset.table)} (name)`);
    await client.query(`analyze public.${quoteIdent(dataset.table)}`);
    await client.query("commit");

    return { ...dataset, features: features.length, inserted };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

const client = await pool.connect();
try {
  const results = [];
  for (const dataset of datasets) {
    results.push(await importDataset(client, dataset));
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  client.release();
  await pool.end();
}
