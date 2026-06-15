import { IsString, Length } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @Length(1, 20)
  short_name: string;

  @IsString()
  @Length(1, 200)
  full_name: string;

  @IsString()
  @Length(1, 200)
  faculty_name: string;
}
