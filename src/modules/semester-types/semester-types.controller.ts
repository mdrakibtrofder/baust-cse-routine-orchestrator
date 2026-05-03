import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { SemesterTypesService } from './semester-types.service';
import { CreateSemesterTypeDto } from '../../dtos/semester-type/create-semester-type.dto';

@Controller('semester-types')
export class SemesterTypesController {
  constructor(private readonly typesService: SemesterTypesService) {}

  @Get()
  findAll() {
    return this.typesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.typesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSemesterTypeDto) {
    return this.typesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CreateSemesterTypeDto) {
    return this.typesService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.typesService.delete(id);
  }
}
