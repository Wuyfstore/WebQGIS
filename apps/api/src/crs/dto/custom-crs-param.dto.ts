import { IsString } from "class-validator";

export class CustomCrsParamDto {
  @IsString()
  id: string;
}
