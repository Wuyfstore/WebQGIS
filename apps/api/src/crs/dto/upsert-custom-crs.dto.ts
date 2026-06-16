import { Transform } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class UpsertCustomCrsDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  code: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsInt()
  @Min(1)
  @Max(999999)
  srid: number;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  proj4text: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  authName = "LOCAL";

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  wkt = "";

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  area = "";

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  scope = "";
}
