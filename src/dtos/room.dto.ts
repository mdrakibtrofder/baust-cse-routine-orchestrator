import { IsString, IsEnum, IsInt, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  name: string;

  @IsEnum(['Theory', 'Sessional'])
  room_type: 'Theory' | 'Sessional';

  @IsInt()
  @Min(1)
  capacity: number;
}
