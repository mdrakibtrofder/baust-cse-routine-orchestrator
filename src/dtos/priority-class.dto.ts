import { IsUUID, IsInt, IsString, IsArray, IsOptional, ValidateNested, IsNotEmpty, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class TimeSlotDto {
  @IsString()
  @IsNotEmpty()
  start: string;

  @IsString()
  @IsNotEmpty()
  end: string;
}

export class CreatePriorityClassDto {
  @IsUUID()
  @IsNotEmpty()
  semester_id: string;

  @IsUUID()
  @IsNotEmpty()
  department_id: string;

  @IsInt()
  level: number;

  @IsString()
  @IsNotEmpty()
  term: string;

  @IsUUID()
  @IsNotEmpty()
  section_id: string;

  @IsNotEmpty()
  @IsIn(['Theory', 'Sessional'])
  course_type: 'Theory' | 'Sessional';

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  course_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  room_ids?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  time_slots?: TimeSlotDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  days?: string[];
}
