import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LabGroupItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  label: string;

  @IsUUID()
  section_id: string;

  @IsArray()
  @IsUUID('all', { each: true })
  teacher_ids: string[];

  @IsOptional()
  @IsUUID()
  primary_room_id?: string | null;
}

export class BatchSaveLabGroupsDto {
  @IsUUID()
  semester_id: string;

  @IsUUID()
  course_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabGroupItemDto)
  lab_groups: LabGroupItemDto[];
}
