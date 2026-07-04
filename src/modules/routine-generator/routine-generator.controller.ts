import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { RoutineGeneratorService } from './routine-generator.service';

@Controller('routine-generator')
export class RoutineGeneratorController {
  constructor(private readonly generatorService: RoutineGeneratorService) {}

  @Get('status')
  getStatus() {
    return this.generatorService.getProgress();
  }

  @Post('start')
  async start(
    @Body('semester_id') semesterId: string,
    @Body('resolve_conflicts') resolveConflicts?: boolean,
  ) {
    await this.generatorService.start(semesterId, resolveConflicts !== false);
    return { success: true, message: 'Generation started' };
  }

  @Post('pause')
  pause() {
    this.generatorService.pause();
    return { success: true, message: 'Generation paused' };
  }

  @Post('resume')
  resume() {
    this.generatorService.resume();
    return { success: true, message: 'Generation resumed' };
  }

  @Post('stop')
  stop() {
    this.generatorService.stop();
    return { success: true, message: 'Generation stopped' };
  }
}
