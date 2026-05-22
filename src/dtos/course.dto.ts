import { IsString, IsNumber, IsEnum, IsInt, Min, Max } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  credit: number;

  @IsEnum(['theory_2.0', 'theory_3.0', 'sessional_1.5', 'sessional_0.75'])
  course_type: 'theory_2.0' | 'theory_3.0' | 'sessional_1.5' | 'sessional_0.75';

  @IsEnum(['Departmental', 'Non-Departmental'])
  departmental_type: 'Departmental' | 'Non-Departmental';

  @IsInt()
  @Min(1)
  @Max(4)
  level: number;

  @IsEnum(['I', 'II'])
  term: 'I' | 'II';

  @IsInt()
  @Min(0)
  theory: number;

  @IsInt()
  @Min(0)
  sessional: number;
}
