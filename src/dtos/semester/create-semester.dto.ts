import { IsUUID, IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateSemesterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  year_id: string;

  @IsUUID()
  type_id: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
