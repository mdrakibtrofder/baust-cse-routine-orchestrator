import { IsUUID, IsArray, IsString, IsOptional, IsEnum, Matches } from 'class-validator';

export class CheckConflictsDto {
  @IsUUID()
  semester_id: string;

  @IsUUID()
  course_id: string;

  @IsUUID()
  section_id: string;

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
}
