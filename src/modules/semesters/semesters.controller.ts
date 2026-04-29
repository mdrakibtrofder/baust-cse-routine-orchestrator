import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { SemestersService } from './semesters.service';
import { CreateSemesterDto } from '../../dtos/semester.dto';
import { UpdateSemesterDto } from '../../dtos/update-dtos/update-semester.dto';

@Controller('semesters')
export class SemestersController {
  constructor(private readonly semestersService: SemestersService) {}

  @Get()
  findAll() {
    return this.semestersService.findAll();
  }

  @Get('active')
  findActive() {
    return this.semestersService.findActive();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.semestersService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateSemesterDto) {
    return this.semestersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSemesterDto) {
    return this.semestersService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.semestersService.delete(id);
  }
}
