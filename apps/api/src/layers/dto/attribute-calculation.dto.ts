import { IsOptional, IsString, MaxLength } from "class-validator";

export class AttributeCalculationDto {
  @IsString()
  targetField!: string;

  @IsString()
  @MaxLength(500)
  expression!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  where?: string;
}
