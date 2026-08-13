import { IsInt, IsUUID, IsOptional, IsDateString, Min, Max, IsBoolean, IsArray, ValidateNested, IsString, IsIn, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCTSettingDto {
  @IsInt()
  @Min(1)
  @Max(25)
  total_weeks: number;

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
  /** Every room the sitting occupies. */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  room_ids?: string[];

  @IsInt()
  @IsOptional()
  week_number?: number;

  @IsDateString()
  @IsOptional()
  date?: string;
}

/** Identifies a level-term bucket: level + term + departmental_type (+ department for Departmental). */
export class LevelTermBucketDto {
  @IsInt()
  level: number;

  @IsIn(['I', 'II'])
  term: 'I' | 'II';

  @IsIn(['Departmental', 'Non-Departmental'])
  departmental_type: 'Departmental' | 'Non-Departmental';

  @IsOptional()
  @IsUUID()
  department_id?: string | null;
}

export class CTLevelTermDayMappingItemDto extends LevelTermBucketDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  days: string[];
}

export class UpdateCTLevelTermDayMappingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CTLevelTermDayMappingItemDto)
  mappings: CTLevelTermDayMappingItemDto[];
}

export class CTLevelTermRoomMappingItemDto extends LevelTermBucketDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  room_ids: string[];
}

export class UpdateCTLevelTermRoomMappingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CTLevelTermRoomMappingItemDto)
  mappings: CTLevelTermRoomMappingItemDto[];
}

