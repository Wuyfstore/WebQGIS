import { IsObject, IsOptional } from "class-validator";

export class FeaturePayloadDto {
  @IsOptional()
  geometry?: unknown;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
