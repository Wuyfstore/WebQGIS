import { IsString, MinLength } from "class-validator";

export class LayerParamDto {
  @IsString()
  @MinLength(1)
  id: string;
}
