import { IsInt, IsEnum, IsString, Min, IsOptional, IsUUID } from 'class-validator';

export class CreateSectionDto {
  @IsInt()
  @Min(1)
  level: number;

  @IsEnum(['I', 'II'])
  term: 'I' | 'II';

  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  total_students: number;

  @IsOptional()
  @IsEnum(['Departmental', 'Non-Departmental'])
  departmental_type?: 'Departmental' | 'Non-Departmental';

  @IsOptional()
  @IsUUID()
  department_id?: string;
}
