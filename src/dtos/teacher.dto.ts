import { IsString, IsOptional, IsNumber, Min, Max, Matches, IsEmail, MaxLength, ValidateIf } from 'class-validator';

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

  /** Contact details. Empty string is allowed, so the address is only validated
   *  when something was actually typed. */
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => typeof value === 'string' && value.trim() !== '')
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  assigned_credit_hours?: number;
}
