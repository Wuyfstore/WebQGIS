import { Type } from "class-transformer";
import { IsInt, IsString, Max, Min, MinLength } from "class-validator";

export class TileParamDto {
  @IsString()
  @MinLength(1)
  id: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  z: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  x: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  y: number;
}
