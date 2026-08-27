import { IsUUID, IsArray, IsString, IsOptional, IsEnum, Matches } from 'class-validator';

export class CheckConflictsDto {
  @IsUUID()
  semester_id: string;

  @IsUUID()
  course_id: string;

  @IsOptional()
  @IsUUID()
  section_id?: string;

  @IsOptional()
  @IsUUID()
  lab_section_id?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  teacher_ids: string[];

  @IsString()
  day: string;

  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  start: string;

  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  end: string;

  @IsOptional()
  @IsUUID()
  room_id?: string;

  @IsOptional()
  @IsEnum(['EVERY', 'EVEN', 'ODD'])
  week?: 'EVERY' | 'EVEN' | 'ODD';

  @IsOptional()
  @IsUUID()
  ignoreSlotId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  ignoreSlotIds?: string[];

  @IsOptional()
  ignoreCourseSectionSlots?: boolean;

  @IsOptional()
  siblingSlots?: Array<{ id: string; day: string; start: string; end: string; week: string; semester_id: string; course_id: string; section_id?: string; lab_section_id?: string }>;
}
