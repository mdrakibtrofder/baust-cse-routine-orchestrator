import { Controller, Get, Param, Query } from '@nestjs/common';
import { RoutineService } from './routine.service';

@Controller('routine')
export class RoutineController {
  constructor(private readonly routineService: RoutineService) {}

  @Get('teacher/:teacherId')
  async getTeacherRoutine(
    @Param('teacherId') teacherId: string,
    @Query('semester_id') semesterId: string,
  ) {
    return this.routineService.getTeacherRoutine(teacherId, semesterId);
  }

  @Get('room/:roomId')
  async getRoomRoutine(
    @Param('roomId') roomId: string,
    @Query('semester_id') semesterId: string,
  ) {
    return this.routineService.getRoomRoutine(roomId, semesterId);
  }

  @Get('section/:sectionId')
  async getSectionRoutine(
    @Param('sectionId') sectionId: string,
    @Query('semester_id') semesterId: string,
  ) {
    return this.routineService.getSectionRoutine(sectionId, semesterId);
  }

  @Get('semester/:semesterId')
  async getSemesterRoutine(@Param('semesterId') semesterId: string) {
    return this.routineService.getSemesterRoutine(semesterId);
  }
}
