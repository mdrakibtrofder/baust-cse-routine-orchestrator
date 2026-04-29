import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { DaysService } from './days.service';

@Controller('days')
export class DaysController {
  constructor(private readonly daysService: DaysService) {}

  @Get()
  findAll() {
    return this.daysService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.daysService.findById(id);
  }

  @Post()
  create(@Body('name') name: string) {
    return this.daysService.create(name);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.daysService.delete(id);
  }
}
