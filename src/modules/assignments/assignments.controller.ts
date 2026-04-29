import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from '../../dtos/assignment.dto';

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  findAll(@Query('semester_id') semesterId: string) {
    return this.assignmentsService.findAll(semesterId);
  }

  @Get('course/:courseId/section/:sectionId')
  findOne(
    @Query('semester_id') semesterId: string,
    @Param('courseId') courseId: string,
    @Param('sectionId') sectionId: string,
  ) {
    return this.assignmentsService.findOne(semesterId, courseId, sectionId);
  }

  @Post()
  createOrUpdate(@Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.createOrUpdate(dto);
  }

  @Get('teacher/:teacherId')
  findByTeacher(
    @Param('teacherId') teacherId: string,
    @Query('semester_id') semesterId: string,
  ) {
    return this.assignmentsService.findByTeacher(teacherId, semesterId);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.assignmentsService.delete(id);
  }
}
