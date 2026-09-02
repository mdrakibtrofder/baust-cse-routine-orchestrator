import { IsInt, IsUUID, IsOptional, IsDateString, Min, Max, IsBoolean, IsArray, ValidateNested, IsString, IsIn, ArrayNotEmpty, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CTBreakDto {
  /** The week number this break sits immediately before. */
  @IsInt()
  @Min(1)
  before_week: number;

  /** Falls back to a generic label server-side when blank. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;
}

export class UpdateCTSettingDto {
  @IsInt()
  @Min(1)
  @Max(25)
  total_weeks: number;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  /** Named break weeks; see `CTSetting.breaks`. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CTBreakDto)
  breaks?: CTBreakDto[];
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


/** Swap class-test sittings between two courses.
 *
 *  Two modes, both exchanging the *scheduling* fields (date, week number and the
 *  occupied room set) between sittings while leaving each sitting attached to its
 *  own course:
 *
 *  - `all`    — every CT of course A trades places with the same-numbered CT of
 *               course B. Both courses must carry the same credit (and therefore
 *               the same number of sittings).
 *  - `single` — one sitting trades places with one other sitting. The two must
 *               share a CT number: CT1 only ever swaps with CT1, CT2 with CT2.
 *
 *  In both modes the two courses must sit in the same level-term bucket, because
 *  the bucket is what determines which weekdays and which rooms a sitting may use;
 *  swapping across buckets would land a test on a day its cohort does not test on. */
export class SwapCTDto {
  @IsIn(['all', 'single'])
  mode: 'all' | 'single';

  /** `all` mode: the two courses whose whole CT series trade places. */
  @IsOptional()
  @IsUUID()
  course_a_id?: string;

  @IsOptional()
  @IsUUID()
  course_b_id?: string;

  /** `single` mode: the two individual sittings that trade places. */
  @IsOptional()
  @IsUUID()
  assignment_a_id?: string;

  @IsOptional()
  @IsUUID()
  assignment_b_id?: string;

  /** Carry out the swap even though the preview reported warnings (a CT series
   *  left out of order, or consecutive sittings closer than the minimum gap). */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
