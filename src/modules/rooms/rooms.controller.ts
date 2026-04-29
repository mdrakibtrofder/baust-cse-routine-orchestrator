import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from '../../dtos/room.dto';
import { UpdateRoomDto } from '../../dtos/update-dtos/update-room.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.roomsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.roomsService.delete(id);
  }
}
