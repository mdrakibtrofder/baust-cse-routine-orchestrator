import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ClassSlotsService } from './class-slots.service';
import { CreateClassSlotDto } from '../../dtos/class-slot.dto';
import { UpdateClassSlotDto } from '../../dtos/update-dtos/update-class-slot.dto';
import { CheckConflictsDto } from '../../dtos/check-conflicts.dto';
import { Conflict } from './interfaces/conflict.interface';

@Controller('class-slots')
export class ClassSlotsController {
  constructor(private readonly classSlotsService: ClassSlotsService) {}

  @Get()
  async findBySemester(@Query('semester_id') semesterId: string) {
    return this.classSlotsService.findBySemester(semesterId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.classSlotsService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateClassSlotDto) {
    return this.classSlotsService.create(dto);
  }

  @Post('check-conflicts')
  async checkConflicts(@Body() dto: CheckConflictsDto) {
    const conflicts = await this.classSlotsService.checkConflicts(dto);
    return { conflicts, hasConflicts: conflicts.length > 0 };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateClassSlotDto) {
    return this.classSlotsService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.classSlotsService.delete(id);
    return { success: true };
  }

  @Delete('course/:courseId/section/:sectionId')
  async deleteForCourseSection(
    @Param('courseId') courseId: string,
    @Param('sectionId') sectionId: string,
    @Query('semester_id') semesterId: string,
  ) {
    await this.classSlotsService.deleteForCourseSection(courseId, sectionId, semesterId);
    return { success: true };
  }
}
