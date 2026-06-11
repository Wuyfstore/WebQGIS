import { IsString, MinLength } from "class-validator";

export class FeatureParamDto {
  @IsString()
  @MinLength(1)
  id: string;

  @IsString()
  @MinLength(1)
  pk: string;
}
