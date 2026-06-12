import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateClientLogDto {
  @IsIn(["vue", "window", "promise", "manual"])
  source: "vue" | "window" | "promise" | "manual";

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  stack?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  component?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  info?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  url?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  userAgent?: string;
}
