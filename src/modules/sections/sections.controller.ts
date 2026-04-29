import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from '../../dtos/section.dto';
import { UpdateSectionDto } from '../../dtos/update-dtos/update-section.dto';

@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Get()
  findAll(@Query('level') level?: number, @Query('term') term?: 'I' | 'II') {
    return this.sectionsService.findAll(level ? Number(level) : undefined, term);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.sectionsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateSectionDto) {
    return this.sectionsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.sectionsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.sectionsService.delete(id);
  }
}
