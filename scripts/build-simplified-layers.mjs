import { Pool } from "pg";
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  const sourceSchema = options.sourceSchema ?? "public";
  const sourceTable = requiredOption(options, "source-table");
  const targetSchema = options.targetSchema ?? sourceSchema;
  const targetTable = options.targetTable ?? `${sourceTable}_simplified_z${options.minZoom ?? 0}_${options.maxZoom ?? 6}`;
  const geometryColumn = options.geometryColumn ?? "geom";
  const idColumn = options.idColumn ?? "id";
  const tolerance = Number(options.tolerance ?? 0.01);
  const minArea = Number(options.minArea ?? 0);
  const targetSrid = options.targetSrid === undefined ? undefined : Number(options.targetSrid);
  const execute = Boolean(options.execute);

  const sql = buildSimplifiedLayerSql({
    sourceSchema,
    sourceTable,
    targetSchema,
    targetTable,
    geometryColumn,
    idColumn,
    tolerance,
    minArea,
    targetSrid
  });

  if (!execute) {
    console.log(sql);
    process.exit(0);
  }

  const pool = new Pool({
    host: options.host ?? "127.0.0.1",
    port: Number(options.port ?? 5432),
    database: requiredOption(options, "database"),
    user: requiredOption(options, "user"),
    password: options.password ?? ""
  });

  try {
    await pool.query(sql);
    console.log(JSON.stringify({
      target: `${targetSchema}.${targetTable}`,
      source: `${sourceSchema}.${sourceTable}`,
      geometryColumn,
      tolerance,
      minArea,
      targetSrid: targetSrid ?? "preserve-source"
    }, null, 2));
  } finally {
    await pool.end();
  }
}

export function buildSimplifiedLayerSql(config) {
  const sourceName = `${quoteIdent(config.sourceSchema)}.${quoteIdent(config.sourceTable)}`;
  const targetName = `${quoteIdent(config.targetSchema)}.${quoteIdent(config.targetTable)}`;
  const geom = quoteIdent(config.geometryColumn);
  const id = quoteIdent(config.idColumn);
  const simplifiedGeom = `ST_Multi(ST_SimplifyPreserveTopology(${geom}, ${sqlNumber(config.tolerance)}))`;
  const outputGeom = config.targetSrid === undefined
    ? `${simplifiedGeom}::geometry(MultiPolygon)`
    : `${simplifiedGeom}::geometry(MultiPolygon, ${sqlSrid(config.targetSrid)})`;
  const areaFilter = config.minArea > 0
    ? `and ST_Area(ST_Transform(${geom}, 3857)) >= ${sqlNumber(config.minArea)}`
    : "";
  return `
drop table if exists ${targetName};
create table ${targetName} as
select
  ${id},
  ${outputGeom} as ${geom}
from ${sourceName}
where ${geom} is not null
  and GeometryType(${geom}) in ('POLYGON', 'MULTIPOLYGON')
  ${areaFilter};

create index ${quoteIdent(`${config.targetTable}_${config.geometryColumn}_gix`)}
  on ${targetName}
  using gist (${geom});

analyze ${targetName};
`.trim();
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = toCamelCase(arg.slice(2));
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function requiredOption(options, key) {
  const camelKey = toCamelCase(key);
  const value = options[camelKey];
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return String(value);
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function sqlNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`Invalid numeric option: ${value}`);
  }
  return String(number);
}

function sqlSrid(value) {
  const srid = Number(value);
  if (!Number.isInteger(srid) || srid <= 0) {
    throw new Error(`Invalid SRID option: ${value}`);
  }
  return String(srid);
}
