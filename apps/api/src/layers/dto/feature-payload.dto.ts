import { IsObject, IsOptional, IsString } from "class-validator";

export class FeaturePayloadDto {
  @IsOptional()
  geometry?: unknown;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  revision?: string;
}
