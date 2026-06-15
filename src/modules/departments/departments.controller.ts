import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from '../../dtos/department.dto';
import { UpdateDepartmentDto } from '../../dtos/update-dtos/update-department.dto';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.departmentsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.departmentsService.delete(id);
  }
}
