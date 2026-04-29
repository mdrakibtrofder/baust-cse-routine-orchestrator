import { IsString, IsInt, IsEnum, Min } from 'class-validator';

export class CreateSemesterDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(2000)
  year: number;

  @IsEnum(['Winter', 'Summer'])
  season: 'Winter' | 'Summer';
}
