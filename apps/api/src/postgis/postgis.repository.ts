import { BadRequestException, Injectable, NotFoundException, OnApplicationShutdown } from "@nestjs/common";
import { Pool } from "pg";
import type {
  DatasourceConfig,
  FeaturePage,
  FeaturePageQuery,
  FeaturePayload,
  FeatureDeleteMutationResult,
  FeatureMutationResult,
  FeatureSelectionPayload,
  FeatureSelectionResult,
  FeatureSummary,
  FieldMeta,
  GeoJsonFeature,
  GeometryBbox,
  GeometryKind,
  LayerRegistration,
  SqlQueryResult,
  AttributeCalculationResult
} from "../types.js";
import {
  buildSafeAttributeExpression,
  buildSafeLayerSelectSql,
  buildSafeWhereExpression,
  buildSetClause,
  editableFields,
  filterProperties,
  qualifiedTable,
  quoteIdent
} from "../sql.js";
import { toPoolConfig } from "../types.js";
import type { AttributeCalculationDto } from "../layers/dto/attribute-calculation.dto.js";
import type { CrsDefinition } from "../crs/crs.types.js";

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

type SpatialRefSysRow = {
  srid: number;
  auth_name: string | null;
  auth_srid: number | null;
  srtext: string | null;
  proj4text: string | null;
};

type GeometryProfile = {
  srid: number | null;
  geometry_type: string | null;
};

const supportedGeometryTypes = new Set<GeometryKind>([
  "GEOMETRY",
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
      const geometryProfile = await this.scanGeometryProfile(pool, row);
      const profiledRow: SpatialTableRow = {
        ...row,
        srid: row.srid ?? geometryProfile.srid,
        geometry_type: row.geometry_type === "GEOMETRY" && geometryProfile.geometry_type
          ? geometryProfile.geometry_type
          : row.geometry_type
      };
      const extent = await this.scanExtent(pool, profiledRow);
      const editableReason = this.buildEditableReason(profiledRow);
      const id = `${config.id}_${row.table_schema}_${row.table_name}_${row.geometry_column}`
        .replace(/[^A-Za-z0-9_-]/g, "_");
      layers.push({
        id,
        datasourceId: config.id,
        schema: row.table_schema,
        table: row.table_name,
        geometryColumn: row.geometry_column,
        geometryType: profiledRow.geometry_type,
        srid: profiledRow.srid,
        primaryKey: profiledRow.primary_key,
        fields,
        hasSpatialIndex: profiledRow.has_spatial_index,
        canSelect: profiledRow.can_select,
        canInsert: profiledRow.can_insert,
        canUpdate: profiledRow.can_update,
        canDelete: profiledRow.can_delete,
        queryable: profiledRow.can_select,
        editable: editableReason.length === 0,
        editableReason,
        tileUrl: `/api/layers/${id}/tile/{z}/{x}/{y}.mvt`,
        tileVersion: 1,
        style: this.defaultStyle(index),
        extent,
        updatedAt: new Date().toISOString()
      });
    }
    return layers;
  }

  async searchCoordinateSystems(
    config: DatasourceConfig,
    keyword: string,
    limit: number
  ): Promise<CrsDefinition[]> {
    const pool = this.getPool(config);
    const search = keyword.trim();
    const values: unknown[] = [Math.max(1, Math.min(limit, 100))];
    if (search) {
      values.push(`%${search}%`);
    }
    const result = await pool.query<SpatialRefSysRow>(
      `
      select srid, auth_name, auth_srid, srtext, proj4text
      from public.spatial_ref_sys
      ${search ? `
      where cast(srid as text) ilike $2
         or coalesce(auth_name, '') ilike $2
         or cast(auth_srid as text) ilike $2
         or coalesce(srtext, '') ilike $2
         or coalesce(proj4text, '') ilike $2
      ` : ""}
      order by
        case when upper(coalesce(auth_name, '')) = 'EPSG' then 0 else 1 end,
        auth_srid nulls last,
        srid
      limit $1
      `,
      values
    );
    return result.rows.map((row) => {
      const authName = row.auth_name ?? "SRID";
      const authSrid = row.auth_srid ?? row.srid;
      return {
        id: `${config.id}-${authName}-${authSrid}-${row.srid}`,
        code: `${authName}:${authSrid}`,
        authName,
        authSrid,
        srid: row.srid,
        name: this.readCrsName(row.srtext, `${authName}:${authSrid}`),
        proj4text: row.proj4text ?? "",
        wkt: row.srtext ?? "",
        area: "",
        scope: "",
        source: "postgis" as const,
        datasourceId: config.id,
        custom: false
      };
    });
  }

  async readFeature(config: DatasourceConfig, layer: LayerRegistration, pk: string) {
    this.assertQueryableLayer(layer);
    const pool = this.getPool(config);
    const idPredicate = this.buildFeatureIdPredicate(layer, 3);
    const result = await pool.query(
      `
      select jsonb_build_object(
        'type', 'Feature',
        'id', ${this.featureIdSql(layer)},
        'geometry', ST_AsGeoJSON(ST_Transform(${this.geometrySql(layer)}, 4326))::jsonb,
        'properties', to_jsonb(t) - $1 - coalesce($2, '')
      ) as feature
      from ${qualifiedTable(layer)} t
      where ${idPredicate}
      limit 1
      `,
      [layer.geometryColumn, layer.primaryKey, pk]
    );
    return result.rows[0]?.feature ?? null;
  }

  async listFeatures(
    config: DatasourceConfig,
    layer: LayerRegistration,
    query: FeaturePageQuery
  ): Promise<FeaturePage> {
    this.assertQueryableLayer(layer);
    const pool = this.getPool(config);
    const sortColumn = this.readFeatureSortColumn(layer, query.sort);
    const orderDirection = query.order === "desc" ? "desc" : "asc";
    const limit = Number(query.limit);
    const offset = Number(query.offset);
    const search = (query.search ?? "").trim();
    const ids = this.normalizeFeatureIds(query.ids);
    const sortSql = this.readFeatureSortSql(layer, query.sort);
    const values: unknown[] = [layer.geometryColumn];
    if (search) {
      values.push(`%${search}%`);
    }
    const idValuesIndex = ids.length > 0 ? values.length + 1 : null;
    if (ids.length > 0) {
      values.push(ids);
    }
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    values.push(limit, offset);
    const filters = [
      search ? "to_jsonb(t)::text ilike $2" : "",
      idValuesIndex ? this.buildFeatureIdArrayPredicate(layer, idValuesIndex) : ""
    ].filter(Boolean);
    const whereClause = filters.length > 0 ? `where ${filters.join(" and ")}` : "";
    const result = await pool.query<{ feature: FeatureSummary }>(
      `
      select jsonb_build_object(
        'type', 'Feature',
        'id', ${this.featureIdSql(layer)},
        'geometry', null,
        'properties', to_jsonb(t) - $1
      ) as feature
      from ${qualifiedTable(layer)} t
      ${whereClause}
      order by ${sortSql} ${orderDirection}, ${this.featureIdSql(layer)} asc
      limit $${limitIndex}
      offset $${offsetIndex}
      `,
      values
    );
    const countValues: unknown[] = [];
    const countFilters: string[] = [];
    if (search) {
      countValues.push(`%${search}%`);
      countFilters.push(`to_jsonb(t)::text ilike $${countValues.length}`);
    }
    if (ids.length > 0) {
      countValues.push(ids);
      countFilters.push(this.buildFeatureIdArrayPredicate(layer, countValues.length));
    }
    const total = ids.length > 0 && !search
      ? ids.length
      : countFilters.length > 0
      ? await this.countFilteredFeatures(pool, layer, countFilters, countValues)
      : await this.estimateTableRows(pool, layer);
    return {
      items: result.rows.map((row) => row.feature),
      total,
      limit,
      offset
    };
  }

  async selectFeatures(
    config: DatasourceConfig,
    layer: LayerRegistration,
    payload: FeatureSelectionPayload
  ): Promise<FeatureSelectionResult> {
    this.assertQueryableLayer(layer);
    if (!payload.geometry) {
      throw new BadRequestException("Selection geometry is required");
    }
    const limit = Math.max(1, Math.min(500, Number(payload.limit) || 500));
    const geometryJson = JSON.stringify(payload.geometry);
    const pool = this.getPool(config);
    const result = await pool.query<{ id: string; feature: GeoJsonFeature }>(
      `
      with selection as (
        select ST_Transform(
          ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
          ${this.effectiveSrid(layer)}
        ) as selection_geom
      ),
      matches as (
        select
          ${this.featureIdSql(layer)} as id,
          jsonb_build_object(
            'type', 'Feature',
            'id', ${this.featureIdSql(layer)},
            'geometry', ST_AsGeoJSON(ST_Transform(${this.geometrySql(layer)}, 4326))::jsonb,
            'properties', jsonb_build_object()
          ) as feature
        from ${qualifiedTable(layer)} t, selection
        where t.${quoteIdent(layer.geometryColumn)} is not null
          and ${this.geometrySql(layer)} && selection.selection_geom
          and ST_Intersects(${this.geometrySql(layer)}, selection.selection_geom)
        order by ${this.featureIdSql(layer)} asc
      )
      select id, feature
      from matches
      limit $2
      `,
      [geometryJson, limit]
    );
    return {
      ids: result.rows.map((row) => row.id),
      features: result.rows.map((row) => row.feature),
      total: result.rows.length,
      limit
    };
  }

  async createFeature(
    config: DatasourceConfig,
    layer: LayerRegistration,
    payload: FeaturePayload
  ): Promise<FeatureMutationResult> {
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
      `ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${geometryIndex}), 4326), ${this.effectiveSrid(layer)})`
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
      returning ${this.featureIdSql(layer, false)} as id
      `,
      queryValues
    );
    const feature = await this.readFeature(config, layer, String(result.rows[0].id));
    if (!feature) {
      throw new NotFoundException("Feature not found");
    }
    return {
      feature,
      oldBbox: null,
      newBbox: geometryBbox(feature.geometry)
    };
  }

  async queryLayer(
    config: DatasourceConfig,
    layer: LayerRegistration,
    sql: string,
    limit: number
  ): Promise<SqlQueryResult> {
    this.assertQueryableLayer(layer);
    const safeSql = this.toBadRequest(() => buildSafeLayerSelectSql(layer, sql, limit));
    const pool = this.getPool(config);
    const client = await pool.connect();
    try {
      await client.query("begin read only");
      const result = await client.query<Record<string, unknown>>(safeSql);
      await client.query("commit");
      return {
        columns: result.fields.map((field) => field.name),
        rows: result.rows,
        limit: Math.max(1, Math.min(200, limit))
      };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async calculateAttribute(
    config: DatasourceConfig,
    layer: LayerRegistration,
    dto: AttributeCalculationDto
  ): Promise<AttributeCalculationResult> {
    this.assertEditableLayer(layer);
    const targetField = editableFields(layer).find((field) => field.name === dto.targetField);
    if (!targetField) {
      throw new BadRequestException("Target field is not editable");
    }
    const expressionSql = this.toBadRequest(() => buildSafeAttributeExpression(layer, dto.expression));
    const whereSql = this.toBadRequest(() => buildSafeWhereExpression(layer, dto.where));
    const pool = this.getPool(config);
    const result = await pool.query<{ affected: string }>(
      `
      update ${qualifiedTable(layer)}
      set ${quoteIdent(targetField.name)} = ${expressionSql}
      ${whereSql ? `where ${whereSql}` : ""}
      `
    );
    return {
      targetField: targetField.name,
      affectedRows: result.rowCount ?? result.rows.length
    };
  }

  async updateFeature(
    config: DatasourceConfig,
    layer: LayerRegistration,
    pk: string,
    payload: FeaturePayload
  ): Promise<FeatureMutationResult> {
    this.assertEditableLayer(layer);
    const oldFeature = await this.readFeature(config, layer, pk);
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
        `${quoteIdent(layer.geometryColumn)} = ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${geometryIndex}), 4326), ${this.effectiveSrid(layer)})`
      );
      values.push(JSON.stringify(payload.geometry));
    }
    if (setParts.length === 0) {
      if (!oldFeature) {
        throw new NotFoundException("Feature not found");
      }
      return {
        feature: oldFeature,
        oldBbox: geometryBbox(oldFeature.geometry),
        newBbox: geometryBbox(oldFeature.geometry)
      };
    }
    values.push(pk);
    const idPredicate = this.buildFeatureIdPredicate(layer, values.length);
    const pool = this.getPool(config);
    const result = await pool.query<{ id: string }>(
      `
      update ${qualifiedTable(layer)}
      set ${setParts.join(", ")}
      where ${idPredicate}
      returning ${this.featureIdSql(layer, false)} as id
      `,
      values
    );
    const nextId = result.rows[0]?.id ?? pk;
    const feature = await this.readFeature(config, layer, String(nextId));
    if (!feature) {
      throw new NotFoundException("Feature not found");
    }
    return {
      feature,
      oldBbox: geometryBbox(oldFeature?.geometry),
      newBbox: geometryBbox(feature.geometry)
    };
  }

  async deleteFeature(
    config: DatasourceConfig,
    layer: LayerRegistration,
    pk: string
  ): Promise<FeatureDeleteMutationResult> {
    this.assertEditableLayer(layer);
    const oldFeature = await this.readFeature(config, layer, pk);
    const pool = this.getPool(config);
    await pool.query(
      `delete from ${qualifiedTable(layer)} t where ${this.buildFeatureIdPredicate(layer, 1)}`,
      [pk]
    );
    return {
      oldBbox: geometryBbox(oldFeature?.geometry)
    };
  }

  async getVectorTile(
    config: DatasourceConfig,
    layer: LayerRegistration,
    z: number,
    x: number,
    y: number
  ): Promise<Buffer> {
    const pool = this.getPool(config);
    const sourceGeom = this.geometrySql(layer);
    const boundsGeom = this.tileBoundsSql(layer);
    const propertyColumns = this.vectorTilePropertyColumns(layer);
    const primaryField = layer.fields.find((field) => field.name === layer.primaryKey);
    const canUseMvtFeatureId = Boolean(primaryField && this.isIntegerField(primaryField));
    const featureIdColumn = canUseMvtFeatureId ? `${quoteIdent(layer.primaryKey!)}::bigint as mvt_feature_id` : "null::bigint as mvt_feature_id";
    const idPropertyColumn = `${this.featureIdSql(layer)} as id`;
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
            ST_Transform(${sourceGeom}, 3857),
            bounds.geom,
            4096,
            64,
            true
          ) as geom
        from ${qualifiedTable(layer)} t, bounds
        where ${sourceGeom} && ${boundsGeom}
          and ST_Intersects(${sourceGeom}, ${boundsGeom})
        order by ${this.featureIdSql(layer, false)} asc
        limit ${this.vectorTileFeatureLimit(z)}
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
        with estimated as (
          select ST_EstimatedExtent($1, $2, $3) as box
        ),
        envelope as (
          select ST_Transform(
            ST_SetSRID(
              ST_MakeEnvelope(
                ST_XMin(box),
                ST_YMin(box),
                ST_XMax(box),
                ST_YMax(box)
              ),
              $4
            ),
            4326
          ) as geom
          from estimated
          where box is not null
        )
        select ST_Extent(geom)::text as extent
        from envelope
        `,
        [row.table_schema, row.table_name, row.geometry_column, this.effectiveSrid({ srid: row.srid } as LayerRegistration)]
      );
      return this.parseExtent(result.rows[0]?.extent ?? null);
    } catch {
      return this.parseExtent(row.extent);
    }
  }

  private async scanGeometryProfile(pool: Pool, row: SpatialTableRow): Promise<GeometryProfile> {
    if (row.srid && row.srid > 0 && row.geometry_type !== "GEOMETRY") {
      return {
        srid: row.srid,
        geometry_type: row.geometry_type
      };
    }
    try {
      const result = await pool.query<GeometryProfile>(
        `
        select
          nullif(ST_SRID(${quoteIdent(row.geometry_column)}), 0) as srid,
          upper(GeometryType(${quoteIdent(row.geometry_column)})) as geometry_type
        from ${quoteIdent(row.table_schema)}.${quoteIdent(row.table_name)}
        where ${quoteIdent(row.geometry_column)} is not null
        limit 1
        `
      );
      return result.rows[0] ?? { srid: null, geometry_type: null };
    } catch {
      return { srid: null, geometry_type: null };
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

  private readCrsName(wkt: string | null, fallback: string): string {
    const match = wkt?.match(/^(?:PROJCS|GEOGCS|COMPD_CS|VERT_CS|LOCAL_CS)\["([^"]+)"/);
    return match?.[1] ?? fallback;
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

  private readFeatureSortColumn(layer: LayerRegistration, sort?: string): string {
    if (!sort && layer.primaryKey) {
      return layer.primaryKey!;
    }
    if (!sort) {
      return layer.fields[0]?.name ?? layer.geometryColumn;
    }
    const allowedColumns = new Set([
      layer.primaryKey,
      ...layer.fields.map((field) => field.name)
    ].filter(Boolean));
    return allowedColumns.has(sort) ? sort : layer.primaryKey ?? layer.fields[0]?.name ?? layer.geometryColumn;
  }

  private normalizeFeatureIds(value: unknown): string[] {
    const rawItems = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
    return [
      ...new Set(
        rawItems
          .flatMap((item) => String(item).split(","))
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ];
  }

  private readFeatureSortSql(layer: LayerRegistration, sort?: string): string {
    if (!sort && !layer.primaryKey) {
      return "t.ctid";
    }
    return `${quoteIdent(this.readFeatureSortColumn(layer, sort))}::text`;
  }

  private vectorTilePropertyColumns(layer: LayerRegistration): string[] {
    return layer.fields
      .filter((field) => field.name !== layer.primaryKey)
      .filter((field) => !field.name.toLowerCase().includes("geom"))
      .slice(0, 4)
      .map((field) => quoteIdent(field.name));
  }

  private vectorTileFeatureLimit(z: number): number {
    if (z <= 8) {
      return 5000;
    }
    if (z <= 12) {
      return 12000;
    }
    return 25000;
  }

  private toBadRequest<T>(task: () => T): T {
    try {
      return task();
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid SQL");
    }
  }

  private assertQueryableLayer(layer: LayerRegistration): void {
    if (!layer.canSelect) {
      throw new BadRequestException("Layer is not queryable");
    }
  }

  private assertLayerSrid(layer: LayerRegistration): void {
    if (!layer.srid || layer.srid <= 0) {
      throw new BadRequestException("Layer has no valid SRID");
    }
  }

  private assertEditableLayer(layer: LayerRegistration): void {
    if (!layer.editable) {
      throw new BadRequestException(layer.editableReason.join("、") || "Layer is not editable");
    }
  }

  private effectiveSrid(layer: LayerRegistration): number {
    return layer.srid && layer.srid > 0 ? layer.srid : 4326;
  }

  private geometrySql(layer: LayerRegistration): string {
    const geom = `t.${quoteIdent(layer.geometryColumn)}`;
    if (layer.srid && layer.srid > 0) {
      return geom;
    }
    return `ST_SetSRID(${geom}, ${this.effectiveSrid(layer)})`;
  }

  private tileBoundsSql(layer: LayerRegistration): string {
    return this.effectiveSrid(layer) === 3857
      ? "bounds.geom"
      : `ST_Transform(bounds.geom, ${this.effectiveSrid(layer)})`;
  }

  private featureIdSql(layer: LayerRegistration, withTableAlias = true): string {
    const tablePrefix = withTableAlias ? "t." : "";
    return layer.primaryKey ? `${tablePrefix}${quoteIdent(layer.primaryKey)}::text` : `${tablePrefix}ctid::text`;
  }

  private buildFeatureIdPredicate(layer: LayerRegistration, paramIndex: number): string {
    return layer.primaryKey
      ? `${this.featureIdSql(layer)} = $${paramIndex}`
      : `t.ctid = $${paramIndex}::tid`;
  }

  private buildFeatureIdArrayPredicate(layer: LayerRegistration, paramIndex: number): string {
    return layer.primaryKey
      ? `${this.featureIdSql(layer)} = any($${paramIndex}::text[])`
      : `t.ctid = any($${paramIndex}::tid[])`;
  }

  private async countFilteredFeatures(
    pool: Pool,
    layer: LayerRegistration,
    countFilters: string[],
    countValues: unknown[]
  ): Promise<number> {
    const countWhereClause = countFilters.length > 0 ? `where ${countFilters.join(" and ")}` : "";
    const countResult = await pool.query<{ total: string }>(
      `
      select count(*)::text as total
      from ${qualifiedTable(layer)} t
      ${countWhereClause}
      `,
      countValues
    );
    return Number(countResult.rows[0]?.total ?? 0);
  }

  private async estimateTableRows(pool: Pool, layer: LayerRegistration): Promise<number> {
    const estimateResult = await pool.query<{ total: string | null }>(
      `
      select greatest(coalesce(c.reltuples, 0), 0)::bigint::text as total
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1
        and c.relname = $2
      limit 1
      `,
      [layer.schema, layer.table]
    );
    return Number(estimateResult.rows[0]?.total ?? 0);
  }
}

export function geometryBbox(geometry: unknown): GeometryBbox | null {
  const bbox: GeometryBbox = [Infinity, Infinity, -Infinity, -Infinity];
  collectGeometryCoordinates(geometry, bbox);
  if (bbox.some((value) => !Number.isFinite(value))) {
    return null;
  }
  return bbox;
}

function collectGeometryCoordinates(value: unknown, bbox: GeometryBbox) {
  if (!Array.isArray(value)) {
    if (isGeoJsonGeometry(value)) {
      collectGeometryCoordinates(value.coordinates, bbox);
    }
    return;
  }
  if (isCoordinate(value)) {
    const lon = Number(value[0]);
    const lat = Number(value[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      bbox[0] = Math.min(bbox[0], lon);
      bbox[1] = Math.min(bbox[1], lat);
      bbox[2] = Math.max(bbox[2], lon);
      bbox[3] = Math.max(bbox[3], lat);
    }
    return;
  }
  for (const item of value) {
    collectGeometryCoordinates(item, bbox);
  }
}

function isCoordinate(value: unknown[]): value is [unknown, unknown, ...unknown[]] {
  return value.length >= 2
    && typeof value[0] === "number"
    && typeof value[1] === "number";
}

function isGeoJsonGeometry(value: unknown): value is { coordinates: unknown } {
  return Boolean(value && typeof value === "object" && "coordinates" in value);
}
