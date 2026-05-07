import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { TeacherUnavailabilityService } from './teacher-unavailability.service';
import { CreateTeacherUnavailabilityDto, UpdateTeacherUnavailabilityDto } from '../../dtos/unavailability.dto';

@Controller('teacher-unavailability')
export class TeacherUnavailabilityController {
  constructor(private readonly service: TeacherUnavailabilityService) {}

  @Get()
  async findAll(@Query('teacher_id') teacherId?: string) {
    if (teacherId) {
      return this.service.findByTeacher(teacherId);
    }
    return this.service.findAll();
  }

  @Post()
  async create(@Body() dto: CreateTeacherUnavailabilityDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTeacherUnavailabilityDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
