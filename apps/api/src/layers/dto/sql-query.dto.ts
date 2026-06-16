import { Type } from "class-transformer";
import { IsInt, IsString, Max, Min } from "class-validator";

export class SqlQueryDto {
  @IsString()
  sql!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 100;
}
