import { IsString, IsNumber, IsEnum, IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  credit: number;

  @IsEnum(['theory_2.0', 'theory_3.0', 'sessional_1.5', 'sessional_0.75', 'sessional_3.0'])
  course_type: 'theory_2.0' | 'theory_3.0' | 'sessional_1.5' | 'sessional_0.75' | 'sessional_3.0';

  @IsEnum(['Departmental', 'Non-Departmental'])
  departmental_type: 'Departmental' | 'Non-Departmental';

  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsInt()
  @Min(1)
  @Max(4)
  level: number;

  @IsEnum(['I', 'II'])
  term: 'I' | 'II';

  @IsNumber()
  @Min(0)
  theory: number;

  @IsNumber()
  @Min(0)
  sessional: number;
}
