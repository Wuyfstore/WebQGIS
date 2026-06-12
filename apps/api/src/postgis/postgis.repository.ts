import { BadRequestException, Injectable, OnApplicationShutdown } from "@nestjs/common";
import { Pool } from "pg";
import type {
  DatasourceConfig,
  FeaturePayload,
  FieldMeta,
  GeometryKind,
  LayerRegistration
} from "../types.js";
import { buildSetClause, filterProperties, qualifiedTable, quoteIdent } from "../sql.js";
import { toPoolConfig } from "../types.js";

type SpatialTableRow = {
  table_schema: string;
  table_name: string;
  geometry_column: string;
  srid: number | null;
  geometry_type: string;
  primary_key: string | null;
  has_spatial_index: boolean;
  can_select: boolean;
  can_insert: boolean;
  can_update: boolean;
  can_delete: boolean;
  extent: string | null;
};

type FieldRow = {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
};

const supportedGeometryTypes = new Set<GeometryKind>([
  "POINT",
  "MULTIPOINT",
  "LINESTRING",
  "MULTILINESTRING",
  "POLYGON",
  "MULTIPOLYGON"
]);

@Injectable()
export class PostgisRepository implements OnApplicationShutdown {
  private readonly pools = new Map<string, Pool>();

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([...this.pools.values()].map((pool) => pool.end()));
    this.pools.clear();
  }

  async testConnection(config: DatasourceConfig): Promise<void> {
    const pool = new Pool(toPoolConfig(config));
    try {
      await pool.query("select postgis_version() as postgis_version");
    } finally {
      await pool.end();
    }
  }

  async scanDatasource(config: DatasourceConfig): Promise<LayerRegistration[]> {
    const pool = this.getPool(config);
    const spatialResult = await pool.query<SpatialTableRow>(
      `
      with geom_cols as (
        select
          f_table_schema as table_schema,
          f_table_name as table_name,
          f_geometry_column as geometry_column,
          srid,
          type as geometry_type
        from public.geometry_columns
        where f_table_schema not in ('pg_catalog', 'information_schema')
      ),
      single_pk as (
        select
          kcu.table_schema,
          kcu.table_name,
          min(kcu.column_name) as primary_key,
          count(*) as key_count
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
         and tc.table_schema = kcu.table_schema
         and tc.table_name = kcu.table_name
        where tc.constraint_type = 'PRIMARY KEY'
        group by kcu.table_schema, kcu.table_name
      ),
      spatial_indexes as (
        select
          schemaname as table_schema,
          tablename as table_name,
          indexdef
        from pg_indexes
        where indexdef ilike '%gist%' or indexdef ilike '%spgist%'
      )
      select
        gc.table_schema,
        gc.table_name,
        gc.geometry_column,
        nullif(gc.srid, 0) as srid,
        upper(gc.geometry_type) as geometry_type,
        case when pk.key_count = 1 then pk.primary_key else null end as primary_key,
        exists (
          select 1 from spatial_indexes si
          where si.table_schema = gc.table_schema
            and si.table_name = gc.table_name
            and si.indexdef ilike '%' || gc.geometry_column || '%'
        ) as has_spatial_index,
        has_table_privilege(format('%I.%I', gc.table_schema, gc.table_name), 'SELECT') as can_select,
        has_table_privilege(format('%I.%I', gc.table_schema, gc.table_name), 'INSERT') as can_insert,
        has_table_privilege(format('%I.%I', gc.table_schema, gc.table_name), 'UPDATE') as can_update,
        has_table_privilege(format('%I.%I', gc.table_schema, gc.table_name), 'DELETE') as can_delete,
        null as extent
      from geom_cols gc
      left join single_pk pk
        on pk.table_schema = gc.table_schema
       and pk.table_name = gc.table_name
      order by gc.table_schema, gc.table_name, gc.geometry_column
      `
    );

    const layers: LayerRegistration[] = [];
    for (const [index, row] of spatialResult.rows.entries()) {
      const fields = await this.scanFields(pool, row);
      const extent = await this.scanExtent(pool, row);
      const editableReason = this.buildEditableReason(row);
      const id = `${config.id}_${row.table_schema}_${row.table_name}_${row.geometry_column}`
        .replace(/[^A-Za-z0-9_-]/g, "_");
      layers.push({
        id,
        datasourceId: config.id,
        schema: row.table_schema,
        table: row.table_name,
        geometryColumn: row.geometry_column,
        geometryType: row.geometry_type,
        srid: row.srid,
        primaryKey: row.primary_key,
        fields,
        hasSpatialIndex: row.has_spatial_index,
        canSelect: row.can_select,
        canInsert: row.can_insert,
        canUpdate: row.can_update,
        canDelete: row.can_delete,
        queryable: row.can_select && Boolean(row.primary_key),
        editable: editableReason.length === 0,
        editableReason,
        tileUrl: `/api/layers/${id}/tile/{z}/{x}/{y}.mvt`,
        style: this.defaultStyle(index),
        extent,
        updatedAt: new Date().toISOString()
      });
    }
    return layers;
  }

  async readFeature(config: DatasourceConfig, layer: LayerRegistration, pk: string) {
    this.assertQueryableLayer(layer);
    const pool = this.getPool(config);
    const result = await pool.query(
      `
      select jsonb_build_object(
        'type', 'Feature',
        'id', ${quoteIdent(layer.primaryKey!)},
        'geometry', ST_AsGeoJSON(ST_Transform(${quoteIdent(layer.geometryColumn)}, 4326))::jsonb,
        'properties', to_jsonb(t) - $1 - $2
      ) as feature
      from ${qualifiedTable(layer)} t
      where ${quoteIdent(layer.primaryKey!)}::text = $3
      limit 1
      `,
      [layer.geometryColumn, layer.primaryKey, pk]
    );
    return result.rows[0]?.feature ?? null;
  }

  async createFeature(
    config: DatasourceConfig,
    layer: LayerRegistration,
    payload: FeaturePayload
  ) {
    this.assertEditableLayer(layer);
    if (!payload.geometry) {
      throw new BadRequestException("Feature geometry is required");
    }
    const properties = filterProperties(layer, payload.properties);
    const propertyEntries = Object.entries(properties);
    const geometryIndex = propertyEntries.length + 1;
    const columns = [...propertyEntries.map(([key]) => quoteIdent(key)), quoteIdent(layer.geometryColumn)]
      .join(", ");
    const values = [
      ...propertyEntries.map((_, index) => `$${index + 1}`),
      `ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${geometryIndex}), 4326), ${layer.srid})`
    ].join(", ");
    const queryValues = [
      ...propertyEntries.map(([, value]) => value),
      JSON.stringify(payload.geometry)
    ];
    const pool = this.getPool(config);
    const result = await pool.query(
      `
      insert into ${qualifiedTable(layer)} (${columns})
      values (${values})
      returning ${quoteIdent(layer.primaryKey!)} as id
      `,
      queryValues
    );
    return this.readFeature(config, layer, String(result.rows[0].id));
  }

  async updateFeature(
    config: DatasourceConfig,
    layer: LayerRegistration,
    pk: string,
    payload: FeaturePayload
  ) {
    this.assertEditableLayer(layer);
    const properties = filterProperties(layer, payload.properties);
    const setParts: string[] = [];
    const values: unknown[] = [];
    if (Object.keys(properties).length > 0) {
      const set = buildSetClause(1, properties);
      setParts.push(set.clause);
      values.push(...set.values);
    }
    if (payload.geometry) {
      const geometryIndex = values.length + 1;
      setParts.push(
        `${quoteIdent(layer.geometryColumn)} = ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${geometryIndex}), 4326), ${layer.srid})`
      );
      values.push(JSON.stringify(payload.geometry));
    }
    if (setParts.length === 0) {
      return this.readFeature(config, layer, pk);
    }
    values.push(pk);
    const pool = this.getPool(config);
    await pool.query(
      `
      update ${qualifiedTable(layer)}
      set ${setParts.join(", ")}
      where ${quoteIdent(layer.primaryKey!)}::text = $${values.length}
      `,
      values
    );
    return this.readFeature(config, layer, pk);
  }

  async deleteFeature(
    config: DatasourceConfig,
    layer: LayerRegistration,
    pk: string
  ): Promise<void> {
    this.assertEditableLayer(layer);
    const pool = this.getPool(config);
    await pool.query(
      `delete from ${qualifiedTable(layer)} where ${quoteIdent(layer.primaryKey!)}::text = $1`,
      [pk]
    );
  }

  async getVectorTile(
    config: DatasourceConfig,
    layer: LayerRegistration,
    z: number,
    x: number,
    y: number
  ): Promise<Buffer> {
    const pool = this.getPool(config);
    const propertyColumns = layer.fields
      .filter((field) => field.name !== layer.primaryKey)
      .slice(0, 24)
      .map((field) => quoteIdent(field.name));
    const primaryField = layer.fields.find((field) => field.name === layer.primaryKey);
    const canUseMvtFeatureId = Boolean(primaryField && this.isIntegerField(primaryField));
    const featureIdColumn = canUseMvtFeatureId ? `${quoteIdent(layer.primaryKey!)}::bigint as mvt_feature_id` : "null::bigint as mvt_feature_id";
    const idPropertyColumn = layer.primaryKey ? `${quoteIdent(layer.primaryKey)} as id` : "null as id";
    const selectColumns = [featureIdColumn, idPropertyColumn, ...propertyColumns].join(", ");
    const result = await pool.query<{ mvt: Buffer }>(
      `
      with bounds as (
        select ST_TileEnvelope($1, $2, $3) as geom
      ),
      mvtgeom as (
        select
          ${selectColumns},
          ST_AsMVTGeom(
            ST_Transform(t.${quoteIdent(layer.geometryColumn)}, 3857),
            bounds.geom,
            4096,
            64,
            true
          ) as geom
        from ${qualifiedTable(layer)} t, bounds
        where ST_Intersects(
          ST_Transform(t.${quoteIdent(layer.geometryColumn)}, 3857),
          bounds.geom
        )
      )
      select ST_AsMVT(mvtgeom.*, $4, 4096, 'geom', 'mvt_feature_id') as mvt
      from mvtgeom
      `,
      [z, x, y, layer.id]
    );
    return result.rows[0]?.mvt ?? Buffer.alloc(0);
  }

  private getPool(config: DatasourceConfig): Pool {
    const existing = this.pools.get(config.id);
    if (existing) {
      return existing;
    }
    const pool = new Pool(toPoolConfig(config));
    this.pools.set(config.id, pool);
    return pool;
  }

  private async scanExtent(pool: Pool, row: SpatialTableRow): Promise<[number, number, number, number] | null> {
    try {
      const result = await pool.query<{ extent: string | null }>(
        `
        select ST_Extent(ST_Transform(${quoteIdent(row.geometry_column)}, 4326))::text as extent
        from ${quoteIdent(row.table_schema)}.${quoteIdent(row.table_name)}
        where ${quoteIdent(row.geometry_column)} is not null
        `
      );
      return this.parseExtent(result.rows[0]?.extent ?? null);
    } catch {
      return this.parseExtent(row.extent);
    }
  }

  private async scanFields(pool: Pool, row: SpatialTableRow): Promise<FieldMeta[]> {
    const fieldsResult = await pool.query<FieldRow>(
      `
      select column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = $1
        and table_name = $2
        and column_name <> $3
      order by ordinal_position
      `,
      [row.table_schema, row.table_name, row.geometry_column]
    );
    return fieldsResult.rows.map((field) => ({
      name: field.column_name,
      dataType: field.data_type,
      udtName: field.udt_name,
      nullable: field.is_nullable === "YES",
      defaultValue: field.column_default,
      editable: field.column_name !== row.primary_key && !field.column_default?.includes("nextval(")
    }));
  }

  private buildEditableReason(row: SpatialTableRow): string[] {
    const reasons: string[] = [];
    if (!row.primary_key) {
      reasons.push("缺少单字段主键");
    }
    if (!row.srid || row.srid <= 0) {
      reasons.push("geometry 字段缺少有效 SRID");
    }
    if (!supportedGeometryTypes.has(row.geometry_type.toUpperCase() as GeometryKind)) {
      reasons.push(`暂不支持几何类型 ${row.geometry_type}`);
    }
    if (!row.can_select || !row.can_update || !row.can_insert || !row.can_delete) {
      reasons.push("当前数据库用户缺少完整 SELECT/INSERT/UPDATE/DELETE 权限");
    }
    return reasons;
  }

  private parseExtent(value: string | null): [number, number, number, number] | null {
    if (!value) {
      return null;
    }
    const match = value.match(/^BOX\(([-0-9.]+) ([-0-9.]+),([-0-9.]+) ([-0-9.]+)\)$/);
    if (!match) {
      return null;
    }
    return [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4])
    ];
  }

  private defaultStyle(index: number): LayerRegistration["style"] {
    const palette = [
      { fill: "#6EA8FE55", stroke: "#1D4ED8" },
      { fill: "#7DD3FC55", stroke: "#0369A1" },
      { fill: "#86EFAC55", stroke: "#15803D" },
      { fill: "#FDE68A66", stroke: "#B45309" },
      { fill: "#FDA4AF55", stroke: "#BE123C" }
    ];
    const color = palette[index % palette.length];
    return {
      ...color,
      strokeWidth: 2,
      pointRadius: 6,
      opacity: 0.82
    };
  }

  private isIntegerField(field: FieldMeta): boolean {
    return ["int2", "int4", "int8"].includes(field.udtName);
  }

  private assertQueryableLayer(layer: LayerRegistration): void {
    if (!layer.primaryKey) {
      throw new BadRequestException("Layer has no primary key");
    }
  }

  private assertEditableLayer(layer: LayerRegistration): void {
    if (!layer.editable || !layer.primaryKey) {
      throw new BadRequestException(layer.editableReason.join("、") || "Layer is not editable");
    }
  }
}
