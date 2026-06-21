import { IsHexColor, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTagDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsHexColor()
  color!: string;
}
