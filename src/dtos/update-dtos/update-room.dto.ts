import { PartialType } from '@nestjs/mapped-types';
import { CreateRoomDto } from '../room.dto';

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}
