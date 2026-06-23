import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LabSectionItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  label: string;

  /** Actual section(s) this lab section's classes count toward — many-to-many. */
  @IsArray()
  @IsUUID('all', { each: true })
  section_ids: string[];

  @IsArray()
  @IsUUID('all', { each: true })
  teacher_ids: string[];

  @IsOptional()
  @IsUUID()
  primary_room_id?: string | null;
}

export class BatchSaveLabSectionsDto {
  @IsUUID()
  semester_id: string;

  @IsUUID()
  course_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabSectionItemDto)
  lab_sections: LabSectionItemDto[];
}

/** Quick single-field edits (e.g. picking a room from Room & Time Mapping) without
 *  re-submitting the whole batch. */
export class UpdateLabSectionDto {
  @IsOptional()
  @IsUUID()
  primary_room_id?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  teacher_ids?: string[];
}
