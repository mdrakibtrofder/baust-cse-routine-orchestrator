import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SchemaMigrationsService } from './schema-migrations.service';

@Controller('schema-migrations')
export class SchemaMigrationsController {
  constructor(private readonly schemaMigrationsService: SchemaMigrationsService) {}

  @Get('logs')
  getLogs(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit);
    return this.schemaMigrationsService.getRecentLogs(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100);
  }

  @Post('semesters/:id/retry')
  retry(@Param('id') semesterId: string) {
    return this.schemaMigrationsService.retryProvisioning(semesterId);
  }
}
