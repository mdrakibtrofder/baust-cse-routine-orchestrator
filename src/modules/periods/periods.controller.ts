import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { PeriodsService } from './periods.service';
import { CreatePeriodDto } from '../../dtos/period.dto';
import { UpdatePeriodDto } from '../../dtos/update-dtos/update-period.dto';

@Controller('periods')
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Get()
  findAll(@Query('kind') kind?: 'theory' | 'sessional') {
    return this.periodsService.findAll(kind);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.periodsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreatePeriodDto) {
    return this.periodsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePeriodDto) {
    return this.periodsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.periodsService.delete(id);
  }
}
