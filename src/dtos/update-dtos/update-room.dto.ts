import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['Theory', 'Sessional', 'Both'])
  room_type?: 'Theory' | 'Sessional' | 'Both';

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsIn(['Departmental', 'Non-Departmental'])
  departmental_type?: 'Departmental' | 'Non-Departmental';

  @IsOptional()
  @IsUUID()
  department_id?: string;
}
