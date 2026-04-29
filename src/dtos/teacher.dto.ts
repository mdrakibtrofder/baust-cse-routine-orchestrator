import { IsString, IsOptional, IsNumber, Min, Max, Matches } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9.]+$/, { message: 'Short name must be alphanumeric or contain dots' })
  short_name: string;

  @IsString()
  name: string;

  @IsString()
  designation: string;

  @IsString()
  department: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  assigned_credit?: number;
}
