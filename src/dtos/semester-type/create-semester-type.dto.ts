import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateSemesterTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
