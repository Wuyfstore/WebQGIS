import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CrsSearchQueryDto {
  @IsOptional()
  @IsString()
  q = "";

  @IsOptional()
  @IsString()
  datasourceId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
