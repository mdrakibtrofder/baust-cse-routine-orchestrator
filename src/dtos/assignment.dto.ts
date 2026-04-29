import { IsUUID, IsArray } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  semester_id: string;

  @IsUUID()
  course_id: string;

  @IsUUID()
  section_id: string;

  @IsArray()
  @IsUUID('all', { each: true })
  teacher_ids: string[];
}
