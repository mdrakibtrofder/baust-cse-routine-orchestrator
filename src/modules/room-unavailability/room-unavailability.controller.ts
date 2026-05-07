import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { RoomUnavailabilityService } from './room-unavailability.service';
import { CreateRoomUnavailabilityDto, UpdateRoomUnavailabilityDto } from '../../dtos/unavailability.dto';

@Controller('room-unavailability')
export class RoomUnavailabilityController {
  constructor(private readonly service: RoomUnavailabilityService) {}

  @Get()
  async findAll(@Query('room_id') roomId?: string) {
    if (roomId) {
      return this.service.findByRoom(roomId);
    }
    return this.service.findAll();
  }

  @Post()
  async create(@Body() dto: CreateRoomUnavailabilityDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRoomUnavailabilityDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
