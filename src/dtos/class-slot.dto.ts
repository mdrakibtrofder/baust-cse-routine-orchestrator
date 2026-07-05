import { IsUUID, IsString, Matches, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export class CreateClassSlotDto {
  @IsUUID()
  semester_id: string;

  @IsUUID()
  course_id: string;

  @IsUUID()
  section_id: string;

  @IsString()
  day: string;

  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'Start time must be HH:MM or HH:MM:SS format' })
  start: string;

  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'End time must be HH:MM or HH:MM:SS format' })
  end: string;

  @IsOptional()
  @IsUUID()
  room_id?: string;

  @IsOptional()
  @IsEnum(['EVERY', 'EVEN', 'ODD'])
  week?: 'EVERY' | 'EVEN' | 'ODD';

  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}
