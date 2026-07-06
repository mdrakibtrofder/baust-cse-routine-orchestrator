import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { LabSectionsService } from './lab-sections.service';
import { BatchSaveLabSectionsDto, UpdateLabSectionDto } from '../../dtos/lab-section.dto';
import { IsArray, IsOptional, IsBoolean } from 'class-validator';

class BatchReplaceSlotsDto {
  @IsArray()
  slots: Array<{ day: string; start: string; end: string; room_id: string; week?: string; locked?: boolean }>;
}

@Controller('lab-sections')
export class LabSectionsController {
  constructor(private readonly service: LabSectionsService) {}

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
  batchSave(@Body() dto: BatchSaveLabSectionsDto) {
    return this.service.batchSave(dto);
  }

  @Post(':id/slots/batch-replace')
  batchReplaceSlots(@Param('id') id: string, @Body() dto: BatchReplaceSlotsDto) {
    return this.service.batchReplaceSlots(id, dto.slots);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLabSectionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
