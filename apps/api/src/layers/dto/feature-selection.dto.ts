import { Type } from "class-transformer";
import { IsDefined, IsInt, Max, Min } from "class-validator";

export class FeatureSelectionDto {
  @IsDefined()
  geometry!: unknown;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 500;
}
