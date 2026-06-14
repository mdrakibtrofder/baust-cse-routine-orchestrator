import { Controller, Get, Post, Patch, Delete, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from '../../dtos/teacher.dto';
import { UpdateTeacherDto } from '../../dtos/update-teacher.dto';

@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  async findAll(@Query('search') search?: string) {
    return this.teachersService.findAll(search);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.teachersService.findById(id);
  }

  @Get('short-name/:shortName')
  async findByShortName(@Param('shortName') shortName: string) {
    return this.teachersService.findByShortName(shortName);
  }

  @Post()
  async create(@Body() dto: CreateTeacherDto) {
    return this.teachersService.create(dto);
  }

  @Post('bulk-import')
  async bulkImport(@Body() dto: { teachers: CreateTeacherDto[] }) {
    if (!Array.isArray(dto.teachers) || dto.teachers.length === 0) {
      throw new BadRequestException('Invalid import data');
    }
    return this.teachersService.bulkImport(dto.teachers);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.teachersService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.teachersService.delete(id);
    return { success: true, message: 'Teacher deleted successfully' };
  }

  @Post(':id/move-assignments')
  async moveAssignments(
    @Param('id') fromId: string,
    @Body('toTeacherId') toId: string,
  ) {
    if (!toId) throw new BadRequestException('Target teacher ID required');
    await this.teachersService.moveAssignments(fromId, toId);
    return { success: true, message: 'Assignments moved successfully' };
  }

  @Get(':id/load')
  async getTeacherLoad(@Param('id') id: string) {
    return this.teachersService.getTeacherLoad(id);
  }
}
