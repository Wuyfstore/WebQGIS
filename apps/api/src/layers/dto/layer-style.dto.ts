import { Transform } from "class-transformer";
import { IsNumber, IsOptional, Matches, Max, Min } from "class-validator";

const hexColorPattern = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export class LayerStyleDto {
  @IsOptional()
  @Matches(hexColorPattern, { message: "fill must be a hex color" })
  fill?: string;

  @IsOptional()
  @Matches(hexColorPattern, { message: "stroke must be a hex color" })
  stroke?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(8)
  strokeWidth?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(2)
  @Max(20)
  pointRadius?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.05)
  @Max(1)
  opacity?: number;
}
