import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { LabGroupsService } from './lab-groups.service';
import { BatchSaveLabGroupsDto } from '../../dtos/lab-group.dto';
import { IsUUID, IsArray } from 'class-validator';

class BatchReplaceSlotsDto {
  @IsArray()
  slots: Array<{ day: string; start: string; end: string; room_id: string; week?: string }>;
}

@Controller('lab-groups')
export class LabGroupsController {
  constructor(private readonly service: LabGroupsService) {}

  @Get()
  findBySemester(@Query('semester_id') semesterId: string) {
    return this.service.findBySemester(semesterId);
  }

  @Get('by-course')
  findByCourse(
    @Query('semester_id') semesterId: string,
    @Query('course_id') courseId: string,
  ) {
    return this.service.findByCourse(semesterId, courseId);
  }

  @Post('batch')
  batchSave(@Body() dto: BatchSaveLabGroupsDto) {
    return this.service.batchSave(dto);
  }

  @Post(':id/slots/batch-replace')
  batchReplaceSlots(@Param('id') id: string, @Body() dto: BatchReplaceSlotsDto) {
    return this.service.batchReplaceSlots(id, dto.slots);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
