export type CrsDefinition = {
  id: string;
  code: string;
  authName: string;
  authSrid: number;
  srid: number;
  name: string;
  proj4text: string;
  wkt: string;
  area: string;
  scope: string;
  source: "postgis" | "custom" | "fallback";
  datasourceId?: string;
  custom: boolean;
  updatedAt?: string;
};

export type CustomCrsRecord = Omit<CrsDefinition, "source" | "custom"> & {
  createdAt: string;
  updatedAt: string;
};
