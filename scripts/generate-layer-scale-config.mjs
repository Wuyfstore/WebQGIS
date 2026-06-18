import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  const schema = options.schema ?? "public";
  const sourceTable = requiredOption(options, "source-table");
  const geometryColumn = options.geometryColumn ?? "geom";
  const idColumn = options.idColumn ?? "id";
  const ranges = parseRanges(options.ranges ?? "0-6,7-10");
  const config = ranges.map((range) => ({
    minZoom: range.minZoom,
    maxZoom: range.maxZoom,
    schema,
    table: options.prefix
      ? `${options.prefix}_z${range.minZoom}_${range.maxZoom}`
      : `${sourceTable}_simplified_z${range.minZoom}_${range.maxZoom}`,
    geometryColumn,
    idColumn
  }));
  console.log(JSON.stringify({ scaleSources: config }, null, 2));
}

export function parseRanges(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(\d+)-(\d+)$/);
      if (!match) {
        throw new Error(`Invalid zoom range: ${item}`);
      }
      const minZoom = Number(match[1]);
      const maxZoom = Number(match[2]);
      if (minZoom > maxZoom) {
        throw new Error(`Invalid zoom range order: ${item}`);
      }
      return { minZoom, maxZoom };
    });
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
