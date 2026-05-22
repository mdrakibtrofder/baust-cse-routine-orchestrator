import { IsInt, IsUUID, IsOptional, IsDateString, Min, Max, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCTSettingDto {
  @IsInt()
  @Min(1)
  @Max(25)
  total_weeks: number;

  @IsInt()
  @Min(1)
  @Max(25)
  start_week: number;

  @IsOptional()
  @IsDateString()
  start_date?: string;
}

export class CTWeekDayConfigDto {
  @IsInt()
  week_number: number;

  @IsDateString()
  date: string;

  @IsBoolean()
  is_available: boolean;
}

export class UpdateCTWeekConfigsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CTWeekDayConfigDto)
  configs: CTWeekDayConfigDto[];
}

export class UpdateCTAssignmentDto {
  @IsUUID()
  @IsOptional()
  room_id?: string;

  @IsInt()
  @IsOptional()
  week_number?: number;

  @IsDateString()
  @IsOptional()
  date?: string;
}

