# WebQGIS

WebQGIS is a V1 MVP for a QGIS-like web GIS workflow focused on PostGIS vector layers. It separates fast map display through vector tiles from source-of-truth editing through original PostGIS geometries.

## What Is Included

- PostgreSQL/PostGIS datasource testing and local registration.
- Spatial table scanning for schema, table, geometry column, SRID, geometry type, primary key, fields, privileges and spatial index status.
- Automatic layer registration with editable/queryable state and default style.
- MVT endpoint generation per layer.
- Feature read, create, update and delete APIs using original PostGIS geometries.
- Vue 3 + OpenLayers client with layer list, vector tile display, feature selection, draft drawing, modify, snapping, attribute panel and save/delete actions.

## Quick Start

```bash
npm install
npm run dev
```

The API runs on `http://localhost:4100` by default. The web client runs on the Vite port printed by the terminal, normally `http://localhost:5173`.

Runtime datasource and layer registry files are written under `data/` and are intentionally ignored by Git.

## API Summary

- `POST /api/datasources/test` tests a PostGIS connection.
- `POST /api/datasources` stores a datasource config after a successful connection test.
- `GET /api/datasources` lists saved datasource configs without passwords.
- `POST /api/datasources/:id/scan` scans PostGIS metadata and registers layers.
- `GET /api/layers` lists registered layers.
- `GET /api/layers/:id/tile/:z/:x/:y.mvt` returns vector tiles.
- `GET /api/layers/:id/features/:pk` reads an original feature as GeoJSON.
- `POST /api/layers/:id/features` creates a feature.
- `PUT /api/layers/:id/features/:pk` updates geometry and properties.
- `DELETE /api/layers/:id/features/:pk` deletes a feature.

## V1 Boundaries

This MVP only treats PostGIS `geometry` columns as editable. Layers without a stable single primary key, SRID, supported geometry type or write privileges are registered as read-only. Advanced QGIS styling, topology rules, multi-user conflict workflows and file import/export are intentionally left for later versions.
