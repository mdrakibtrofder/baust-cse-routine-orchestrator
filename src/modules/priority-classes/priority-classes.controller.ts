import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { PriorityClassesService } from './priority-classes.service';
import { CreatePriorityClassDto } from '../../dtos/priority-class.dto';
import { UpdatePriorityClassDto } from '../../dtos/update-priority-class.dto';

@Controller('priority-classes')
export class PriorityClassesController {
  constructor(private readonly priorityClassesService: PriorityClassesService) {}

  @Get()
  findAll(@Query('semester_id') semesterId?: string) {
    return this.priorityClassesService.findAll(semesterId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.priorityClassesService.findById(id);
  }

  @Post()
  create(@Body() dto: CreatePriorityClassDto) {
    return this.priorityClassesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePriorityClassDto) {
    return this.priorityClassesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.priorityClassesService.delete(id);
  }
}
