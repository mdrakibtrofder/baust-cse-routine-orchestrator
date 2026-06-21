import { IsString, IsEnum, IsInt, Min, IsOptional, IsUUID } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  name: string;

  @IsEnum(['Theory', 'Sessional'])
  room_type: 'Theory' | 'Sessional';

  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional()
  @IsEnum(['Departmental', 'Non-Departmental'])
  departmental_type?: 'Departmental' | 'Non-Departmental';

  @IsOptional()
  @IsUUID()
  department_id?: string;
}
