import { IsString, IsInt, Min, IsOptional, IsUUID, IsIn } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  name: string;

  @IsIn(['Theory', 'Sessional', 'Both'])
  room_type: 'Theory' | 'Sessional' | 'Both';

  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional()
  @IsIn(['Departmental', 'Non-Departmental'])
  departmental_type?: 'Departmental' | 'Non-Departmental';

  @IsOptional()
  @IsUUID()
  department_id?: string;
}
