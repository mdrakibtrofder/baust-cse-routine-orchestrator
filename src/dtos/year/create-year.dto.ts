import { IsInt, Min, Max } from 'class-validator';

export class CreateYearDto {
  @IsInt()
  @Min(2026)
  @Max(2056)
  value: number;
}
