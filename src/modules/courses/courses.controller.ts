import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from '../../dtos/course.dto';
import { UpdateCourseDto } from '../../dtos/update-dtos/update-course.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll(@Query('level') level?: number, @Query('term') term?: 'I' | 'II') {
    return this.coursesService.findAll(level ? Number(level) : undefined, term);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.coursesService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.coursesService.delete(id);
  }
}
