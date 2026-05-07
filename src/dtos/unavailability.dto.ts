import { IsUUID, IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateTeacherUnavailabilityDto {
  @IsUUID()
  @IsNotEmpty()
  teacher_id: string;

  @IsString()
  @IsNotEmpty()
  day: string;

  @IsString()
  @IsNotEmpty()
  start: string;

  @IsString()
  @IsNotEmpty()
  end: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateTeacherUnavailabilityDto {
  @IsString()
  @IsOptional()
  day?: string;

  @IsString()
  @IsOptional()
  start?: string;

  @IsString()
  @IsOptional()
  end?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateRoomUnavailabilityDto {
  @IsUUID()
  @IsNotEmpty()
  room_id: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  days: string[];

  @IsString()
  @IsNotEmpty()
  start: string;

  @IsString()
  @IsNotEmpty()
  end: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateRoomUnavailabilityDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  days?: string[];

  @IsString()
  @IsOptional()
  start?: string;

  @IsString()
  @IsOptional()
  end?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
