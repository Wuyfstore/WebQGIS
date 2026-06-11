import { registerAs } from "@nestjs/config";

export const appConfig = registerAs("app", () => ({
  host: process.env.API_HOST ?? "0.0.0.0",
  port: Number(process.env.API_PORT ?? 4100),
  nodeEnv: process.env.NODE_ENV ?? "development"
}));
