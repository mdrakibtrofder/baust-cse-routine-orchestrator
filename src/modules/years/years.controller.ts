import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { YearsService } from './years.service';
import { CreateYearDto } from '../../dtos/year/create-year.dto';

@Controller('years')
export class YearsController {
  constructor(private readonly yearsService: YearsService) {}

  @Get()
  findAll() {
    return this.yearsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.yearsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateYearDto) {
    return this.yearsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CreateYearDto) {
    return this.yearsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.yearsService.delete(id);
  }
}
