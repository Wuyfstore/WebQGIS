import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateDatasourceDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port = 5432;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  database: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  user: string;

  @IsString()
  @IsOptional()
  password = "";

  @IsBoolean()
  @IsOptional()
  ssl = false;
}
