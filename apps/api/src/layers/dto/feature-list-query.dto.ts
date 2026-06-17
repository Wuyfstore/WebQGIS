import { Transform, Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class FeatureListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 100;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @IsOptional()
  @IsString()
  search = "";

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => String(item).split(",")).map((item) => item.trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  ids?: string[];

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order: "asc" | "desc" = "asc";
}
