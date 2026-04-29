import { IsInt, IsEnum, IsString, Min } from 'class-validator';

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
}
